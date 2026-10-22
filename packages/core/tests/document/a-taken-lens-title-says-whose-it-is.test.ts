import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AnySchema, GraviewApp } from "../../src/index.js";
import { compileDocument, describeApp } from "../../src/check.js";
import { editDocument, readDocument } from "../../src/document/index.js";

/**
 * A TAKEN LENS TITLE SAYS WHOSE IT IS. An app made in Graview Cloud was
 * given a board per choice field it never asked for; its author hid them
 * with set-lens-hidden and went to add their own "Remediations by
 * audience" — and add-lens answered only "there is already a lens
 * called…", for a lens they could not see on the page. The refusal now
 * names the lens that holds the title (what draws it, over what, and that
 * it is hidden, which does not free its title), and the one way to take
 * it: "replace" with that title. describeApp says which lenses are hidden.
 */
const hall = readDocument(JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8"))).document!;
const hidden = (() => {
  const outcome = editDocument(hall, [{ op: "set-lens-hidden", title: "By day", hidden: true }]);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome.document;
})();
const board = { op: "add-lens", lens: "columns", title: "By day", bindings: { shift: { column: "day" } } } as const;

describe("a taken lens title says whose it is", () => {
  it("names the lens that holds the title, what draws it and over what, and the replace that takes it", () => {
    const outcome = editDocument(hall, [board]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]?.message).toBe('there is already a lens called "By day" — the columns lens over shifts');
    expect(outcome.findings[0]?.fix).toBe('to draw this one in its place, say "replace": "By day"; or give this one a title of its own');
  });

  it("says a hidden lens still holds its title and its address, and that its replacement stays hidden until shown", () => {
    const outcome = editDocument(hidden, [board]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]?.message).toContain("kept off the bar and the page list (set-lens-hidden), which still holds its title and its address");
    expect(outcome.findings[0]?.fix).toContain('say "replace": "By day" (it stays off the lists, as that one is, until set-lens-hidden with "hidden": false shows it)');
  });

  it("takes the hidden lens's title by replace, says it stays hidden, and is shown by set-lens-hidden", () => {
    const replaced = editDocument(hidden, [{ ...board, replace: "By day" }]);
    if (!replaced.ok) throw new Error(JSON.stringify(replaced.findings));
    expect(replaced.said).toEqual(['The lens "By day" changes, over shifts; it stays off the bar and the page list, as "By day" was, until set-lens-hidden with "hidden": false shows it.']);
    const shown = editDocument(replaced.document, [{ op: "set-lens-hidden", title: "By day", hidden: false }]);
    if (!shown.ok) throw new Error(JSON.stringify(shown.findings));
    expect((shown.document.lenses as { title?: string; hidden?: boolean }[]).find((lens) => lens.title === "By day")).not.toHaveProperty("hidden");
  });

  it("describeApp lists a hidden lens among the lenses that draw, and says it is hidden", () => {
    const compiled = compileDocument(hidden as never, { today: () => "2026-09-01" });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((one) => one.severity === "error")));
    const said = describeApp(compiled.app as GraviewApp<AnySchema>);
    expect(said).toMatch(/"By day" \(the columns over [^)]*; hidden: kept off the bar and the page list, reached by its address\)/);
    expect(said).not.toMatch(/"The week" \([^)]*hidden/);
  });
});
