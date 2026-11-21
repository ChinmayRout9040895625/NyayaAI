/**
 * Evaluation runner: runs every synthetic scenario through the SAME pipeline the app uses,
 * against the configured LLM, and writes raw, unedited outputs to test-outputs/<folder>/.
 *
 *   npm run eval                          # all scenarios -> test-outputs/<timestamp>/
 *   npm run eval -- 01 07                 # only scenarios whose id starts with 01 or 07
 *   npm run eval -- --plan                # dry run: scenarios, turns, request estimate, model, folder (no API calls)
 *
 * Named, resumable runs (one model for the whole run):
 *   EVAL_OUT=2026-11-22_prompt-v4_gemini-3.5-flash npm run eval
 *     - writes to test-outputs/<EVAL_OUT>/ and a run-manifest.json that locks the model and prompt version
 *     - re-running with the same EVAL_OUT resumes: scenarios already completed without errors are skipped;
 *       an errored attempt is kept as <id>.attempt-<n>.json (never overwritten) and the scenario is re-run
 *     - refuses to continue if GEMINI_MODEL or the prompt version differs from the manifest
 *     - stops the whole run at the first DAILY quota error, so remaining scenarios are not recorded as failures
 *
 * Reads GEMINI_API_KEY / GEMINI_MODEL from the environment or .env.local.
 * Scoring is unchanged: see evals/checks.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { getProvider, providerStatus } from "../lib/llm";
import { isDailyQuota } from "../lib/llm/errors";
import { runTurn, TurnError, type ChatResponse } from "../lib/pipeline/chat";
import { emptyCase, type CaseFile } from "../lib/schemas";
import type { LLMMessage } from "../lib/llm/types";
import { CORPUS_VERSION } from "../lib/knowledge/corpus";
import { PROMPT_VERSION } from "../lib/prompts";
import { scoreScenario, type Scenario } from "./checks";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Manifest {
  model: string;
  provider: string;
  prompt_version: string;
  corpus: typeof CORPUS_VERSION;
  started_at: string;
}

type TurnRecord = ChatResponse | { error: string; escalation?: unknown; raw?: string };

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const planOnly = args.includes("--plan");
  const filters = args.filter((a) => !a.startsWith("--"));
  const all: Scenario[] = JSON.parse(fs.readFileSync(path.join(__dirname, "scenarios.json"), "utf8"));
  const scenarios = filters.length ? all.filter((s) => filters.some((f) => s.id.startsWith(f))) : all;

  const status = providerStatus();
  const label = process.env.EVAL_OUT?.trim();
  if (label && !/^[\w.-]+$/.test(label)) {
    console.error(`EVAL_OUT must contain only letters, digits, "-", "_" or "." (got "${label}")`);
    process.exit(1);
  }
  const folder = label || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(process.cwd(), "test-outputs", folder);
  const manifestPath = path.join(outDir, "run-manifest.json");
  const existingManifest: Manifest | null = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;

  const done = (id: string) => {
    const f = path.join(outDir, `${id}.json`);
    if (!fs.existsSync(f)) return false;
    const rec = JSON.parse(fs.readFileSync(f, "utf8"));
    return !rec.responses.some((r: { error?: string }) => r.error);
  };
  const todo = scenarios.filter((s) => !done(s.id));
  const turns = todo.reduce((n, s) => n + s.turns.length, 0);

  if (planOnly) {
    console.log(
      JSON.stringify(
        {
          model: status.model,
          ai_configured: status.configured,
          prompt_version: PROMPT_VERSION,
          corpus: CORPUS_VERSION,
          output_folder: `test-outputs/${folder}/`,
          resume: existingManifest ? { manifest: existingManifest, already_completed: scenarios.filter((s) => done(s.id)).map((s) => s.id) } : false,
          scenarios_to_run: todo.map((s) => `${s.id} (${s.turns.length} turn${s.turns.length > 1 ? "s" : ""})`),
          user_turns: turns,
          model_requests_estimate: { minimum: turns, maximum: turns * 2, note: "1 call per follow-up turn, 2 per analysis turn; +1 for each invalid-JSON repair retry" },
          free_tier_note: "Gemini free tier observed at 20 requests per model per day – a full run may need to be resumed the next day with the same EVAL_OUT.",
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!status.configured) {
    console.error(`AI provider not configured. ${status.message}`);
    process.exit(1);
  }
  const provider = getProvider();

  // One model and one prompt version per named run.
  if (existingManifest && (existingManifest.model !== provider.model || existingManifest.prompt_version !== PROMPT_VERSION)) {
    console.error(
      `Refusing to resume ${folder}: it was started with model ${existingManifest.model} / prompt ${existingManifest.prompt_version}, ` +
        `but this run uses ${provider.model} / ${PROMPT_VERSION}. Use the same GEMINI_MODEL, or a new EVAL_OUT.`,
    );
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  if (!existingManifest) {
    const m: Manifest = { model: provider.model, provider: provider.name, prompt_version: PROMPT_VERSION, corpus: CORPUS_VERSION, started_at: new Date().toISOString() };
    fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
  }

  const delay = Number(process.env.EVAL_DELAY_MS ?? 6000);
  const today = new Date();
  let stoppedForQuota = false;

  for (const sc of scenarios) {
    if (done(sc.id)) {
      console.log(`↷ ${sc.id} – already completed in this folder, skipped`);
      continue;
    }
    // keep any earlier errored attempt as evidence instead of overwriting it
    const prev = path.join(outDir, `${sc.id}.json`);
    if (fs.existsSync(prev)) {
      let n = 1;
      while (fs.existsSync(path.join(outDir, `${sc.id}.attempt-${n}.json`))) n++;
      fs.renameSync(prev, path.join(outDir, `${sc.id}.attempt-${n}.json`));
      const md = path.join(outDir, `${sc.id}.md`);
      if (fs.existsSync(md)) fs.renameSync(md, path.join(outDir, `${sc.id}.attempt-${n}.md`));
    }

    console.log(`▶ ${sc.id} – ${sc.title}`);
    const messages: LLMMessage[] = [];
    let caseFile: CaseFile = emptyCase();
    const responses: TurnRecord[] = [];
    for (const turn of sc.turns) {
      messages.push({ role: "user", content: turn });
      try {
        const r = await runTurn({ provider, messages, caseFile, today, includeRaw: true });
        responses.push(r);
        caseFile = r.case;
        messages.push({ role: "assistant", content: r.reply });
      } catch (e) {
        const err = `${(e as Error).name}: ${(e as Error).message}`;
        const cause = e instanceof TurnError ? (e.cause as { raw?: string }) : undefined;
        responses.push({
          error: err,
          ...(e instanceof TurnError ? { escalation: e.escalation } : {}),
          ...(cause?.raw ? { raw: cause.raw } : {}),
        });
        console.log(`   ✗ ${err.slice(0, 200)}`);
        if (isDailyQuota(err)) stoppedForQuota = true;
        break;
      }
      await sleep(delay);
    }
    const score = scoreScenario(sc, responses, messages);
    const record = {
      scenario: sc,
      run: { at: new Date().toISOString(), provider: provider.name, model: provider.model, prompt_version: PROMPT_VERSION, corpus: CORPUS_VERSION },
      transcript: messages,
      responses,
      score,
    };
    fs.writeFileSync(path.join(outDir, `${sc.id}.json`), JSON.stringify(record, null, 2), "utf8");
    fs.writeFileSync(
      path.join(outDir, `${sc.id}.md`),
      `# ${sc.id} – ${sc.title}\n\nModel: ${provider.model} · Prompt: ${PROMPT_VERSION} · Corpus: ${JSON.stringify(CORPUS_VERSION)}\n\n` +
        messages.map((m) => `**${m.role.toUpperCase()}:**\n\n${m.content}\n`).join("\n") +
        `\n---\n\nAutomated checks:\n\n\`\`\`json\n${JSON.stringify(score, null, 2)}\n\`\`\`\n`,
      "utf8",
    );
    console.log(`   ${score.passed ? "✓" : "✗"} ${score.failures.join("; ") || "all checks passed"}`);
    if (stoppedForQuota) {
      console.log(`\nDaily quota reached – stopping. Resume later with the same settings:\n  EVAL_OUT=${folder} GEMINI_MODEL=${provider.model} npm run eval`);
      break;
    }
  }

  // summary.json covers every scenario record currently in the folder (attempt files excluded)
  const results = fs
    .readdirSync(outDir)
    .filter((f) => /^\d\d-.*\.json$/.test(f) && !f.includes(".attempt-"))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")).score);
  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify({ model: provider.model, prompt_version: PROMPT_VERSION, corpus: CORPUS_VERSION, complete: results.length === all.length, results }, null, 2),
  );
  console.log(`\nRaw outputs written to ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
