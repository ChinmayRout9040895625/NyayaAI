import { describe, it, expect, afterEach } from "vitest";
import { getProvider, providerStatus } from "@/lib/llm";

const KEYS = ["LLM_PROVIDER", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("provider selection (no network)", () => {
  it("anthropic without a key reports which variable to set", () => {
    process.env.LLM_PROVIDER = "anthropic";
    delete process.env.ANTHROPIC_API_KEY;
    const s = providerStatus();
    expect(s.configured).toBe(false);
    expect(s.message).toContain("ANTHROPIC_API_KEY");
  });

  it("anthropic with a key builds the Anthropic provider, defaulting to claude-opus-4-6", () => {
    process.env.LLM_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    delete process.env.ANTHROPIC_MODEL;
    const p = getProvider();
    expect(p.name).toBe("anthropic");
    expect(p.model).toBe("claude-opus-4-6");
  });

  it("gemini stays the default provider", () => {
    delete process.env.LLM_PROVIDER;
    process.env.GEMINI_API_KEY = "test-key-not-real";
    expect(getProvider().name).toBe("gemini");
  });

  it("an unknown provider is reported, not silently replaced", () => {
    process.env.LLM_PROVIDER = "other";
    const s = providerStatus();
    expect(s.configured).toBe(false);
    expect(s.message).toMatch(/not implemented/);
  });
});
