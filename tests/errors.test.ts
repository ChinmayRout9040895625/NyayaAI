import { describe, it, expect, afterEach } from "vitest";
import { describeProviderError, humanizeRetry, isDailyQuota } from "@/lib/llm/errors";
import { providerStatus } from "@/lib/llm";

// Shape of the real Gemini 429 text recorded in test-outputs/2026-11-21T04-06-27 (scenario 07).
const DAILY =
  "Gemini HTTP 429: You exceeded your current quota, please check your plan and billing details. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash, description: Generate content requests per day limit exceeded on Free Tier. Please retry in 3h48m20.885980456s.";
const PER_MINUTE = "Gemini HTTP 429: Quota exceeded for metric: generate_content_free_tier_requests per minute. Please retry in 42.5s.";

describe("quota messages (demo flaw 4)", () => {
  it("humanises Google's retry delay", () => {
    expect(humanizeRetry("3h48m20.885980456s")).toBe("about 3 h 48 min");
    expect(humanizeRetry("42.5s")).toBe("about 43 s");
    expect(humanizeRetry("1m5s")).toBe("about 1 min 5 s");
    expect(humanizeRetry("soon")).toBeUndefined();
  });

  it("a daily quota says daily, gives the reset time and does not say 'wait a minute'", () => {
    expect(isDailyQuota(DAILY)).toBe(true);
    const d = describeProviderError(DAILY, "gemini-3.5-flash");
    expect(d.code).toBe("QUOTA_DAILY");
    expect(d.message).toMatch(/daily/);
    expect(d.message).toContain("about 3 h 48 min");
    expect(d.message).toContain("gemini-3.5-flash");
    expect(d.message).not.toMatch(/wait a minute and try again/);
  });

  it("a per-minute limit is reported as a short wait", () => {
    expect(isDailyQuota(PER_MINUTE)).toBe(false);
    const d = describeProviderError(PER_MINUTE);
    expect(d.code).toBe("RATE_LIMITED");
    expect(d.message).toContain("about 43 s");
  });

  it("overload and timeout are distinguished", () => {
    expect(describeProviderError("Gemini HTTP 503: high demand").code).toBe("OVERLOADED");
    expect(describeProviderError("This operation was aborted").code).toBe("TIMEOUT");
  });
});

describe("not-configured message (demo flaw 5)", () => {
  const saved = process.env.GEMINI_API_KEY;
  afterEach(() => {
    if (saved === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved;
  });
  it("does not repeat the 'AI provider not configured' heading the UI already shows", () => {
    process.env.GEMINI_API_KEY = "";
    const s = providerStatus();
    expect(s.configured).toBe(false);
    expect(s.message).not.toMatch(/not configured/i);
    expect(s.message).toContain("GEMINI_API_KEY");
  });
});
