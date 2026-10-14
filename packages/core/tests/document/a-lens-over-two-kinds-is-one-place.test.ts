import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { checkApp } from "../../src/cli/check.js";
import { describeApp } from "../../src/cli/describe.js";
import { createViewRegistry, onePerPicture, placeLabel, sharesItsName, Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { search } from "../../src/search.js";
import { placesOf } from "../../src/seat.js";

/**
 * A LENS OVER TWO KINDS IS ONE PLACE.
 *
 * The gauntlet's "The timetable" is one calendar over talks and workshops,
 * and the scene's bar read "The timetable · The timetable": every list of
 * places listed it once per kind it binds. It is one picture — one tab, one
 * page, one entry in the seat's places — and a district of either kind
 * still goes in to it. Two DIFFERENT lenses that share a title are another
 * matter: the checker says so, and the lists say whose.
 */
const hall = JSON.parse(readFileSync(new URL("./fixtures/every-lens.gdd.json", import.meta.url), "utf8"));
/* The hall with a second dated kind: its classes, on a day as its shifts are. */
const withClasses = {
  ...hall,
  kinds: { ...hall.kinds, class: { noun: "class", plural: "classes", fields: { label: { type: "string", required: true }, on: { type: "date" } } } },
  acts: { ...hall.acts, "add-class": { title: "Add a class", creates: "class", description: "A class in the hall." } },
  pages: undefined,
};

function compiled(lenses: unknown[]): GraviewApp<AnySchema> {
  const result = compileDocument({ ...withClasses, lenses }, { today: () => "2026-09-01" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"))}`);
  return result.app as GraviewApp<AnySchema>;
}

const timetable = { name: "calendar", title: "The timetable", bindings: { shift: { start: "on" }, class: { start: "on" } } };

describe("one lens over two kinds", () => {
  it("is one place in placesOf, at one address, saying every kind it is over", () => {
    const pictures = placesOf(compiled([timetable])).filter((place) => place.title === "The timetable");
    expect(pictures).toEqual([expect.objectContaining({ slug: "the-timetable", kind: "shift", over: ["shift", "class"], address: "/places/the-timetable", stop: "#view=the-timetable", lens: "calendar" })]);
  });

  it("is a place on each kind in the registry, so either district goes in to it, and one picture in a list", () => {
    const registry = createViewRegistry(compiled([timetable]).schema);
    const meta = { title: "The timetable", over: ["shift", "class"] };
    registry.register("shift" as never, { cardinality: "many", fidelity: "full" }, "door", meta);
    registry.register("class" as never, { cardinality: "many", fidelity: "full" }, "door", meta);
    expect(registry.places().map((place) => place.kind)).toEqual(["shift", "class"]);
    expect(registry.resolve("class" as never, { cardinality: "many", fidelity: "full" }, "the-timetable")?.view).toBe("door");
    expect(onePerPicture(registry.places())).toEqual([{ kind: "shift", title: "The timetable", as: "the-timetable", over: ["shift", "class"] }]);
    expect(registry.places().some((place) => sharesItsName(place, registry.places()))).toBe(false);
  });

  it("checks clean, and is found once by Find", () => {
    const app = compiled([timetable]);
    expect(checkApp(app).findings.filter((f) => f.code.startsWith("lens-"))).toEqual([]);
    const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}) });
    const places = [
      { kind: "shift", title: "The timetable", as: "the-timetable", over: ["shift", "class"] },
      { kind: "class", title: "The timetable", as: "the-timetable", over: ["shift", "class"] },
    ];
    const found = search(store, "timetable", { places }).hits.filter((hit) => hit.about === "place");
    expect(found).toEqual([expect.objectContaining({ title: "The timetable", address: "/places/the-timetable" })]);
  });
});

describe("two different lenses that share a title, on different kinds", () => {
  const twins = [
    { name: "calendar", title: "The timetable", bindings: { shift: { start: "on" } } },
    { name: "calendar", title: "The timetable", bindings: { class: { start: "on" } }, options: { range: "week" } },
  ];

  it("both draw, and the checker says two pictures are listed under one name", () => {
    const app = compiled(twins);
    expect(checkApp(app).findings.filter((f) => f.code.startsWith("lens-"))).toEqual([expect.objectContaining({ code: "lens-title-repeated", where: "lenses.1.title", severity: "warning" })]);
    expect(placesOf(app).filter((place) => place.title === "The timetable").map((place) => place.address)).toEqual(["/places/the-timetable?of=shifts", "/places/the-timetable?of=classes"]);
  });

  it("is told apart in a list by whose it is", () => {
    const app = compiled(twins);
    const places = [
      { kind: "shift", title: "The timetable", as: "the-timetable" },
      { kind: "class", title: "The timetable", as: "the-timetable" },
    ];
    expect(onePerPicture(places)).toHaveLength(2);
    expect(places.map((place) => placeLabel(place, places, app.schema))).toEqual(["The timetable · shifts", "The timetable · classes"]);
    expect(describeApp(app)).toContain("The timetable");
  });
});
