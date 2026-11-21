"use client";

import { useMemo, useState } from "react";
import type { ChatResponse } from "@/lib/pipeline/chat";
import type { CaseFile } from "@/lib/schemas";
import { EMPTY_PARTIES, countPlaceholders, renderComplaint, renderLegalNotice, type PartyDetails } from "@/lib/documents/templates";
import { parseDocMarkdown, type Inline } from "@/lib/documents/markdown";
import type { UiText } from "@/lib/i18n";

const FIELD_KEYS: (keyof PartyDetails)[] = [
  "complainant_name",
  "complainant_address",
  "complainant_contact",
  "opposite_party_name",
  "opposite_party_address",
  "order_or_invoice_no",
  "reply_days",
  "district",
];

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((x, i) => {
        let node: React.ReactNode = x.text;
        if (x.placeholder) node = <mark className={x.placeholder === "missing" ? "ph-missing" : "ph-confirm"}>{x.text}</mark>;
        if (x.italic) node = <em>{node}</em>;
        if (x.bold) node = <strong>{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

/** Renders the template Markdown as formatted text (headings, bold, lists) instead of raw syntax. */
function DocView({ md }: { md: string }) {
  const blocks = parseDocMarkdown(md);
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "h1" || b.type === "h2")
          return b.type === "h1" ? (
            <h2 key={i} className="mb-3 text-center text-base font-bold tracking-wide">
              <Inlines items={b.inlines} />
            </h2>
          ) : (
            <h3 key={i} className="mb-1 mt-3 font-bold">
              <Inlines items={b.inlines} />
            </h3>
          );
        if (b.type === "hr") return <hr key={i} className="my-3 border-slate-300" />;
        if (b.type === "li")
          return (
            <div key={i} className={`flex gap-2 ${b.indent ? "pl-6" : "pl-2"}`}>
              <span aria-hidden>•</span>
              <span><Inlines items={b.inlines} /></span>
            </div>
          );
        return (
          <p key={i} className={`my-2 ${b.italic ? "text-xs italic text-slate-600" : ""}`}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Inlines items={l} />
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

export default function DocumentsTab({ caseFile, last, t }: { caseFile: CaseFile; last: ChatResponse | null; t: UiText }) {
  const [kind, setKind] = useState<"notice" | "complaint">("notice");
  const [parties, setParties] = useState<PartyDetails>(EMPTY_PARTIES);

  const doc = useMemo(() => {
    const sources = (last?.sources ?? []).filter((s) => s.used_in_claim && s.status === "in_force");
    const evidenceHave = (last?.evidence ?? []).filter((e) => e.state === "have").map((e) => e.label);
    const input = { caseFile, parties, sources, rules: last?.rules ?? [], evidenceHave, today: new Date() };
    return kind === "notice" ? renderLegalNotice(input) : renderComplaint(input);
  }, [kind, parties, caseFile, last]);

  const counts = countPlaceholders(doc);

  if (caseFile.domain !== "consumer") {
    return <p className="text-slate-500">{t.docsConsumerOnly}</p>;
  }

  function download() {
    const blob = new Blob([doc], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind === "notice" ? "legal-notice-draft.md" : "consumer-complaint-draft.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 print:hidden">
        <button
          onClick={() => setKind("notice")}
          className={`rounded-md border px-3 py-1 ${kind === "notice" ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-300"}`}
        >
          {t.legalNotice}
        </button>
        <button
          onClick={() => setKind("complaint")}
          className={`rounded-md border px-3 py-1 ${kind === "complaint" ? "border-indigo-600 bg-indigo-50 text-indigo-800" : "border-slate-300"}`}
        >
          {t.complaintDraft}
        </button>
      </div>

      <details className="rounded border border-slate-200 p-2 print:hidden" open>
        <summary className="cursor-pointer font-medium">{t.yourDetails}</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FIELD_KEYS.map((key) => (
            <label key={key} className="text-xs text-slate-600">
              {t.partyLabels[key]}
              <input
                value={parties[key]}
                onChange={(e) => setParties({ ...parties, [key]: e.target.value })}
                className="mt-0.5 block w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
              />
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className={`rounded px-2 py-0.5 text-xs ${counts.missing ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
          {t.placeholders(counts.missing, counts.confirm)}
        </span>
        <button onClick={download} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
          {t.download}
        </button>
        <button onClick={() => window.print()} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
          {t.print}
        </button>
      </div>
      {t.docEnglish && <p className="text-xs text-slate-500 print:hidden">{t.docEnglish}</p>}

      <div id="print-doc" className="max-h-[60vh] overflow-y-auto rounded border border-slate-200 bg-white p-4 font-serif text-[13px] leading-relaxed">
        <DocView md={doc} />
      </div>
    </div>
  );
}
