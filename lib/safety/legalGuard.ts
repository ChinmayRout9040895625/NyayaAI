/**
 * Deterministic guards for model-written FREE TEXT (summary, options, steps):
 *  1. Legal-assertion detection – a sentence that states a legal rule must be backed by a source-matched
 *     claim on the same topic (or by a code-computed rule); otherwise it is RELABELLED as
 *     "needs legal verification" (moved, not deleted, so useful content is preserved but not presented as law).
 *  2. Number guard – deadlines, time spans, money amounts and percentages must be traceable to the user's
 *     own text, a verified provision supplied to the model, or a code-computed rule; otherwise removed.
 * Works on English, Hindi (Devanagari) and Hinglish. These are heuristics: see limitations in the report.
 */

export type Lang = "en" | "hi" | "hinglish";

/* ------------------------------------------------------------------ */
/* Sentences                                                           */
/* ------------------------------------------------------------------ */

// Do not split after abbreviations common in legal / Indian text ("X v. Y", "s. 69", "Rs. 500", "No. 12").
const NO_SPLIT_AFTER = /(?:^|[\s(])(?:v|vs|s|ss|sec|secs|art|cl|no|nos|rs|e\.g|i\.e|etc|dr|mr|mrs|ms|ltd|pvt|co|st|govt|dept)\.$/i;

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    let buf = "";
    for (const piece of line.split(/(?<=[.!?।])\s+/)) {
      buf = buf ? `${buf} ${piece}` : piece;
      if (!NO_SPLIT_AFTER.test(buf)) {
        out.push(buf.trim());
        buf = "";
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out.filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Legal assertions and their topics                                   */
/* ------------------------------------------------------------------ */

// Phrases that are practical, not legal claims, even though they contain "legal"-ish words.
const SAFE_PHRASES =
  /legal (notice|information|advice|aid|help)|kanooni (notice|salah|sahayata|jankari)|कानूनी (नोटिस|सलाह|सहायता|जानकारी|मदद)|free legal aid|मुफ़्त कानूनी/gi;

// Generic legal-rule language (no specific topic).
const GENERIC_LEGAL =
  /\b(under (?:the )?(?:law|act|consumer protection)|legally|the law (?:says|requires|allows|gives)|by law|you (?:are|were) entitled|entitled to|you have (?:a|the) (?:legal )?right|your (?:legal )?rights?|consumer rights?|burden of proof|(?:need|have|has|will need) to prove|must prove|liable|liability|illegal|unlawful|statutory|is a (?:crime|criminal offence)|criminal offence|punitive|responsibility of the (?:seller|trader))\b|कानून के (?:तहत|अनुसार)|कानूनन|अधिनियम|अधिकार|हकदार|साबित करना|सिद्ध करना|ज़िम्मेदारी|जिम्मेदारी|गैरकानूनी|अवैध|दायित्व|\b(?:kanoon|kaanoon|qanoon) ke (?:tahat|hisaab)|\b(?:adhikar|haqdaar|haq hai|saabit karna|sabit karna|zimmedari|illegal)\b/i;

interface Topic {
  id: string;
  re: RegExp;
  provisions: string[]; // any one source-matched provision supports the topic
  rule?: string; // or a code-computed rule result referencing this provision
}

export const TOPICS: Topic[] = [
  {
    id: "limitation",
    re: /limitation|time[- ]barred|condon|(?:two|2)[- ]?years?\b.*(?:complain|file|limit)|(?:complain|file|limit).*(?:two|2)[- ]?years?\b|(?:दो|2)\s*(?:साल|वर्ष)|शिकायत (?:दर्ज करने )?की समय[- ]?सीमा|(?:do|2) saal/i,
    provisions: ["CPA2019-S69"],
    rule: "CPA2019-S69",
  },
  { id: "unfair_trade", re: /unfair trade|अनुचित व्यापार|anuchit vyapar/i, provisions: ["CPA2019-S2-47-VIII"] },
  { id: "deficiency", re: /deficien|सेवा में कमी|seva me(?:in)? kami/i, provisions: ["CPA2019-S2-11"] },
  { id: "defect", re: /\bdefect|दोष|खराबी|kharabi/i, provisions: ["CPA2019-S2-10"] },
  {
    id: "consumer_status",
    // includes the commercial-purpose / self-employment wording of s.2(7) (false positive found in the audit, eval 06)
    re: /(?:qualify|count|are|is) (?:as )?a consumer|definition of (?:a )?consumer|commercial purpose|for resale|self-employment|उपभोक्ता (?:हैं|माने|की श्रेणी)|व्यावसायिक (?:उद्देश्य|उपयोग)|स्वरोज़गार|स्वरोजगार|consumer (?:ho|hain|mana)/i,
    provisions: ["CPA2019-S2-7"],
  },
  {
    id: "remedies",
    re: /(?:commission|court|forum) (?:can|may|will|could) (?:order|direct|award|ask)|refund (?:of )?the price|with interest|compensation|आयोग .{0,40}(?:आदेश|निर्देश)|मुआवज|muavz|muavj/i,
    provisions: ["CPA2019-S39-1"],
  },
  {
    id: "forum_place",
    re: /your own district|district where you (?:live|reside)|where (?:the seller|they|the company|the opposite party) (?:operates?|carries on business|is based)|where you (?:live|reside) or work|अपने (?:ज़िले|जिले)|जहाँ आप रहते/i,
    provisions: ["CPA2019-S34-2"],
  },
];

export function topicsOf(sentence: string): Topic[] {
  return TOPICS.filter((t) => t.re.test(sentence));
}

/** Does this sentence state a legal rule (as opposed to practical guidance)? */
export function isLegalAssertion(sentence: string): boolean {
  const s = sentence.replace(SAFE_PHRASES, " ");
  if (GENERIC_LEGAL.test(s)) return true;
  // topic words alone are legal assertions only for these topics (others appear in practical text too)
  return topicsOf(s).some((t) => ["limitation", "unfair_trade", "deficiency", "consumer_status", "remedies", "forum_place"].includes(t.id));
}

export interface SupportContext {
  matchedProvisionIds: Set<string>; // provisions behind source-matched claims in THIS answer
  ruleProvisionIds: Set<string>; // provisions behind code-computed rule results in THIS answer
}

/**
 * A legal sentence is supported only if it has at least one recognised topic and EVERY topic is backed.
 * Generic legal language with no recognised topic (e.g. burden of proof) is never supported.
 */
export function isSupported(sentence: string, ctx: SupportContext): boolean {
  const s = sentence.replace(SAFE_PHRASES, " ");
  const topics = topicsOf(s);
  if (!topics.length) return false;
  if (/burden of proof|(?:need|have|has|will need) to prove|must prove|साबित करना|सिद्ध करना|saabit karna|sabit karna/i.test(s)) return false;
  // Duty / obligation language ("it is the seller's responsibility to refund") is a rule, not a definition:
  // a definition provision (defect, deficiency, consumer) alone cannot support it.
  if (/responsib|obligat|is (?:bound|required|obliged) to|must (?:refund|replace|repair|pay)|ज़िम्मेदारी|जिम्मेदारी|बाध्य|zimmedari|zimmedaari/i.test(s)) {
    const ruleTopics = topics.filter((t) => ["unfair_trade", "remedies", "limitation", "forum_place"].includes(t.id));
    if (!ruleTopics.length) return false;
  }
  return topics.every((t) => t.provisions.some((p) => ctx.matchedProvisionIds.has(p)) || (t.rule ? ctx.ruleProvisionIds.has(t.rule) : false));
}

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, sixty: 60, ninety: 90,
  एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5, छह: 6, सात: 7, आठ: 8, नौ: 9, दस: 10, पंद्रह: 15, बीस: 20, तीस: 30,
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, saat: 7, das: 10, pandrah: 15, tees: 30,
};
const WORD_NUM_RE = Object.keys(WORD_NUM).join("|");
const TIME_UNIT =
  "(?:working days?|business days?|days?|weeks?|months?|years?|hours?|दिनों|दिन|हफ़्ते|हफ्ते|सप्ताह|महीनों|महीने|महीना|साल|वर्ष|din|dino|hafte|mahine|mahina|saal)";
const NUM = "\\d+(?:\\.\\d+)?";
const RANGE_SEP = "\\s*(?:-|–|to|se|से|या|or)\\s*";

// "7 days", "7-10 दिन", "7 to 10 working days", "seven days", "सात दिन", "15 din"
// Unicode-aware boundaries: JS \b does not work next to Devanagari.
const TIME_RE = new RegExp(
  `(?:(?<![\\d.,])(${NUM})(?:${RANGE_SEP}(${NUM}))?|(?<![\\p{L}\\p{M}\\d])(${WORD_NUM_RE})(?:${RANGE_SEP}(${WORD_NUM_RE}))?)\\s*${TIME_UNIT}(?![\\p{L}\\p{M}])`,
  "giu",
);
// "₹50,000", "Rs. 5000", "5000 rupees", "5,000 रुपये", "10%"
const MONEY_RE = /(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*(?:rupees|rupaye|रुपये|रुपए|रुपया|lakh|लाख|crore|करोड़)|(\d+(?:\.\d+)?)\s*(?:%|percent|प्रतिशत)/gi;

const HELPLINES = [112, 181, 1915, 14416, 15100];

function toNum(s: string | undefined): number | null {
  if (!s) return null;
  const k = s.toLowerCase();
  if (k in WORD_NUM) return WORD_NUM[k];
  const n = Number(k.replace(/,/g, ""));
  return isFinite(n) ? n : null;
}

/** Every number written in a text, digits or number words (English, Hindi, Hinglish). */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (isFinite(n)) out.push(n);
  }
  for (const m of text.matchAll(new RegExp(`(?<![\\p{L}\\p{M}])(${WORD_NUM_RE})(?![\\p{L}\\p{M}])`, "giu"))) out.push(WORD_NUM[m[1].toLowerCase()]);
  // "45k" style amounts in user text
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*k\b/gi)) out.push(Math.round(Number(m[1]) * 1000));
  return out;
}

export interface AllowedNumbers {
  time: Set<number>; // numbers that appear WITH a time unit in a trusted source ("10 days", "two years", "thirty days")
  money: Set<number>; // amounts the user wrote, or money amounts in a provision
}

/** Numbers attached to a time unit, e.g. "thirty days" -> 30, "7-10 din" -> 7 and 10. */
function timeNumbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(TIME_RE)) for (const g of [m[1], m[2], m[3], m[4]]) {
    const n = toNum(g);
    if (n !== null) out.push(n);
  }
  return out;
}

function moneyNumbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(MONEY_RE)) {
    const n = toNum(m[1] ?? m[2] ?? m[3]);
    if (n !== null) out.push(n);
  }
  return out;
}

/**
 * Trusted sources: the user's own words, verified provision text and code-computed rule messages.
 * Bare numbers in provisions (clause numbering like "(7)", "(10)") and date parts are NOT allowed as time spans –
 * otherwise "7 days" would look traceable to "s. 2(7)" (a bug found while writing the regression tests).
 */
export function allowedNumbers(src: { user: string; statutory: string[] }): AllowedNumbers {
  return {
    time: new Set([...timeNumbersIn(src.user), ...src.statutory.flatMap(timeNumbersIn)]),
    money: new Set([...HELPLINES, ...numbersIn(src.user), ...src.statutory.flatMap(moneyNumbersIn)]),
  };
}

const REASONABLE: Record<Lang, string> = { en: "a reasonable period", hi: "उचित समय", hinglish: "reasonable time" };
const AMOUNT_TBC: Record<Lang, string> = { en: "[amount to be confirmed]", hi: "[राशि की पुष्टि करें]", hinglish: "[amount confirm karein]" };

/**
 * Removes deadlines / time spans / amounts not traceable to `allowed`.
 * Parenthetical examples like "(e.g. 7-10 days)" / "(जैसे 7-10 दिन)" are removed entirely.
 */
export function guardNumbers(text: string, allowedAll: AllowedNumbers, lang: Lang, removed: string[]): string {
  const check = (set: Set<number>) => (...xs: (string | undefined)[]) =>
    xs.filter(Boolean).every((x) => {
      const n = toNum(x);
      return n !== null && set.has(n);
    });
  const ok = check(allowedAll.time);
  const okMoney = check(allowedAll.money);
  // 1) parenthetical examples containing an unbacked time span
  let out = text.replace(/\s*\((?:e\.g\.|eg|for example|such as|like|जैसे|उदाहरण के लिए|jaise)[^()]*\)/gi, (paren) => {
    TIME_RE.lastIndex = 0;
    const m = TIME_RE.exec(paren);
    TIME_RE.lastIndex = 0;
    if (m && !ok(m[1], m[2], m[3], m[4])) {
      removed.push(paren.trim());
      return "";
    }
    return paren;
  });
  // 2) remaining time spans
  out = out.replace(TIME_RE, (m, a, b, c, d) => {
    if (ok(a, b, c, d)) return m;
    removed.push(m.trim());
    return REASONABLE[lang];
  });
  // 3) money and percentages
  out = out.replace(MONEY_RE, (m, a, b, c) => {
    if (okMoney(a ?? b ?? c)) return m;
    removed.push(m.trim());
    return AMOUNT_TBC[lang];
  });
  return out.replace(/\s{2,}/g, " ").replace(/\s+([.,;:।])/g, "$1").trim();
}
