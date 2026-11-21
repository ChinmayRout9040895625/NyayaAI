/**
 * Provider-specific data-processing disclosure shown to users.
 * Kept deliberately cautious: it states who processes the text and points to the provider's own terms,
 * rather than promising retention periods this app cannot verify.
 */
export interface PrivacyNotice {
  provider: string;
  processor: string; // who receives the user's messages
  dataUse: string; // what the provider's terms say about use of inputs, in plain words
  termsUrl: string;
}

export function privacyNotice(provider: string): PrivacyNotice {
  if (provider === "anthropic") {
    return {
      provider: "anthropic",
      processor: "Anthropic (Claude API)",
      dataUse:
        "Under Anthropic's commercial terms, API inputs are not used to train its models by default; Anthropic may keep them for a limited time, for example for safety monitoring.",
      termsUrl: "https://www.anthropic.com/legal/commercial-terms",
    };
  }
  if (provider === "gemini") {
    return {
      provider: "gemini",
      processor: "Google (Gemini API)",
      dataUse: "On Google's free tier, inputs may be used by Google to improve its products.",
      termsUrl: "https://ai.google.dev/gemini-api/terms",
    };
  }
  return {
    provider,
    processor: "the configured AI provider",
    dataUse: "Check that provider's terms for how it uses your messages.",
    termsUrl: "",
  };
}
