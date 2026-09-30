import { createSchema, defineNode, Graph } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EMPTY_VIEW, layout } from "../../src/index.js";

/**
 * A KIND TUCKED BEHIND A SHED KIND GOES WITH IT.
 *
 * Focus a lot in a dealership: the row of kinds cannot hold eight, so it
 * sheds three into "+3 more" — among them Vehicles — and Deals and Service
 * appointments, tucked behind Vehicles, fell back to "the end of the row":
 * the "+3 more" card's own place, under it. Two districts nobody could
 * press, and a list of three that should have said five.
 */
const fields = z.object({ label: z.string() });
const location = defineNode("location", { fields, plural: "Locations" });
const staff = defineNode("staff", { fields, plural: "Staff", edges: { "works-at": { to: ["location"] } } });
const customer = defineNode("customer", { fields, plural: "Customers" });
const vehicle = defineNode("vehicle", { fields, plural: "Vehicles", edges: { "parked-at": { to: ["location"] } } });
const drive = defineNode("drive", { fields, plural: "Test drives", edges: { drives: { to: ["vehicle"] }, driver: { to: ["customer"] } } });
const deal = defineNode("deal", { fields, plural: "Deals", edges: { "for-vehicle": { to: ["vehicle"] }, buyer: { to: ["customer"] } } });
const trade = defineNode("trade", { fields, plural: "Trade-ins", edges: { "offered-by": { to: ["customer"] } } });
const service = defineNode("service", { fields, plural: "Service appointments", edges: { services: { to: ["vehicle"] } } });
const schema = createSchema([vehicle, location, staff, customer, drive, deal, trade, service]);
const graph = () => {
  const nodes: { id: string; kind: string; label: string }[] = [];
  const edges: { kind: string; from: string; to: string }[] = [];
  nodes.push({ id: "north", kind: "location", label: "North lot" });
  for (let i = 0; i < 40; i++) {
    nodes.push({ id: `v${i}`, kind: "vehicle", label: `Vehicle ${i}` });
    edges.push({ kind: "parked-at", from: `v${i}`, to: "north" });
    nodes.push({ id: `d${i}`, kind: "deal", label: `Deal ${i}` }, { id: `s${i}`, kind: "service", label: `Service ${i}` });
    edges.push({ kind: "for-vehicle", from: `d${i}`, to: `v${i}` }, { kind: "services", from: `s${i}`, to: `v${i}` });
    nodes.push({ id: `c${i}`, kind: "customer", label: `Customer ${i}` }, { id: `t${i}`, kind: "drive", label: `Drive ${i}` }, { id: `x${i}`, kind: "trade", label: `Trade ${i}` });
    edges.push({ kind: "driver", from: `t${i}`, to: `c${i}` }, { kind: "drives", from: `t${i}`, to: `v${i}` }, { kind: "offered-by", from: `x${i}`, to: `c${i}` }, { kind: "buyer", from: `d${i}`, to: `c${i}` });
  }
  nodes.push({ id: "p1", kind: "staff", label: "Priya" });
  edges.push({ kind: "works-at", from: "p1", to: "north" });
  return Graph.from(schema, { nodes: nodes as never, edges });
};

describe("the row of kinds, when it sheds", () => {
  for (const width of [1016, 700]) {
    it(`draws no district under another at ${width}, and names every kind somewhere`, () => {
      const result = layout(graph(), schema, { ...EMPTY_VIEW, focusId: "north" }, { width, height: 806, unit: 16 });
      const row = result.nodes.filter((node) => node.plane === 2);
      const beyond = row.find((node) => node.beyond)?.beyond ?? [];
      const drawn = row.filter((node) => !node.beyond).map((node) => node.id.replace(/^kind:/, ""));
      for (const kind of schema.kinds) {
        if (kind === "location") continue;
        expect(drawn.includes(kind) || beyond.includes(kind), kind).toBe(true);
      }
      for (const a of row) {
        for (const b of row) {
          if (a === b) continue;
          const covered = a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
          expect(covered, `${a.id} drawn wholly under ${b.id}`).toBe(false);
        }
      }
    });
  }
});
