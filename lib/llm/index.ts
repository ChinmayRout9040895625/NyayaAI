import { GeminiProvider } from "./gemini";
import { AnthropicProvider } from "./anthropic";
import { LLMNotConfiguredError, type LLMProvider } from "./types";

export * from "./types";

export interface ProviderStatus {
  configured: boolean;
  provider: string;
  model: string | null;
  message: string;
}

/** Providers: LLM_PROVIDER=gemini (default) or LLM_PROVIDER=anthropic. */
const PROVIDERS = {
  gemini: { keyVar: "GEMINI_API_KEY", modelVar: "GEMINI_MODEL", defaultModel: "gemini-3.5-flash" },
  anthropic: { keyVar: "ANTHROPIC_API_KEY", modelVar: "ANTHROPIC_MODEL", defaultModel: "claude-opus-4-6" },
} as const;
type ProviderName = keyof typeof PROVIDERS;

export function providerStatus(): ProviderStatus {
  const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
  if (!(provider in PROVIDERS)) {
    return {
      configured: false,
      provider,
      model: null,
      message: `LLM_PROVIDER="${provider}" is not implemented. Use "gemini" or "anthropic", or add a provider in lib/llm/.`,
    };
  }
  const p = PROVIDERS[provider as ProviderName];
  const model = process.env[p.modelVar] || p.defaultModel;
  if (!process.env[p.keyVar]) {
    return {
      configured: false,
      provider,
      model,
      // The UI already shows the heading "AI provider not configured", so this is only the instruction.
      message: `Set ${p.keyVar} in .env.local (or the Vercel environment variables). NyayaAI does not fall back to a fake AI.`,
    };
  }
  return { configured: true, provider, model, message: "ok" };
}

/** Factory. To add a provider: implement LLMProvider in a new file and add an entry above and a branch here. */
export function getProvider(): LLMProvider {
  const s = providerStatus();
  if (!s.configured) throw new LLMNotConfiguredError(s.message);
  if (s.provider === "anthropic") return new AnthropicProvider(process.env.ANTHROPIC_API_KEY as string, s.model as string);
  return new GeminiProvider(process.env.GEMINI_API_KEY as string, s.model as string);
}
