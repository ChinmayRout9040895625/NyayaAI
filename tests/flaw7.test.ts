/**
 * Flaw 7 regression tests: unsupported legal statements and invented numbers.
 * Inputs are the actual problematic sentences seen in the demos (screenshots in the demo evidence folders)
 * and in the v1 baseline eval run. Provisions are the REAL verified corpus entries.
 */
import { describe, it, expect } from "vitest";
import { validateAnalysis } from "@/lib/safety/citationValidator";
import { CORPUS_BY_ID } from "@/lib/knowledge/corpus";
import { isLegalAssertion, guardNumbers, allowedNumbers, splitSentences } from "@/lib/safety/legalGuard";
import { REPLY_HEADINGS } from "@/lib/safety/composeReply";
import type { AnalysisLLM, CorpusEntry } from "@/lib/schemas";

const P = (id: string) => CORPUS_BY_ID.get(id) as CorpusEntry;
const SUPPLIED = ["CPA2019-S2-7", "CPA2019-S2-10", "CPA2019-S2-11", "CPA2019-S34-2", "CPA2019-S2-47-VIII", "CPA2019-S35-1", "CPA2019-S39-1", "CPA2019-S69"].map(P);
const S69_RULE = { provision_ids: ["CPA2019-S69"], message: "About 1 month(s) have passed. That appears to be within the two-year period in Section 69(1)." };

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

// real quotes from the verified corpus
const Q_DEFECT = '"defect" means any fault, imperfection or shortcoming in the quality';
const Q_UTP = "refusing, after selling goods or rendering services, to take back or withdraw defective goods";
const Q_34_2 = "the complainant resides or personally works for gain";

describe("unsupported legal statements are relabelled, not presented as law (English demo)", () => {
  const userText =
    "I bought a mixer grinder from HomeKart for Rs 4,299 on 2026-10-05. It stopped working after 10 days and the seller is refusing to replace it. I emailed them on 2026-10-20 and they replied that the damage was due to misuse. I live in Nagpur, Maharashtra.";

  it("'you will need to prove the product was faulty' (demo) goes to needs-verification", () => {
    const v = validateAnalysis(
      {
        ...base,
        claims: [{ text: "A defect is a fault in quality.", type: "verified_law", provision_id: "CPA2019-S2-10", support_quote: Q_DEFECT }],
        issue_summary: "Your mixer grinder stopped working and HomeKart refuses to replace it. Since the seller claims 'misuse', you will need to prove the product was faulty.",
        next_steps: ["You can try sending a formal legal notice first, giving them a final chance to replace or refund the item."],
      },
      SUPPLIED,
      { userText, language: "en" },
    );
    expect(v.issue_summary).not.toMatch(/prove/);
    expect(v.needs_verification.map((n) => n.text).join(" ")).toMatch(/prove the product was faulty/);
    expect(v.needs_verification.find((n) => /prove/.test(n.text))?.reason).toBe("unsupported_legal_statement");
    // useful practical guidance is preserved
    expect(v.next_steps[0]).toMatch(/legal notice/);
    // the composed reply keeps the three kinds apart
    const [law, practical, check] = [REPLY_HEADINGS.en.law, REPLY_HEADINGS.en.practical, REPLY_HEADINGS.en.check];
    expect(v.reply.indexOf(law)).toBeLessThan(v.reply.indexOf(practical));
    expect(v.reply.indexOf(practical)).toBeLessThan(v.reply.indexOf(check));
    expect(v.reply.slice(v.reply.indexOf(check))).toMatch(/prove the product was faulty/);
    expect(v.reply.slice(0, v.reply.indexOf(check))).not.toMatch(/prove/);
  });

  it("place-of-filing statement (s.34(2) substance, demo) is kept only when s.34(2) was source-matched", () => {
    const sentence = "You can file this in your own district (Nagpur) or where the seller operates.";
    const without = validateAnalysis({ ...base, next_steps: [sentence] }, SUPPLIED, { userText });
    expect(without.next_steps).toEqual([]);
    expect(without.needs_verification[0].reason).toBe("unsupported_legal_statement");

    const withClaim = validateAnalysis(
      {
        ...base,
        claims: [{ text: "You can file where you reside.", type: "verified_law", provision_id: "CPA2019-S34-2", support_quote: Q_34_2 }],
        next_steps: [sentence],
      },
      SUPPLIED,
      { userText },
    );
    expect(withClaim.next_steps).toEqual([sentence]);
  });

  it("removing an invalid citation moves its whole sentence (demo: 'Section 34(2)' removed but substance left)", () => {
    const v = validateAnalysis({ ...base, next_steps: ["File the complaint in Nagpur under Section 34(2)."] }, SUPPLIED, { userText });
    expect(v.next_steps).toEqual([]);
    expect(v.needs_verification[0]).toMatchObject({ reason: "invalid_reference" });
    expect(v.needs_verification[0].text).toContain("[reference removed]");
    expect(v.reply.split(REPLY_HEADINGS.en.check)[0]).not.toMatch(/Nagpur/);
  });

  it("v1 baseline 'giving them 7 days' – the invented deadline is removed, the advice kept", () => {
    const v = validateAnalysis({ ...base, options: [{ title: "Final notice", description: "Send a final formal email notice to ShopKart giving them 7 days to issue the refund." }] }, SUPPLIED, {
      userText: "I ordered a speaker for Rs 3,499 on 2026-08-14.",
    });
    expect(v.options[0].description).not.toMatch(/7 days/);
    expect(v.options[0].description).toMatch(/a reasonable period/);
    expect(v.report.invented_numbers_removed).toContain("7 days");
  });

  it("invented compensation amounts are removed and the claim relabelled", () => {
    const v = validateAnalysis({ ...base, next_steps: ["You can claim ₹50,000 as compensation for mental harassment."] }, SUPPLIED, { userText });
    expect(v.reply).not.toContain("50,000");
    expect(v.report.invented_numbers_removed.join(" ")).toContain("50,000");
    expect(v.needs_verification[0].reason).toBe("unsupported_legal_statement");
  });
});

describe("supported guidance is preserved", () => {
  it("a verified claim keeps its statutory number ('thirty days' is in s.2(47)(viii)) and the user's own amount stays", () => {
    const v = validateAnalysis(
      {
        ...base,
        claims: [{ text: "Refusing to take back defective goods and refund within 30 days, where the bill states no period, can be an unfair trade practice.", type: "verified_law", provision_id: "CPA2019-S2-47-VIII", support_quote: Q_UTP }],
        issue_summary: "You paid ₹4,299 for the mixer grinder.",
      },
      SUPPLIED,
      { userText: "I paid Rs 4,299", language: "en" },
    );
    expect(v.claims[0].status).toBe("source_matched");
    expect(v.claims[0].text).toContain("30 days");
    expect(v.issue_summary).toContain("₹4,299");
    expect(v.report.invented_numbers_removed).toEqual([]);
    expect(v.reply).toContain("Consumer Protection Act, 2019, s. 2(47)(viii)");
  });
});

describe("audit false positive (eval 06): correct s.2(7) explanation must be kept when s.2(7) is verified", () => {
  const sentence =
    "Under the Consumer Protection Act, 2019, goods bought for a commercial purpose are excluded from consumer protection unless they are used exclusively for earning your livelihood by self-employment.";
  const Q_27 = "does not include a person who obtains such goods for resale or for any commercial purpose";
  it("kept with a matched s.2(7) claim, relabelled without one", () => {
    const withClaim = validateAnalysis(
      { ...base, claims: [{ text: "Business purchases are excluded.", type: "verified_law", provision_id: "CPA2019-S2-7", support_quote: Q_27 }], issue_summary: sentence },
      SUPPLIED,
    );
    expect(withClaim.issue_summary).toBe(sentence);
    const without = validateAnalysis({ ...base, issue_summary: sentence }, SUPPLIED);
    expect(without.issue_summary).toBe("");
    // without a matched claim the Act's name is itself an unverified reference, which is checked first
    expect(without.needs_verification[0].reason).toBe("invalid_reference");
  });
});

describe("Hindi demo (phase-1 demo, pressure cooker case)", () => {
  const userText =
    "मैंने ऑनलाइन एक प्रेशर कुकर 1,850 रुपये में मंगाया था, लेकिन टूटा हुआ आया और विक्रेता रिफंड नहीं दे रहा। विक्रेता का नाम BartanMart है और मैंने 2026-10-28 को ऑर्डर किया था।";

  it("the invented '(जैसे 7-10 दिन)' is removed while the practical advice stays", () => {
    const v = validateAnalysis(
      {
        ...base,
        options: [
          {
            title: "विक्रेता को अंतिम नोटिस भेजें",
            description: "विक्रेता को एक औपचारिक पत्र या ईमेल भेजें जिसमें बिल और टूटे हुए कुकर की फोटो संलग्न हो। उन्हें रिफंड के लिए एक उचित समय सीमा (जैसे 7-10 दिन) दें।",
          },
        ],
      },
      SUPPLIED,
      { userText, rules: [S69_RULE], language: "hi" },
    );
    expect(v.reply).not.toMatch(/7-10/);
    expect(v.options[0].description).toContain("उचित समय सीमा");
    expect(v.options[0].description).toContain("ईमेल भेजें");
    expect(v.report.invented_numbers_removed.join(" ")).toContain("7-10 दिन");
    expect(v.reply).toContain(REPLY_HEADINGS.hi.practical);
    expect(v.reply).toContain(REPLY_HEADINGS.hi.disclaimer);
  });

  it("'…रिफंड देना विक्रेता की जिम्मेदारी है' (duty claim) is relabelled even though 'defect' is a verified definition", () => {
    const v = validateAnalysis(
      {
        ...base,
        claims: [{ text: "दोष का अर्थ गुणवत्ता में कमी है।", type: "verified_law", provision_id: "CPA2019-S2-10", support_quote: Q_DEFECT }],
        issue_summary: "उपभोक्ता संरक्षण अधिनियम के तहत, यदि कोई वस्तु दोषपूर्ण है, तो उसे वापस लेना और रिफंड देना विक्रेता की जिम्मेदारी है।",
      },
      SUPPLIED,
      { userText, language: "hi" },
    );
    expect(v.issue_summary).toBe("");
    expect(v.needs_verification[0].reason).toBe("unsupported_legal_statement");
    expect(v.reply).toContain(REPLY_HEADINGS.hi.check);
  });

  it("'2 साल की समय सीमा' is kept when the code's s.69 check ran (supported, number traceable to 'two years')", () => {
    const v = validateAnalysis(
      { ...base, next_steps: ["आपके पास शिकायत दर्ज करने के लिए पर्याप्त समय है (2 साल की समय सीमा)।"] },
      SUPPLIED,
      { userText, rules: [S69_RULE], language: "hi" },
    );
    expect(v.next_steps[0]).toContain("2 साल");
    expect(v.report.invented_numbers_removed).toEqual([]);
    // …but without the code check it is an unsupported legal statement
    const noRule = validateAnalysis({ ...base, next_steps: ["आपके पास शिकायत दर्ज करने के लिए पर्याप्त समय है (2 साल की समय सीमा)।"] }, SUPPLIED, { userText, language: "hi" });
    expect(noRule.next_steps).toEqual([]);
  });
});

describe("Hinglish", () => {
  it("invented 'din' counts are removed and legal claims relabelled", () => {
    const v = validateAnalysis(
      { ...base, next_steps: ["Seller ko 15 din ka time dein.", "Kanoon ke tahat aapko compensation ka haq hai."] },
      SUPPLIED,
      { userText: "Maine 3500 diye the, technician aaya hi nahi.", language: "hinglish" },
    );
    expect(v.next_steps[0]).not.toMatch(/15 din/);
    expect(v.next_steps[0]).toMatch(/reasonable time/);
    expect(v.needs_verification.map((n) => n.text).join(" ")).toMatch(/compensation/);
    expect(v.reply).toContain(REPLY_HEADINGS.hinglish.check);
  });
});

describe("guard helpers", () => {
  it("practical phrases with 'legal' words are not legal assertions", () => {
    expect(isLegalAssertion("Send a legal notice to the seller.")).toBe(false);
    expect(isLegalAssertion("कानूनी नोटिस भेजें।")).toBe(false);
    expect(isLegalAssertion("Free legal aid is available on 15100.")).toBe(false);
    expect(isLegalAssertion("Under the law you are entitled to a refund.")).toBe(true);
  });
  it("numbers the user wrote, helplines and statutory numbers are allowed; others removed", () => {
    const allowed = allowedNumbers({ user: "I paid 3500 and waited 10 days", statutory: [P("CPA2019-S69").text, P("CPA2019-S2-7").text] });
    // clause numbering "(7)" in s.2(7) must not make "7 days" look traceable
    expect(allowed.time.has(7)).toBe(false);
    const removed: string[] = [];
    expect(guardNumbers("You waited 10 days.", allowed, "en", removed)).toBe("You waited 10 days.");
    expect(guardNumbers("Call 1915.", allowed, "en", removed)).toBe("Call 1915.");
    expect(guardNumbers("You have two years.", allowed, "en", removed)).toBe("You have two years.");
    expect(guardNumbers("Reply within seven days.", allowed, "en", removed)).toBe("Reply within a reasonable period.");
    expect(guardNumbers("उन्हें सात दिन दें।", allowed, "hi", removed)).toBe("उन्हें उचित समय दें।");
  });
  it("does not split sentences inside case names or section abbreviations", () => {
    expect(splitSentences("As held in A v. B, you can sue. See s. 69 too.")).toEqual(["As held in A v. B, you can sue.", "See s. 69 too."]);
  });
});
