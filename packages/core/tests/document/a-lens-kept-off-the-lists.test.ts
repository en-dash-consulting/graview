import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createViewRegistry, declaredLenses, type AnySchema, type GraviewApp } from "../../src/index.js";
import { checkApp, compileDocument } from "../../src/check.js";
import { placesOf } from "../../src/seat.js";
import { diffDocuments, editDocument, readDocument } from "../../src/document/index.js";

/**
 * A LENS KEPT OFF THE LISTS. An app whose custom home links to lenses as
 * targets ("features where stage is building") ended with a page list of
 * six of them. A lens marked hidden — `set-lens-hidden`, or `hidden: true`
 * on a lens in TypeScript — is still a place at its address, reached by a
 * link or `navigate`, but is not offered by the bar, the page list or the
 * home's gallery (`a-hidden-lens-is-reached-not-listed` in pages draws it).
 */
const hall = readDocument(JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8"))).document!;
const appOf = (document: unknown) => {
  const compiled = compileDocument(document as never, { today: () => "2026-09-01" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((one) => one.severity === "error")));
  return compiled.app as GraviewApp<AnySchema>;
};

describe("a lens kept off the lists", () => {
  it("is set by set-lens-hidden, which says so in words, and taken back the same way", () => {
    const hidden = editDocument(hall, [{ op: "set-lens-hidden", title: "By day", hidden: true }]);
    if (!hidden.ok) throw new Error(JSON.stringify(hidden.findings));
    expect(hidden.said).toEqual(['The lens "By day" is kept off the bar and the page list; a link or navigate still reaches it.']);
    expect((hidden.document.lenses as { title?: string; hidden?: boolean }[]).find((lens) => lens.title === "By day")?.hidden).toBe(true);
    const shown = editDocument(hidden.document, [{ op: "set-lens-hidden", title: "by day", hidden: false }]);
    if (!shown.ok) throw new Error(JSON.stringify(shown.findings));
    expect(shown.said).toEqual(['The lens "By day" is listed on the bar and the page list again.']);
    expect((shown.document.lenses as { title?: string; hidden?: boolean }[]).find((lens) => lens.title === "By day")).not.toHaveProperty("hidden");
  });

  it("is said by diffDocuments, the preview of the change", () => {
    const hidden = editDocument(hall, [{ op: "set-lens-hidden", title: "By day", hidden: true }]);
    if (!hidden.ok) throw new Error("not hidden");
    expect(diffDocuments(hall, hidden.document).sentences).toContain('The lens "By day" is kept off the bar and the page list; a link or navigate still reaches it.');
    expect(diffDocuments(hidden.document, hall).sentences).toContain('The lens "By day" is listed on the bar and the page list again.');
  });

  it("refuses a lens that is not there, naming the lenses there are", () => {
    const outcome = editDocument(hall, [{ op: "set-lens-hidden", title: "By night", hidden: true }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]?.message).toMatch(/there is no lens "By night"; the lenses are .*"By day"/);
  });

  it("refuses to hide a lens pages.primary stands on the bar", () => {
    const primary = editDocument(hall, [{ op: "arrange-pages", primary: ["By day"] }]);
    if (!primary.ok) throw new Error(JSON.stringify(primary.findings));
    const outcome = editDocument(primary.document, [{ op: "set-lens-hidden", title: "By day", hidden: true }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]?.message).toContain('pages.primary stands "By day" on the bar');
  });

  it("is still a place at its address, said hidden where a host lists the places", () => {
    const hidden = editDocument(hall, [{ op: "set-lens-hidden", title: "By day", hidden: true }]);
    if (!hidden.ok) throw new Error("not hidden");
    const app = appOf(hidden.document);
    expect(declaredLenses(app).drawn.find((lens) => lens.title === "By day")?.hidden).toBe(true);
    const place = placesOf(app).find((one) => one.title === "By day");
    expect(place).toMatchObject({ slug: "by-day", address: "/places/by-day", hidden: true });
    expect(placesOf(app).find((one) => one.title === "The week")).not.toHaveProperty("hidden");
  });

  it("is checked: hidden that is not true or false, and pages.primary naming a hidden lens, are found", () => {
    const loose = structuredClone(hall) as { lenses: Record<string, unknown>[]; pages: Record<string, unknown> };
    loose.lenses.find((lens) => lens["title"] === "By day")!["hidden"] = "yes";
    loose.lenses.find((lens) => lens["title"] === "The week")!["hidden"] = true;
    loose.pages["primary"] = ["The week"];
    const findings = checkApp(appOf(loose)).findings;
    expect(findings.find((one) => one.code === "lens-hidden-not-a-boolean")).toMatchObject({ where: expect.stringMatching(/^lenses\.\d+\.hidden$/) });
    expect(findings.find((one) => one.code === "pages-primary-hidden")?.message).toContain('"The week", a lens kept off the lists (hidden)');
  });

  it("in TypeScript, a registration's hidden place is listed hidden and never takes its kind's own cell", () => {
    const app = appOf(hall);
    const registry = createViewRegistry(app.schema);
    const cell = { cardinality: "many", fidelity: "full" } as const;
    registry.register("shift" as never, cell, "own", { title: "The shifts" });
    registry.register("shift" as never, cell, "target", { title: "Mondays", hidden: true });
    expect(registry.places()).toEqual([
      { kind: "shift", title: "The shifts", as: "the-shifts" },
      { kind: "shift", title: "Mondays", as: "mondays", hidden: true },
    ]);
    // What the kind draws with no picture named is a place a person can find; the hidden one is reached by its name.
    expect(registry.lookup("shift", cell)).toBe("own");
    expect(registry.resolve("shift", cell, "mondays")?.view).toBe("target");
  });
});
