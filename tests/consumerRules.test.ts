import { describe, it, expect } from "vitest";
import { checkLimitation, checkForum } from "@/lib/legal/consumerRules";
import { emptyCase, type CaseFile } from "@/lib/schemas";
import { FX_R3, FX_S34, FX_S69 } from "./fixtures";

const verified = new Map([FX_S69, FX_S34, FX_R3].map((e) => [e.id, e]));
const withFacts = (facts: CaseFile["facts"]): CaseFile => ({ ...emptyCase(), domain: "consumer", facts });
const today = new Date(Date.UTC(2026, 10, 21));

describe("checkLimitation (s.69)", () => {
  it("refuses to compute when the provision is not verified", () => {
    const c = withFacts({ purchase_date: { value: "2026-01-01", source: "user_stated" } });
    expect(checkLimitation(c, today, new Map()).status).toBe("rule_not_verified");
  });

  it("within / near / possibly outside, with condonation explained", () => {
    const f = (d: string) => checkLimitation(withFacts({ purchase_date: { value: d, source: "user_stated" } }), today, verified);
    expect(f("2026-01-10").status).toBe("within");
    expect(f("2025-01-25").status).toBe("near_deadline");
    const late = f("2024-01-01");
    expect(late.status).toBe("possibly_outside");
    expect(late.message).toMatch(/69\(2\)/);
    expect(late.message).toMatch(/sufficient cause/);
    expect(late.message).not.toMatch(/time-barred/i);
  });

  it("unknown without an exact date", () => {
    const c = withFacts({ purchase_date: { value: "last year", source: "user_stated" } });
    expect(checkLimitation(c, today, verified).status).toBe("unknown");
  });
});

describe("checkForum (consideration paid, not compensation)", () => {
  it("uses amount paid only, ignoring compensation claimed", () => {
    const c = withFacts({
      amount_paid: { value: "30000", source: "user_stated" },
      relief_wanted: { value: "compensation of 90 lakh", source: "user_stated" },
    });
    const r = checkForum(c, verified);
    expect(r.status).toBe("district");
    expect(r.message).toMatch(/not on the compensation/);
  });

  it("above the district limit", () => {
    expect(checkForum(withFacts({ amount_paid: { value: "6000000", source: "user_stated" } }), verified).status).toBe("state");
  });

  it("unknown amount / unverified rule", () => {
    expect(checkForum(withFacts({}), verified).status).toBe("unknown_amount");
    expect(checkForum(withFacts({ amount_paid: { value: "30000", source: "user_stated" } }), new Map()).status).toBe("rule_not_verified");
  });
});
