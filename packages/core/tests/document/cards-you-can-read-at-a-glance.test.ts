import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { parseTemplate, renderTemplate, validateViewSpecs, validateViews } from "../../src/document/index.js";
import { createSchema, defineNode, excerpt, z } from "../../src/index.js";

/**
 * CARDS YOU CAN READ AT A GLANCE (the Roadmap's f-glanceable-cards).
 *
 * On the Roadmap's "Up next", each card printed its whole thirty-line
 * summary, so a row of cards was a wall of text. A card or a row says a
 * long text's start — `{summary|excerpt}`, its first sentence or about 140
 * characters, or `{summary|excerpt: 80}` — and `graview check` says so
 * where a card or a row puts a text field whole in a text block.
 */
const LONG =
  "Offline drafts keep what a person wrote when the network goes. It changes what a person meets on the page, so it is written down here in full before anyone starts.\n\nThe open questions follow, each with who owns it.";

const say = (template: string, summary: string) => renderTemplate(parseTemplate(template), { node: { id: "f1", kind: "feature", summary } as never, kinds: new Map() });

describe("an excerpt", () => {
  it("is a long text's first sentence when that is short enough", () => {
    expect(excerpt(LONG)).toBe("Offline drafts keep what a person wrote when the network goes.");
    expect(say("{summary|excerpt}", LONG)).toBe("Offline drafts keep what a person wrote when the network goes.");
  });

  it("is cut at a word with an ellipsis when its first sentence is longer than asked, and a short text is said as it is", () => {
    expect(say("{summary | excerpt: 40}", LONG)).toBe("Offline drafts keep what a person wrote…");
    expect(say("{summary|excerpt: 40}", LONG).length).toBeLessThanOrEqual(41);
    expect(say("{summary|excerpt}", "Asked for twice")).toBe("Asked for twice");
    // A line break is a space on a card: the excerpt is one run of words.
    expect(excerpt("One line\nand the next, with no stop at all", 20)).toBe("One line and the…");
  });

  it("is not cut short at an abbreviation's stop: a first sentence is more than a word or two", () => {
    expect(excerpt("Dr. Okafor reviews every request before it is built, and says why when she turns one down.")).toBe(
      "Dr. Okafor reviews every request before it is built, and says why when she turns one down.",
    );
    expect(excerpt("E.g. a garden, a shed or a porch: whatever the house has room for. And more after it.")).toBe("E.g. a garden, a shed or a porch: whatever the house has room for.");
    // A short first sentence that is a sentence still ends the excerpt.
    expect(excerpt("Ship it on Friday. Then the notes, the release and the long tail after it.")).toBe("Ship it on Friday.");
  });

  it("is told a whole number of characters, from 20 to 1000, and says so when it is not", () => {
    expect(() => parseTemplate("{summary|excerpt: 'eighty'}")).toThrow(/excerpt is told at most how many characters/);
    expect(() => parseTemplate("{summary|excerpt: 5}")).toThrow(/20 to 1000/);
  });
});

describe("graview check, on a card or a row that shows a text field whole", () => {
  const roadmap = JSON.parse(readFileSync(new URL("../../../../scripts/fixtures/growing/roadmap.gdd.json", import.meta.url), "utf8"));

  it("warns, naming the excerpt; an excerpt, a string field and the page say nothing", () => {
    const findings = validateViews(roadmap).filter((finding) => finding.code === "view-whole-text");
    expect(findings).toEqual([
      {
        severity: "warning",
        code: "view-whole-text",
        path: "views.feature.card.2.text",
        message: "feature card shows summary whole; it will be clamped. Use {summary|excerpt} or move it to the page.",
        fix: "write {summary|excerpt}, or {summary|excerpt: 80} for fewer characters",
      },
      {
        severity: "warning",
        code: "view-whole-text",
        path: "views.request.row.3.text",
        message: "request row shows summary whole; it will be clamped. Use {summary|excerpt} or move it to the page.",
        fix: "write {summary|excerpt}, or {summary|excerpt: 80} for fewer characters",
      },
    ]);
    const paged = { ...roadmap, views: { request: { row: [{ title: "{name}" }, { text: "{summary|excerpt: 80}" }] }, feature: { page: [{ text: "{summary}" }], row: [{ title: "{name}" }, { text: "{name}" }] } } };
    expect(validateViews(paged).filter((finding) => finding.code === "view-whole-text")).toEqual([]);
  });

  it("is a warning, so the document still compiles and the card is drawn clamped", () => {
    const result = compileDocument(roadmap, { today: () => "2026-10-12" });
    expect(result.ok).toBe(true);
    expect(result.findings.filter((finding) => finding.code === "view-whole-text").map((finding) => finding.severity)).toEqual(["warning", "warning"]);
  });

  it("reads a TypeScript declaration's prose as a string declared longer than 500 characters", () => {
    const feature = defineNode("feature", { fields: z.object({ name: z.string(), summary: z.string().max(5000), note: z.string() }) });
    const schema = createSchema([feature]);
    const findings = validateViewSpecs(schema, { feature: { row: [{ title: "{name}" }, { text: "{summary}" }, { text: "{note}" }] } });
    expect(findings.filter((finding) => finding.code === "view-whole-text").map((finding) => finding.path)).toEqual(["viewSpecs.feature.row.1.text"]);
  });
});
