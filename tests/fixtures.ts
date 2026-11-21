import type { CorpusEntry } from "@/lib/schemas";

/** TEST FIXTURES ONLY – synthetic text, NOT real statutory wording. Never used by the app. */
export function fixture(id: string, section: string, text: string, overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id,
    act: "Consumer Protection Act, 2019",
    act_number: "Act No. 35 of 2019",
    section,
    title: "fixture",
    text,
    text_type: "verbatim",
    source_url: "https://www.indiacode.nic.in/handle/123456789/15256",
    source_name: "India Code",
    jurisdiction: "central",
    status: "in_force",
    status_basis: "fixture",
    amendments: "fixture",
    verified_on: "2026-11-21",
    domains: ["consumer"],
    keywords: ["fixture"],
    verification_checks: { text_verbatim: true, section_number: true, amendments: true, commencement: true, applicability: true },
    ...overrides,
  };
}

export const FX_S69 = fixture(
  "CPA2019-S69",
  "69",
  "FIXTURE: complaint within two years from the date on which the cause of action has arisen; may be entertained after that period if sufficient cause is shown.",
);
export const FX_S34 = fixture(
  "CPA2019-S34",
  "34",
  "FIXTURE: value of the goods or services paid as consideration does not exceed the prescribed amount.",
);
export const FX_R3 = fixture(
  "JR2021-R3",
  "Rule 3",
  "FIXTURE: jurisdiction where value paid as consideration does not exceed fifty lakh rupees; state up to two crore rupees.",
  { act: "Consumer Protection Jurisdiction Rules, 2021" },
);
