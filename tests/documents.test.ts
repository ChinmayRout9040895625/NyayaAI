import { describe, it, expect } from "vitest";
import { renderLegalNotice, renderComplaint, countPlaceholders, EMPTY_PARTIES } from "@/lib/documents/templates";
import { emptyCase, type CaseFile } from "@/lib/schemas";

const c: CaseFile = {
  ...emptyCase(),
  domain: "consumer",
  facts: {
    trader_name: { value: "ShopKart", source: "user_stated" },
    product_or_service: { value: "washing machine", source: "user_stated" },
    amount_paid: { value: "24500", source: "inferred" },
  },
};
const today = new Date(Date.UTC(2026, 10, 21));

describe("document templates", () => {
  it("marks every missing or inferred item and invents no names or sections", () => {
    const md = renderLegalNotice({ caseFile: c, parties: EMPTY_PARTIES, sources: [], rules: [], evidenceHave: [], today });
    const n = countPlaceholders(md);
    expect(n.missing).toBeGreaterThan(5);
    expect(n.confirm).toBe(1); // inferred amount
    expect(md).toContain("ShopKart");
    expect(md).toContain("₹24,500");
    expect(md).not.toMatch(/Section \d/); // no verified sources supplied -> no sections
    expect(md).toContain("[[MISSING: legal basis");
    expect(md).toContain("not legal advice");
  });

  it("lists only supplied verified sources", () => {
    const md = renderComplaint({
      caseFile: c,
      parties: { ...EMPTY_PARTIES, complainant_name: "Test User" },
      sources: [{ act: "Consumer Protection Act, 2019", section: "69", title: "Limitation period" }],
      rules: [],
      evidenceHave: ["Invoice / bill / receipt"],
      today,
    });
    expect(md).toContain("Section 69 of the Consumer Protection Act, 2019");
    expect(md.match(/Section \d+/g)).toHaveLength(1);
    expect(md).toContain("Test User");
  });
});
