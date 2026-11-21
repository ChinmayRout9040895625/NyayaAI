import { describe, it, expect } from "vitest";
import { parseDocMarkdown, parseInline, blocksToPlainText } from "@/lib/documents/markdown";
import { renderLegalNotice, renderComplaint, EMPTY_PARTIES } from "@/lib/documents/templates";
import { emptyCase, type CaseFile } from "@/lib/schemas";

const c: CaseFile = {
  ...emptyCase(),
  domain: "consumer",
  facts: {
    trader_name: { value: "HomeKart", source: "user_stated" },
    product_or_service: { value: "mixer grinder", source: "user_stated" },
    problem_description: { value: "Stopped working after 10 days.", source: "user_stated" },
    relief_wanted: { value: "replacement or refund", source: "user_stated" },
  },
};
const input = { caseFile: c, parties: EMPTY_PARTIES, sources: [], rules: [], evidenceHave: ["Invoice / bill / receipt"], today: new Date(Date.UTC(2026, 10, 21)) };

describe("document Markdown rendering (demo flaw 1)", () => {
  it("parses headings, bold, list items and keeps placeholders as highlighted inlines", () => {
    const blocks = parseDocMarkdown("# LEGAL NOTICE\n\n**Date:** today\n\n## 1. Facts\n- item one\n   - nested\n\n---\n_footer note_");
    expect(blocks.map((b) => b.type)).toEqual(["h1", "p", "h2", "li", "li", "hr", "p"]);
    const p = blocks[1];
    expect(p.type === "p" && p.lines[0][0]).toMatchObject({ text: "Date:", bold: true });
    const last = blocks[6];
    expect(last.type === "p" && last.italic).toBe(true);
    const inl = parseInline("**BEFORE THE [[CONFIRM: x]] COMMISSION**");
    expect(inl.find((x) => x.placeholder === "confirm")).toMatchObject({ bold: true });
  });

  it("does not treat blank-line underscores as italics", () => {
    const inl = parseInline("Consumer Complaint No. ______ of 20__");
    expect(inl.map((x) => x.text).join("")).toBe("Consumer Complaint No. ______ of 20__");
    expect(inl.some((x) => x.italic)).toBe(false);
  });

  it("rendered notice and complaint contain no raw Markdown syntax", () => {
    for (const md of [renderLegalNotice(input), renderComplaint(input)]) {
      const text = blocksToPlainText(parseDocMarkdown(md));
      expect(text).not.toMatch(/^#/m);
      expect(text).not.toContain("**");
      expect(text).not.toMatch(/^- /m);
      expect(text).toContain("[[MISSING:"); // placeholders survive
    }
  });
});

describe("document grammar and punctuation (demo flaws 2, 3)", () => {
  it("relief sentence is grammatical for noun-phrase relief", () => {
    const md = renderLegalNotice(input);
    expect(md).not.toMatch(/call upon you to replacement/);
    expect(md).toContain("call upon you to provide the following relief within");
    expect(md).toContain(": replacement or refund.");
  });

  it("never produces double full stops when a fact already ends with one", () => {
    for (const md of [renderLegalNotice(input), renderComplaint(input)]) {
      expect(md).not.toMatch(/[^.]\.\.(?!\.)/);
    }
  });
});
