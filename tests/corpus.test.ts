import { describe, it, expect } from "vitest";
import { CORPUS, isCitable } from "@/lib/knowledge/corpus";
import { CorpusEntry } from "@/lib/schemas";
import { fixture } from "./fixtures";

describe("corpus", () => {
  it("every entry passes schema + official-host allow-list", () => {
    for (const e of CORPUS) expect(CorpusEntry.safeParse(e).success, e.id).toBe(true);
  });

  it("in_force entries have verbatim text, all checks and a verification date", () => {
    for (const e of CORPUS.filter((x) => x.status === "in_force")) {
      expect(e.text_type).toBe("verbatim");
      expect(e.verified_on).toBeTruthy();
      expect(Object.values(e.verification_checks).every(Boolean)).toBe(true);
    }
  });

  it("rejects unofficial hosts and incomplete in_force entries", () => {
    const longText = "some long enough text here for the check";
    expect(CorpusEntry.safeParse(fixture("X-1", "1", longText, { source_url: "https://indiankanoon.org/doc/1/" })).success).toBe(false);
    expect(
      CorpusEntry.safeParse(
        fixture("X-2", "1", longText, {
          verification_checks: { text_verbatim: true, section_number: true, amendments: false, commencement: true, applicability: true },
        }),
      ).success,
    ).toBe(false);
  });

  it("the enacted 'one crore' limit in s.34(1) and the unverified Jurisdiction Rules are not citable", () => {
    const byId = new Map(CORPUS.map((e) => [e.id, e]));
    expect(isCitable(byId.get("CPA2019-S34-1"))).toBe(false);
    expect(isCitable(byId.get("JR2021-R3"))).toBe(false);
    for (const e of CORPUS.filter(isCitable)) expect(e.text).not.toMatch(/one crore/);
  });

  it("verified texts contain the phrases the deterministic rules rely on", () => {
    const s69 = CORPUS.find((e) => e.id === "CPA2019-S69")!;
    expect(isCitable(s69)).toBe(true);
    for (const p of ["two years", "cause of action", "sufficient cause", "records its reasons for condoning"]) expect(s69.text).toContain(p);
    const s27 = CORPUS.find((e) => e.id === "CPA2019-S2-7")!;
    expect(s27.text).toContain("commercial purpose");
    expect(s27.text).toContain("self-employment");
  });

  it("model law / repealed / verify entries are never citable", () => {
    for (const e of CORPUS.filter((x) => x.status !== "in_force")) expect(isCitable(e)).toBe(false);
  });
});
