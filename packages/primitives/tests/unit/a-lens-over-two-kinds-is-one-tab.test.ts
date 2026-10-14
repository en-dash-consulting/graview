import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { createViews } from "@graview/react/provider";
import { aggregateId, EMPTY_VIEW, withPicture } from "@graview/layout/view";
import { describe, expect, it } from "vitest";
import { barPlaces, registerDeclaredLenses, scenePlacesOf } from "../../src/index.js";

/**
 * A LENS OVER TWO KINDS IS ONE TAB. The gauntlet's scene bar read "The
 * whole thing · What the talks are about · The timetable · The timetable ·
 * A dozen workshops": one calendar over talks and workshops was a tab per
 * kind it binds. It is one tab on the scene's bar and one entry on the
 * Pages bar — and a district of either kind still goes in to it. Two
 * DIFFERENT pictures of one name are two entries, each saying whose.
 */
const owner = { kind: "human" as const, id: "u:owner", roles: ["owner"] };
const program = {
  format: "graview-document",
  formatVersion: 1,
  name: "Program",
  description: "A conference's talks and workshops.",
  kinds: {
    talk: { noun: "talk", plural: "talks", fields: { label: { type: "string", required: true }, startsAt: { type: "date" } } },
    workshop: { noun: "workshop", plural: "workshops", fields: { label: { type: "string", required: true }, startsAt: { type: "date" } } },
  },
  acts: {
    "add-talk": { title: "Add a talk", creates: "talk", description: "A talk." },
    "add-workshop": { title: "Add a workshop", creates: "workshop", description: "A workshop." },
  },
};

function opened(lenses: unknown[]) {
  const compiled = compileDocument({ ...program, lenses }, { today: () => "2026-09-28" });
  if (!compiled.ok) throw new Error(`the program did not compile: ${JSON.stringify(compiled.findings)}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}) });
  const views = registerDeclaredLenses(createViews(app.schema), app);
  return { store, views };
}

const timetable = { name: "calendar", title: "The timetable", bindings: { talk: { start: "startsAt" }, workshop: { start: "startsAt" } } };

describe("one calendar over talks and workshops", () => {
  it("is a place on each kind, so either district goes in to it", () => {
    const { views } = opened([timetable]);
    expect(views.places().map((place) => place.kind)).toEqual(["talk", "workshop"]);
    expect(views.resolve("workshop" as never, { cardinality: "many", fidelity: "full" }, "the-timetable")).toBeDefined();
  });

  it("is one tab on the scene's bar, pressed from either district, and goes in from the district in focus", () => {
    const { store, views } = opened([timetable]);
    const scene = scenePlacesOf({ places: views.places(), hidden: new Set(), view: EMPTY_VIEW, schema: store.schema });
    expect(scene.places.map((place) => place.label)).toEqual(["The whole thing", "The timetable"]);
    const tab = scene.places[1]!.key;
    for (const kind of ["talk", "workshop"]) {
      const there = withPicture(EMPTY_VIEW, kind, "the-timetable");
      expect(scenePlacesOf({ places: views.places(), hidden: new Set(), view: there, schema: store.schema }).current).toBe(tab);
      expect(scene.to(tab, there)?.focusId).toBe(aggregateId(kind));
    }
    // With the talks kept from this seat, it is still one tab, over the workshops.
    expect(scenePlacesOf({ places: views.places(), hidden: new Set(["talk"]), view: EMPTY_VIEW, schema: store.schema }).places.map((place) => place.label)).toEqual(["The whole thing", "The timetable"]);
  });

  it("is one entry on the Pages bar, at one address", () => {
    const { store, views } = opened([timetable]);
    const pictures = barPlaces({ store, principal: owner, views }).filter((place) => place.group === "pictures" && place.key !== "connections");
    expect(pictures.map((place) => [place.label, place.path])).toEqual([["The timetable", "/places/the-timetable"]]);
  });
});

describe("two different calendars called the same, one over talks and one over workshops", () => {
  const twins = [
    { name: "calendar", title: "The timetable", bindings: { talk: { start: "startsAt" } } },
    { name: "calendar", title: "The timetable", bindings: { workshop: { start: "startsAt" } }, options: { range: "week" } },
  ];

  it("are two tabs on each bar, each saying whose", () => {
    const { store, views } = opened(twins);
    const scene = scenePlacesOf({ places: views.places(), hidden: new Set(), view: EMPTY_VIEW, schema: store.schema });
    expect(scene.places.map((place) => place.label)).toEqual(["The whole thing", "The timetable · talks", "The timetable · workshops"]);
    const pictures = barPlaces({ store, principal: owner, views }).filter((place) => place.group === "pictures" && place.key !== "connections");
    expect(pictures.map((place) => [place.label, place.path])).toEqual([
      ["The timetable · talks", "/places/the-timetable?of=talks"],
      ["The timetable · workshops", "/places/the-timetable?of=workshops"],
    ]);
  });
});
