import { describe, it, expect } from "vitest";
import { mergeCase } from "@/lib/pipeline/mergeCase";
import { emptyCase, type Understanding } from "@/lib/schemas";

const base: Understanding = {
  domain: "consumer",
  domain_confidence: 0.9,
  language: "en",
  extracted: [],
  timeline: [],
  evidence_mentioned: [],
  search_terms: [],
  user_wants_analysis: false,
  acknowledgement: "",
};
const userText = "I bought a washing machine from ShopKart for Rs 24,500 on 2026-05-10. I have the invoice.";

describe("mergeCase", () => {
  it("keeps user_stated only when the quote is in the user's text", () => {
    const c = mergeCase(
      emptyCase(),
      {
        ...base,
        extracted: [
          { field: "trader_name", value: "ShopKart", source: "user_stated", quote: "from ShopKart" },
          { field: "relief_wanted", value: "refund", source: "user_stated", quote: "I want a refund" },
        ],
      },
      userText,
    );
    expect(c.facts.trader_name.source).toBe("user_stated");
    expect(c.facts.relief_wanted.source).toBe("inferred");
  });

  it("marks amounts not present in user text as inferred", () => {
    const bad = mergeCase(emptyCase(), { ...base, extracted: [{ field: "amount_paid", value: "25000", source: "user_stated", quote: "Rs 24,500" }] }, userText);
    expect(bad.facts.amount_paid.value).toBe("25000");
    expect(bad.facts.amount_paid.source).toBe("inferred");
    const ok = mergeCase(emptyCase(), { ...base, extracted: [{ field: "amount_paid", value: "24500", source: "user_stated", quote: "Rs 24,500" }] }, userText);
    expect(ok.facts.amount_paid.source).toBe("user_stated");
  });

  it("inferred facts never overwrite user-stated facts", () => {
    const c1 = mergeCase(emptyCase(), { ...base, extracted: [{ field: "trader_name", value: "ShopKart", source: "user_stated", quote: "from ShopKart" }] }, userText);
    const c2 = mergeCase(c1, { ...base, extracted: [{ field: "trader_name", value: "OtherCo", source: "inferred", quote: "" }] }, userText);
    expect(c2.facts.trader_name.value).toBe("ShopKart");
  });

  it("ignores unknown fields and records only quoted evidence", () => {
    const c = mergeCase(
      emptyCase(),
      {
        ...base,
        extracted: [{ field: "aadhaar_number", value: "x", source: "user_stated", quote: "invoice" }],
        evidence_mentioned: [
          { key: "invoice", has: true, quote: "I have the invoice" },
          { key: "product_photos", has: true, quote: "photos taken" },
        ],
      },
      userText,
    );
    expect(c.facts.aadhaar_number).toBeUndefined();
    expect(c.evidence.invoice?.state).toBe("have");
    expect(c.evidence.product_photos).toBeUndefined();
  });
});
