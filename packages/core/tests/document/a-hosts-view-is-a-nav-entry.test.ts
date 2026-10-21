import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createViewRegistry, openingOf, type AnySchema, type GraviewApp, type HostView } from "../../src/index.js";
import { checkApp, compileDocument } from "../../src/check.js";
import { placesOf } from "../../src/seat.js";
import { editDocument, readDocument } from "../../src/document/index.js";

/**
 * A VIEW THE HOST KEEPS IS A NAV ENTRY (Roadmap q-custom-views-in-nav).
 * The hosted playbook's "To do" is a script view a chat drew, kept by the
 * host with a manifest; the declaration does not know it. `arrange-pages`
 * names it as `view:<its manifest name>` — by its title too where the host
 * hands its views to the edit — so it is ordered among the kinds' lists,
 * stands on the bar and is where the app opens; the checker says a name
 * no view registered here has is "not drawn here yet" rather than refusing
 * it. And a kind's list is kept off the places by `set-lens-hidden`, as a
 * lens is.
 */
const hall = readDocument(JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8"))).document!;
const toDo: HostView = { name: "to-do", title: "To do", attach: "shift", cardinality: "many" };
const front: HostView = { name: "front", title: "Front", attach: "home", cardinality: "many" };
const views = [toDo, front];
const appOf = (document: unknown, options: { readonly views?: readonly HostView[] } = {}) => {
  const compiled = compileDocument(document as never, { today: () => "2026-09-01", ...options });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((one) => one.severity === "error")));
  return compiled;
};
const edited = (edits: unknown[], options: { readonly views?: readonly HostView[] } = {}) => {
  const outcome = editDocument(hall, edits, options);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.findings));
  return outcome;
};

describe("arrange-pages names a view the host keeps", () => {
  it("by its title, where the host says its views, written as view:<its name> in the order and as the first place", () => {
    const outcome = edited([{ op: "arrange-pages", order: ["To do", "volunteer"], first: "To do", primary: ["To do", "shift"] }], { views });
    expect(outcome.document.pages).toMatchObject({ order: ["view:to-do", "volunteer"], first: "view:to-do", primary: ["view:to-do", "shift"] });
    expect(outcome.said).toEqual(['The view "To do" and volunteers come first, in that order, the app opens on the view "To do" and the bar stands up the view "To do" and "shift" beside Home.']);
  });

  it("by view:<name> without the host's views, taken on the host's word and said so", () => {
    const outcome = edited([{ op: "arrange-pages", order: ["view:to-do"], first: "view:to-do" }]);
    expect(outcome.document.pages).toMatchObject({ order: ["view:to-do"], first: "view:to-do" });
    expect(outcome.said).toEqual(['The view "to-do" (once the host registers it) comes first and the app opens on the view "to-do" (once the host registers it).']);
  });

  it("refuses a title that is neither a kind nor a view, saying how a view is named", () => {
    const outcome = editDocument(hall, [{ op: "arrange-pages", order: ["To do"] }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]?.message).toContain('"To do" is not a kind this app has, nor a view its host keeps');
    expect(outcome.findings[0]?.fix).toContain('"view:<its name>"');
    const first = editDocument(hall, [{ op: "arrange-pages", first: "To do" }]);
    expect(first.ok).toBe(false);
  });

  it("refuses a view:<name> the host does not keep, and the home's own view, where the host says its views", () => {
    const outcome = editDocument(hall, [{ op: "arrange-pages", order: ["view:doing"] }], { views });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]?.message).toBe('the host keeps no view named "doing"');
    expect(outcome.findings[0]?.fix).toContain('"view:to-do" (To do)');
    expect(editDocument(hall, [{ op: "arrange-pages", first: "view:front" }], { views }).ok).toBe(false);
  });

  it("is a note in the check where no view of that name is registered here, and nothing once one is", () => {
    const outcome = edited([{ op: "arrange-pages", order: ["view:to-do"], first: "view:to-do" }]);
    const unseen = appOf(outcome.document);
    const notes = unseen.findings.filter((one) => one.code === "check:pages-view-not-drawn-here");
    expect(notes.map((one) => one.path)).toEqual(["pages.order.0", "pages.first"]);
    expect(notes.every((one) => one.severity === "note")).toBe(true);
    expect(notes[0]?.message).toContain("not drawn here yet");
    expect(unseen.findings.some((one) => one.code === "check:pages-first-unknown" || one.code === "check:pages-kind-unknown")).toBe(false);
    // Told the host's views, the check finds nothing to say of it.
    expect(appOf(outcome.document, { views }).findings.some((one) => one.code.startsWith("check:pages-view"))).toBe(false);
    // And a name the host does not keep is a warning.
    const findings = checkApp(unseen.app as GraviewApp<AnySchema>, { views: [front] }).findings;
    expect(findings.find((one) => one.code === "pages-view-unknown")).toMatchObject({ severity: "warning", where: "pages.order.0" });
  });
});

describe("the places, with the host's views", () => {
  it("list the view where the order names it, among the kinds, and first where pages.first names it", () => {
    const app = appOf(edited([{ op: "arrange-pages", order: ["view:to-do", "volunteer"], first: "view:to-do" }]).document).app as GraviewApp<AnySchema>;
    const places = placesOf(app, { views });
    const slugs = places.map((place) => place.slug);
    // After the pictures, the arranged list: the view, then the kinds the order names, then the rest.
    expect(slugs.indexOf("to-do")).toBe(slugs.indexOf("volunteers") - 1);
    expect(places.find((place) => place.slug === "to-do")).toMatchObject({ title: "To do", kind: "shift", address: "/places/to-do", view: "to-do", first: true });
    expect(places.find((place) => place.slug === "home")).not.toHaveProperty("first");
    // Never the home's own view: it is the home's body, not a place.
    expect(places.some((place) => place.view === "front")).toBe(false);
    // Without the host's views, the declaration's places only, and no first.
    expect(placesOf(app).some((place) => place.slug === "to-do")).toBe(false);
  });

  it("open on the view where it is registered, by its manifest name", () => {
    const app = appOf(hall).app as GraviewApp<AnySchema>;
    const registry = createViewRegistry(app.schema);
    registry.register("shift", { cardinality: "many", fidelity: "full" }, "drawn", { title: "To do", name: "to-do", lens: "view" });
    expect(openingOf("view:to-do", app.schema, registry.places())).toMatchObject({ to: "place", place: { as: "to-do", name: "to-do" } });
    expect(openingOf("view:doing", app.schema, registry.places())).toBeUndefined();
  });
});

describe("a kind's list kept off the lists", () => {
  it("is set-lens-hidden on the kind, by its name or plural, written as pages.hide and said in words", () => {
    const hidden = edited([{ op: "set-lens-hidden", title: "Seats", hidden: true }]);
    expect(hidden.document.pages?.hide).toEqual(["room", "seat"]);
    expect(hidden.said).toEqual(["The list of seats is kept off the bar's places and the front page; its address and the links to it still reach it."]);
    const shown = editDocument(hidden.document, [{ op: "set-lens-hidden", title: "room", hidden: false }]);
    if (!shown.ok) throw new Error(JSON.stringify(shown.findings));
    expect(shown.document.pages?.hide).toEqual(["seat"]);
    expect(shown.said).toEqual(["The list of rooms is listed on the bar's places and the front page again."]);
  });

  it("is said hidden where a host lists the places, and still has its address", () => {
    const app = appOf(edited([{ op: "set-lens-hidden", title: "seat", hidden: true }]).document).app as GraviewApp<AnySchema>;
    expect(placesOf(app).find((place) => place.slug === "seats")).toMatchObject({ address: "/seats", hidden: true });
  });

  it("is refused where pages.primary stands it on the bar", () => {
    const primary = edited([{ op: "arrange-pages", primary: ["seat"] }]);
    const outcome = editDocument(primary.document, [{ op: "set-lens-hidden", title: "seat", hidden: true }]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.findings[0]?.message).toContain("pages.primary stands the list of seats on the bar");
  });
});
