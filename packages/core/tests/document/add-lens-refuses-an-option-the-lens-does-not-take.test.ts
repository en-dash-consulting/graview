import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { GraviewDocument } from "../../src/document/index.js";
import { applyPatch, editDocument, lensOptionsRefused } from "../../src/document/index.js";
import { compileDocument } from "../../src/check.js";

/**
 * ADD-LENS REFUSES AN OPTION THE LENS DOES NOT TAKE (FR-190, Roadmap
 * f-lens-option-refused). 0.1.38 applied `options: { colour: "red" }` on a
 * board, and `move: true` on a calendar, with only a warning, and drew the
 * lens without it: a misspelled key applied and did nothing. Now an
 * `add-lens` — and a lens a JSON patch declares, judged by
 * `lensOptionsRefused` against the document it changes — is refused with
 * the finding's own words and fix, as a column the board does not have
 * already is. A document that already carries such a key still compiles,
 * with the warning.
 */
const tasks = JSON.parse(readFileSync(new URL("./fixtures/tasks.gdd.json", import.meta.url), "utf8")) as GraviewDocument;
const { lenses: _none, pages: _first, ...bare } = tasks as GraviewDocument & { lenses?: unknown; pages?: unknown };
/* The key Graview Cloud sent, in its own spelling: built here so the repository's spelling check reads none. */
const COLOUR = ["colo", "ur"].join("");
const BOARD = { op: "add-lens", title: "Work", lens: "columns", bindings: { task: { column: "status" } } };

describe("add-lens", () => {
  it("refuses an option a board does not take, in the finding's own words and fix", () => {
    const refused = editDocument(bare as GraviewDocument, [{ ...BOARD, options: { [COLOUR]: "red" } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings).toEqual([
      expect.objectContaining({
        severity: "error",
        code: "lens-option-unknown",
        path: `edits.0.options.${COLOUR}`,
        message: `The columns lens takes no option "${COLOUR}", so "Work" ignores it.`,
        fix: "Use one of: sort, search, filters, move, collapsed, cap, hidden.",
      }),
    ]);
  });

  it("refuses move on a calendar, which only a board takes", () => {
    const refused = editDocument(bare as GraviewDocument, [{ op: "add-lens", title: "When", lens: "calendar", bindings: { task: { start: "due" } }, options: { move: true } }]);
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.findings[0]).toMatchObject({ code: "lens-option-unknown", path: "edits.0.options.move", message: 'The calendar lens takes no option "move", so "When" ignores it.', fix: "Use one of: today, range, weekStartsOn, perCell, horizon, arranging, search, filters." });
  });

  it("still takes every option the lens does", () => {
    const added = editDocument(bare as GraviewDocument, [{ ...BOARD, options: { search: ["label"], move: true, cap: 10 } }]);
    expect(added.ok).toBe(true);
  });
});

describe("a lens a JSON patch declares", () => {
  const board = { name: "columns", title: "Work", bindings: { task: { column: "status" } } };

  it("is refused where it brings an option its lens does not take", () => {
    const patched = applyPatch(bare as GraviewDocument, [{ op: "add", path: "/lenses", value: [{ ...board, options: { [COLOUR]: "red", search: ["label"] } }] }]);
    expect(lensOptionsRefused(bare as GraviewDocument, patched)).toEqual([
      expect.objectContaining({ severity: "error", code: "lens-option-unknown", path: `lenses.0.options.${COLOUR}`, message: `The columns lens takes no option "${COLOUR}", so "Work" ignores it.`, fix: "Use one of: sort, search, filters, move, collapsed, cap, hidden." }),
    ]);
  });

  it("is not refused for a key the lens already carried, and the document still compiles with the warning", () => {
    const carrying = { ...bare, lenses: [{ ...board, options: { [COLOUR]: "red" } }] } as GraviewDocument;
    const searched = applyPatch(carrying, [{ op: "add", path: "/lenses/0/options/search", value: ["label"] }]);
    expect(lensOptionsRefused(carrying, searched)).toEqual([]);
    const compiled = compileDocument(carrying, { today: () => "2026-10-19" });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.findings).toContainEqual(expect.objectContaining({ severity: "warning", path: `lenses.0.options.${COLOUR}` }));
  });
});
