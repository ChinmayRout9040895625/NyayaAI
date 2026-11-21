import { LLMOutputError, type GenerateJSONOptions, type GenerateJSONResult, type LLMProvider } from "./types";
import { isDailyQuota } from "./errors";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini via REST (no SDK). Output is forced to JSON and validated with Zod; one repair retry. */
export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  constructor(
    private apiKey: string,
    readonly model: string,
    private timeoutMs = 55_000,
  ) {}

  async generateJSON<T>(opts: GenerateJSONOptions<T>): Promise<GenerateJSONResult<T>> {
    const contents = opts.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    let lastRaw = "";
    let lastErr = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const turnContents =
        attempt === 1
          ? contents
          : [
              ...contents,
              { role: "model", parts: [{ text: lastRaw }] },
              {
                role: "user",
                parts: [
                  {
                    text: `Your previous output was not valid for the required JSON schema: ${lastErr.slice(0, 800)}. Return ONLY corrected JSON.`,
                  },
                ],
              },
            ];
      lastRaw = await this.callWithRetry(opts.system, turnContents, opts.temperature ?? 0.2, opts.effort);
      const parsed = safeParseJSON(lastRaw);
      if (parsed.ok) {
        const v = opts.schema.safeParse(parsed.value);
        if (v.success) return { data: v.data, raw: lastRaw, attempts: attempt };
        lastErr = v.error.message;
      } else {
        lastErr = parsed.error;
      }
    }
    throw new LLMOutputError(`Model output failed validation after retry: ${lastErr.slice(0, 300)}`, lastRaw);
  }

  /** Retries once on 503/429 (overload / quota) and drops the thinking setting if the model rejects it. */
  private async callWithRetry(system: string, contents: unknown[], temperature: number, effort?: string): Promise<string> {
    let thinking = effort;
    for (let i = 0; i < 3; i++) {
      try {
        return await this.call(system, contents, temperature, thinking);
      } catch (e) {
        const msg = (e as Error).message;
        if (thinking && /HTTP 400/.test(msg) && /thinking/i.test(msg)) {
          thinking = undefined; // model does not support this level – use its default
          continue;
        }
        // A daily quota will not recover in seconds – retrying only wastes time.
        if (i < 2 && /HTTP (503|429)/.test(msg) && !isDailyQuota(msg)) {
          await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
          continue;
        }
        throw e;
      }
    }
    throw new Error("Gemini: retries exhausted");
  }

  private async call(system: string, contents: unknown[], temperature: number, thinkingLevel?: string): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: {
            temperature,
            responseMimeType: "application/json",
            ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
          },
        }),
        signal: ctrl.signal,
      });
      const body = await res.text();
      if (!res.ok) {
        // Never echo request content or key; status + provider message only.
        let msg = body.slice(0, 300);
        try {
          msg = JSON.parse(body)?.error?.message ?? msg;
        } catch {
          /* keep raw slice */
        }
        throw new Error(`Gemini HTTP ${res.status}: ${msg}`);
      }
      const json = JSON.parse(body);
      const text: string = (json?.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string; thought?: boolean }) => (p.thought ? "" : (p.text ?? "")))
        .join("");
      if (!text) {
        const reason = json?.candidates?.[0]?.finishReason ?? json?.promptFeedback?.blockReason ?? "empty";
        throw new Error(`Gemini returned no text (reason: ${reason})`);
      }
      return text;
    } finally {
      clearTimeout(t);
    }
  }
}

export function safeParseJSON(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1];
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
}
