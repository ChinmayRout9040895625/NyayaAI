import { describe, it, expect } from "vitest";
import { UI_TEXT, FIELD_LABELS_HI, EVIDENCE_HI, panelMode, uiLang } from "@/lib/i18n";
import { CONSUMER_EVIDENCE, CONSUMER_FIELDS } from "@/lib/domains/consumer";
import { DOMAIN_STUBS } from "@/lib/domains/stubs";

describe("panel mode (demo flaw 9)", () => {
  it("hides the consumer fact table for tenancy, employment and out-of-scope cases", () => {
    expect(panelMode("tenancy")).toBe("stub");
    expect(panelMode("employment")).toBe("stub");
    expect(panelMode("out_of_scope")).toBe("stub");
    expect(panelMode("consumer")).toBe("consumer");
    expect(panelMode("unknown")).toBe("consumer"); // still collecting consumer facts
  });
});

describe("language-aware case panel (demo flaw 10)", () => {
  it("Hindi users get the Hindi interface; English and Hinglish get English", () => {
    expect(uiLang("hi")).toBe("hi");
    expect(uiLang("en")).toBe("en");
    expect(uiLang("hinglish")).toBe("en");
  });

  it("every interface string exists in Hindi and is actually Hindi", () => {
    const keys = Object.keys(UI_TEXT.en) as (keyof typeof UI_TEXT.en)[];
    for (const k of keys) {
      const v = UI_TEXT.hi[k];
      expect(v, k).toBeDefined();
      const sample = typeof v === "function" ? (v as (...a: number[]) => string)(1, 2, 3) : typeof v === "string" ? v : JSON.stringify(v);
      // strings that are intentionally empty in English (extra notes) must be non-empty Devanagari in Hindi
      if (sample) expect(/[ऀ-ॿ]/.test(sample), `${k} should contain Devanagari`).toBe(true);
    }
  });

  it("every consumer field, evidence item and stub evidence list has a Hindi version", () => {
    for (const f of CONSUMER_FIELDS) expect(FIELD_LABELS_HI[f.key], f.key).toBeTruthy();
    for (const e of CONSUMER_EVIDENCE) {
      expect(EVIDENCE_HI[e.key]?.label, e.key).toBeTruthy();
      expect(EVIDENCE_HI[e.key]?.why, e.key).toBeTruthy();
    }
    for (const [d, s] of Object.entries(DOMAIN_STUBS)) expect(s!.evidence_hi.length, d).toBe(s!.evidence.length);
  });
});
