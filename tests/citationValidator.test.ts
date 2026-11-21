import { describe, it, expect } from "vitest";
import { validateAnalysis, REMOVED } from "@/lib/safety/citationValidator";
import type { AnalysisLLM } from "@/lib/schemas";
import { FX_S69 } from "./fixtures";

const base: AnalysisLLM = {
  issue_summary: "",
  claims: [],
  options: [],
  next_steps: [],
  needs_verification: [],
  uncertainties: [],
  lawyer_recommended: false,
  lawyer_reason: "",
};
// NOTE (prompt v4): the model's free-text "reply" is ignored – the reply is composed by code from validated
// parts – so these tests feed text through the fields the model now uses (next_steps / issue_summary).
const GOOD_QUOTE = "within two years from the date on which the cause of action";

describe("validateAnalysis", () => {
  it("accepts a claim whose quote is in the supplied provision", () => {
    const v = validateAnalysis(
      { ...base, claims: [{ text: "Section 69 sets a time limit.", type: "verified_law", provision_id: "CPA2019-S69", support_quote: GOOD_QUOTE }] },
      [FX_S69],
    );
    expect(v.claims[0].status).toBe("source_matched");
    expect(v.claims[0].text).toContain("Section 69");
  });

  it("downgrades fabricated quotes and unknown provision ids", () => {
    const v = validateAnalysis(
      {
        ...base,
        claims: [
          { text: "x", type: "verified_law", provision_id: "CPA2019-S69", support_quote: "within three years of purchase always" },
          { text: "y", type: "verified_law", provision_id: "CPA2019-S999", support_quote: "anything at all goes here" },
        ],
      },
      [FX_S69],
    );
    expect(v.claims.map((c) => c.status)).toEqual(["downgraded", "downgraded"]);
    expect(v.report.claims_source_matched).toBe(0);
  });

  it("strips sections, Acts and case law that were not verified – and moves the whole sentence", () => {
    const v = validateAnalysis(
      { ...base, next_steps: ["Under Section 420 of the Indian Penal Code and as held in Rajesh Kumar v. State of Delhi, AIR 2019 SC 123, you can sue."] },
      [FX_S69],
    );
    expect(v.reply).not.toMatch(/420|Indian Penal Code|AIR 2019|Rajesh Kumar v\./);
    expect(v.reply).not.toContain(REMOVED); // no sentence left with a hole in it
    expect(v.next_steps).toEqual([]);
    expect(v.needs_verification[0].reason).toBe("invalid_reference");
    expect(v.report.unverified_refs_removed.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps references backed by a matched claim, strips the rest", () => {
    const v = validateAnalysis(
      {
        ...base,
        claims: [{ text: "t", type: "verified_law", provision_id: "CPA2019-S69", support_quote: GOOD_QUOTE }],
        next_steps: ["Section 69 of the Consumer Protection Act, 2019 applies. Section 35 also helps."],
      },
      [FX_S69],
    );
    expect(v.reply).toContain("Section 69 of the Consumer Protection Act, 2019");
    expect(v.reply).not.toContain("Section 35");
  });

  it("strips Hindi section references", () => {
    const v = validateAnalysis({ ...base, next_steps: ["धारा 420 के तहत केस करें"] }, [], { language: "hi" });
    expect(v.reply).not.toContain("420");
  });

  it("flags guarantee language and always states reasoning is unverified", () => {
    const v = validateAnalysis({ ...base, next_steps: ["You will definitely win, 100% guaranteed."] }, []);
    expect(v.report.guarantee_phrases_flagged.length).toBeGreaterThan(0);
    expect(v.report.note).toMatch(/does not confirm/);
  });
});

describe("quote elision and overconfidence", () => {
  it("accepts elided quotes only when every fragment appears in order", async () => {
    const { quoteSupported } = await import("@/lib/safety/citationValidator");
    const t = "A complaint shall be instituted where (a) the opposite party resides; or (d) the complainant resides or personally works for gain.";
    expect(quoteSupported(t, "A complaint shall be instituted [...] the complainant resides or personally works for gain")).toBe(true);
    expect(quoteSupported(t, "the complainant resides or personally works for gain [...] A complaint shall be instituted")).toBe(false); // wrong order
    expect(quoteSupported(t, "A complaint shall be instituted [...] the seller must refund in seven days")).toBe(false); // invented fragment
    expect(quoteSupported(t, "A [...] resides")).toBe(false); // fragments too short
  });
  it("flags overconfident case assessments", () => {
    const v = validateAnalysis({ ...base, issue_summary: "You have a clear case and are in a good position." }, []);
    expect(v.report.guarantee_phrases_flagged).toEqual(expect.arrayContaining(["clear case", "good position"]));
  });
});

describe("guarantee flag false positives (regression from eval 08)", () => {
  it("does not flag a refusal or a guarantee card, but flags a promise", () => {
    expect(validateAnalysis({ ...base, issue_summary: "I cannot provide case citations or guarantees." }, []).report.guarantee_phrases_flagged).toEqual([]);
    expect(validateAnalysis({ ...base, next_steps: ["Keep your warranty or guarantee card."] }, []).report.guarantee_phrases_flagged).toEqual([]);
    expect(validateAnalysis({ ...base, issue_summary: "A refund is guaranteed." }, []).report.guarantee_phrases_flagged.length).toBe(1);
  });
});
