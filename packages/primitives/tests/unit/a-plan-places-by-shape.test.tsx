// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, z } from "@graview/core";
import { describe, expect, it } from "vitest";
import { buildPlanLens, PlanBindingError } from "../../src/index.js";

/**
 * A LENS PLACES NODES BY A RULE THE DOMAIN SUPPLIES.
 *
 * A timeline places by time. A matrix places by two sets. A board places by
 * coordinates the nodes carry. This places by an OUTLINE — a closed shape
 * on the node — with points standing inside it, and the domain says which
 * kind carries which.
 *
 * It was written in a product, for a garden, and every line of it turned
 * out to be about drawing. So the test that matters is the one that builds
 * it over something that is not a garden: a floor of a building, where
 * nothing is ground, no field name matches, and it must still work.
 */

const room = defineNode("room", {
  fields: z.object({ label: z.string(), plan: z.array(z.object({ x: z.number(), y: z.number() })).optional(), use: z.string() }),
  plural: "Rooms",
});
const fixture = defineNode("fixture", {
  fields: z.object({ label: z.string(), spot: z.object({ x: z.number(), y: z.number() }).optional(), sort: z.string() }),
  plural: "Fixtures",
});
const schema = createSchema([room, fixture]);
const options = {
  regions: "room",
  outline: "plan",
  markers: "fixture",
  at: "spot",
  within: "sits-in",
  regionKind: "use",
  markerKind: "sort",
} as const;

const box = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const nodes = [
  { id: "kitchen", kind: "room", label: "Kitchen", use: "wet", plan: box(0, 0, 0.5, 0.5) },
  { id: "hall", kind: "room", label: "Hall", use: "circulation" },
  { id: "sink", kind: "fixture", label: "Sink", sort: "plumbing", spot: { x: 0.2, y: 0.2 } },
  { id: "meter", kind: "fixture", label: "Meter", sort: "services" },
];
const edges = [{ kind: "sits-in", from: "sink", to: "kitchen" }];

describe("a plan built over a building, which is not what it was written for", () => {
  it("draws the rooms that have a shape and names the ones that do not", () => {
    const plan = buildPlanLens(nodes as never, edges, options, schema as never);
    expect(plan.regions.map((one) => one.label)).toEqual(["Kitchen"]);
    expect(plan.regions[0]!.what).toBe("wet");
    /* A room somebody named and never drew is said out loud, not dropped. */
    expect(plan.undrawn.map((one) => one.label)).toEqual(["Hall"]);
  });

  it("stands a fixture in the room its edge points at", () => {
    const plan = buildPlanLens(nodes as never, edges, options, schema as never);
    expect(plan.regions[0]!.markers.map((one) => one.label)).toEqual(["Sink"]);
    expect(plan.regions[0]!.markers[0]!.at).toEqual({ x: 0.2, y: 0.2 });
  });

  it("says which fixtures stand nowhere, because that is the absence to surface", () => {
    const plan = buildPlanLens(nodes as never, edges, options, schema as never);
    expect(plan.strays.map((one) => one.label)).toEqual(["Meter"]);
  });

  it("refuses a binding that names a field the kind does not have, and says which", () => {
    expect(() => buildPlanLens(nodes as never, edges, { ...options, outline: "shape" }, schema as never)).toThrow(
      PlanBindingError,
    );
    try {
      buildPlanLens(nodes as never, edges, { ...options, outline: "shape" }, schema as never);
    } catch (error) {
      expect((error as Error).message).toContain('"room" has no field called "shape"');
    }
  });

  it("refuses a binding that names a kind nothing declares", () => {
    expect(() => buildPlanLens(nodes as never, edges, { ...options, regions: "storey" }, schema as never)).toThrow(
      /No kind is declared for "storey"/,
    );
  });
});
