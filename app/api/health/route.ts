import { providerStatus } from "@/lib/llm";
import { CORPUS_VERSION } from "@/lib/knowledge/corpus";
import { PROMPT_VERSION } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = providerStatus();
  return Response.json({
    ai: { configured: s.configured, provider: s.provider, model: s.model, message: s.message },
    corpus: CORPUS_VERSION,
    prompt_version: PROMPT_VERSION,
  });
}
