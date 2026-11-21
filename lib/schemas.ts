import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Legal corpus                                                        */
/* ------------------------------------------------------------------ */

export const OFFICIAL_SOURCE_HOSTS = [
  "indiacode.nic.in",
  "www.indiacode.nic.in",
  "egazette.gov.in",
  "egazette.nic.in",
  "consumeraffairs.nic.in",
  "doca.gov.in",
  "edaakhil.nic.in",
  "e-jagriti.gov.in",
  "consumerhelpline.gov.in",
  "labour.gov.in",
  "legislative.gov.in",
  "nalsa.gov.in",
] as const;

export const ProvisionStatus = z.enum([
  "in_force", // verified: text, section, amendments, commencement, applicability
  "repealed",
  "model_law", // model legislation, applies only where adopted
  "not_in_force",
  "verify", // not yet verified – must never be cited as law
]);
export type ProvisionStatus = z.infer<typeof ProvisionStatus>;

export const VerificationChecks = z.object({
  text_verbatim: z.boolean(), // exact text read on official source and copied verbatim
  section_number: z.boolean(), // section / sub-section numbering confirmed
  amendments: z.boolean(), // amending Acts / rule amendments checked
  commencement: z.boolean(), // commencement notification identified
  applicability: z.boolean(), // no known repeal / supersession; scope limits noted
});

export const CorpusEntry = z
  .object({
    id: z.string().regex(/^[A-Z0-9-]+$/),
    act: z.string().min(3),
    act_number: z.string().min(3),
    section: z.string().min(1),
    title: z.string().min(3),
    text: z.string(),
    text_type: z.enum(["verbatim", "pending"]),
    source_url: z.string().url(),
    source_name: z.string().min(3),
    source_document: z.string().optional(), // e.g. official PDF file name the text was read from
    jurisdiction: z.string().min(3),
    status: ProvisionStatus,
    status_basis: z.string().min(3),
    amendments: z.string().min(3),
    verification_checks: VerificationChecks,
    verified_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    domains: z.array(z.string()).min(1),
    keywords: z.array(z.string()).min(1),
    notes: z.string().optional(),
  })
  .superRefine((e, ctx) => {
    let host = "";
    try {
      host = new URL(e.source_url).hostname;
    } catch {
      /* handled by .url() */
    }
    if (!(OFFICIAL_SOURCE_HOSTS as readonly string[]).includes(host)) {
      ctx.addIssue({ code: "custom", message: `${e.id}: source host "${host}" is not on the official allow-list` });
    }
    if (e.status === "in_force") {
      const allChecks = Object.values(e.verification_checks).every(Boolean);
      if (!allChecks) ctx.addIssue({ code: "custom", message: `${e.id}: in_force requires all verification checks` });
      if (e.text_type !== "verbatim" || e.text.trim().length < 20)
        ctx.addIssue({ code: "custom", message: `${e.id}: in_force requires verbatim text` });
      if (!e.verified_on) ctx.addIssue({ code: "custom", message: `${e.id}: in_force requires verified_on` });
    }
  });
export type CorpusEntry = z.infer<typeof CorpusEntry>;

/* ------------------------------------------------------------------ */
/* Case file                                                           */
/* ------------------------------------------------------------------ */

export const Domain = z.enum(["consumer", "tenancy", "employment", "out_of_scope", "unknown"]);
export type Domain = z.infer<typeof Domain>;

export const Language = z.enum(["en", "hi", "hinglish"]);
export type Language = z.infer<typeof Language>;

export const FactSource = z.enum(["user_stated", "inferred"]);

export const Fact = z.object({
  value: z.string(),
  source: FactSource,
  quote: z.string().optional(), // user's own words supporting the fact
});
export type Fact = z.infer<typeof Fact>;

export const TimelineEvent = z.object({
  date: z.string().nullable(), // ISO yyyy-mm-dd, yyyy-mm, or null
  event: z.string(),
  source: FactSource, // whether the EVENT is in the user's words
  quote: z.string().optional(),
  // whether the DATE itself was written by the user, or worked out by the model ("after 10 days", today)
  date_source: FactSource.optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEvent>;

export const EvidenceState = z.enum(["have", "missing", "not_mentioned"]);

export const CaseFile = z.object({
  domain: Domain,
  language: Language,
  facts: z.record(z.string(), Fact),
  timeline: z.array(TimelineEvent),
  evidence: z.record(z.string(), z.object({ state: EvidenceState, quote: z.string().optional() })),
  notes: z.array(z.string()), // system notes: downgraded facts, assumptions
  turns: z.number().int(),
});
export type CaseFile = z.infer<typeof CaseFile>;

export function emptyCase(): CaseFile {
  return { domain: "unknown", language: "en", facts: {}, timeline: [], evidence: {}, notes: [], turns: 0 };
}

/* ------------------------------------------------------------------ */
/* LLM outputs                                                         */
/* ------------------------------------------------------------------ */

export const Understanding = z.object({
  domain: Domain,
  domain_confidence: z.number().min(0).max(1),
  language: Language,
  extracted: z.array(
    z.object({
      field: z.string(),
      value: z.string(),
      source: FactSource,
      quote: z.string().default(""),
    }),
  ),
  timeline: z.array(
    z.object({ date: z.string().nullable(), event: z.string(), quote: z.string().default("") }),
  ),
  evidence_mentioned: z.array(z.object({ key: z.string(), has: z.boolean(), quote: z.string().default("") })),
  search_terms: z.array(z.string()),
  user_wants_analysis: z.boolean(),
  acknowledgement: z.string(), // 1-2 sentence empathetic acknowledgement in the user's language, no legal claims
});
export type Understanding = z.infer<typeof Understanding>;

export const Claim = z.object({
  text: z.string(),
  type: z.enum(["verified_law", "general_explanation"]),
  provision_id: z.string().nullable().default(null),
  support_quote: z.string().nullable().default(null),
});
export type Claim = z.infer<typeof Claim>;

export const AnalysisLLM = z.object({
  issue_summary: z.string(), // facts only, no legal rules
  claims: z.array(Claim), // EVERY statement about the law goes here
  options: z.array(z.object({ title: z.string(), description: z.string() })), // practical only
  next_steps: z.array(z.string()), // practical only
  needs_verification: z.array(z.string()).default([]), // legal points the model could not support with a quote
  uncertainties: z.array(z.string()),
  lawyer_recommended: z.boolean(),
  lawyer_reason: z.string().nullable().transform((s) => s ?? ""),
  // Older prompt versions returned a free-text reply. It is accepted but IGNORED: the reply is now composed by code.
  reply: z.string().optional(),
});
export type AnalysisLLM = z.infer<typeof AnalysisLLM>;

/* Validated claim as shown to the user */
export const ValidatedClaim = Claim.extend({
  status: z.enum(["source_matched", "downgraded", "general"]),
  reason: z.string().optional(),
});
export type ValidatedClaim = z.infer<typeof ValidatedClaim>;

export interface ValidationReport {
  claims_total: number;
  claims_source_matched: number;
  claims_downgraded: number;
  unverified_refs_removed: string[];
  guarantee_phrases_flagged: string[];
  relabelled_unsupported: string[]; // free-text legal statements moved to "needs legal verification"
  invented_numbers_removed: string[]; // deadlines / amounts not traceable to user text, provisions or code checks
  note: string; // always states that reasoning is not verified
}
