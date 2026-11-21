/**
 * Minimal, dependency-free parser for the Markdown subset our document templates produce:
 * "# h1", "## h2", "---", "- item", paragraphs (line breaks kept), **bold**, *italic*,
 * a whole line wrapped in _underscores_ (italic), and [[MISSING: …]] / [[CONFIRM: …]] placeholders.
 * Pure function so it can be unit-tested; the React renderer just maps blocks to elements.
 */

export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  placeholder?: "missing" | "confirm";
}

export type Block =
  | { type: "h1"; inlines: Inline[] }
  | { type: "h2"; inlines: Inline[] }
  | { type: "hr" }
  | { type: "li"; inlines: Inline[]; indent: number }
  | { type: "p"; lines: Inline[][]; italic?: boolean };

const PLACEHOLDER = /(\[\[(?:MISSING|CONFIRM):[^\]]*\]\])/;
const ITALIC_STAR = /(\*[^*\s][^*]*\*)/;

function splitPlaceholders(text: string, base: Omit<Inline, "text">): Inline[] {
  return text
    .split(PLACEHOLDER)
    .filter((s) => s !== "")
    .map((s) =>
      s.startsWith("[[MISSING")
        ? { ...base, text: s, placeholder: "missing" as const }
        : s.startsWith("[[CONFIRM")
          ? { ...base, text: s, placeholder: "confirm" as const }
          : { ...base, text: s },
    );
}

export function parseInline(text: string, base: Omit<Inline, "text"> = {}): Inline[] {
  const out: Inline[] = [];
  // bold first (may contain placeholders), then single-star italics in non-bold parts
  const boldParts = text.split(/\*\*(.+?)\*\*/);
  boldParts.forEach((part, i) => {
    if (part === "") return;
    if (i % 2 === 1) {
      out.push(...splitPlaceholders(part, { ...base, bold: true }));
      return;
    }
    part.split(ITALIC_STAR).forEach((seg) => {
      if (seg === "") return;
      if (ITALIC_STAR.test(seg) && seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
        out.push(...splitPlaceholders(seg.slice(1, -1), { ...base, italic: true }));
      } else {
        out.push(...splitPlaceholders(seg, base));
      }
    });
  });
  return out;
}

export function parseDocMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const whole = para.join("\n").trim();
    const italicLine = /^_[^_][\s\S]*_$/.test(whole) && !whole.includes("\n");
    if (italicLine) {
      blocks.push({ type: "p", lines: [parseInline(whole.slice(1, -1))], italic: true });
    } else {
      blocks.push({ type: "p", lines: para.map((l) => parseInline(l.trim())) });
    }
    para = [];
  };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#\s+(.*)$/))) {
      flush();
      blocks.push({ type: "h1", inlines: parseInline(m[1]) });
    } else if ((m = line.match(/^##\s+(.*)$/))) {
      flush();
      blocks.push({ type: "h2", inlines: parseInline(m[1]) });
    } else if (/^-{3,}$/.test(line.trim())) {
      flush();
      blocks.push({ type: "hr" });
    } else if ((m = line.match(/^(\s*)-\s+(.*)$/))) {
      flush();
      blocks.push({ type: "li", inlines: parseInline(m[2]), indent: m[1].length >= 2 ? 1 : 0 });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** Plain text of all blocks – used by tests to assert no Markdown syntax leaks into the rendered output. */
export function blocksToPlainText(blocks: Block[]): string {
  const inl = (xs: Inline[]) => xs.map((x) => x.text).join("");
  return blocks
    .map((b) => (b.type === "hr" ? "" : b.type === "p" ? b.lines.map(inl).join("\n") : inl(b.inlines)))
    .join("\n");
}
