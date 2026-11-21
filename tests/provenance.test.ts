import { describe, it, expect } from "vitest";
import { dateMentioned } from "@/lib/pipeline/text";
import { mergeCase, detectEvidence } from "@/lib/pipeline/mergeCase";
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

describe("dateMentioned (demo flaw 6)", () => {
  it("recognises dates the user actually wrote", () => {
    expect(dateMentioned("I bought it on 2026-10-05.", "2026-10-05")).toBe(true);
    expect(dateMentioned("bought on 5/10/2026", "2026-10-05")).toBe(true);
    expect(dateMentioned("on 5th October 2026", "2026-10-05")).toBe(true);
    expect(dateMentioned("Oct 5, 2026", "2026-10-05")).toBe(true);
    expect(dateMentioned("5 अक्टूबर को खरीदा", "2026-10-05")).toBe(true);
    expect(dateMentioned("in March 2026", "2026-03")).toBe(true);
  });
  it("rejects dates the model worked out", () => {
    expect(dateMentioned("It stopped working after 10 days.", "2026-10-15")).toBe(false);
    expect(dateMentioned("last month", "2026-10")).toBe(false);
    expect(dateMentioned("he changed the locks today", "2026-11-21")).toBe(false);
    expect(dateMentioned("on 15 October", "2026-10-05")).toBe(false); // different day
  });
});

describe("timeline date provenance (demo flaw 6)", () => {
  const userText = "I bought a mixer from HomeKart on 2026-10-05. It stopped working after 10 days.";
  it("event quote may be the user's while the date is marked as worked out by the AI", () => {
    const c = mergeCase(
      emptyCase(),
      {
        ...base,
        timeline: [
          { date: "2026-10-05", event: "Purchase", quote: "I bought a mixer from HomeKart on 2026-10-05" },
          { date: "2026-10-15", event: "Stopped working", quote: "It stopped working after 10 days" },
        ],
      },
      userText,
    );
    const [buy, broke] = c.timeline;
    expect(buy.date_source).toBe("user_stated");
    expect(broke.source).toBe("user_stated"); // the event is in the user's words
    expect(broke.date_source).toBe("inferred"); // the date is not
  });
  it("a purchase date the user did not write becomes inferred even if the model claims user_stated", () => {
    const c = mergeCase(
      emptyCase(),
      { ...base, extracted: [{ field: "purchase_date", value: "2026-10-21", source: "user_stated", quote: "last month" }] },
      "I bought it last month",
    );
    expect(c.facts.purchase_date.source).toBe("inferred");
  });
});

describe("evidence detection (demo flaw 8)", () => {
  it("recognises complaint emails, chats and ticket numbers in English, Hinglish and Hindi", () => {
    expect(detectEvidence("I emailed them on 2026-10-20 and they replied it was misuse.").map((d) => d.key)).toContain("complaint_records");
    expect(detectEvidence("Maine company ko email kiya tha par jawab nahi aaya.").map((d) => d.key)).toContain("complaint_records");
    expect(detectEvidence("मैंने कंपनी को ईमेल किया था।").map((d) => d.key)).toContain("complaint_records");
    expect(detectEvidence("My ticket no. 48213 is still open.").map((d) => d.key)).toContain("complaint_records");
    expect(detectEvidence("Order ID is ABC123").map((d) => d.key)).toContain("order_confirmation");
  });
  it("ignores negated mentions", () => {
    expect(detectEvidence("I have not emailed them yet.")).toEqual([]);
    expect(detectEvidence("Maine mail nahi kiya.")).toEqual([]);
  });
  it("fills gaps the model left but never overrides the model's recorded evidence", () => {
    const text = "I emailed them on 2026-10-20 and they replied that the damage was due to misuse. I have the invoice.";
    const c = mergeCase(
      emptyCase(),
      { ...base, evidence_mentioned: [{ key: "written_refusal", has: true, quote: "they replied that the damage was due to misuse" }] },
      text,
    );
    expect(c.evidence.complaint_records?.state).toBe("have");
    expect(c.evidence.written_refusal?.state).toBe("have");
    const c2 = mergeCase(emptyCase(), { ...base, evidence_mentioned: [{ key: "complaint_records", has: false, quote: "I emailed them" }] }, text);
    expect(c2.evidence.complaint_records?.state).toBe("missing");
  });
});
