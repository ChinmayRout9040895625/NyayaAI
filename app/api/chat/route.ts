import { z } from "zod";
import { getProvider, providerStatus, LLMOutputError } from "@/lib/llm";
import { runTurn, TurnError } from "@/lib/pipeline/chat";
import { describeProviderError } from "@/lib/llm/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(40),
  caseFile: z.unknown().optional(),
});

export async function POST(req: Request) {
  const status = providerStatus();
  if (!status.configured) {
    return Response.json({ error: "AI_NOT_CONFIGURED", message: status.message }, { status: 503 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "BAD_REQUEST", message: "Invalid request." }, { status: 400 });
  }
  if (body.messages.at(-1)?.role !== "user") {
    return Response.json({ error: "BAD_REQUEST", message: "Last message must be from the user." }, { status: 400 });
  }

  try {
    const result = await runTurn({
      provider: getProvider(),
      messages: body.messages,
      caseFile: body.caseFile as never,
    });
    return Response.json(result);
  } catch (err) {
    // Safety guidance from deterministic triage is returned even when the AI fails.
    const escalation = err instanceof TurnError ? err.escalation : undefined;
    const e = err instanceof TurnError ? (err.cause as Error) : (err as Error);
    // Privacy: log only the error type, never conversation content.
    const name = (e as Error).name;
    console.error(`[chat] ${name}`);
    if (e instanceof LLMOutputError) {
      return Response.json(
        { error: "INVALID_AI_OUTPUT", message: "The AI response failed validation, so nothing was shown. Please try again.", escalation },
        { status: 502 },
      );
    }
    const info = describeProviderError((e as Error).message || "", providerStatus().model ?? undefined);
    return Response.json(
      { error: info.code, message: info.message, retry_after: info.retryAfter, escalation },
      { status: info.code === "QUOTA_DAILY" || info.code === "RATE_LIMITED" ? 429 : 502 },
    );
  }
}
