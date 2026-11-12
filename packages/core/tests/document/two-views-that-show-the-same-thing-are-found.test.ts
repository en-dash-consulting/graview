import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";

/**
 * TWO VIEWS THAT SHOW THE SAME THING ARE FOUND, AND THE FIX IS AN EDIT.
 *
 * Pages and lenses are becoming one thing — a view that stands in the city
 * as a board (docs/pages-and-lenses-are-one.md) — and while they come
 * together an app may say one view twice. The check says which to keep,
 * and its fix is the document edit a host applies: applied, the finding is
 * gone and nothing else is.
 */
const review = JSON.parse(readFileSync(new URL("./fixtures/review.gdd.json", import.meta.url), "utf8"));
const findingsOf = (document: unknown) => {
  const compiled = compileDocument(document, { today: () => "2026-10-15" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((finding) => finding.severity === "error")));
  return compiled.findings.filter((finding) => finding.code === "check:view-duplicates-another");
};

describe("two views that show the same thing", () => {
  it("finds a lens that is only a kind's list, keeps the list page, and fixes it with remove-lens", () => {
    const found = findingsOf(review).find((finding) => finding.message.includes('"Root causes"'));
    expect(found).toMatchObject({ severity: "warning", edits: [{ op: "remove-lens", title: "Root causes" }] });
    expect(found?.message).toContain("Keep the Root causes page");
    const fixed = editDocument(review, found!.edits!);
    expect(fixed.ok).toBe(true);
    if (!fixed.ok) return;
    expect(findingsOf(fixed.document).some((finding) => finding.message.includes('"Root causes"'))).toBe(false);
  });

  it("only notes one the arrangement names, and says to point the arrangement at the list first", () => {
    const named = findingsOf(review).find((finding) => finding.message.includes('"This week"'));
    expect(named).toMatchObject({ severity: "note" });
    expect(named?.edits).toBeUndefined();
  });

  it("finds two lenses that draw the same picture under two titles, and keeps the one said first", () => {
    const twice = structuredClone(review);
    const board = { name: "blocks", title: "Where they stand", on: "root-cause", options: { blocks: [{ headline: "Every cause" }, { list: "all('root-cause')", as: "card" }] } };
    twice.lenses = [...twice.lenses, board, { ...board, title: "Standing" }];
    const found = findingsOf(twice).find((finding) => finding.message.includes('"Standing"'));
    expect(found?.message).toContain('Keep "Where they stand"');
    expect(found?.edits).toEqual([{ op: "remove-lens", title: "Standing" }]);
  });

  it("says nothing of a view that shows more than a list", () => {
    const more = structuredClone(review);
    more.lenses[0].options.blocks = [{ headline: "Why it happened" }, ...more.lenses[0].options.blocks];
    expect(findingsOf(more).some((finding) => finding.message.includes('"Root causes"'))).toBe(false);
  });
});
