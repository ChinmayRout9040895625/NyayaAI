import { z } from "zod";
import { CorpusEntry } from "../schemas";
import consumer from "./consumer.json";
import tenancy from "./tenancy.json";
import employment from "./employment.json";

/** Validated once at module load: an invalid corpus is a build/test failure, not a runtime surprise. */
export const CORPUS: CorpusEntry[] = z.array(CorpusEntry).parse([...consumer, ...tenancy, ...employment]);

const ids = new Set<string>();
for (const e of CORPUS) {
  if (ids.has(e.id)) throw new Error(`Duplicate corpus id ${e.id}`);
  ids.add(e.id);
}

export const CORPUS_BY_ID = new Map(CORPUS.map((e) => [e.id, e]));

/** Only fully verified, in-force provisions may support a legal claim. */
export function isCitable(e: CorpusEntry | undefined): e is CorpusEntry {
  return !!e && e.status === "in_force" && e.text_type === "verbatim";
}

export const CORPUS_VERSION = (() => {
  const dates = CORPUS.map((e) => e.verified_on).filter(Boolean) as string[];
  const latest = dates.sort().at(-1) ?? "none";
  const citable = CORPUS.filter(isCitable).length;
  return { entries: CORPUS.length, citable, last_verified: latest };
})();
