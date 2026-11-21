import type { CaseFile, Understanding } from "../schemas";
import { CONSUMER_EVIDENCE_KEYS, CONSUMER_FIELD_KEYS } from "../domains/consumer";
import { containsQuote, dateMentioned, parseAmountValue, parseAmounts, parseIsoDate } from "./text";

/** Phrases showing the user has a record of complaining in writing / by chat / with a ticket. */
const EVIDENCE_PATTERNS: { key: string; re: RegExp }[] = [
  {
    key: "complaint_records",
    re: /\b(e-?mailed|sent (?:an? )?e-?mail|wrote to them|complained (?:by|via|on|through) (?:e-?mail|mail|chat|the app|app)|(?:ticket|complaint|reference|grievance) (?:no\.?|number|id)|chatted with|app chat|e-?mail kiya|mail kiya|mail bheja|chat (?:par|pe) complaint)\b|ईमेल (?:किया|भेजा)|टिकट (?:नंबर|संख्या)|शिकायत संख्या/i,
  },
  { key: "order_confirmation", re: /\b(order (?:id|no\.?|number)|booking (?:id|no\.?|number)|order confirmation)\b|ऑर्डर (?:आईडी|नंबर)/i },
];
// ("no" is deliberately excluded: it appears in "ticket no. 123")
const NEGATION = /\b(not|never|didn'?t|haven'?t|hasn'?t|nahi|nahin)\b|नहीं/i;

export function detectEvidence(userText: string): { key: string; quote: string }[] {
  const found: { key: string; quote: string }[] = [];
  for (const sentence of userText.split(/(?<=[.!?।\n])\s*/)) {
    for (const p of EVIDENCE_PATTERNS) {
      const m = sentence.match(p.re);
      if (!m || found.some((f) => f.key === p.key)) continue;
      // skip "I have not emailed them" / "maine mail nahi kiya": negation close before or after the match
      const idx = m.index ?? 0;
      const window = sentence.slice(Math.max(0, idx - 20), idx + m[0].length + 12);
      if (NEGATION.test(window)) continue;
      found.push({ key: p.key, quote: m[0] });
    }
  }
  return found;
}

/**
 * Deterministic merge of model-extracted facts into the case file.
 * - A fact is only "user_stated" if its quote is found verbatim in the user's own messages.
 * - amount_paid must be a number that actually appears in the user's text, else it is "inferred".
 * - Inferred facts never overwrite user-stated facts.
 */
export function mergeCase(prev: CaseFile, u: Understanding, userText: string): CaseFile {
  const next: CaseFile = structuredClone(prev);
  next.turns = prev.turns + 1;
  next.language = u.language;

  if (prev.domain === "unknown" || prev.domain === u.domain) {
    if (u.domain_confidence >= 0.5 || prev.domain === "unknown") next.domain = u.domain;
  } else if (u.domain_confidence >= 0.75) {
    next.notes.push(`Domain changed from ${prev.domain} to ${u.domain}.`);
    next.domain = u.domain;
  }

  const userAmounts = parseAmounts(userText);

  for (const x of u.extracted) {
    if (!CONSUMER_FIELD_KEYS.includes(x.field)) continue;
    let value = x.value.trim();
    if (!value) continue;
    let source = x.source;
    const quoteOk = containsQuote(userText, x.quote);
    if (source === "user_stated" && !quoteOk) {
      source = "inferred";
      next.notes.push(`"${x.field}" marked as inferred: supporting quote not found in your messages.`);
    }
    if (x.field === "amount_paid") {
      const n = parseAmountValue(value);
      if (n === null) continue;
      value = String(n);
      if (!userAmounts.includes(n)) {
        source = "inferred";
        next.notes.push(`Amount ${n} not found in your messages – marked as inferred, please confirm.`);
      }
    }
    if (x.field === "purchase_date" && !parseIsoDate(value)) {
      next.notes.push(`Purchase date "${value}" is not an exact date – limitation check may be unavailable.`);
    }
    if (x.field === "purchase_date" && source === "user_stated" && parseIsoDate(value) && !dateMentioned(userText, value)) {
      source = "inferred";
      next.notes.push(`Purchase date ${value} was worked out by the AI, not written by you – please confirm.`);
    }
    const existing = next.facts[x.field];
    if (existing && existing.source === "user_stated" && source === "inferred") continue;
    next.facts[x.field] = { value, source, quote: quoteOk ? x.quote : undefined };
  }

  for (const t of u.timeline) {
    const source = containsQuote(userText, t.quote) ? "user_stated" : "inferred";
    const date_source = t.date ? (dateMentioned(userText, t.date) ? "user_stated" : "inferred") : undefined;
    const dup = next.timeline.some((e) => e.event.toLowerCase() === t.event.toLowerCase() && e.date === t.date);
    if (!dup)
      next.timeline.push({ date: t.date, event: t.event, source, quote: source === "user_stated" ? t.quote : undefined, date_source });
  }
  next.timeline.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));

  for (const ev of u.evidence_mentioned) {
    if (!CONSUMER_EVIDENCE_KEYS.includes(ev.key)) continue;
    if (!containsQuote(userText, ev.quote)) continue; // only record evidence the user actually mentioned
    next.evidence[ev.key] = { state: ev.has ? "have" : "missing", quote: ev.quote };
  }

  // Deterministic supplement: the model sometimes misses evidence the user plainly mentioned
  // (demo: "I emailed them…" was not recorded as complaint records). Only fills gaps; never overrides.
  for (const d of detectEvidence(userText)) {
    if (!next.evidence[d.key]) next.evidence[d.key] = { state: "have", quote: d.quote };
  }

  next.notes = Array.from(new Set(next.notes)).slice(-12);
  return next;
}
