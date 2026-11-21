import { describe, it, expect } from "vitest";
import { parseAmounts, containsQuote, parseIsoDate } from "@/lib/pipeline/text";

describe("parseAmounts", () => {
  it("parses rupee formats", () => {
    expect(parseAmounts("I paid ₹45,999 for it")).toContain(45999);
    expect(parseAmounts("around 45k")).toContain(45000);
    expect(parseAmounts("1.2 lakh ka phone")).toContain(120000);
    expect(parseAmounts("Rs. 899 only")).toContain(899);
    expect(parseAmounts("15 हज़ार दिए")).toContain(15000);
  });
  it("does not read a following Hinglish word as a unit (regression from eval 02)", () => {
    expect(parseAmounts("ek phone liya tha 18,999 ka")).toEqual([18999]);
    expect(parseAmounts("5 crore ka ghar")).toEqual([50000000]);
    expect(parseAmounts("2 lakhs")).toEqual([200000]);
  });
});

describe("containsQuote", () => {
  it("matches ignoring case/punctuation/whitespace", () => {
    expect(containsQuote("I ordered a Phone on 3rd March!", "ordered a phone on 3rd march")).toBe(true);
    expect(containsQuote("I ordered a phone", "I bought a laptop")).toBe(false);
    expect(containsQuote("abc", "")).toBe(false);
  });
});

describe("parseIsoDate", () => {
  it("accepts yyyy-mm-dd and yyyy-mm only", () => {
    expect(parseIsoDate("2025-03-04")?.toISOString().slice(0, 10)).toBe("2025-03-04");
    expect(parseIsoDate("2025-03")?.toISOString().slice(0, 10)).toBe("2025-03-01");
    expect(parseIsoDate("last month")).toBeNull();
  });
});
