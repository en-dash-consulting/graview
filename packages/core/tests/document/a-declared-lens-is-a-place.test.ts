import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/document/index.js";
import { checkApp } from "../../src/cli/check.js";
import { describeApp } from "../../src/cli/describe.js";
import { declaredLenses, placesOf, SHIPPED_LENS_NAMES, type GraviewApp } from "../../src/index.js";

/**
 * A DECLARED LENS IS A PLACE (FR-79), AND THE ARRANGEMENT IS HONOURED (FR-80).
 *
 * Before, a document's `lenses` were accepted and drew nothing, and `pages`
 * was accepted and never compiled: a chat could write a lens and nobody
 * would ever see it. Now one list (`declaredLenses`) says which lenses draw
 * and why the rest do not, and `check`, `describe` and `placesOf` all read
 * it — so they cannot disagree about what a person will see.
 */
const document = JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8"));

function compiled(doc: unknown = document): GraviewApp {
  const result = compileDocument(doc, { today: () => "2026-09-01" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app;
}

describe("a document declaring one lens of each shipped type", () => {
  it("draws every one of them, by its title, over the kind it binds", () => {
    const { drawn, undrawn } = declaredLenses(compiled());
    expect(undrawn).toEqual([]);
    expect(drawn.map((lens) => [lens.lens, lens.title, lens.kinds])).toEqual([
      ["timeline", "The week", ["shift"]],
      ["calendar", "The month", ["shift"]],
      ["coverage", "Who covers what", ["shift"]],
      ["board", "The floor", ["seat"]],
      ["plan", "The building", ["room"]],
      ["reach", "Who may do what", ["member"]],
      ["blocks", "Who keeps the hall", ["member"]],
    ]);
    expect(new Set(drawn.map((lens) => lens.lens))).toEqual(new Set(SHIPPED_LENS_NAMES));
  });

  it("resolves each factory's options from the bindings, and derives a timeline's columns from its column field", () => {
    const byTitle = Object.fromEntries(declaredLenses(compiled()).drawn.map((lens) => [lens.title, lens]));
    expect(byTitle["The week"]?.options["columns"]).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => ({ id: day, label: day.toUpperCase() })));
    expect(byTitle["The week"]?.options["extent"]).toBe(1440);
    expect(byTitle["The month"]?.options).toMatchObject({ range: "month", today: "2026-09-01", bindings: { shift: { start: "on" } } });
    expect(byTitle["Who covers what"]?.options).toMatchObject({ rows: "shift", columns: "volunteer", link: "covered-by" });
    expect(byTitle["Who covers what"]?.across).toBe("volunteer");
    expect(byTitle["The floor"]?.options).toMatchObject({ slots: "seat", x: "x", y: "y", fill: "taken-by" });
    expect(byTitle["The building"]?.options).toMatchObject({ regions: "room", outline: "outline" });
  });

  it("checks clean of lens and arrangement findings, and describes every place that draws", () => {
    const app = compiled();
    const result = checkApp(app);
    expect(result.findings.filter((f) => f.code.startsWith("lens-") || f.code.startsWith("pages-"))).toEqual([]);
    const said = describeApp(app);
    for (const lens of declaredLenses(app).drawn) expect(said).toContain(`"${lens.title}" (the ${lens.lens} over`);
    expect(said).toContain('It opens on "The floor" (/places/the-floor).');
    expect(said).toContain("Left off the home, and still at their own addresses and in search: room.");
  });

  it("puts plan among the lenses the framework ships, in check and describe alike", () => {
    const planned = compiled({ ...document, lenses: [{ name: "plan", bindings: { regions: { kind: "room" }, outline: { field: "outline", on: "regions" } } }] });
    expect(checkApp(planned).findings.some((f) => f.code === "lens-authored-here")).toBe(false);
    expect(describeApp(planned)).not.toContain("Lenses this app wrote");
  });
});

describe("a declared lens that cannot draw says why, at its path", () => {
  const findingsOf = (lenses: unknown[], pages?: unknown) => {
    const { pages: _arranged, ...unarranged } = document;
    const result = compileDocument({ ...unarranged, lenses, ...(pages ? { pages } : {}) }, { today: () => "2026-09-01" });
    return result.findings.map((f) => ({ ...f, code: f.code.replace(/^check:/, "") })).filter((f) => f.code.startsWith("lens-") || f.code.startsWith("pages-"));
  };

  it("names an option the lens does not take", () => {
    expect(findingsOf([{ name: "calendar", title: "The month", bindings: { shift: { start: "on" } }, options: { colour: "red" } }])).toEqual([
      expect.objectContaining({ code: "lens-option-unknown", path: "lenses.0.options.colour", severity: "warning" }),
    ]);
  });

  it("names a calendar range it cannot open at, and does not draw it", () => {
    const app = compiled({ ...document, lenses: [{ name: "calendar", title: "The month", bindings: { shift: { start: "on" } }, options: { range: "fortnight" } }] });
    expect(declaredLenses(app).drawn).toEqual([]);
    expect(declaredLenses(app).undrawn[0]?.why).toContain('"fortnight"');
    expect(describeApp(app)).toContain('"The month" does not draw:');
  });

  it("names a timeline with nowhere to put a span", () => {
    expect(findingsOf([{ name: "timeline", title: "The day", bindings: { shift: { start: "from", end: "until" } } }])).toEqual([
      expect.objectContaining({ code: "lens-cannot-draw", path: "lenses.0.options.columns" }),
    ]);
  });

  it("names two lenses on one kind that share a title", () => {
    expect(findingsOf([
      { name: "calendar", title: "Shifts", bindings: { shift: { start: "on" } } },
      { name: "calendar", title: "Shifts", bindings: { shift: { start: "on" } }, options: { range: "week" } },
    ])).toEqual([expect.objectContaining({ code: "lens-title-taken", path: "lenses.1.title" })]);
  });

  it("names a kind it stands on that is not there", () => {
    expect(findingsOf([{ name: "reach", title: "Who may do what", on: "people" }])).toEqual([
      expect.objectContaining({ code: "lens-cannot-draw", path: "lenses.0.on" }),
    ]);
  });

  it("keeps a lens without a title as bindings the checker holds, with no finding", () => {
    const app = compiled({ ...document, lenses: [{ name: "calendar", bindings: { shift: { start: "on" } } }] });
    expect(declaredLenses(app).drawn).toEqual([]);
    expect(findingsOf([{ name: "calendar", bindings: { shift: { start: "on" } } }])).toEqual([]);
  });
});

describe("pages is a real arrangement", () => {
  it("is compiled onto the app and given back by toDocument's round trip", () => {
    expect(compiled().pages).toEqual({ order: ["volunteer", "seat", "shift"], hide: ["room"], first: "The floor" });
  });

  it("names kinds and a first place that are not there, as warnings at their paths", () => {
    const result = compileDocument({ ...document, pages: { order: ["volunteer", "ghost"], hide: ["nobody"], first: "The attic" } }, { today: () => "2026-09-01" });
    expect(result.ok).toBe(true);
    expect(result.findings.filter((f) => f.code.startsWith("check:pages-")).map((f) => [f.code.replace("check:", ""), f.path, f.severity])).toEqual([
      ["pages-kind-unknown", "pages.order.1", "warning"],
      ["pages-kind-unknown", "pages.hide.0", "warning"],
      ["pages-first-unknown", "pages.first", "warning"],
    ]);
  });

  it("still parses a document whose pages carried something else before FR-80", () => {
    expect(compileDocument({ ...document, pages: { layout: "grid" } }, { today: () => "2026-09-01" }).ok).toBe(true);
  });
});

describe("placesOf lists every place an app has", () => {
  it("lists the home, each lens and each kind, in the arrangement's order, saying which opens first and which the home leaves off", () => {
    const places = placesOf(compiled());
    expect(places.map((place) => [place.slug, place.kind, place.address])).toEqual([
      ["home", null, "/"],
      ["the-floor", "seat", "/places/the-floor"],
      ["the-week", "shift", "/places/the-week"],
      ["the-month", "shift", "/places/the-month"],
      ["who-covers-what", "shift", "/places/who-covers-what"],
      ["the-building", "room", "/places/the-building"],
      ["who-may-do-what", "member", "/places/who-may-do-what"],
      ["who-keeps-the-hall", "member", "/places/who-keeps-the-hall"],
      ["volunteers", "volunteer", "/volunteers"],
      ["seats", "seat", "/seats"],
      ["shifts", "shift", "/shifts"],
      ["rooms", "room", "/rooms"],
      ["members", "member", "/members"],
    ]);
    expect(places.filter((place) => place.first).map((place) => place.title)).toEqual(["The floor"]);
    expect(places.filter((place) => place.hidden).map((place) => place.slug)).toEqual(["rooms"]);
    expect(places.find((place) => place.slug === "the-floor")).toMatchObject({ title: "The floor", cardinality: "many", stop: "#view=the-floor", lens: "board" });
    expect(places.find((place) => place.slug === "shifts")?.stop).toBe("#focus=aggregate:shift");
  });
});
