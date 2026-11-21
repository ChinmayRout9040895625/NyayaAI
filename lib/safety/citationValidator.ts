import type { AnalysisLLM, CorpusEntry, Language, ValidatedClaim, ValidationReport } from "../schemas";
import { normalize } from "../pipeline/text";
import { allowedNumbers, guardNumbers, isLegalAssertion, isSupported, splitSentences, type Lang, type SupportContext } from "./legalGuard";
import { composeReply } from "./composeReply";

/**
 * Deterministic citation checks. IMPORTANT LIMIT: a passing check only proves that the quoted
 * words exist in a verified official provision we supplied. It does NOT prove the provision
 * applies to the user's facts or that the legal reasoning is correct.
 */
export const REASONING_NOT_VERIFIED =
  "Source check only confirms that quoted words exist in a verified official provision. It does not confirm that the provision applies to your facts or that the legal reasoning is correct. Have a lawyer review before acting.";

const MIN_QUOTE_LEN = 15;

// "Section 69", "s. 2(7)", "Sec 35(1)(a)", "Article 21", "Rule 3", "धारा 69"
const SECTION_RE =
  /\b(?:sections?|secs?\.?|s\.|articles?|art\.|rules?|clauses?|regulations?)\s*\d+[A-Za-z]?(?:\s*\(\s*[0-9a-zA-Z]{1,4}\s*\))*|(?:धारा|अनुच्छेद|नियम)\s*\d+[A-Za-z]?(?:\s*\(\s*[0-9a-zA-Z]{1,4}\s*\))*/gi;
// "Consumer Protection Act, 2019", "Indian Penal Code", "Code on Wages, 2019", "IPC", "BNS", "CrPC"
const ACT_RE =
  /\b(?:[A-Z][A-Za-z()&'-]*\s+){1,8}(?:Act|Code|Rules|Sanhita)(?:,?\s*(?:of\s*)?\d{4})?\b|\b(?:IPC|CrPC|BNS|BNSS|BSA|CPC)\b/g;
// Case-law patterns: "AIR 2019 SC 123", "(2020) 5 SCC 1", "SCC OnLine", "X v. Y", "X vs Y"
const CASE_RE =
  /\bAIR\s*\d{4}\b[^.;\n]{0,30}|\(\d{4}\)\s*\d+\s*SCC\s*\d+|\b\d{4}\s*SCC\b[^.;\n]{0,20}|\bSCC\s*OnLine\b[^.;\n]{0,30}|\b[A-Z][\w.&]*(?:\s+[A-Z][\w.&]*){0,4}\s+(?:v\.|vs\.?|versus)\s+[A-Z][\w.&]*(?:\s+[A-Z][\w.&]*){0,4}/g;
// Promises of an outcome. Bare "guarantee" is NOT flagged: it appears in refusals ("I cannot provide guarantees")
// and in "warranty or guarantee card" (false positive seen in eval 08).
const GUARANTEE_RE =
  /\b((?:i|we) guarantee|guaranteed (?:to|that|win|success|refund|result|outcome)|(?:is|are) guaranteed|definitely (?:win|get|succeed)|surely (?:win|get)|100\s*%|certain(?:ly)? (?:to )?win|will (?:definitely|certainly) (?:win|get))\b|पक्का|ज़रूर जीत/gi;

export const REMOVED = "[unverified reference removed]";

// Overconfident assessments of the case – flagged so the UI can warn (outcomes are never predictable).
const OVERCONFIDENCE_RE =
  /\b(clear case|strong case|solid case|airtight|good position|strong position|good chance|high chance|likely to (?:win|succeed|get)|bound to (?:win|succeed))\b|मज़बूत केस|पक्का केस/gi;

/**
 * Quote check that also accepts elisions ("[...]", "...", "…"): every fragment must appear
 * verbatim (after normalisation) in the provision text, in order, and be at least 10 characters.
 */
export function quoteSupported(provisionText: string, quote: string): boolean {
  const parts = quote
    .split(/\s*(?:\[\s*(?:\.\.\.|…)\s*\]|\.\.\.|…)\s*/)
    .map((x) => normalize(x))
    .filter(Boolean);
  if (!parts.length || parts.join(" ").length < MIN_QUOTE_LEN) return false;
  if (parts.some((x) => x.length < 10)) return false;
  const text = normalize(provisionText);
  let from = 0;
  for (const part of parts) {
    const at = text.indexOf(part, from);
    if (at < 0) return false;
    from = at + part.length;
  }
  return true;
}

function sectionNumber(ref: string): string | null {
  const m = ref.match(/\d+[A-Za-z]?/);
  return m ? m[0] : null;
}

interface Allowed {
  sections: Set<string>; // leading section numbers of matched provisions
  acts: string[]; // normalised act names of matched provisions
}

function scrub(text: string, allowed: Allowed, removed: string[]): string {
  let out = text.replace(CASE_RE, (m) => {
    removed.push(m.trim());
    return REMOVED;
  });
  out = out.replace(SECTION_RE, (m) => {
    const n = sectionNumber(m);
    if (n && allowed.sections.has(n)) return m;
    removed.push(m.trim());
    return REMOVED;
  });
  out = out.replace(ACT_RE, (m) => {
    const nm = normalize(m);
    if (allowed.acts.some((a) => a.includes(nm) || nm.includes(a))) return m;
    // Generic words like "the Act" / "this Code" are not references.
    if (/^(the|this|that|such)\s+(act|code|rules)$/i.test(m.trim())) return m;
    removed.push(m.trim());
    return REMOVED;
  });
  return out;
}

export type NeedsReason = "general_explanation" | "citation_failed" | "unsupported_legal_statement" | "invalid_reference" | "model_flagged";

export interface ValidatedAnalysis {
  issue_summary: string;
  claims: ValidatedClaim[];
  options: { title: string; description: string }[];
  next_steps: string[];
  /** Legal points that are NOT verified: shown separately, never presented as law. */
  needs_verification: { text: string; reason: NeedsReason }[];
  uncertainties: string[];
  lawyer_recommended: boolean;
  lawyer_reason: string;
  reply: string; // composed by code from the validated parts
  report: ValidationReport;
}

export interface ValidationContext {
  userText?: string; // the user's own messages (numbers they wrote are allowed)
  rules?: { provision_ids: string[]; message: string }[]; // code-computed rule results
  language?: Language;
}

const stripMd = (s: string) => s.replace(/\*\*/g, "").replace(/(^|\s)#{1,3}\s+/g, "$1").trim();

function provisionLabel(p: CorpusEntry): string {
  return `${p.act}, s. ${p.section}`;
}

export function validateAnalysis(a: AnalysisLLM, supplied: CorpusEntry[], ctx: ValidationContext = {}): ValidatedAnalysis {
  const language: Language = ctx.language ?? "en";
  const lang: Lang = language;
  const byId = new Map(supplied.map((p) => [p.id, p]));

  /* 1. Claims: quote must be found in a supplied, verified provision */
  const claims: ValidatedClaim[] = a.claims.map((c) => {
    const base = { ...c, text: stripMd(c.text) };
    if (c.type !== "verified_law") return { ...base, status: "general" };
    const p = c.provision_id ? byId.get(c.provision_id) : undefined;
    if (!p) return { ...base, type: "general_explanation", status: "downgraded", reason: "Cited provision was not among the verified provisions supplied." };
    if (!c.support_quote || normalize(c.support_quote).length < MIN_QUOTE_LEN)
      return { ...base, type: "general_explanation", status: "downgraded", reason: "No supporting quote given." };
    if (!quoteSupported(p.text, c.support_quote))
      return { ...base, type: "general_explanation", status: "downgraded", reason: "Quoted words not found in the official text of the cited provision." };
    return { ...base, status: "source_matched" };
  });

  const matched = claims.filter((c) => c.status === "source_matched").map((c) => byId.get(c.provision_id!)!);
  const allowed: Allowed = {
    sections: new Set(matched.map((p) => sectionNumber(p.section)).filter(Boolean) as string[]),
    acts: Array.from(new Set(matched.map((p) => normalize(p.act)))),
  };
  const support: SupportContext = {
    matchedProvisionIds: new Set(matched.map((p) => p.id)),
    ruleProvisionIds: new Set((ctx.rules ?? []).flatMap((r) => r.provision_ids)),
  };
  // Numbers may come only from: the user's own words, verified provision text, code-computed rule messages, helplines.
  const allowedNums = allowedNumbers({ user: ctx.userText ?? "", statutory: [...supplied.map((p) => p.text), ...(ctx.rules ?? []).map((r) => r.message)] });

  const removed: string[] = [];
  const guarantees: string[] = [];
  const relabelled: string[] = [];
  const numbersRemoved: string[] = [];
  const needs: { text: string; reason: NeedsReason }[] = [];

  const flagOutcome = (s: string) => {
    for (const m of s.matchAll(GUARANTEE_RE)) guarantees.push(m[0]);
    for (const m of s.matchAll(OVERCONFIDENCE_RE)) guarantees.push(m[0]);
  };
  const tidy = (s: string) =>
    s
      .replace(/\s*\[unverified reference removed\]\s*/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,;:।])/g, "$1")
      .trim();
  const checkText = (s: string) => tidy(guardNumbers(scrub(stripMd(s), allowed, removed), allowedNums, lang, numbersRemoved));

  /**
   * Free text is checked SENTENCE BY SENTENCE. A sentence that cites an unverified reference, or states a
   * legal rule that no source-matched claim / code rule supports, is moved (not deleted) to needs_verification.
   * Unbacked numbers are removed from every sentence.
   */
  const guardFree = (text: string): string => {
    const kept: string[] = [];
    for (const raw of splitSentences(stripMd(text))) {
      flagOutcome(raw);
      const before = removed.length;
      const scrubbed = scrub(raw, allowed, removed);
      const hadBadRef = removed.length > before;
      const s = guardNumbers(scrubbed, allowedNums, lang, numbersRemoved);
      if (hadBadRef) {
        // moved to "needs checking"; the removed reference is marked, so the sentence still reads sensibly
        const t = tidy(s.split(REMOVED).join("[reference removed]"));
        if (t) needs.push({ text: t, reason: "invalid_reference" });
        relabelled.push(raw);
      } else if (isLegalAssertion(s) && !isSupported(s, support)) {
        needs.push({ text: s, reason: "unsupported_legal_statement" });
        relabelled.push(raw);
      } else if (s) {
        kept.push(s);
      }
    }
    return kept.join(" ");
  };

  /* 2. Verified claims keep their place; unbacked numbers / references inside them are still removed.
        General and downgraded claims are legal points WITHOUT verification -> needs_verification. */
  const outClaims = claims.map((c) => {
    flagOutcome(c.text);
    return { ...c, text: checkText(c.text) };
  });
  for (const c of outClaims) {
    if (c.status === "general") needs.push({ text: c.text, reason: "general_explanation" });
    if (c.status === "downgraded") needs.push({ text: c.text, reason: "citation_failed" });
  }

  /* 3. Free-text fields */
  const issue_summary = guardFree(a.issue_summary);
  const options = a.options
    .map((o) => ({ title: tidy(guardNumbers(stripMd(o.title), allowedNums, lang, numbersRemoved)), description: guardFree(o.description) }))
    .filter((o) => o.description);
  const next_steps = a.next_steps.map(guardFree).filter(Boolean);
  for (const n of a.needs_verification ?? []) {
    const t = checkText(n);
    if (t) needs.push({ text: t, reason: "model_flagged" });
  }
  // Uncertainties and the lawyer reason express doubt, so they are not relabelled; numbers and references are still checked.
  const uncertainties = a.uncertainties.map(checkText).filter(Boolean);
  const lawyer_reason = checkText(a.lawyer_reason);

  // de-duplicate (the same sentence can arrive via several fields)
  const seen = new Set<string>();
  const needs_verification = needs.filter((n) => {
    const k = normalize(n.text);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const verifiedForReply = outClaims
    .filter((c) => c.status === "source_matched")
    .map((c) => ({ text: c.text, label: provisionLabel(byId.get(c.provision_id!)!) }));
  const practical = [...options.map((o) => `${o.title}: ${o.description}`), ...next_steps].slice(0, 6);

  const reply = composeReply({
    language,
    summary: issue_summary,
    verified: verifiedForReply,
    practical,
    needsCheck: needs_verification.map((n) => n.text).slice(0, 5),
  });

  return {
    issue_summary,
    claims: outClaims,
    options,
    next_steps,
    needs_verification,
    uncertainties,
    lawyer_recommended: a.lawyer_recommended,
    lawyer_reason,
    reply,
    report: {
      claims_total: claims.length,
      claims_source_matched: matched.length,
      claims_downgraded: claims.filter((c) => c.status === "downgraded").length,
      unverified_refs_removed: removed,
      guarantee_phrases_flagged: Array.from(new Set(guarantees)),
      relabelled_unsupported: relabelled,
      invented_numbers_removed: numbersRemoved,
      note: REASONING_NOT_VERIFIED,
    },
  };
}
