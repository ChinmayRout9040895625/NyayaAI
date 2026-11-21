/** Deterministic text helpers used for fact and quote verification. */

export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‛`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/[“”"'.,;:!?()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if `quote` appears (after normalisation) inside `source`. Empty/very short quotes never match. */
export function containsQuote(source: string, quote: string | null | undefined, minLen = 3): boolean {
  if (!quote) return false;
  const q = normalize(quote);
  if (q.length < minLen) return false;
  return normalize(source).includes(q);
}

const MULT: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  hazar: 1_000,
  hazaar: 1_000,
  "हज़ार": 1_000,
  "हजार": 1_000,
  lakh: 100_000,
  lakhs: 100_000,
  lac: 100_000,
  "लाख": 100_000,
  crore: 10_000_000,
  cr: 10_000_000,
  "करोड़": 10_000_000,
};

/** Extract rupee-like amounts from free text: "₹45,000", "45k", "1.2 lakh", "Rs. 899". */
export function parseAmounts(text: string): number[] {
  const out: number[] = [];
  // Unit words must end at a word boundary: in "18,999 ka" the "k" of "ka" is NOT "thousand".
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(?:(k|thousand|hazaa?r|lakhs?|lac|crore|cr)(?![a-z])|(हज़ार|हजार|लाख|करोड़))?(?![\d])/gi;
  for (const m of text.matchAll(re)) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(n)) continue;
    const unit = (m[2] || m[3] || "").toLowerCase();
    out.push(Math.round(n * (MULT[unit] ?? 1)));
  }
  return out;
}

export function parseAmountValue(value: string): number | null {
  const a = parseAmounts(value);
  return a.length ? a[0] : null;
}

/** Accepts yyyy-mm-dd or yyyy-mm; returns a Date (first of month for yyyy-mm) or null. */
export function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1));
  return isNaN(d.getTime()) ? null : d;
}

const MONTHS_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTHS_HI = ["जनवरी", "फ़रवरी|फरवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर|सितम्बर", "अक्टूबर", "नवंबर|नवम्बर", "दिसंबर|दिसम्बर"];

/**
 * Did the user actually write this date? Accepts yyyy-mm-dd / yyyy-mm values and looks for the same
 * date in the user's text: ISO form, dd/mm/yyyy (- or .), or day + month name (English or Hindi, either order).
 * A date the model worked out (e.g. "after 10 days", "last month", today's date) is NOT mentioned.
 */
export function dateMentioned(userText: string, value: string | null | undefined): boolean {
  if (!value) return false;
  const m = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return false;
  const [, y, mo, d] = m;
  const t = userText.toLowerCase();
  if (t.includes(value.trim())) return true;
  const monthIdx = Number(mo) - 1;
  const mon = `(?:${MONTHS_EN[monthIdx]}[a-z]*\\.?|${MONTHS_HI[monthIdx]})`;
  const mNum = `0?${Number(mo)}`;
  if (!d) {
    // month-only value: "March 2026", "03/2026", "मार्च 2026"
    return new RegExp(`${mon}\\s*,?\\s*${y}|\\b${mNum}[/.-]${y}\\b`, "i").test(t);
  }
  const dNum = `0?${Number(d)}`;
  const day = `${dNum}(?:st|nd|rd|th)?`;
  const yearOpt = `(?:\\s*,?\\s*(?:${y}|${y.slice(2)}))?`;
  const patterns = [
    `\\b${dNum}[/.-]${mNum}[/.-](?:${y}|${y.slice(2)})\\b`, // 15/10/2026, 15-10-26
    `\\b${day}\\s*(?:of\\s+)?${mon}${yearOpt}`, // 15 Oct, 15th October 2026, 15 अक्टूबर
    `${mon}\\s*${day}\\b${yearOpt}`, // Oct 15, October 15th, 2026
  ];
  return patterns.some((p) => new RegExp(p, "i").test(t));
}

export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}
