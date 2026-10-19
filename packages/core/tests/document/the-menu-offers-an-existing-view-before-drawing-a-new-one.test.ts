import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createViewRegistry, declaredLenses, Store, type AnySchema } from "../../src/index.js";
import { existingViewsOf, type CatalogPlace } from "../../src/catalog.js";
import { compileDocument } from "../../src/check.js";

/**
 * THE MENU OFFERS A VIEW THE APP ALREADY HAS BEFORE DRAWING A NEW ONE
 * (Roadmap f-menu-suggests-existing-views). Asked for a searchable board of
 * Recon's actions, the app's own "Actions by status" board is what fits
 * first — by what it is attached to, what it reads and what it is — and it
 * is offered to be opened, or opened and adjusted where it fits in part.
 * Read from the places alone: no model is asked.
 */
const recon = JSON.parse(readFileSync(new URL("./fixtures/recon.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(recon);
if (!compiled.ok) throw new Error("the Recon fixture should compile");
const { app } = compiled;
const store = new Store<AnySchema>({
  schema: app.schema,
  mutations: (app.mutations ?? []) as never,
  snapshot: {
    nodes: [
      { id: "a1", kind: "action", name: "Write the readout", status: "open" },
      { id: "o1", kind: "opportunity", name: "Self-serve onboarding", stage: "sized" },
      { id: "p1", kind: "person", name: "Ada" },
    ] as never,
    edges: [],
  },
});
const lensPlaces: CatalogPlace[] = declaredLenses(app).drawn.map((lens) => ({ as: lens.as, title: lens.title, kind: lens.kinds[0]!, lens: lens.lens }));
const human = { kind: "human" as const, id: "ada" };

describe("an existing view, before a new one", () => {
  it("offers Recon's own board first for a searchable board of its actions, to open and adjust", () => {
    const found = existingViewsOf(store, { on: "list", kind: "action" }, { principal: human, places: lensPlaces, said: "a searchable board" });
    expect(found[0]).toMatchObject({ place: "actions-by-status", title: "Actions by status", fit: "partial" });
    // The pipeline is a board too, but of opportunities; due dates are actions, but no board.
    expect(found.map((one) => one.place)).not.toContain("the-pipeline");
    expect(found.map((one) => one.place)).not.toContain("due-dates");
  });

  it("opens one outright when every word asked is said by it", () => {
    const found = existingViewsOf(store, { on: "record", id: "a1" }, { principal: human, places: lensPlaces, said: "a board of actions" });
    expect(found[0]).toMatchObject({ place: "actions-by-status", fit: "full" });
    const pipeline = existingViewsOf(store, { on: "record", id: "a1" }, { principal: human, places: lensPlaces, said: "the opportunities pipeline" });
    expect(pipeline[0]).toMatchObject({ place: "the-pipeline", fit: "full" });
  });

  it("offers, unasked, the views of the record's own kind where the menu would draw one", () => {
    const found = existingViewsOf(store, { on: "record", id: "a1" }, { principal: human, places: lensPlaces });
    expect(found.map((one) => one.place)).toEqual(["actions-by-status", "due-dates"]);
    expect(found.every((one) => one.fit === "full")).toBe(true);
  });

  it("is quiet when nothing fits: no view of the kind, no word it says, or the home with nothing asked", () => {
    expect(existingViewsOf(store, { on: "record", id: "p1" }, { principal: human, places: lensPlaces })).toEqual([]);
    expect(existingViewsOf(store, { on: "list", kind: "action" }, { principal: human, places: lensPlaces, said: "a map of where they live" })).toEqual([]);
    expect(existingViewsOf(store, { on: "place", place: "home" }, { principal: human, places: lensPlaces })).toEqual([]);
    // Words that only say a view is wanted name none.
    expect(existingViewsOf(store, { on: "list", kind: "action" }, { principal: human, places: lensPlaces, said: "show" })).toEqual([]);
  });

  it("asks a word a view's title says of that view, not of every view whose kind of picture says it", () => {
    const weeks: CatalogPlace[] = [...lensPlaces, { as: "this-week", title: "This week", kind: "action", lens: "calendar" }];
    expect(existingViewsOf(store, { on: "list", kind: "action" }, { principal: human, places: weeks, said: "week" }).map((one) => one.place)).toEqual(["this-week"]);
  });

  it("is at most three, best first, never the lens it was opened on, never one kept off the lists", () => {
    const many: CatalogPlace[] = [
      ...lensPlaces,
      { as: "actions-by-owner", title: "Actions by owner", kind: "action", lens: "columns" },
      { as: "this-week", title: "This week", kind: "action", lens: "calendar" },
      { as: "secret-board", title: "Secret board", kind: "action", lens: "columns", hidden: true },
    ];
    const found = existingViewsOf(store, { on: "list", kind: "action" }, { principal: human, places: many });
    expect(found).toHaveLength(3);
    expect(found.map((one) => one.place)).not.toContain("secret-board");
    const onTheBoard = existingViewsOf(store, { on: "lens", place: "actions-by-status", kind: "action" }, { principal: human, places: many, said: "a board" });
    expect(onTheBoard.map((one) => one.place)).toEqual(["actions-by-owner"]);
  });

  it("counts a worker view by its manifest: what it attaches to and what it reads", () => {
    const views = createViewRegistry(app.schema);
    views.register("opportunity", { cardinality: "many", fidelity: "full" }, null, { title: "Deal room", lens: "view", reads: ["action", "person"] });
    const places = views.places();
    expect(places[0]).toMatchObject({ as: "deal-room", lens: "view", reads: ["action", "person"] });
    const found = existingViewsOf(store, { on: "record", id: "a1" }, { principal: human, places: [...places] });
    // It reads actions but is a picture of opportunities: a partial fit, opened to be adjusted.
    expect(found).toEqual([expect.objectContaining({ place: "deal-room", fit: "partial" })]);
    const asked = existingViewsOf(store, { on: "place", place: "home" }, { principal: human, places: [...places], said: "the deal room" });
    expect(asked[0]).toMatchObject({ place: "deal-room", fit: "full" });
  });
});
