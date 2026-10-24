import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AnySchema, GraviewApp } from "../../src/index.js";
import { checkApp, compileDocument, describeApp } from "../../src/check.js";
import { diffDocuments, editDocument, readDocument, toDocument } from "../../src/document/index.js";

/**
 * "EXPORT CSV" IS OFFERED ON A PLACE THAT LISTS RECORDS, UNLESS SWITCHED OFF
 * (Roadmap f-view-export-csv): "allow a dev/user to choose it to be hidden
 * or shown for a view." `export: false` on a lens, or on a kind's list
 * (`pages.lists.<kind>.export`), offers it to nobody; `set-lens-export`
 * switches it, said in words; `graview check` judges a switch that is not
 * true or false, and one on a lens with no records to write; the place
 * carries it to the page as `hidden` is carried; `toDocument` writes it
 * only when it is off; `graview describe` says it.
 */
const hall = readDocument(JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8"))).document!;
const appOf = (document: unknown) => {
  const compiled = compileDocument(document as never, { today: () => "2026-09-01" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((one) => one.severity === "error")));
  return compiled.app as GraviewApp<AnySchema>;
};
type Lens = { title?: string; export?: boolean };

describe("a place that offers Export CSV unless switched off", () => {
  it("is switched on a lens by set-lens-export, said in words, and switched back the same way, the key gone", () => {
    const off = editDocument(hall, [{ op: "set-lens-export", title: "The month", export: false }]);
    if (!off.ok) throw new Error(JSON.stringify(off.findings));
    expect(off.said).toEqual(['The lens "The month" offers Export CSV to nobody.']);
    expect((off.document.lenses as Lens[]).find((lens) => lens.title === "The month")?.export).toBe(false);
    const on = editDocument(off.document, [{ op: "set-lens-export", title: "the month", export: true }]);
    if (!on.ok) throw new Error(JSON.stringify(on.findings));
    expect(on.said).toEqual(['The lens "The month" offers Export CSV again.']);
    expect((on.document.lenses as Lens[]).find((lens) => lens.title === "The month")).not.toHaveProperty("export");
    expect(diffDocuments(hall, off.document).sentences).toContain('The lens "The month" offers Export CSV to nobody.');
  });

  it("is switched on a kind's list by its kind or plural, as pages.lists.<kind>.export, and taken away when on again", () => {
    const off = editDocument(hall, [{ op: "set-lens-export", title: "shifts", export: false }]);
    if (!off.ok) throw new Error(JSON.stringify(off.findings));
    expect(off.said[0]).toMatch(/^The list of shifts offers Export CSV to nobody\.$/i);
    expect((off.document.pages as { lists?: Record<string, { export?: boolean }> }).lists?.["shift"]?.export).toBe(false);
    expect(diffDocuments(hall, off.document).sentences).toContain("The shift list offers Export CSV to nobody.");
    const on = editDocument(off.document, [{ op: "set-lens-export", title: "shift", export: true }]);
    if (!on.ok) throw new Error(JSON.stringify(on.findings));
    expect((on.document.pages as { lists?: Record<string, unknown> } | undefined)?.lists?.["shift"]).toBeUndefined();
    // The compiled app carries it where a page reads it.
    expect(appOf(off.document).pages?.lists?.["shift"]?.export).toBe(false);
  });

  it("refuses a lens that lists no records: a blocks place has nothing to export", () => {
    const outcome = editDocument(hall, [{ op: "set-lens-export", title: "Who keeps the hall", export: false }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]?.message).toContain("lists no records");
  });

  it("is checked: export that is not true or false, and export on a lens that lists no records, are found", () => {
    const loose = structuredClone(hall) as { lenses: Record<string, unknown>[] };
    loose.lenses.find((lens) => lens["title"] === "The week")!["export"] = "yes";
    loose.lenses.find((lens) => lens["title"] === "The building")!["export"] = false;
    // A TypeScript app's switch is judged by the checker, as a document's is by its schema.
    const app = appOf(hall);
    const ts = { ...app, lenses: loose.lenses as never, pages: { ...app.pages, lists: { shift: { export: "no" as never } } } } as GraviewApp<AnySchema>;
    const findings = checkApp(ts).findings;
    expect(findings.find((one) => one.code === "lens-export-not-a-boolean")).toMatchObject({ severity: "warning", where: expect.stringMatching(/^lenses\.\d+\.export$/) });
    expect(findings.find((one) => one.code === "lens-export-lists-no-records")?.message).toContain('"The building" says export, but the plan lens lists no records');
    expect(findings.find((one) => one.code === "pages-list-export-not-a-boolean")).toMatchObject({ severity: "warning", where: "pages.lists.shift.export" });
  });

  it("is written by toDocument only when it is off, and said by describe", () => {
    const app = appOf(hall);
    const lenses = (app.lenses ?? []).map((lens) => (lens.title === "The month" ? { ...lens, export: false } : lens.title === "The week" ? { ...lens, export: true } : lens));
    const back = toDocument({ ...app, lenses } as GraviewApp<AnySchema>).document;
    expect((back.lenses as Lens[]).find((lens) => lens.title === "The month")?.export).toBe(false);
    expect((back.lenses as Lens[]).find((lens) => lens.title === "The week")).not.toHaveProperty("export");
    const said = describeApp({ ...app, lenses, pages: { ...app.pages, lists: { shift: { export: false } } } } as GraviewApp<AnySchema>);
    expect(said).toMatch(/"The month" \(the calendar over [^)]*; offers nobody Export CSV\)/);
    expect(said).toContain("Offers nobody Export CSV on the list of: shift.");
  });
});
