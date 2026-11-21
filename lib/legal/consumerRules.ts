import type { CaseFile, CorpusEntry } from "../schemas";
import { CORPUS_BY_ID, isCitable } from "../knowledge/corpus";
import { formatINR, normalize, parseIsoDate } from "../pipeline/text";

/**
 * Deterministic consumer-law rules. Each rule runs ONLY if the provision it depends on is verified
 * (status in_force) AND the verified text still contains the phrase the rule relies on.
 * Otherwise the rule reports "rule_not_verified" instead of guessing.
 */

export interface RuleResult {
  status: string;
  message: string;
  provision_ids: string[];
  assumptions: string[];
}

export type CorpusLookup = Map<string, CorpusEntry>;

function verifiedTextHas(id: string, phrases: string[], corpus: CorpusLookup): boolean {
  const e = corpus.get(id);
  if (!isCitable(e)) return false;
  const t = normalize(e.text);
  return phrases.every((p) => t.includes(normalize(p)));
}

/* ---------------- Limitation – CPA 2019 s.69 ---------------- */

export const LIMITATION_MONTHS = 24; // "two years" – used only when verified text contains that phrase

export function checkLimitation(c: CaseFile, today: Date, corpus: CorpusLookup = CORPUS_BY_ID): RuleResult {
  const ruleVerified =
    verifiedTextHas("CPA2019-S69", ["two years", "cause of action"], corpus) &&
    verifiedTextHas("CPA2019-S69", ["sufficient cause"], corpus);
  if (!ruleVerified) {
    return {
      status: "rule_not_verified",
      message:
        "Consumer complaints have a time limit. NyayaAI has not verified the official text of that rule yet, so it cannot calculate your deadline – act promptly and confirm the limit with the Consumer Commission or a lawyer.",
      provision_ids: [],
      assumptions: [],
    };
  }
  const raw = c.facts.purchase_date?.value;
  const d = parseIsoDate(raw);
  if (!d) {
    return {
      status: "unknown",
      message: "Time-limit check not possible: an exact purchase/service date is needed.",
      provision_ids: ["CPA2019-S69"],
      assumptions: [],
    };
  }
  const months =
    (today.getUTCFullYear() - d.getUTCFullYear()) * 12 + (today.getUTCMonth() - d.getUTCMonth()) -
    (today.getUTCDate() < d.getUTCDate() ? 1 : 0);
  const assumptions = [
    `Counted from the purchase/service date (${raw}). The "cause of action" may arise later – for example when the defect appeared or when the trader finally refused – which could give you more time. This is a conservative estimate.`,
  ];
  const condonation =
    "Section 69(2) lets the Commission admit a complaint filed after this period if you satisfy it that you had sufficient cause for the delay; the Commission must record its reasons. Whether a delay will be condoned cannot be predicted – explain the reasons for delay and get legal advice.";
  if (months < 0) {
    return { status: "unknown", message: "The purchase date appears to be in the future – please check it.", provision_ids: [], assumptions: [] };
  }
  if (months < LIMITATION_MONTHS - 3) {
    return {
      status: "within",
      message: `About ${months} month(s) have passed. That appears to be within the two-year period in Section 69(1).`,
      provision_ids: ["CPA2019-S69"],
      assumptions,
    };
  }
  if (months < LIMITATION_MONTHS) {
    return {
      status: "near_deadline",
      message: `About ${months} month(s) have passed – you may be close to the two-year period in Section 69(1). Act quickly.`,
      provision_ids: ["CPA2019-S69"],
      assumptions,
    };
  }
  return {
    status: "possibly_outside",
    message: `About ${months} month(s) have passed, which may be beyond the two-year period in Section 69(1) if the cause of action arose on the purchase date. This is not a final conclusion. ${condonation}`,
    provision_ids: ["CPA2019-S69"],
    assumptions,
  };
}

/* ---------------- Forum by consideration paid ---------------- */

/** Limits used only when the verified Rule text contains these phrases. */
export const DISTRICT_MAX = 5_000_000; // fifty lakh
export const STATE_MAX = 20_000_000; // two crore

export function checkForum(c: CaseFile, corpus: CorpusLookup = CORPUS_BY_ID): RuleResult {
  // s.34(1) as enacted says "one crore", but its proviso lets the Central Government prescribe another value.
  // The current value therefore comes ONLY from the verified Jurisdiction Rules entry; the Act's figure is never used.
  const ruleVerified = verifiedTextHas("JR2021-R3", ["fifty lakh"], corpus);
  const amountFact = c.facts.amount_paid;
  const amount = amountFact ? Number(amountFact.value) : NaN;
  const base = "Which Commission hears a case depends on the value of the goods or services paid as consideration – not on the compensation you claim.";
  if (!ruleVerified) {
    return {
      status: "rule_not_verified",
      message: `${base} The Act originally set the District Commission's limit at one crore rupees but lets the Central Government prescribe a different value by rules, and NyayaAI has not verified the current rules – so it cannot tell you the current limit. Confirm the current limit on the official consumer e-filing portal or with the Commission before filing.`,
      provision_ids: [],
      assumptions: [],
    };
  }
  if (!isFinite(amount) || amount <= 0) {
    return { status: "unknown_amount", message: `${base} Tell me the amount you actually paid to work this out.`, provision_ids: ["JR2021-R3"], assumptions: [] };
  }
  const assumptions =
    amountFact!.source === "inferred" ? [`Amount paid (${formatINR(amount)}) was inferred, not clearly stated – please confirm.`] : [];
  if (amount <= DISTRICT_MAX) {
    return {
      status: "district",
      message: `${base} You paid ${formatINR(amount)}, which is within the District Commission's limit of ₹50 lakh.`,
      provision_ids: ["JR2021-R3"],
      assumptions,
    };
  }
  const stateVerified = verifiedTextHas("JR2021-R3", ["two crore"], corpus);
  return {
    status: amount <= STATE_MAX && stateVerified ? "state" : "above_district",
    message: `${base} You paid ${formatINR(amount)}, which is above the District Commission's ₹50 lakh limit, so the State or National Commission would be the forum. Please get legal advice for a claim of this size.`,
    provision_ids: ["JR2021-R3"],
    assumptions,
  };
}

/* ---------------- Personal vs commercial use ---------------- */

export function checkPurpose(c: CaseFile, corpus: CorpusLookup = CORPUS_BY_ID): RuleResult | null {
  const v = c.facts.purchase_purpose?.value?.toLowerCase() ?? "";
  if (!/commercial|business|resale|resell|shop|dukaan|vyapar/.test(v)) return null;
  const verified = verifiedTextHas("CPA2019-S2-7", ["commercial purpose"], corpus);
  return {
    status: "commercial_flag",
    message: verified
      ? "You said this was bought for a business. The definition of 'consumer' in Section 2(7) does not include a person who obtains goods for resale or for any commercial purpose, or who avails a service for any commercial purpose. Its Explanation says 'commercial purpose' does not include goods bought and used exclusively to earn a livelihood by self-employment. Whether this applies to you depends on the facts – get legal advice before filing."
      : "You said this was bought for a business. Consumer law may not cover purchases made for commercial purposes. NyayaAI has not verified the exact definition yet – get legal advice before filing.",
    provision_ids: verified ? ["CPA2019-S2-7"] : [],
    assumptions: [],
  };
}
