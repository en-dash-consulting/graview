import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  createViewRegistry,
  defineApp,
  defineNode,
  describeApp,
  nodeRef,
} from "../../src/index.js";

/**
 * "RUN IT AND LOOK" IS THE ONE INSTRUCTION AN AGENT CANNOT FOLLOW.
 *
 * Every skill ends on it, and the product that found thirty-one things in
 * this framework ended its own summary on it too: *what no check caught,
 * running it did* — four faults that passed every static check and were
 * obvious the moment somebody opened the thing. An agent can declare and
 * cannot see.
 *
 * The interface here is DERIVED, which is exactly what makes it describable.
 * Each test below is one of those four faults, caught in words.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const feature = defineNode("feature", { fields: z.object({ label: z.string() }), plural: "Features" });
const schema = createSchema([zone, feature]);
const { defineMutation } = bindSchema(schema);

const stakeOut = defineMutation("stake-out", {
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply: () => {},
});
const placeFeature = defineMutation("place-feature", {
  creates: ["feature"],
  input: z.object({ label: z.string(), zoneId: nodeRef(["zone"]) }),
  apply: () => {},
});

describe("reading an app out", () => {
  it("says what a blank installation meets, which is the screen nobody tests", () => {
    const said = describeApp(defineApp({ name: "grounds", schema, mutations: [stakeOut, placeFeature] }));
    expect(said).toContain("1 of 2 kinds can begin: zone");
    expect(said).toContain('"stake-out"');
    expect(said).toContain("feature waits for zone");
  });

  it("says plainly when nothing can be made at all", () => {
    const said = describeApp(defineApp({ name: "grounds", schema, mutations: [placeFeature] }));
    expect(said).toContain("Nothing can be made");
  });

  /*
   * THE POLICY FAULT: declared, enforced, and no principal holding a granted
   * role — so every act in the whole product is refused and every repair
   * struck through, with no error anywhere. It looks broken rather than
   * guarded, and `graview check` passes it.
   */
  it("counts what one seat may actually do, which is how a silent refusal shows", () => {
    const app = defineApp({
      name: "grounds",
      schema,
      mutations: [stakeOut, placeFeature],
      policy: {
        roles: ["keeper", "visitor"],
        grants: [{ roles: ["keeper"], mutations: "*", describe: "The keeper keeps it." }],
      },
    });
    expect(describeApp(app, { as: { kind: "human", id: "sam", roles: ["visitor"] } })).toContain(
      "Every act in the product would be struck through",
    );
    expect(describeApp(app, { as: { kind: "human", id: "ada", roles: ["keeper"] } })).not.toContain(
      "struck through",
    );
  });

  /*
   * THE HUE FAULT, in its general form: not "the unit is wrong" but "these
   * kinds will read as one colour", which is what a person sees.
   */
  it("says when two kinds will be drawn in the same colour", () => {
    const near = defineApp({
      name: "grounds",
      schema,
      mutations: [stakeOut],
      brand: { name: "Grounds", accents: { zone: 120, feature: 124 } },
    });
    expect(describeApp(near)).toContain("will read as one colour");
    const apart = defineApp({
      name: "grounds",
      schema,
      mutations: [stakeOut],
      brand: { name: "Grounds", accents: { zone: 120, feature: 300 } },
    });
    expect(describeApp(apart)).not.toContain("will read as one colour");
  });

  /*
   * THE LENS FAULT'S NEIGHBOUR: a declaration whose pictures live in the UI
   * package is invisible to every tool outside a browser. Saying WHICH of
   * "there are none" and "I cannot see them" this is, is the whole value.
   */
  it("distinguishes an app with no views from one whose views it cannot see", () => {
    const unseen = describeApp(defineApp({ name: "grounds", schema, mutations: [stakeOut] }));
    expect(unseen).toContain("carries no view registry");

    const views = createViewRegistry<typeof schema, string>(schema);
    views.register("zone", { cardinality: "many", fidelity: "full" }, "TheGrounds", { title: "The grounds" });
    const seen = describeApp(defineApp({ name: "grounds", schema, mutations: [stakeOut], views }));
    expect(seen).toContain("1 of 2 kinds have a view of their own: zone");
    expect(seen).toContain("Drawn by the framework's list: feature");
    expect(seen).toContain('"The grounds" over the zones');
  });

  it("names a rule that tells a person about a problem they cannot fix", () => {
    const { defineInvariant } = bindSchema(schema);
    const unfixable = defineInvariant("every-zone-kept", {
      scope: { kind: "zone" },
      description: "Every zone has somebody keeping it.",
      evaluate: () => [],
    });
    expect(describeApp(defineApp({ name: "g", schema, mutations: [stakeOut], invariants: [unfixable] }))).toContain(
      "NO REPAIR",
    );
  });
});
