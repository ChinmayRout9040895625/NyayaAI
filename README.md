# NyayaAI – consumer dispute assistant for India

A chat assistant for ordinary people in India with a **consumer problem**: a refund that never came, a defective product, or a service that wasn't delivered. It:

- turns a messy story into a structured case (facts tagged *you said* or *inferred*), asking only for what's missing;
- explains where the person stands in plain English, Hindi or Hinglish;
- shows a proof checklist;
- drafts a **legal notice** and a **consumer complaint**, with every gap highlighted;
- answers in three clearly separated parts – **verified law** (quoted from the official text), **practical steps**, and **points that need a lawyer's check** – and removes deadlines or amounts it cannot trace to a source.

It is **legal information, not legal advice**, and it says so.

Built for the Kuku AI Generalist Assignment, Problem 2 ("Build an AI Lawyer").

## What it covers

| | Coverage |
|---|---|
| Consumer disputes (goods and services, online and offline) | **In depth**: case building, analysis, evidence, documents, time-limit check |
| Tenancy (deposit, rent, eviction) | Recognised only. Fixed reply explaining that state law isn't verified, plus an evidence list and referral |
| Employment (unpaid salary) | Recognised only. Fixed reply noting the Labour Codes transition, plus referral. Future work needing its own legal verification |
| Criminal, family, property, police matters | Out of scope. Referral to NALSA 15100 or emergency 112 |
| Case law / judgments | Never cited (stripped by the validator) |

## Run it locally

Requires Node 20+ and an API key for one provider: Google Gemini (free tier, from Google AI Studio) or Anthropic Claude (paid, from the Anthropic Console).

```bash
npm install
cp .env.example .env.local      # set LLM_PROVIDER and that provider's key
npm run dev                     # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm test` | 81 unit tests for the deterministic code: triage, fact merge and provenance, citation validator, legal-statement and number guards, consumer rules, corpus rules, documents, quota messages, interface text |
| `npm run eval` | Runs `evals/scenarios.json` through the real pipeline and model. Writes raw outputs to `test-outputs/<timestamp>/` |
| `npm run eval -- 01 07` | Runs selected scenarios only |
| `npm run eval -- --plan` | Dry run: lists scenarios, the model, the output folder and an estimate of model requests. Makes no API calls |
| `EVAL_OUT=<name> npm run eval` | Named run in `test-outputs/<name>/`. Locks one model and prompt version, resumes after a quota stop, and keeps failed attempts as `<id>.attempt-<n>.json` |
| `npm run sources` | Regenerates `docs/KNOWLEDGE_SOURCES.md` from the corpus |
| `npm run build` | Production build |

If no key is configured, `/api/health` reports it and the chat stays disabled. There's no fake "offline AI".

## How it works

```
user message
  → triage (code: urgent / police / threats → escalation card with helplines)
  → understand (Gemini, JSON: domain, language, facts with exact quotes, search terms)
  → merge case (code: a fact counts as "you said" only if its quote is found in the user's own words;
                amounts must appear in the user's text; inferred never overwrites stated)
  → missing-field check (code) → up to 2 follow-up questions (fixed templates in en / hi / hinglish)
  → retrieval (code: keyword search over the verified corpus + fixed anchor provisions)
  → rules (code: s.69 limitation with condonation, forum by consideration paid, commercial-purpose flag)
  → analysis (Gemini, JSON, prompt v4: legal claims with provision id + exact quote; practical steps;
              points needing verification – the model does NOT write the final reply)
  → validator (code: quotes checked against the official text; unverified references, unsupported
               legal statements and untraceable numbers handled sentence by sentence – see below)
  → reply composed by code in three labelled parts, in the user's language
```

| Done by AI (Gemini) | Done by code |
|---|---|
| Understanding free text in English, Hindi or Hinglish | Safety triage and escalation |
| Classifying the problem | Which questions to ask, and when to stop asking |
| Extracting facts with quotes | Checking quotes against the user's text; parsing amounts and dates |
| Explaining the law in plain words, using supplied provisions only | Retrieval, quote verification, reference stripping, overconfidence flags |
| Sorting its output into legal claims / practical steps / points to verify | Relabelling unsupported legal statements, removing untraceable numbers, composing the reply |
| | Time limit and forum checks; evidence checklist; documents |

## How answers are structured

Every analysis reply has three parts, assembled by code from validated pieces (the model's own wording is used inside each part, but it never writes the reply as a whole):

| Part | What goes in it | How it is checked |
|---|---|---|
| **What the law says** (checked against the official text) | Legal claims whose quote was found word for word, in order, in a verified provision | Quote check; provision label (Act and section) added by code |
| **Practical steps** | Non-legal actions: gather documents, write to the seller, use the helpline, file online | Sentence-level guards below |
| **Needs checking by a lawyer** (not verified) | Legal points without a matched source: model-flagged points, unquoted explanations, failed citations, and sentences moved here by the guards | Shown with the reason it is unverified |

The guards run on every sentence of the model's free text (`lib/safety/legalGuard.ts`):

1. **Invalid reference → whole sentence moved.** If a sentence names a section, Act or case that no matched claim supports, the reference is removed and the sentence goes to "needs checking", marked "[reference removed]". It is not left behind with a hole in it.
2. **Unsupported legal statement → moved, not deleted.** A sentence that states a legal rule ("you will need to prove…", "under the law you are entitled to…", "कानून के तहत…") stays in place only if every legal topic it mentions (time limit, unfair trade practice, defect, deficiency, consumer status, remedies, place of filing) is backed by a matched claim or a code-computed rule. Burden-of-proof wording is never treated as backed. Duty wording ("it is the seller's responsibility to refund") cannot be backed by a definition alone.
3. **Untraceable numbers → removed.** Deadlines, day counts, ranges, amounts and percentages must come from the user's own words, from a verified provision (number attached to a unit, e.g. "thirty days", "two years"), or from a code check. Otherwise "7 days" becomes "a reasonable period", "(जैसे 7-10 दिन)" ("e.g. 7–10 days") is dropped, and an amount becomes "[amount to be confirmed]". Clause numbering such as "(7)" in s.2(7) does not count.

The same guards apply to English, Hindi and Hinglish. The Law & sources tab shows how many sentences were relabelled and which numbers were removed.

**These guards are keyword-based heuristics.** They catch the patterns tested (see `tests/flaw7.test.ts`), but a legal statement phrased in an unanticipated way can still pass as practical advice, and correct text can be over-flagged (one false positive was found and fixed during the audit). Topic matching is approximate: one backed topic can make a broader sentence look supported. And a **verified quotation does not guarantee a correct interpretation** – the model can quote the right provision and still explain it wrongly. The guards reduce invented law; they do not replace a lawyer's review.

## Legal sources and verification

The corpus is in `lib/knowledge/*.json`; the human-readable list is [docs/KNOWLEDGE_SOURCES.md](docs/KNOWLEDGE_SOURCES.md).

An entry becomes citable (`in_force`) only when **all five** checks pass, and a test enforces this:
1. Verbatim text read from an official source.
2. Section numbering confirmed.
3. Amendments checked.
4. Commencement confirmed.
5. Current applicability confirmed.

The source URL must be on an allow-list of government sites.

**Current state (verified 2026-11-21):**
- **9 citable provisions** of the Consumer Protection Act, 2019: ss.2(7), 2(10), 2(11), 2(47)(viii), 34(2), 35(1), 39(1), 69, 100.
- Text source: India Code's consolidated PDF ("Last Updated 17-9-2021", SHA-256 recorded in each entry).
- Extraction was cross-checked against a second, independent text extraction.
- Commencement: S.O. 2351(E), in force 20 July 2020.

**Deliberately not citable:**
- **s.34(1)** (₹1 crore District Commission limit as enacted). Its proviso lets the Government prescribe a different value, and the rules doing that (Jurisdiction Rules, 2021) couldn't be fetched and verified. So the app never states a monetary limit for forum selection.
- **Jurisdiction Rules 2021, Model Tenancy Act, Code on Wages:** status `verify` or `model_law`.

**Known gap:** amendments after the PDF's "last updated" date (17-9-2021) couldn't be checked against the live India Code page, which was unreachable from the build environment.

**Important limit:** the validator proves that a quoted passage exists in a verified provision. It does **not** prove the provision applies to the user's facts, or that the model's explanation of it is correct. The UI says this on every analysis.

## Swapping the model

The model sits behind one interface (`lib/llm/types.ts`):

```ts
interface LLMProvider { name: string; model: string; generateJSON<T>(opts): Promise<{ data: T; raw: string; attempts: number }> }
```

Two providers are implemented. `LLM_PROVIDER` chooses one; prompts, guards, rules and scoring are the same for both.

| `LLM_PROVIDER` | Key | Model variable (default) | Notes |
|---|---|---|---|
| `gemini` (default) | `GEMINI_API_KEY` | `GEMINI_MODEL` (`gemini-3.5-flash`) | REST call with JSON mode; one retry on 503/429; `gemini-2.5-flash` is no longer offered to new keys |
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` (`claude-opus-4-6`) | Official `@anthropic-ai/sdk`; adaptive thinking; effort `low` for extraction, `medium` for analysis; refusals and SDK errors reported in the same form as Gemini's |

Switching is configuration only: change `LLM_PROVIDER` (and set that provider's key) and restart. To add another provider, write one file implementing `LLMProvider` and add one entry in `lib/llm/index.ts`.

## Privacy

- The API key lives only in `.env.local` or Vercel environment variables (git-ignored) and is used only on the server.
- The server logs error types only, never conversation content. The case lives in browser memory; "Clear case" wipes it.
- Names, addresses and order numbers for documents are typed into the Documents tab and **never sent to the AI**.
- The landing page names the provider actually configured, with its data-use note and a link to its terms (`lib/privacy.ts`, rendered per request):
  - Gemini free tier: inputs may be used by Google to improve its products.
  - Anthropic API: inputs are not used for training by default and may be kept for a limited time.
  Check each provider's current terms before deploying.
- All test scenarios are synthetic.

## Deploying (Vercel)

1. Push the repo to GitHub.
2. In Vercel, import the repo. The framework is detected as Next.js.
3. Add environment variables: `LLM_PROVIDER`, then either `GEMINI_API_KEY` and `GEMINI_MODEL`, or `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. Set only the key for the provider you use.
4. Deploy. `/api/chat` sets `maxDuration = 60` because an analysis turn makes two model calls.

## Repository layout

```
app/                 pages (landing, assistant) and API routes (chat, health)
components/          chat UI, case panel tabs, documents tab
lib/llm/             provider interface, Gemini and Anthropic providers, error messages
lib/privacy.ts       provider-specific privacy notice
lib/knowledge/       verified corpus + loader + retrieval
lib/domains/         consumer domain pack; tenancy/employment stubs
lib/pipeline/        triage, merge, required fields, orchestration
lib/legal/           deterministic consumer-law rules
lib/safety/          citation validator, legal-statement and number guards, reply composer
lib/documents/       notice and complaint templates, Markdown renderer for previews and printing
lib/i18n.ts          case-panel text in English and Hindi
evals/               scenarios, runner, automated checks
test-outputs/        raw, unedited evaluation outputs
tests/               unit tests
docs/                sources list, evaluation report, solution document
```

## Limitations

- Consumer law only, at statute level, and only the provisions listed above. No state law, rules or case law.
- The current monetary limits for which Commission to approach aren't verified, so the app tells users to confirm them.
- Keyword retrieval can miss paraphrased questions. A fixed set of core consumer provisions is always supplied to reduce this.
- The legal-statement and number guards are keyword-based (see "How answers are structured"). They are tested on the phrasings seen so far, not proven complete.
- A matched quotation does not guarantee a correct legal interpretation.
- Model quality varies. The free Gemini tier can be overloaded (HTTP 503) or rate-limited, and allows about 20 requests per model per day. Overloads are retried once; a daily-quota error says when Google reports the quota resets.
- Hindi and Hinglish follow-up questions are fixed templates. Answers are model-generated in the user's language. The case panel is shown in Hindi for Hindi users, but code-computed rule messages, official provision text and system notes stay in English (translating legal wording would create unverified legal text). Hinglish users get the English interface. Hindi output was spot-checked, not systematically evaluated.
- The saved evaluation results in `test-outputs/` were produced with prompt versions v1–v3, before the three-part structure and the guards. A prompt-v4 run on Claude Opus 4.6 completed only 4 of 12 scenarios before the account credit ran out (see the evaluation report).
