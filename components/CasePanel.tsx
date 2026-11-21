"use client";

import { useState } from "react";
import type { ChatResponse } from "@/lib/pipeline/chat";
import type { CaseFile } from "@/lib/schemas";
import { CONSUMER_FIELDS } from "@/lib/domains/consumer";
import { DOMAIN_STUBS } from "@/lib/domains/stubs";
import { formatINR } from "@/lib/pipeline/text";
import { EVIDENCE_HI, FIELD_LABELS_HI, UI_TEXT, panelMode, uiLang, type UiText } from "@/lib/i18n";
import DocumentsTab from "./DocumentsTab";

const TABS = ["Summary", "Law & sources", "Evidence", "Documents"] as const;
type Tab = (typeof TABS)[number];

function SourceBadge({ s, t }: { s: "user_stated" | "inferred"; t: UiText }) {
  return s === "user_stated" ? (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">{t.youSaid}</span>
  ) : (
    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">{t.inferred}</span>
  );
}

function DateInferredBadge({ t }: { t: UiText }) {
  return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{t.dateInferred}</span>;
}

export default function CasePanel({
  caseFile,
  last,
  corpus,
}: {
  caseFile: CaseFile;
  last: ChatResponse | null;
  corpus: { entries: number; citable: number; last_verified: string } | null;
}) {
  const [tab, setTab] = useState<Tab>("Summary");
  const a = last?.analysis;
  const lang = uiLang(caseFile.language);
  const t = UI_TEXT[lang];
  const mode = panelMode(caseFile.domain);
  const stub = DOMAIN_STUBS[caseFile.domain];

  const timeline = caseFile.timeline.length > 0 && (
    <div>
      <h3 className="mb-2 font-semibold">{t.timeline}</h3>
      <ul className="space-y-1">
        {caseFile.timeline.map((ev, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{ev.date ?? t.dateUnknown}</span>
            <span>{ev.event}</span>
            <SourceBadge s={ev.source} t={t} />
            {ev.date && ev.date_source === "inferred" && <DateInferredBadge t={t} />}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <section className="flex h-[calc(100vh-6rem)] flex-col rounded-xl border border-slate-200 bg-white print:h-auto print:border-0">
      <div className="flex gap-1 border-b border-slate-200 px-2 pt-2 print:hidden">
        {TABS.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`rounded-t-md px-3 py-1.5 text-sm ${tab === tb ? "border border-b-white border-slate-200 bg-white font-medium text-indigo-800" : "text-slate-600 hover:text-slate-900"}`}
          >
            {t.tabs[tb]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-sm print:overflow-visible">
        {tab === "Summary" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-slate-100 px-2 py-0.5">
                {t.domain}: {t.domains[caseFile.domain]}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5">
                {t.language}: {t.languages[caseFile.language]}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5">
                {t.turns}: {caseFile.turns}
              </span>
              {last && (
                <span className="rounded bg-slate-100 px-2 py-0.5">
                  {t.stage}: {t.stages[last.stage]}
                </span>
              )}
            </div>

            {mode === "stub" ? (
              /* Tenancy / employment / out-of-scope: no consumer fact table (it would show irrelevant "missing" rows). */
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  {t.stubNotice}
                  {stub && stub.evidence.length > 0 && (
                    <>
                      <div className="mt-2 font-medium">{t.usefulToKeep}</div>
                      <ul className="mt-1 list-disc pl-5">
                        {(lang === "hi" ? stub.evidence_hi : stub.evidence).map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {caseFile.facts.problem_description && (
                  <div>
                    <h3 className="mb-1 font-semibold">{t.whatYouToldMe}</h3>
                    <p>{caseFile.facts.problem_description.value}</p>
                    {lang === "hi" && caseFile.facts.problem_description.quote && (
                      <p className="mt-1 text-xs text-slate-500">
                        {t.yourWords}: “{caseFile.facts.problem_description.quote}”
                      </p>
                    )}
                  </div>
                )}
                {timeline}
              </>
            ) : (
              <>
                <div>
                  <h3 className="mb-2 font-semibold">{t.caseFacts}</h3>
                  <table className="w-full border-collapse">
                    <tbody>
                      {CONSUMER_FIELDS.map((f) => {
                        const v = caseFile.facts[f.key];
                        return (
                          <tr key={f.key} className="border-b border-slate-100 align-top">
                            <td className="w-1/3 py-1.5 pr-2 text-slate-500">{lang === "hi" ? (FIELD_LABELS_HI[f.key] ?? f.label) : f.label}</td>
                            <td className="py-1.5">
                              {v ? (
                                <>
                                  <span className="flex flex-wrap items-center gap-2">
                                    <span>{f.key === "amount_paid" && !isNaN(Number(v.value)) ? formatINR(Number(v.value)) : v.value}</span>
                                    <SourceBadge s={v.source} t={t} />
                                  </span>
                                  {lang === "hi" && v.quote && f.key !== "amount_paid" && (
                                    <span className="mt-0.5 block text-xs text-slate-500">
                                      {t.yourWords}: “{v.quote}”
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-amber-700">
                                  {t.missing}
                                  {f.core ? ` ${t.needed}` : ""}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {timeline}

                {last?.rules && last.rules.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-semibold">
                      {t.checks} {t.inEnglish && <span className="text-xs font-normal text-slate-500">{t.inEnglish}</span>}
                    </h3>
                    <ul className="space-y-2">
                      {last.rules.map((r) => (
                        <li key={r.status + r.message} className="rounded border border-slate-200 p-2">
                          <div className="text-xs font-medium uppercase text-slate-500">{r.status.replace(/_/g, " ")}</div>
                          <div>{r.message}</div>
                          {r.assumptions.map((x) => (
                            <div key={x} className="mt-1 text-xs text-slate-500">
                              {t.assumption}: {x}
                            </div>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {a && (
                  <>
                    <div>
                      <h3 className="mb-1 font-semibold">{t.whereYouStand}</h3>
                      <p>{a.issue_summary}</p>
                    </div>
                    {a.options.length > 0 && (
                      <div>
                        <h3 className="mb-1 font-semibold">{t.options}</h3>
                        <ul className="space-y-1">
                          {a.options.map((o) => (
                            <li key={o.title}>
                              <strong>{o.title}:</strong> {o.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.next_steps.length > 0 && (
                      <div>
                        <h3 className="mb-1 font-semibold">{t.nextSteps}</h3>
                        <ol className="list-decimal space-y-1 pl-5">
                          {a.next_steps.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {a.uncertainties.length > 0 && (
                      <div>
                        <h3 className="mb-1 font-semibold">{t.uncertain}</h3>
                        <ul className="list-disc space-y-1 pl-5 text-slate-700">
                          {a.uncertainties.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {a.lawyer_recommended && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                        <strong>{t.lawyer}</strong> {a.lawyer_reason} {t.freeAid}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {caseFile.notes.length > 0 && (
              <div>
                <h3 className="mb-1 font-semibold">{t.systemNotes}</h3>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-500">
                  {caseFile.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "Law & sources" && (
          <div className="space-y-4">
            {corpus && (
              <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                {t.library(corpus.entries, corpus.citable, corpus.last_verified)}
              </div>
            )}
            {!a && <p className="text-slate-500">{t.analysisLater}</p>}
            {a && (
              <>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-indigo-900">
                  <div className="font-medium">
                    {t.sourceCheck(a.report.claims_source_matched, a.report.claims_total)}
                    {a.report.claims_downgraded > 0 && t.downgraded(a.report.claims_downgraded)}
                    {a.report.unverified_refs_removed.length > 0 && t.removed(a.report.unverified_refs_removed.length)}
                  </div>
                  <div className="mt-1 text-xs">{t.reasoningNote || a.report.note}</div>
                  {a.report.guarantee_phrases_flagged.length > 0 && (
                    <div className="mt-1 text-xs text-red-700">{t.guaranteeFlag(a.report.guarantee_phrases_flagged.join(", "))}</div>
                  )}
                </div>
                {(a.report.relabelled_unsupported.length > 0 || a.report.invented_numbers_removed.length > 0) && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    {a.report.relabelled_unsupported.length > 0 && <div>{t.relabelledCount(a.report.relabelled_unsupported.length)}</div>}
                    {a.report.invented_numbers_removed.length > 0 && (
                      <div>
                        {t.numbersRemoved(a.report.invented_numbers_removed.length)}: {a.report.invented_numbers_removed.join(" · ")}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <h3 className="mb-2 font-semibold">{t.verifiedLaw}</h3>
                  {a.claims.filter((c) => c.status === "source_matched").length === 0 && <p className="text-xs text-slate-500">{t.noneVerified}</p>}
                  <ul className="space-y-2">
                    {a.claims
                      .filter((c) => c.status === "source_matched")
                      .map((c, i) => (
                        <li key={i} className="rounded border border-emerald-200 p-2">
                          <div className="mb-1">
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                              {t.quoteMatched} · {c.provision_id}
                            </span>
                          </div>
                          <div>{c.text}</div>
                          {c.support_quote && (
                            <blockquote className="mt-1 border-l-2 border-emerald-300 pl-2 text-xs italic text-slate-600">“{c.support_quote}”</blockquote>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
                {a.needs_verification.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-semibold">{t.needsVerification}</h3>
                    <ul className="space-y-2">
                      {a.needs_verification.map((n, i) => (
                        <li key={i} className="rounded border border-amber-200 p-2">
                          <div className="mb-1">
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{t.needsReason[n.reason]}</span>
                          </div>
                          <div>{n.text}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {a.report.unverified_refs_removed.length > 0 && (
                  <div className="text-xs text-slate-500">
                    {t.removedList}: {a.report.unverified_refs_removed.join(" · ")}
                  </div>
                )}
              </>
            )}
            {last && last.sources.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold">{t.supplied}</h3>
                <ul className="space-y-2">
                  {last.sources.map((s) => (
                    <li key={s.id} className="rounded border border-slate-200 p-2">
                      <div className="font-medium">
                        {s.act}, Section {s.section} – {s.title} {s.used_in_claim && <span className="text-xs text-emerald-700">{t.used}</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {t.status}: {s.status} · {t.verified} {s.verified_on} ·{" "}
                        <a href={s.source_url} target="_blank" rel="noreferrer" className="text-indigo-700 underline">
                          {t.officialSource}
                        </a>
                      </div>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-indigo-700">{t.officialText}</summary>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{s.text}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {last && last.stage === "analysis" && last.sources.length === 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">{t.noProvision}</div>
            )}
            {last && last.unverified_matches.length > 0 && (
              <div>
                <h3 className="mb-2 font-semibold">{t.relatedUnverified}</h3>
                <ul className="space-y-1 text-xs text-slate-600">
                  {last.unverified_matches.map((s) => (
                    <li key={s.id}>
                      {s.act}, {s.section} – {s.title} ·{" "}
                      <span className="font-medium">
                        {t.status}: {s.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "Evidence" && (
          <div>
            {mode === "stub" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                {t.stubNotice}
                {stub && stub.evidence.length > 0 && (
                  <ul className="mt-2 list-disc pl-5">
                    {(lang === "hi" ? stub.evidence_hi : stub.evidence).map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
                <p className="mb-3 text-slate-600">{t.evidenceIntro}</p>
                <ul className="space-y-2">
                  {(last?.evidence ?? []).map((e) => {
                    const hiText = lang === "hi" ? EVIDENCE_HI[e.key] : undefined;
                    return (
                      <li key={e.key} className="rounded border border-slate-200 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{hiText?.label ?? e.label}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              e.state === "have" ? "bg-emerald-100 text-emerald-800" : e.state === "missing" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {e.state === "have" ? t.have : e.state === "missing" ? t.dontHave : t.notMentioned}
                          </span>
                        </div>
                        {(hiText?.why ?? e.why) && <div className="mt-1 text-xs text-slate-600">{hiText?.why ?? e.why}</div>}
                      </li>
                    );
                  })}
                </ul>
                {!last && <p className="text-slate-500">{t.startConversation}</p>}
              </>
            )}
          </div>
        )}

        {tab === "Documents" && <DocumentsTab caseFile={caseFile} last={last} t={t} />}
      </div>
    </section>
  );
}
