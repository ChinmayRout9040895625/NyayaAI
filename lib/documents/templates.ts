import type { CaseFile } from "../schemas";
import type { RuleResult } from "../legal/consumerRules";
import { formatINR } from "../pipeline/text";

/**
 * Deterministic document templates. No model output is used for legal content.
 * Party details are entered in the browser and never sent to the AI.
 */

export interface PartyDetails {
  complainant_name: string;
  complainant_address: string;
  complainant_contact: string;
  opposite_party_name: string;
  opposite_party_address: string;
  order_or_invoice_no: string;
  reply_days: string;
  district: string;
}

export const EMPTY_PARTIES: PartyDetails = {
  complainant_name: "",
  complainant_address: "",
  complainant_contact: "",
  opposite_party_name: "",
  opposite_party_address: "",
  order_or_invoice_no: "",
  reply_days: "",
  district: "",
};

export interface DocSource {
  act: string;
  section: string;
  title: string;
}

export interface DocInput {
  caseFile: CaseFile;
  parties: PartyDetails;
  sources: DocSource[]; // ONLY verified provisions that backed a source-matched claim
  rules: RuleResult[];
  evidenceHave: string[];
  today: Date;
}

export const DOC_DISCLAIMER =
  "Draft prepared with NyayaAI, an AI-assisted tool, for information only. It is not legal advice. Review it with an advocate or your District Legal Services Authority (NALSA helpline 15100) before sending or filing. Check every fact and fill every highlighted placeholder.";

const missing = (what: string) => `[[MISSING: ${what}]]`;
const confirm = (what: string) => `[[CONFIRM: ${what}]]`;

function fact(c: CaseFile, key: string, label: string): string {
  const f = c.facts[key];
  if (!f?.value) return missing(label);
  return f.source === "inferred" ? `${f.value} ${confirm(`${label} – inferred, please check`)}` : f.value;
}

function amount(c: CaseFile): string {
  const f = c.facts.amount_paid;
  if (!f?.value) return missing("amount paid");
  const s = formatINR(Number(f.value));
  return f.source === "inferred" ? `${s} ${confirm("amount – inferred, please check")}` : s;
}

/** Ends a sentence with exactly one full stop (facts often already end with one: avoids ".."). */
export function sentence(s: string): string {
  return s.trim().replace(/[.!?।]+$/, "") + ".";
}

function val(v: string, label: string): string {
  return v.trim() ? v.trim() : missing(label);
}

function legalBasis(sources: DocSource[]): string {
  if (!sources.length) {
    return `${missing("legal basis – NyayaAI has no verified provision for this draft. Ask an advocate to add the applicable provisions; do not add sections you have not checked")}`;
  }
  return sources.map((s) => `- Section ${s.section} of the ${s.act} (${s.title})`).join("\n");
}

function dateStr(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

export function renderLegalNotice(i: DocInput): string {
  const c = i.caseFile;
  const p = i.parties;
  const timeline = c.timeline.filter((t) => t.source === "user_stated");
  return `# LEGAL NOTICE

**Date:** ${dateStr(i.today)}

**From:**
${val(p.complainant_name, "your full name")}
${val(p.complainant_address, "your address")}
${val(p.complainant_contact, "your phone / email")}

**To:**
${val(p.opposite_party_name, "seller / company legal name")} (${fact(c, "trader_name", "seller / platform")})
${val(p.opposite_party_address, "seller / company registered address")}

**Subject:** Notice regarding ${fact(c, "product_or_service", "product or service")} – demand for ${fact(c, "relief_wanted", "relief you want (refund / replacement / repair)")}

Sir/Madam,

1. I purchased/availed ${fact(c, "product_or_service", "product or service")} from you on ${fact(c, "purchase_date", "date of purchase")} for ${amount(c)} (Order/Invoice No. ${val(p.order_or_invoice_no, "order or invoice number")}).

2. The problem: ${sentence(fact(c, "problem_description", "what went wrong"))}

3. Steps already taken: ${sentence(fact(c, "prior_complaint", "your earlier complaints and their reply"))}
${timeline.length ? `\n4. Relevant dates:\n${timeline.map((t) => `   - ${t.date ?? missing("date")}: ${t.event}`).join("\n")}\n` : ""}
${timeline.length ? "5" : "4"}. Despite this, the matter remains unresolved.

${timeline.length ? "6" : "5"}. Legal basis (verified provisions only):
${legalBasis(i.sources)}

${timeline.length ? "7" : "6"}. I therefore call upon you to provide the following relief within ${val(p.reply_days, "number of days, e.g. 15")} days of receiving this notice: ${sentence(fact(c, "relief_wanted", "relief you want"))} If you fail to do so, I may pursue the remedies available to me under law, including a complaint before the appropriate Consumer Commission, without further notice.

**Enclosures (copies):**
${i.evidenceHave.length ? i.evidenceHave.map((e) => `- ${e}`).join("\n") : missing("list of documents you are attaching")}

Yours faithfully,

${val(p.complainant_name, "your full name")}
(Signature)

---
_${DOC_DISCLAIMER}_
`;
}

export function renderComplaint(i: DocInput): string {
  const c = i.caseFile;
  const p = i.parties;
  const forum = i.rules.find((r) => ["district", "state", "above_district", "unknown_amount", "rule_not_verified"].includes(r.status));
  const limitation = i.rules.find((r) => r.provision_ids.includes("CPA2019-S69") || r.status === "rule_not_verified");
  const commission =
    forum?.status === "district"
      ? `DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION, ${val(p.district, "district")}`
      : `${confirm("correct Consumer Commission (District / State / National) – depends on the value paid as consideration")} CONSUMER DISPUTES REDRESSAL COMMISSION, ${val(p.district, "district / state")}`;
  return `# DRAFT CONSUMER COMPLAINT

**BEFORE THE ${commission}**

Consumer Complaint No. ______ of 20__

**${val(p.complainant_name, "your full name")}**, ${val(p.complainant_address, "your address")} – *Complainant*

Versus

**${val(p.opposite_party_name, "opposite party legal name")}** (${fact(c, "trader_name", "seller / platform")}), ${val(p.opposite_party_address, "opposite party address")} – *Opposite Party*

## 1. Facts
1. The Complainant purchased/availed ${fact(c, "product_or_service", "product or service")} from the Opposite Party on ${fact(c, "purchase_date", "date of purchase")} for ${amount(c)} (Order/Invoice No. ${val(p.order_or_invoice_no, "order or invoice number")}).
2. ${sentence(fact(c, "problem_description", "what went wrong"))}
3. Complaints made and response: ${sentence(fact(c, "prior_complaint", "earlier complaints and replies"))}
4. Purpose of purchase: ${sentence(fact(c, "purchase_purpose", "personal or commercial use"))}

## 2. Defect / deficiency alleged
${fact(c, "problem_description", "describe the defect or deficiency")}

## 3. Legal basis (verified provisions only)
${legalBasis(i.sources)}

## 4. Cause of action and limitation
The cause of action arose on ${missing("date – e.g. date of purchase, defect, or final refusal")}.
${limitation ? `NyayaAI check (not legal advice): ${limitation.message}` : missing("limitation check")}

## 5. Jurisdiction
${forum ? `NyayaAI check (not legal advice): ${forum.message}` : missing("jurisdiction")}
Territorial jurisdiction: ${missing("why this Commission – where you live/work or where the opposite party carries on business")}

## 6. Relief claimed
${fact(c, "relief_wanted", "relief claimed")}
${missing("exact amounts claimed, if any (refund / compensation / costs)")}

## 7. List of documents
${i.evidenceHave.length ? i.evidenceHave.map((e, n) => `${n + 1}. ${e}`).join("\n") : missing("documents annexed")}

## Verification
I, ${val(p.complainant_name, "your full name")}, verify that the contents above are true to my knowledge and belief.

Place: ${missing("place")}    Date: ${dateStr(i.today)}

(Signature of Complainant)

---
_Filing formalities (fees, affidavit, number of copies, e-filing format) are not covered by this draft – check the official e-filing portal or with the Commission._

_${DOC_DISCLAIMER}_
`;
}

export function countPlaceholders(md: string): { missing: number; confirm: number } {
  return {
    missing: (md.match(/\[\[MISSING:/g) || []).length,
    confirm: (md.match(/\[\[CONFIRM:/g) || []).length,
  };
}
