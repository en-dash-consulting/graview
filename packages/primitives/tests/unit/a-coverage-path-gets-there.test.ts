import { createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { buildCoverage, CoverageBindingError } from "../../src/index.js";

/** A coverage bound by a path that cannot get from its columns to its rows says so, not "6 offers with no showroom" (W-172). */
const showroom = defineNode("showroom", { fields: z.object({ label: z.string() }), plural: "Showrooms" });
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars", edges: { "on-show-at": { to: ["showroom"], description: "where it is", inverse: "the cars here" } } });
const offer = defineNode("offer", { fields: z.object({ label: z.string() }), plural: "Offers", edges: { "applies-to": { to: ["car"], description: "the cars it applies to", inverse: "the offers on it" } } });
const schema = createSchema([showroom, car, offer]);
const nodes = [
  { id: "showroom:quay", kind: "showroom", label: "The Quay" },
  { id: "car:golf", kind: "car", label: "Golf" },
  { id: "offer:zero", kind: "offer", label: "0% APR" },
] as never;
const edges = [
  { kind: "on-show-at", from: "car:golf", to: "showroom:quay" },
  { kind: "applies-to", from: "offer:zero", to: "car:golf" },
];

describe("a coverage walked through a node", () => {
  it("throws a binding error that says which way round, when named backwards", () => {
    expect(() => buildCoverage(nodes, edges, { rows: "offer", columns: "showroom", link: { path: ["applies-to", "on-show-at"] } }, schema)).toThrow(CoverageBindingError);
    expect(() => buildCoverage(nodes, edges, { rows: "offer", columns: "showroom", link: { path: ["applies-to", "on-show-at"] } }, schema)).toThrow(/walked from the columns/);
  });

  it("covers the offer at the showroom when named column end first", () => {
    const grid = buildCoverage(nodes, edges, { rows: "offer", columns: "showroom", link: { path: ["on-show-at", "applies-to"] } }, schema);
    expect(grid.cells.map((cell) => `${cell.rowId}|${cell.columnId}`)).toEqual(["offer:zero|showroom:quay"]);
  });
});
