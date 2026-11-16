import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { dependentsOf, planFrom, without } from "../../src/index.js";

/**
 * A QUESTION ABOUT A PLAN ALONE IS ASKED OF AN EMPTY STORE. A review asks
 * what goes with a declined line before anything is applied, and the answer
 * cannot depend on what the graph holds. The store it is asked of is the
 * app's own, made with nothing in it: a plan reads the store's acts, its
 * policy and its graph, so an object shaped like a few of those breaks the
 * first time the plan reads one more.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const feature = defineNode("feature", { fields: z.object({ label: z.string() }), plural: "Features" });
const schema = createSchema([zone, feature]);
const { defineMutation } = bindSchema(schema);
const addZone = defineMutation("add-zone", {
  title: "Add a zone",
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "zone"), kind: "zone", label: args.label } as never),
});
const placeFeature = defineMutation("place-feature", {
  title: "Place a feature",
  creates: ["feature"],
  input: z.object({ label: z.string(), zoneId: nodeRef(["zone"]) }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "feature"), kind: "feature", label: args.label } as never),
});
const mutations = [addZone, placeFeature];

const calls = [
  { mutation: "place-feature", as: "maple", args: { label: "The Maple", zoneId: { $plan: "back" } } },
  { mutation: "add-zone", as: "back", args: { label: "Back Lawn" } },
  { mutation: "add-zone", as: "front", args: { label: "Front Lawn" } },
];

const empty = () => new Store({ schema, mutations });
const full = () =>
  new Store({
    schema,
    mutations,
    snapshot: {
      nodes: [
        { id: "z_side", kind: "zone", label: "Side Yard" },
        { id: "f_shed", kind: "feature", label: "The Shed" },
      ] as never,
      edges: [],
    },
  });

const shape = (store: Store<typeof schema>) => {
  const plan = planFrom(store, calls);
  return {
    order: plan.entries.map((entry) => entry.call.as),
    refused: plan.refused.length,
    goesWithBack: dependentsOf(plan, "back").map((entry) => entry.call.as),
    leftWithoutBack: without(store, plan, ["back"]).ready.map((entry) => entry.call.as),
  };
};

describe("a plan alone is asked of an empty store", () => {
  it("orders, judges and cascades the same over an empty store as over a full one", () => {
    expect(shape(empty())).toEqual(shape(full()));
    expect(shape(empty())).toEqual({
      order: ["back", "maple", "front"],
      refused: 0,
      goesWithBack: ["maple"],
      leftWithoutBack: ["front"],
    });
  });

  it("still refuses, over an empty store, only what the plan itself gets wrong", () => {
    const plan = planFrom(empty(), [{ mutation: "place-feature", as: "x", args: { label: "X", zoneId: { $plan: "nowhere" } } }]);
    expect(plan.refused[0]!.refusal!.message).toMatch(/nowhere.*nothing in this plan makes/);
  });

  it("is the only store where a plan's name equal to a record's id is not refused, which is why the graph is read", () => {
    const named = [{ mutation: "add-zone", as: "z_side", args: { label: "Side Yard" } }];
    expect(planFrom(empty(), named).refused).toHaveLength(0);
    expect(planFrom(full(), named).refused[0]!.refusal!.message).toMatch(/z_side.*already a record's id/);
  });
});
