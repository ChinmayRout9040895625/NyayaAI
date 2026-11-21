import Anthropic from "@anthropic-ai/sdk";
import { safeParseJSON } from "./gemini";
import { LLMOutputError, type GenerateJSONOptions, type GenerateJSONResult, type LLMProvider } from "./types";

/**
 * Anthropic Claude provider (official SDK). Same contract as the Gemini provider:
 * JSON-only output, validated with the caller's Zod schema, one repair retry.
 * Prefill is not supported on Claude 4.6+ models, so JSON is requested by instruction and validated by code.
 */

// Pipeline effort hints -> Opus 4.6 effort levels (low | medium | high | max).
const EFFORT: Record<NonNullable<GenerateJSONOptions<unknown>["effort"]>, "low" | "medium" | "high"> = {
  minimal: "low", // intake / extraction
  low: "medium", // legal analysis
  high: "high",
};

/** Models that accept the server-side refusal fallback ("default" mode). */
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-2", "claude-fable-5-1"]);

const JSON_ONLY = "\n\nOutput format: respond with ONLY the JSON object described above. No prose before or after it, no Markdown code fences.";

/** Convert SDK errors into the "HTTP nnn" form the app's error messages and retry logic already understand. */
function toProviderError(e: unknown): Error {
  if (e instanceof Anthropic.APIConnectionTimeoutError) return Object.assign(new Error("Anthropic request aborted (timeout)"), { name: "AbortError" });
  if (e instanceof Anthropic.APIError) {
    const msg = (e.message || "").replace(/\s+/g, " ").slice(0, 300);
    // 529 = Anthropic "overloaded"; report it like Gemini's 503 so the app shows the overload message
    const status = e.status === 529 ? 503 : e.status;
    return new Error(`Anthropic HTTP ${status ?? "?"}: ${msg}`);
  }
  return e instanceof Error ? e : new Error(String(e));
}

/** The JSON object may occasionally be wrapped in a fence or a sentence; take the outermost {...}. */
function extractJSON(text: string): string {
  const t = text.trim();
  if (t.startsWith("{")) return t;
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    // SDK retries 408/409/429/5xx itself (maxRetries); the timeout keeps an analysis turn inside the 60 s route budget.
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 55_000 });
  }

  async generateJSON<T>(opts: GenerateJSONOptions<T>): Promise<GenerateJSONResult<T>> {
    const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
    let lastRaw = "";
    let lastErr = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const turn: Anthropic.MessageParam[] =
        attempt === 1
          ? messages
          : [
              ...messages,
              { role: "assistant", content: lastRaw || "{}" },
              { role: "user", content: `Your previous output was not valid for the required JSON schema: ${lastErr.slice(0, 800)}. Return ONLY corrected JSON.` },
            ];
      let response: Anthropic.Message;
      try {
        const params = {
          model: this.model,
          max_tokens: 16000,
          system: opts.system + JSON_ONLY,
          messages: turn,
          thinking: { type: "adaptive" as const },
          output_config: { effort: EFFORT[opts.effort ?? "low"] },
        };
        response = FALLBACK_MODELS.has(this.model)
          ? // Server-side refusal fallback: if this model's safety classifier declines, the API re-runs the
            // request on a suitable fallback model inside the same call ("default" routes by refusal category).
            ((await this.client.beta.messages.create({
              ...params,
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
            })) as unknown as Anthropic.Message)
          : await this.client.messages.create(params);
      } catch (e) {
        throw toProviderError(e);
      }
      if (response.stop_reason === "refusal") {
        throw new Error(`Anthropic refusal: the model declined this request (${response.stop_details?.category ?? "no category"})`);
      }
      lastRaw = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (response.stop_reason === "max_tokens") {
        lastErr = "output was cut off at max_tokens";
        continue;
      }
      const parsed = safeParseJSON(extractJSON(lastRaw));
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
}
