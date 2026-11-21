import Link from "next/link";
import { providerStatus } from "@/lib/llm";
import { privacyNotice } from "@/lib/privacy";

// Rendered per request so the privacy notice names the provider actually configured (LLM_PROVIDER).
export const dynamic = "force-dynamic";

const steps = [
  { t: "Tell your story", d: "In English, Hindi or Hinglish – the way you would tell a friend." },
  { t: "Build the case", d: "It asks only what is missing: who, what, when, how much, and what proof you have." },
  { t: "Understand where you stand", d: "Plain-language options and next steps. Legal statements are shown only with the official provision they came from." },
  { t: "Draft the notice", d: "A legal notice or consumer complaint draft, with every missing detail clearly highlighted." },
];

export default function Home() {
  const privacy = privacyNotice(providerStatus().provider);
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-700">For everyday consumer problems in India</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
          A refund that never came? A product that broke? Understand your options and act on them.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          NyayaAI turns your story into a structured case, explains consumer rights in plain language, checks what proof you have, and drafts a legal notice
          – citing only provisions it has verified against official government sources.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/assistant" className="rounded-lg bg-indigo-700 px-5 py-2.5 font-medium text-white hover:bg-indigo-800">
            Start with your problem
          </Link>
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.t} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-indigo-700">{i + 1}</div>
            <div className="mt-1 font-medium">{s.t}</div>
            <p className="mt-1 text-sm text-slate-600">{s.d}</p>
          </div>
        ))}
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">What it covers</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Consumer disputes: refunds, defective products, poor or undelivered services, e-commerce orders</li>
            <li>Case summary, evidence checklist, time-limit and forum checks</li>
            <li>Draft legal notice and consumer complaint</li>
          </ul>
          <h2 className="mt-4 font-semibold">What it does not cover (yet)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Tenancy and employment – recognised, but only general pointers and referral</li>
            <li>Criminal, family, property and police matters</li>
            <li>Case law / court judgments, and state-specific laws</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">How it avoids inventing law</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>A small library of provisions, each checked against official text with section, date and status recorded.</li>
            <li>The AI may only cite provisions from that library, and must quote them; code checks every quote word-for-word.</li>
            <li>Any other section, Act or case name is removed before you see it – and the count is shown.</li>
            <li>Time limits and which Commission to approach are calculated by code, not guessed by the AI.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            A passed source check does not mean the legal reasoning is correct for your situation. Have a lawyer review before acting.
          </p>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Legal information, not legal advice.</strong> NyayaAI is not a lawyer and cannot guarantee any outcome. Your messages are sent to{" "}
        {privacy.processor} to be processed. {privacy.dataUse}{" "}
        {privacy.termsUrl && (
          <a href={privacy.termsUrl} target="_blank" rel="noreferrer" className="underline">
            Provider terms
          </a>
        )}
        . Avoid entering real names, Aadhaar, bank or card numbers. Free legal aid: NALSA helpline <strong>15100</strong>. Consumer helpline: <strong>1915</strong>. Emergency: <strong>112</strong>.
      </section>
    </main>
  );
}
