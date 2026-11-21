import type { Language } from "../schemas";

/**
 * The chat reply is assembled by code from VALIDATED parts, in three clearly separated sections:
 *   1. verified law (source-matched claims, with their provision label)
 *   2. practical guidance (non-legal steps)
 *   3. needs legal verification (anything legal that could not be verified)
 * The model never writes the final reply text directly, so nothing unvalidated reaches the chat.
 */

const H: Record<Language, { law: string; practical: string; check: string; disclaimer: string }> = {
  en: {
    law: "What the law says (checked against the official text):",
    practical: "Practical steps:",
    check: "Needs checking by a lawyer (not verified):",
    disclaimer: "This is legal information, not legal advice.",
  },
  hi: {
    law: "कानून क्या कहता है (आधिकारिक पाठ से जाँचा गया):",
    practical: "व्यावहारिक कदम:",
    check: "वकील से जाँच ज़रूरी (सत्यापित नहीं):",
    disclaimer: "यह केवल कानूनी जानकारी है, कानूनी सलाह नहीं।",
  },
  hinglish: {
    law: "Kanoon kya kehta hai (official text se check kiya gaya):",
    practical: "Practical steps:",
    check: "Lawyer se check karwana zaroori (verified nahi):",
    disclaimer: "Yeh sirf legal information hai, legal advice nahi.",
  },
};

export const REPLY_HEADINGS = H;

export interface ComposeInput {
  language: Language;
  summary: string;
  verified: { text: string; label: string }[]; // label e.g. "Consumer Protection Act, 2019, s. 69"
  practical: string[];
  needsCheck: string[];
}

const bullets = (xs: string[]) => xs.map((x) => `• ${x}`).join("\n");

export function composeReply(i: ComposeInput): string {
  const h = H[i.language] ?? H.en;
  const parts: string[] = [];
  if (i.summary.trim()) parts.push(i.summary.trim());
  if (i.verified.length) parts.push(`${h.law}\n${bullets(i.verified.map((v) => `${v.text} (${v.label})`))}`);
  if (i.practical.length) parts.push(`${h.practical}\n${bullets(i.practical)}`);
  if (i.needsCheck.length) parts.push(`${h.check}\n${bullets(i.needsCheck)}`);
  parts.push(h.disclaimer);
  return parts.join("\n\n");
}
