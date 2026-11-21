import { AnalysisLLM, CaseFile, Understanding, emptyCase, type CorpusEntry, type Language } from "../schemas";
import type { LLMMessage, LLMProvider } from "../llm/types";
import { understandSystem, analysisSystem, PROMPT_VERSION } from "../prompts";
import { triage, type TriageResult } from "./triage";
import { mergeCase } from "./mergeCase";
import { evidenceChecklist, missingFields, pickFollowups, readyForAnalysis, type EvidenceItem } from "./requiredFields";
import { retrieve } from "../knowledge/retrieve";
import { CONSUMER_ANCHOR_PROVISIONS, CONSUMER_GENERAL_STEPS } from "../domains/consumer";
import { DOMAIN_STUBS } from "../domains/stubs";
import { checkForum, checkLimitation, checkPurpose, type RuleResult } from "../legal/consumerRules";
import { validateAnalysis, type ValidatedAnalysis } from "../safety/citationValidator";

export interface SourceView {
  id: string;
  act: string;
  section: string;
  title: string;
  text: string;
  source_url: string;
  status: string;
  verified_on: string | null;
  used_in_claim: boolean;
}

export interface ChatResponse {
  stage: "followup" | "analysis" | "stub";
  reply: string;
  case: CaseFile;
  followups: string[];
  missing: string[];
  escalation: TriageResult;
  evidence: EvidenceItem[];
  analysis?: Omit<ValidatedAnalysis, "reply">;
  rules?: RuleResult[];
  sources: SourceView[];
  unverified_matches: SourceView[];
  meta: { provider: string; model: string; prompt_version: string; llm_calls: number };
  raw?: { understanding: string; analysis?: string }; // only when includeRaw (evaluation runs)
}

const MAX_HISTORY = 14;

function view(e: CorpusEntry, used: boolean): SourceView {
  return {
    id: e.id,
    act: e.act,
    section: e.section,
    title: e.title,
    text: e.text,
    source_url: e.source_url,
    status: e.status,
    verified_on: e.verified_on,
    used_in_claim: used,
  };
}

function lastUserText(messages: LLMMessage[]): string {
  return [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
}

export interface TurnArgs {
  provider: LLMProvider;
  messages: LLMMessage[];
  caseFile?: CaseFile;
  today?: Date;
  includeRaw?: boolean;
}

/** Raised when the model fails. Carries the deterministic triage so safety guidance survives AI outages. */
export class TurnError extends Error {
  constructor(
    public cause: unknown,
    public escalation: TriageResult,
  ) {
    super((cause as Error)?.message ?? String(cause));
    this.name = (cause as Error)?.name ?? "TurnError";
  }
}

export async function runTurn(args: TurnArgs): Promise<ChatResponse> {
  const userText = args.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const escalation = triage(lastUserText(args.messages) + "\n" + userText);
  try {
    return await runTurnInner(args, escalation);
  } catch (e) {
    throw new TurnError(e, escalation);
  }
}

async function runTurnInner(args: TurnArgs, escalation: TriageResult): Promise<ChatResponse> {
  const today = args.today ?? new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const messages = args.messages.slice(-MAX_HISTORY);
  const prev = args.caseFile ? CaseFile.parse(args.caseFile) : emptyCase();
  const userText = args.messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  let llmCalls = 0;

  // 1. Deterministic safety triage already ran in runTurn, before any model call.

  // 2. Understand (LLM)
  const known = JSON.stringify(prev.facts);
  const u = await args.provider.generateJSON({
    system: understandSystem(todayIso),
    messages: [...messages.slice(0, -1), { role: "user", content: `${lastUserText(messages)}\n\n[System context – facts already recorded: ${known}]` }],
    schema: Understanding,
    effort: "minimal",
  });
  llmCalls++;

  // 3. Deterministic merge
  const c = mergeCase(prev, u.data, userText);
  const meta = { provider: args.provider.name, model: args.provider.model, prompt_version: PROMPT_VERSION, llm_calls: llmCalls };
  const raw = args.includeRaw ? { understanding: u.raw } : undefined;

  // 4. Non-consumer domains → fixed stub text (no model-generated legal content)
  if (c.domain !== "consumer" && c.domain !== "unknown") {
    const stub = DOMAIN_STUBS[c.domain]!;
    const { matched_unverified } = retrieve(u.data.search_terms.join(" "), c.domain);
    return {
      stage: "stub",
      reply: stub.reply[c.language],
      case: c,
      followups: [],
      missing: [],
      escalation,
      evidence: stub.evidence.map((label, i) => ({ key: `stub_${i}`, label, why: "", state: "not_mentioned" as const })),
      sources: [],
      unverified_matches: matched_unverified.map((e) => view(e, false)),
      meta,
      raw,
    };
  }

  // 5. Follow-up questions (deterministic choice; templates in user's language)
  if (!readyForAnalysis(c, u.data.user_wants_analysis)) {
    const fu = pickFollowups(c);
    const qs = fu.map((f) => f.question[c.language as Language]);
    const reply = [u.data.acknowledgement.trim(), ...qs.map((q, i) => `${i + 1}. ${q}`)].filter(Boolean).join("\n\n");
    return {
      stage: "followup",
      reply,
      case: c,
      followups: qs,
      missing: missingFields(c).map((f) => f.key),
      escalation,
      evidence: evidenceChecklist(c),
      sources: [],
      unverified_matches: [],
      meta,
      raw,
    };
  }

  // 6. Retrieval + deterministic rules
  const query = [...u.data.search_terms, c.facts.problem_description?.value ?? ""].join(" ");
  const r = retrieve(query, "consumer", CONSUMER_ANCHOR_PROVISIONS);
  const rules = [checkLimitation(c, today), checkForum(c), checkPurpose(c)].filter(Boolean) as RuleResult[];

  // 7. Analysis (LLM) with only verified provisions
  const provisionsBlock = r.provisions.length
    ? r.provisions.map((p) => `[${p.id}] ${p.act}, Section ${p.section} – ${p.title}\n"""${p.text}"""`).join("\n\n")
    : "(EMPTY – no verified provision available)";
  const analysisInput = `CASE FILE:\n${JSON.stringify({ facts: c.facts, timeline: c.timeline, evidence: c.evidence }, null, 1)}\n\nMISSING INFORMATION: ${missingFields(c).map((f) => f.label).join(", ") || "none"}\n\nVERIFIED PROVISIONS:\n${provisionsBlock}\n\nDETERMINISTIC CHECKS:\n${rules.map((x) => `- ${x.status}: ${x.message}`).join("\n")}\n\nUSER LANGUAGE: ${c.language}\n\nLATEST USER MESSAGE:\n${lastUserText(messages)}`;
  const a = await args.provider.generateJSON({
    system: analysisSystem(),
    messages: [{ role: "user", content: analysisInput }],
    schema: AnalysisLLM,
    effort: "low",
  });
  llmCalls++;

  // 8. Deterministic validation
  const v = validateAnalysis(a.data, r.provisions, { userText, rules, language: c.language });
  if (r.provisions.length === 0 && !v.next_steps.length) v.next_steps = CONSUMER_GENERAL_STEPS;
  const usedIds = new Set(v.claims.filter((x) => x.status === "source_matched").map((x) => x.provision_id));
  const { reply, ...analysis } = v;

  return {
    stage: "analysis",
    reply,
    case: c,
    followups: [],
    missing: missingFields(c).map((f) => f.key),
    escalation,
    evidence: evidenceChecklist(c),
    analysis,
    rules,
    sources: r.provisions.map((p) => view(p, usedIds.has(p.id))),
    unverified_matches: r.matched_unverified.map((e) => view(e, false)),
    meta: { ...meta, llm_calls: llmCalls },
    raw: args.includeRaw ? { understanding: u.raw, analysis: a.raw } : undefined,
  };
}
