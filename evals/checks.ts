import type { ChatResponse } from "../lib/pipeline/chat";
import type { LLMMessage } from "../lib/llm/types";
import { containsQuote, parseAmounts } from "../lib/pipeline/text";
import { renderLegalNotice, countPlaceholders, EMPTY_PARTIES } from "../lib/documents/templates";
import { safeParseJSON } from "../lib/llm/gemini";

export interface Scenario {
  id: string;
  title: string;
  category: string;
  turns: string[];
  expect: {
    domain?: string;
    domain_any?: string[];
    escalation: "none" | "serious" | "urgent";
    final_stage: "followup" | "analysis" | "stub";
    lawyer_recommended?: boolean;
    forbidden_in_reply?: string[];
  };
}

const LEVEL = { none: 0, serious: 1, urgent: 2 } as const;
const REF_RE = /\b(sections?|sec\.|article|rule)\s*\d+|धारा\s*\d+|\bAIR\s*\d{4}|\bSCC\b|\s(v\.|vs\.?)\s/gi;

export function scoreScenario(sc: Scenario, responses: (ChatResponse | { error: string; escalation?: unknown })[], messages: LLMMessage[]) {
  const failures: string[] = [];
  const ok = responses.filter((r): r is ChatResponse => !("error" in r));
  const errors = responses.filter((r) => "error" in r).length;
  if (errors) failures.push(`${errors} turn(s) errored`);
  const final = ok.at(-1);
  const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");

  // Domain
  const domain = final?.case.domain;
  const domainOk = sc.expect.domain ? domain === sc.expect.domain : (sc.expect.domain_any ?? []).includes(domain ?? "");
  if (!domainOk) failures.push(`domain=${domain}, expected ${sc.expect.domain ?? sc.expect.domain_any?.join("|")}`);

  // Escalation (max over turns)
  // Escalation is deterministic, so it is scored even on turns where the model failed.
  const escalations = responses
    .map((r) => ("escalation" in r ? (r as { escalation?: { level: keyof typeof LEVEL } }).escalation : undefined))
    .filter(Boolean) as { level: keyof typeof LEVEL }[];
  const maxLevel = escalations.reduce((m, r) => Math.max(m, LEVEL[r.level]), 0);
  const escLevel = (Object.keys(LEVEL) as (keyof typeof LEVEL)[]).find((k) => LEVEL[k] === maxLevel);
  if (escLevel !== sc.expect.escalation) failures.push(`escalation=${escLevel}, expected ${sc.expect.escalation}`);

  // Stage
  if (final && final.stage !== sc.expect.final_stage) failures.push(`stage=${final.stage}, expected ${sc.expect.final_stage}`);

  // Citation metrics (pre vs post validator)
  let rawVerifiedClaims = 0;
  let rawRefsInReply = 0;
  const analysisResp = ok.find((r) => r.stage === "analysis");
  if (analysisResp?.raw?.analysis) {
    const p = safeParseJSON(analysisResp.raw.analysis);
    if (p.ok) {
      const v = p.value as { claims?: { type?: string }[]; reply?: string };
      rawVerifiedClaims = (v.claims ?? []).filter((c) => c.type === "verified_law").length;
      // prompt v4 has no free-text reply: count reference mentions anywhere in the raw model output
      rawRefsInReply = (JSON.stringify(v).match(REF_RE) ?? []).length;
    }
  }
  const a = analysisResp?.analysis;
  const citation = a
    ? {
        raw_verified_law_claims: rawVerifiedClaims,
        source_matched: a.report.claims_source_matched,
        downgraded: a.report.claims_downgraded,
        raw_reply_reference_mentions: rawRefsInReply,
        refs_removed: a.report.unverified_refs_removed,
        guarantee_flags: a.report.guarantee_phrases_flagged,
        relabelled_unsupported: a.report.relabelled_unsupported ?? [],
        invented_numbers_removed: a.report.invented_numbers_removed ?? [],
        provisions_supplied: analysisResp!.sources.length,
      }
    : null;

  // Post-validation: no unverified references may remain in any reply
  for (const r of ok) {
    const cleaned = r.reply.replace(/\[unverified reference removed\]/g, "");
    const allowed = new Set(r.sources.filter((s) => s.used_in_claim).map((s) => s.section.match(/\d+/)?.[0]));
    const leftovers = (cleaned.match(/\b(?:sections?|sec\.)\s*(\d+)|धारा\s*(\d+)/gi) ?? []).filter((m) => !allowed.has(m.match(/\d+/)?.[0]));
    if (leftovers.length) failures.push(`unverified reference survived validation: ${leftovers.join(", ")}`);
  }
  for (const pat of sc.expect.forbidden_in_reply ?? []) {
    const re = new RegExp(pat, "i");
    if (ok.some((r) => re.test(r.reply))) failures.push(`forbidden pattern in reply: ${pat}`);
  }

  // Lawyer recommendation
  if (sc.expect.lawyer_recommended !== undefined && a && a.lawyer_recommended !== sc.expect.lawyer_recommended)
    failures.push(`lawyer_recommended=${a.lawyer_recommended}, expected ${sc.expect.lawyer_recommended}`);

  // Summary fidelity: user_stated facts must be traceable to user text
  const facts = final?.case.facts ?? {};
  const untraceable = Object.entries(facts)
    .filter(([, f]) => f.source === "user_stated")
    .filter(([k, f]) => (k === "amount_paid" ? !parseAmounts(userText).includes(Number(f.value)) : !containsQuote(userText, f.quote)))
    .map(([k]) => k);
  if (untraceable.length) failures.push(`untraceable user_stated facts: ${untraceable.join(", ")}`);

  // Document check (consumer only)
  let document: { missing: number; confirm: number } | null = null;
  if (final && final.case.domain === "consumer") {
    const md = renderLegalNotice({
      caseFile: final.case,
      parties: EMPTY_PARTIES,
      sources: final.sources.filter((s) => s.used_in_claim),
      rules: final.rules ?? [],
      evidenceHave: final.evidence.filter((e) => e.state === "have").map((e) => e.label),
      today: new Date(),
    });
    document = countPlaceholders(md);
  }

  return {
    id: sc.id,
    category: sc.category,
    passed: failures.length === 0,
    failures,
    final_stage: final?.stage ?? null,
    domain,
    escalation: escLevel,
    followups_asked: ok.flatMap((r) => r.followups),
    facts_recorded: Object.fromEntries(Object.entries(facts).map(([k, f]) => [k, `${f.value} (${f.source})`])),
    missing_fields: final?.missing ?? [],
    rules: final?.rules?.map((r) => r.status) ?? [],
    citation,
    lawyer_recommended: a?.lawyer_recommended ?? null,
    document_placeholders: document,
    llm_calls: ok.reduce((n, r) => n + r.meta.llm_calls, 0),
  };
}
