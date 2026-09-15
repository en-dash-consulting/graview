import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { kindCardId } from "@graview/layout";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/index.js";

/**
 * A DISTRICT THAT CANNOT BEGIN SAYS WHAT IT IS WAITING FOR.
 *
 * "`creates: [kind]` on every act that adds a kind — an EMPTY kind card
 * offers its own beginnings, which is the whole onboarding of a blank graph"
 * holds for the kinds at the ROOT of a dependency chain and stops there. In
 * any real domain almost every creating act connects to something: an act
 * that takes a `zoneId` cannot act while there are no zones, so its district
 * offered nothing at all. The derivation is right — a form with an empty
 * picker is worse than no button — and the consequence was invisible: a
 * person meets eight districts, one of which offers a way in, and no
 * explanation for the other seven.
 *
 * It is the normal case rather than the exception, and it only ever appears
 * on the one graph nobody tests against: the empty one.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const feature = defineNode("feature", { fields: z.object({ label: z.string() }), plural: "Features" });
const schema = createSchema([zone, feature]);
const { defineMutation } = bindSchema(schema);

const stakeOut = defineMutation("stake-out", {
  title: "Stake out some ground",
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode("zone", { label: args.label });
  },
});
const placeFeature = defineMutation("place-feature", {
  title: "Place a feature",
  creates: ["feature"],
  input: z.object({ label: z.string(), zoneId: nodeRef(["zone"]) }),
  apply(ctx, args) {
    ctx.addNode("feature", { label: args.label });
  },
});

const derive = (nodes: readonly { id: string; kind: string; label: string }[], kind: string) => {
  const store = new Store({
    schema,
    mutations: [stakeOut, placeFeature],
    snapshot: { nodes: nodes as never, edges: [] },
  });
  return deriveAffordances(store, [kindCardId(kind)], { kindSelection: [kind] });
};

describe("an empty district whose act needs another kind first", () => {
  it("still offers nothing, because a picker with no candidates is worse", () => {
    expect(derive([], "feature").affordances.map((a) => a.mutation)).toEqual([]);
  });

  it("says what it is waiting for, in the act's own title and the kind's own name", () => {
    const said = derive([], "feature").observations.map((observation) => observation.text);
    expect(said).toContain('"Place a feature" cannot begin until there is a zone.');
  });

  it("offers its own beginning once the ground exists, and stops explaining", () => {
    const with_ = derive([{ id: "lawn", kind: "zone", label: "Back Lawn" }], "feature");
    expect(with_.affordances.map((a) => a.mutation)).toEqual(["place-feature"]);
    expect(with_.observations.map((o) => o.id)).not.toContain("schema:waits:place-feature");
  });

  it("says nothing about a district that was always able to begin", () => {
    const roots = derive([], "zone");
    expect(roots.affordances.map((a) => a.mutation)).toEqual(["stake-out"]);
    expect(roots.observations.filter((o) => o.id.startsWith("schema:waits:"))).toEqual([]);
  });
});
