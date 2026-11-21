import MiniSearch from "minisearch";
import type { CorpusEntry } from "../schemas";
import { CORPUS, CORPUS_BY_ID, isCitable } from "./corpus";

const index = new MiniSearch<CorpusEntry>({
  fields: ["title", "keywords_text", "text", "section"],
  storeFields: ["id"],
  extractField: (doc, field) =>
    field === "keywords_text" ? doc.keywords.join(" ") : (doc as unknown as Record<string, string>)[field],
  searchOptions: { boost: { keywords_text: 3, title: 2 }, fuzzy: 0.15, prefix: true, combineWith: "OR" },
});
index.addAll(CORPUS);

export const MIN_SCORE = 2.0; // below this a match is treated as "no relevant provision"

export interface RetrievalResult {
  provisions: CorpusEntry[]; // citable provisions sent to the model
  matched_unverified: CorpusEntry[]; // relevant but not citable (verify / model_law) – shown with status badge
  scores: Record<string, number>;
}

/**
 * Deterministic retrieval: domain anchors + keyword (BM25) hits above a threshold.
 * Only citable entries are returned in `provisions`.
 */
export function retrieve(query: string, domain: string, anchors: string[] = [], limit = 10): RetrievalResult {
  const scores: Record<string, number> = {};
  const hits = query.trim()
    ? index.search(query).filter((h) => h.score >= MIN_SCORE)
    : [];
  const ordered: string[] = [];
  for (const id of anchors) if (!ordered.includes(id)) ordered.push(id);
  for (const h of hits) {
    const e = CORPUS_BY_ID.get(h.id as string);
    if (!e || !e.domains.includes(domain)) continue;
    scores[e.id] = Math.round(h.score * 100) / 100;
    if (!ordered.includes(e.id)) ordered.push(e.id);
  }
  const provisions: CorpusEntry[] = [];
  const matched_unverified: CorpusEntry[] = [];
  for (const id of ordered) {
    const e = CORPUS_BY_ID.get(id);
    if (!e) continue;
    if (isCitable(e)) {
      if (provisions.length < limit) provisions.push(e);
    } else matched_unverified.push(e);
  }
  return { provisions, matched_unverified, scores };
}
