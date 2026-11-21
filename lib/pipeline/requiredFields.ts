import type { CaseFile } from "../schemas";
import { CONSUMER_EVIDENCE, CONSUMER_FIELDS, type FieldSpec } from "../domains/consumer";

export function missingFields(c: CaseFile): FieldSpec[] {
  return CONSUMER_FIELDS.filter((f) => !c.facts[f.key]?.value);
}

export function pickFollowups(c: CaseFile, max = 2): FieldSpec[] {
  return missingFields(c).slice(0, max);
}

/**
 * Analysis runs when all core fields are present, or the user asks for it after at least one
 * follow-up round, or after 4 turns (avoid endless interrogation). Missing fields become caveats.
 */
export function readyForAnalysis(c: CaseFile, userWantsAnalysis: boolean): boolean {
  const coreMissing = missingFields(c).filter((f) => f.core);
  if (coreMissing.length === 0) return true;
  if (!c.facts.problem_description) return false;
  return (userWantsAnalysis && c.turns >= 2) || c.turns >= 4;
}

export interface EvidenceItem {
  key: string;
  label: string;
  why: string;
  state: "have" | "missing" | "not_mentioned";
  quote?: string;
}

export function evidenceChecklist(c: CaseFile): EvidenceItem[] {
  return CONSUMER_EVIDENCE.map((e) => ({
    ...e,
    state: c.evidence[e.key]?.state ?? "not_mentioned",
    quote: c.evidence[e.key]?.quote,
  }));
}
