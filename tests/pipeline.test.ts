import { describe, it, expect } from "vitest";
import { runTurn, TurnError } from "@/lib/pipeline/chat";
import type { GenerateJSONOptions, LLMProvider } from "@/lib/llm/types";

/** Fake provider: returns canned objects in order. No network. */
function fake(outputs: unknown[]): LLMProvider {
  let i = 0;
  return {
    name: "fake",
    model: "fake-1",
    async generateJSON<T>(opts: GenerateJSONOptions<T>) {
      const o = outputs[i++];
      if (o instanceof Error) throw o;
      return { data: opts.schema.parse(o), raw: JSON.stringify(o), attempts: 1 };
    },
  };
}

const understanding = (over: object = {}) => ({
  domain: "consumer",
  domain_confidence: 0.9,
  language: "en",
  extracted: [],
  timeline: [],
  evidence_mentioned: [],
  search_terms: ["refund"],
  user_wants_analysis: false,
  acknowledgement: "Sorry to hear that.",
  ...over,
});

describe("runTurn", () => {
  it("keeps deterministic escalation when the model fails (regression from eval 10)", async () => {
    const p = fake([Object.assign(new Error("Gemini HTTP 503: overloaded"), { name: "Error" })]);
    const err = await runTurn({ provider: p, messages: [{ role: "user", content: "Landlord changed the locks and threatened me" }] }).catch((e) => e);
    expect(err).toBeInstanceOf(TurnError);
    expect((err as TurnError).escalation.level).toBe("urgent");
  });

  it("asks follow-ups when core facts are missing", async () => {
    const r = await runTurn({ provider: fake([understanding()]), messages: [{ role: "user", content: "my refund did not come" }] });
    expect(r.stage).toBe("followup");
    expect(r.followups.length).toBe(2);
    expect(r.meta.llm_calls).toBe(1);
  });

  it("routes tenancy to the fixed stub without legal claims", async () => {
    const r = await runTurn({
      provider: fake([understanding({ domain: "tenancy" })]),
      messages: [{ role: "user", content: "landlord keeps my deposit" }],
    });
    expect(r.stage).toBe("stub");
    expect(r.reply).toMatch(/not verified your state's law/);
    expect(r.sources).toHaveLength(0);
  });

  it("runs analysis with verified provisions and strips an invented section", async () => {
    const msg = "I bought a mixer from ShopKart for Rs 2,000 on 2026-10-01. It is defective. I emailed them and they refused. I want a refund.";
    const u = understanding({
      user_wants_analysis: true,
      extracted: [
        { field: "trader_name", value: "ShopKart", source: "user_stated", quote: "from ShopKart" },
        { field: "product_or_service", value: "mixer", source: "user_stated", quote: "a mixer" },
        { field: "amount_paid", value: "2000", source: "user_stated", quote: "Rs 2,000" },
        { field: "purchase_date", value: "2026-10-01", source: "user_stated", quote: "2026-10-01" },
        { field: "problem_description", value: "defective", source: "user_stated", quote: "It is defective" },
        { field: "prior_complaint", value: "emailed, refused", source: "user_stated", quote: "I emailed them and they refused" },
      ],
    });
    const analysis = {
      issue_summary: "Defective mixer.",
      claims: [
        { text: "Section 69 gives two years.", type: "verified_law", provision_id: "CPA2019-S69", support_quote: "within two years from the date on which the cause of action has arisen" },
        { text: "Section 12 lets you claim triple damages.", type: "verified_law", provision_id: "CPA2019-S12", support_quote: "triple damages are payable" },
      ],
      options: [],
      next_steps: ["Send a notice."],
      uncertainties: [],
      lawyer_recommended: false,
      lawyer_reason: "",
      reply: "Under Section 69 you have two years. Section 12 gives triple damages.",
    };
    const r = await runTurn({ provider: fake([u, analysis]), messages: [{ role: "user", content: msg }], today: new Date(Date.UTC(2026, 10, 21)) });
    expect(r.stage).toBe("analysis");
    expect(r.analysis!.claims.map((c) => c.status)).toEqual(["source_matched", "downgraded"]);
    expect(r.reply).toContain("Section 69");
    expect(r.reply).not.toContain("Section 12");
    expect(r.rules!.find((x) => x.provision_ids.includes("CPA2019-S69"))!.status).toBe("within");
    expect(r.sources.find((s) => s.id === "CPA2019-S69")!.used_in_claim).toBe(true);
  });
});
