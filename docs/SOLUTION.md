# NyayaAI: an AI legal assistant for consumer disputes in India

**Problem 2 (Build an AI Lawyer)** · Prototype: https://nyayaai-eight.vercel.app · Code: https://github.com/ChinmayRout9040895625/NyayaAI · Raw outputs: `test-outputs/` · Evaluation: `docs/EVALUATION_REPORT.md`

## 1. Problem choice and scope

Small consumer problems are the legal problems most people actually have: a refund that never arrives, a phone that fails in the second month, a courier that loses a parcel. They are rarely worth a lawyer's fee, so people give up. I chose this problem because the remedy is well defined: a written notice, then a complaint to a Consumer Commission. An assistant can therefore take the person from "what happened" to a draft they can send.

I covered **consumer disputes in depth** and nothing else. Consumer law is mostly one central statute, the Consumer Protection Act, 2019, so the legal grounding could be kept small enough to verify by hand. Tenancy depends on each state's rent law; the Model Tenancy Act applies only where a state has adopted it. Employment has just moved to the four Labour Codes, with Central Rules in 2026. Both are recognised by the classifier, but the reply is fixed text: it says what the tool has not verified, lists the evidence to keep and refers the person to free legal aid (NALSA 15100). It makes no legal claims.

**Assumptions:**

- Users write in English, Hindi or Hinglish, and documents are drafted in English.
- There are no accounts; the case lives in the browser.
- Statutes only, with no case law.
- Whether a purchase was for personal or business use is asked, never assumed.

## 2. How it works

Each message passes through a fixed pipeline. Two steps use the model, behind a one-method provider interface: Google Gemini (default) or Anthropic Claude, chosen by one setting, `LLM_PROVIDER`. Everything else is ordinary code and is the same for both.

1. **Triage (code).** Keyword rules in English, Hindi and Hinglish detect threats, lock-outs, court dates, self-harm and police or criminal-law mentions. They raise an escalation card with helplines before any model call, and the card still appears if the model fails.
2. **Understand (model).** Classifies the problem and extracts facts. Each fact must come with the user's exact words.
3. **Merge (code).** A fact is marked "you said" only if its quote is found in the user's own messages, and an amount only if that number appears in what they typed. Anything else is marked "inferred".
4. **Follow-up (code).** Picks at most two questions, for the most important missing facts, from fixed templates in the user's language.
5. **Rules (code).**

    - Time limit: counts the two-year period in s.69 and explains condonation of delay under s.69(2), rather than declaring a claim time-barred.
    - Forum: depends on the value paid as consideration, never the compensation claimed.
    - Commercial purpose: flags a business purchase.

6. **Analyse (model).** The model receives only verified provisions and sorts its output into legal claims (each citing a provision by id, with a quote), practical steps, and points that need a lawyer's check. It does not write the reply.
7. **Validate and compose (code).** Described in §3. Code assembles the reply in three labelled parts: what the law says (checked against the official text), practical steps, and what needs checking by a lawyer.

A case panel (in Hindi for Hindi users) shows the facts with their source tags, the time-limit and forum results, the evidence checklist and the sources. The notice and complaint are filled in by templates, not by the model. Names and addresses are typed into a form that never reaches the model, and missing items appear as highlighted `[[MISSING: …]]` placeholders.

## 3. How it avoids inventing law

- **A small verified corpus.** I extracted nine provisions of the 2019 Act from India Code's consolidated text and cross-checked them against a second, independent extraction of the same PDF: ss.2(7), 2(10), 2(11), 2(47)(viii), 34(2), 35(1), 39(1), 69 and 100. For each one I recorded:

    - the exact section;
    - the commencement notification (S.O. 2351(E), in force 20 July 2020);
    - any amendment footnotes;
    - the verification date.

    A test refuses any entry that lacks one of these, or whose source is not a government site.

- **Quotes are checked by code.** A claim survives only if its quote appears, word for word and in order, in the provision it cites. Otherwise it is downgraded and shown as unverified.

- **Free text is checked sentence by sentence.** A sentence naming an unverified section, Act or case is moved whole to "needs checking by a lawyer". So is a legal statement ("you will need to prove…", "कानून के तहत…") unless every legal topic it mentions is backed by a matched claim or a code rule; it is relabelled, not deleted. Deadlines, ranges and amounts must trace to the user's words, a verified provision or a code check; otherwise "7 days" becomes "a reasonable period" and "(जैसे 7-10 दिन)" ("e.g. 7–10 days") is dropped. These checks are keyword-based: they catch the tested phrasings, but differently worded statements can slip through, and correct text can be over-flagged.

- **What I declined to cite.** s.34(1) as enacted sets the District Commission's limit at ₹1 crore, but its proviso lets the Government prescribe a different value, and I could not obtain and verify the 2021 Jurisdiction Rules. The app therefore states no monetary limit and tells the user to confirm it.

- **What this does not prove.** A matched quote shows the words exist in the Act. It does not guarantee that the model's interpretation of them is correct, or that they apply to the user's facts. The UI says this on every analysis, and the evaluation found cases where it mattered (§4).

## 4. How I know it works, and where it fails

**Tests.** I wrote 12 synthetic scenarios: refund, defect and courier cases in all three languages, a vague story, a claim near the time limit, a business purchase, a false belief that a late refund is an IPC 420 offence, a prompt asking for a fabricated Supreme Court judgment, a tenant deposit, a lock-out with threats, unpaid salary under the repealed Payment of Wages Act, and a state-specific tenancy question. Every run is kept unedited, including the failed ones. A further 81 unit tests cover the deterministic code, including regression tests built from the exact problem sentences seen in the demos.

**Results.** On the latest run of each scenario, nine passed, one passed on substance and failed only my own over-broad check, and one was a partial failure. Across all runs the model proposed 27 cited claims: 25 matched the official text and 2 were downgraded. No case citation reached any reply. Escalation was correct in the latest run of every scenario, including "urgent" for the lock-out.

**Failures.**

1. **Wrong explanation, correct quote.** Two of the 25 matched claims were wrong or imprecise in their explanation. One said the two years run "from the date of the complaint". The quote was genuine, so the validator passed it, and only my manual review caught it. Quote checking cannot close this gap; a lawyer in the loop, or a second check of each claim against its quote, would be needed.
2. **Safety card lost when the model failed.** During a model outage, the lock-out scenario received no escalation card, because the error discarded the triage result. That is now fixed and tested.
3. **Misclassification.** The IPC 420 scenario was first classified as out of scope, so the actual refund problem was dropped. A prompt change fixed the classification, but the smaller model then asked questions the user had already answered.
4. **Unsupported statements and invented numbers in the free text.** Browser demos showed replies saying "you will need to prove the product was faulty" and suggesting "7–10 days", none of it backed by a source. Citation checks alone did not catch this, so the three-part reply and the sentence checks were added, with regression tests. A re-run of the demo cases produced nothing for the checks to catch, so their effect on bad output is shown only by the tests.

The free tier also shaped the results: 20 requests per model per day, plus overloads, meant the scenarios ran across two models (Gemini 3.5 Flash and Flash-Lite). The report states which model produced each result. For the three-part structure (prompt v4), Gemini was overloaded, so the run used Claude Opus 4.6. It completed only 4 of 12 scenarios before the account credit ran out. All 4 passed, with 23 of 23 claims matching the official text and no interpretation errors found. The 8 untested scenarios include every safeguard test, so v4 is not yet fully evaluated.

## 5. Scale and cost

Each conversation turn makes one model call (follow-up questions) or two (analysis). A full scenario took two to four calls, at 2–5 s per call on Flash-Lite and up to 25 s on Flash. I did not measure token counts; cost grows linearly with turns at the chosen model's price. Retrieval, validation and the rules run in-process, with no database or vector store. Adding a domain means writing a domain file (required facts, questions, evidence and templates) and verified corpus entries; the pipeline itself does not change. The real cost of scaling is legal verification: each state's tenancy law, and the Labour Codes with their rules, would need the same five checks, and ideally review by a lawyer. **Human in the loop:** the tool drafts, and the person or a legal-aid volunteer decides. Every document says it needs review before sending.

## 6. AI tools used, and where they went wrong

I used Claude Code to plan, write and test the code. Inside the app, Gemini is the default model and Claude Opus 4.6 the alternative.

- **Claude used the law from memory.** It wrote the forum rule with a District Commission limit of ₹50 lakh. The Act's own text in s.34(1) says ₹1 crore, with a proviso allowing a different value by rules. ₹50 lakh may be what the 2021 Rules set, but nothing verified backed it; the design refused unverified limits, so it never reached a user.
- **Claude broke code with its own edits.** It edited a regular expression through a Python script that turned `\b` into an invisible backspace character; a unit test caught it.
- **Gemini misstated the law.** It made the s.69 error described in §4.
