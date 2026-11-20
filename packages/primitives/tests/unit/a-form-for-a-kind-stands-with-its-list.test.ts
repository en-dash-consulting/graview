import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { createViews } from "@graview/react/provider";
import { describe, expect, it } from "vitest";
import { barPlaces } from "../../src/index.js";

/**
 * A FORM FOR A KIND STANDS WITH ITS LIST (Roadmap f-frame-form-grouped-by-kind).
 * A Thanksgiving app's frame view "Add a dish" — a view of the dishes that
 * may press "add-dish" — was listed under Pictures in the bar, away from
 * the dishes. A view that may make its kind's records is a way in to that
 * kind, and is listed beside its list; a view that only pictures stays
 * under Pictures.
 */
const THANKSGIVING = {
  format: "graview-document",
  formatVersion: 1,
  name: "Thanksgiving",
  kinds: {
    household: { label: "{name}", plural: "Households", fields: { name: { type: "string", required: true } } },
    dish: { label: "{name}", plural: "Dishes", fields: { name: { type: "string", required: true } }, edges: { broughtBy: { to: ["household"], cardinality: "one", inverse: "the dishes it brings" } } },
  },
  acts: {
    "add-household": { title: "Add a household", creates: "household" },
    "add-dish": { title: "Add a dish", args: { to: { required: false } }, effects: [{ create: "dish", as: "new", set: { name: "$name" } }, { connect: "broughtBy", from: "$new", to: "$to" }] },
    "rename-dish": { title: "Rename a dish", on: "dish", writes: ["name"] },
  },
};

const View = () => null;

function bar() {
  const compiled = compileDocument(THANKSGIVING);
  if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [{ id: "smiths", kind: "household", name: "The Smiths" }, { id: "pie", kind: "dish", name: "Pie" }] as never, edges: [] } });
  const views = createViews(app.schema)
    .register("dish", { cardinality: "many", fidelity: "full" }, View as never, { title: "Add a dish", lens: "view", name: "add-a-dish", reads: ["household"], acts: ["add-dish"] })
    .register("dish", { cardinality: "many", fidelity: "full" }, View as never, { title: "Dish photos", lens: "view", name: "dish-photos" })
    .register("dish", { cardinality: "many", fidelity: "full" }, View as never, { title: "Dish names", lens: "view", name: "dish-names", acts: ["rename-dish"] });
  return barPlaces({ store, principal: { kind: "human", id: "u:host", roles: [] }, views });
}

describe("a frame view of a kind that offers a create act", () => {
  it("is listed among the lists, right after its kind's list, not under Pictures", () => {
    const places = bar();
    const form = places.find((place) => place.label === "Add a dish");
    expect(form).toMatchObject({ group: "lists", kind: "dish", path: "/places/add-a-dish" });
    const lists = places.filter((place) => place.group === "lists").map((place) => place.label);
    expect(lists.indexOf("Add a dish")).toBe(lists.indexOf("Dishes") + 1);
  });

  it("leaves a picture-only view under Pictures, and one that changes records but makes none", () => {
    const places = bar();
    expect(places.find((place) => place.label === "Dish photos")).toMatchObject({ group: "pictures" });
    expect(places.find((place) => place.label === "Dish names")).toMatchObject({ group: "pictures" });
  });
});
