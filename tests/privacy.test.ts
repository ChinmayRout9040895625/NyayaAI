import { describe, it, expect } from "vitest";
import { privacyNotice } from "@/lib/privacy";

describe("provider-specific privacy notice", () => {
  it("Anthropic: names Anthropic, not Google, and links Anthropic's terms", () => {
    const n = privacyNotice("anthropic");
    expect(n.processor).toMatch(/Anthropic/);
    expect(`${n.processor} ${n.dataUse}`).not.toMatch(/Google|Gemini/);
    expect(n.dataUse).toMatch(/not used to train/);
    expect(n.termsUrl).toContain("anthropic.com");
  });

  it("Gemini: names Google and the free-tier data use", () => {
    const n = privacyNotice("gemini");
    expect(n.processor).toMatch(/Google/);
    expect(n.dataUse).toMatch(/free tier/);
    expect(`${n.processor} ${n.dataUse}`).not.toMatch(/Anthropic|Claude/);
    expect(n.termsUrl).toContain("ai.google.dev");
  });

  it("unknown provider: makes no specific claim", () => {
    const n = privacyNotice("other");
    expect(n.processor).toBe("the configured AI provider");
    expect(n.termsUrl).toBe("");
  });
});
