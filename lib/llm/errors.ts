/**
 * Turns a provider error message into an honest user-facing message.
 * Gemini's 429 text says whether the exhausted quota is per DAY or per minute and includes
 * "Please retry in 3h48m20.88s" – we report exactly that instead of a generic "wait a minute".
 */

export interface ProviderErrorInfo {
  code: "QUOTA_DAILY" | "RATE_LIMITED" | "OVERLOADED" | "TIMEOUT" | "AI_ERROR";
  message: string;
  retryAfter?: string; // human readable, from the provider (e.g. "about 3 h 48 min")
}

/** "3h48m20.885s" → "about 3 h 48 min"; "42.5s" → "about 43 s"; "1m5s" → "about 1 min 5 s". */
export function humanizeRetry(raw: string): string | undefined {
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Math.round(Number(m[3] ?? 0));
  if (h) return `about ${h} h${min ? ` ${min} min` : ""}`;
  if (min) return `about ${min} min${s ? ` ${s} s` : ""}`;
  return `about ${s} s`;
}

export function isDailyQuota(msg: string): boolean {
  return /HTTP 429/.test(msg) && /(per\s*day|PerDay|requests per day|daily)/i.test(msg);
}

export function describeProviderError(msg: string, model?: string): ProviderErrorInfo {
  // "Please retry in 3h48m20.88s." – drop the sentence's trailing full stop before parsing
  const retryRaw = msg.match(/retry in\s+([0-9hms.]+)/i)?.[1]?.replace(/\.+$/, "");
  const retryAfter = retryRaw ? humanizeRetry(retryRaw) : undefined;
  const m = model ? ` (${model})` : "";
  if (isDailyQuota(msg)) {
    return {
      code: "QUOTA_DAILY",
      retryAfter,
      message:
        `The free daily AI quota for this model${m} has been used up. ` +
        (retryAfter ? `Google reports it resets in ${retryAfter}. ` : "It resets after Google's daily quota period. ") +
        "Waiting a minute will not help. You can try again after the reset, or the app owner can switch to another model (GEMINI_MODEL).",
    };
  }
  if (/HTTP 429/.test(msg)) {
    return {
      code: "RATE_LIMITED",
      retryAfter,
      message: `Too many AI requests in a short time${m}. ` + (retryAfter ? `Please try again in ${retryAfter}.` : "Please wait a minute and try again."),
    };
  }
  if (/HTTP 503/.test(msg)) {
    return { code: "OVERLOADED", message: `The AI service${m} is overloaded right now. Please try again in a moment.` };
  }
  if (/abort/i.test(msg)) {
    return { code: "TIMEOUT", message: `The AI service${m} took too long to answer. Please try again.` };
  }
  return { code: "AI_ERROR", message: `The AI provider returned an error (${msg.slice(0, 160)}). Please try again.` };
}
