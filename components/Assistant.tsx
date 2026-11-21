"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatResponse } from "@/lib/pipeline/chat";
import type { TriageResult } from "@/lib/pipeline/triage";
import { emptyCase, type CaseFile } from "@/lib/schemas";
import CasePanel from "./CasePanel";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Health {
  ai: { configured: boolean; provider: string; model: string | null; message: string };
  corpus: { entries: number; citable: number; last_verified: string };
}

const EXAMPLES = [
  "I ordered a phone online for ₹18,999 on 2 Oct. It arrived with a cracked screen and the seller rejected my return request.",
  "Maine ek AC repair ke liye 3500 diye the, technician aaya hi nahi aur company refund nahi de rahi.",
];

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [caseFile, setCaseFile] = useState<CaseFile>(emptyCase());
  const [last, setLast] = useState<ChatResponse | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escalation, setEscalation] = useState<TriageResult | null>(null); // deterministic; shown even if the AI fails
  const [health, setHealth] = useState<Health | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const aiReady = health?.ai.configured ?? false;

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, caseFile }),
      });
      const data = await res.json();
      if (data.escalation) setEscalation(data.escalation);
      if (!res.ok) {
        setError(data.message ?? "Something went wrong.");
        setMessages(messages); // roll back so the user can retry
        setInput(t);
        return;
      }
      const r = data as ChatResponse;
      setLast(r);
      setCaseFile(r.case);
      setMessages([...next, { role: "assistant", content: r.reply }]);
    } catch {
      setError("Network error – please try again.");
      setMessages(messages);
      setInput(t);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMessages([]);
    setCaseFile(emptyCase());
    setLast(null);
    setError(null);
    setEscalation(null);
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Chat column */}
      <section className="flex h-[calc(100vh-6rem)] flex-col rounded-xl border border-slate-200 bg-white print:hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span>
            Legal information, not legal advice ·{" "}
            {health ? (
              aiReady ? (
                <>AI: {health.ai.provider} / {health.ai.model}</>
              ) : (
                <span className="text-red-600">AI not configured</span>
              )
            ) : (
              "checking AI…"
            )}
          </span>
          <button onClick={reset} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-50">
            Clear case
          </button>
        </div>

        {health && !aiReady && (
          <div className="m-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <strong>AI provider not configured.</strong> {health.ai.message}
          </div>
        )}

        {escalation && escalation.level !== "none" && (
          <div
            className={`mx-3 mt-3 rounded-lg border p-3 text-sm ${
              escalation.level === "urgent" ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            <strong>{escalation.level === "urgent" ? "This may be urgent – please get human help now." : "This needs a lawyer's advice."}</strong>
            <ul className="mt-1 list-disc pl-5">
              {escalation.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <div className="mt-1">
              {escalation.helplines.map((h) => (
                <span key={h.number} className="mr-3 inline-block">
                  {h.name}: <strong>{h.number}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">Describe your consumer problem in your own words.</p>
              <p className="mt-1">English, हिंदी or Hinglish. Please don&apos;t enter Aadhaar, bank or card numbers.</p>
              <div className="mt-3 space-y-2">
                {EXAMPLES.map((e) => (
                  <button
                    key={e}
                    disabled={!aiReady}
                    onClick={() => send(e)}
                    className="block w-full rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50 disabled:opacity-50"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-900"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div className="text-sm text-slate-500">Thinking…</div>}
          <div ref={endRef} />
        </div>

        {error && <div className="mx-3 mb-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t border-slate-200 p-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            maxLength={4000}
            disabled={!aiReady || busy}
            placeholder={aiReady ? "Type your message… (Enter to send)" : "AI not configured"}
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={!aiReady || busy || !input.trim()}
            className="rounded-lg bg-indigo-700 px-4 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </section>

      {/* Case column */}
      <CasePanel caseFile={caseFile} last={last} corpus={health?.corpus ?? null} />
    </main>
  );
}
