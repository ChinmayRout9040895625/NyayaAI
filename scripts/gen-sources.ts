/** Generates docs/KNOWLEDGE_SOURCES.md from the corpus so a human can review every entry. */
import fs from "node:fs";
import path from "node:path";
import { CORPUS, CORPUS_VERSION, isCitable } from "../lib/knowledge/corpus";

const rows = CORPUS.map((e) => {
  const checks = Object.entries(e.verification_checks)
    .map(([k, v]) => `${v ? "✔" : "✘"} ${k}`)
    .join("<br>");
  return `| ${e.id} | ${e.act} | ${e.section} | ${e.title} | **${e.status}**${isCitable(e) ? " (citable)" : " (not citable)"} | ${e.verified_on ?? "—"} | ${checks} | [source](${e.source_url})${e.source_document ? `<br>${e.source_document}` : ""} | ${e.status_basis}<br>Amendments: ${e.amendments} |`;
});

const md = `# Knowledge sources

Generated from \`lib/knowledge/*.json\` by \`npm run sources\`. Do not edit by hand.

Corpus: ${CORPUS_VERSION.entries} entries, **${CORPUS_VERSION.citable} verified and citable**, last verified ${CORPUS_VERSION.last_verified}.

**Verification standard.** An entry becomes \`in_force\` (citable) only when all five checks pass:
verbatim text read on an official source; section numbering confirmed; amendments checked; commencement confirmed; current applicability confirmed.
An official URL alone is not enough. Entries that fail any check stay \`verify\` and the app never cites them.

**What verification does not mean.** A citable entry means the quoted text is accurate. It does not mean the provision applies to a given user's facts,
or that the app's legal reasoning is correct.

| ID | Act / instrument | Section | Title | Status | Verified on | Checks | Source | Basis / amendments |
|---|---|---|---|---|---|---|---|---|
${rows.join("\n")}
`;

fs.mkdirSync(path.join(process.cwd(), "docs"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "docs", "KNOWLEDGE_SOURCES.md"), md, "utf8");
console.log(`Wrote docs/KNOWLEDGE_SOURCES.md (${CORPUS.length} entries, ${CORPUS_VERSION.citable} citable)`);
