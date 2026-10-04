import { describe, expect, it } from "vitest";
import { z } from "zod";
import { type AnySchema, beginning, bindSchema, checkApp, createSchema, defineApp, defineNode, type GraviewApp, nodeRef } from "../../src/index.js";

/**
 * THE ORDER THINGS MUST BE MADE IN, WHICH THE DECLARATION ALREADY STATES.
 *
 * `creates: ["feature"]` and `zoneId: nodeRef(["zone"])` are together a
 * dependency graph over kinds, and one place read it: the affordance
 * derivation, withholding a single act whose picker would be empty. Read
 * whole it is the whole of onboarding — the way in, the order to ask in, the
 * order to apply in, and what can never arrive at all.
 *
 * It reads the DECLARATION, not a graph. What can be done on a particular
 * graph is `deriveAffordances`' question; this is the one underneath it.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const feature = defineNode("feature", { fields: z.object({ label: z.string() }), plural: "Features" });
const routine = defineNode("routine", { fields: z.object({ label: z.string() }), plural: "Routines" });
const almanac = defineNode("almanac", { fields: z.object({ label: z.string() }), plural: "Almanacs" });
const schema = createSchema([zone, feature, routine, almanac]);
const { defineMutation } = bindSchema(schema);

const stakeOut = defineMutation("stake-out", {
  title: "Stake out some ground",
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => ctx.addNode({ id: ctx.freshId(args.label, "zone"), kind: "zone", label: args.label }),
});
const placeFeature = defineMutation("place-feature", {
  title: "Place a feature",
  creates: ["feature"],
  input: z.object({ label: z.string(), zoneId: nodeRef(["zone"]) }),
  apply: (ctx, args) => ctx.addNode({ id: ctx.freshId(args.label, "feature"), kind: "feature", label: args.label }),
});
const scheduleRoutine = defineMutation("schedule-routine", {
  title: "Schedule a routine",
  creates: ["routine"],
  input: z.object({ label: z.string(), featureId: nodeRef(["feature"]) }),
  apply: (ctx, args) => ctx.addNode({ id: ctx.freshId(args.label, "routine"), kind: "routine", label: args.label }),
});

const app = defineApp({ name: "grounds", schema, mutations: [stakeOut, placeFeature, scheduleRoutine] });

describe("the chain a declaration states", () => {
  it("finds the kinds that can begin with nothing in the graph", () => {
    const chain = beginning(app);
    expect(chain.roots).toEqual(["zone"]);
    expect(chain.doors).toEqual(["stake-out"]);
  });

  it("puts every kind in the order a blank installation can fill it", () => {
    const chain = beginning(app);
    expect(chain.order.map((entry) => `${entry.kind}@${entry.depth}`)).toEqual([
      "zone@0",
      "feature@1",
      "routine@2",
      "almanac@null",
    ]);
  });

  it("says what each kind waits for, in the declaration's own names", () => {
    const chain = beginning(app);
    const at = (kind: string) => chain.order.find((entry) => entry.kind === kind)!;
    expect(at("feature").needs).toEqual(["zone"]);
    expect(at("routine").needs).toEqual(["feature"]);
    expect(at("feature").madeBy).toEqual(["place-feature"]);
  });

  it("names what nothing can ever make, and why", () => {
    const chain = beginning(app);
    expect(chain.unreachable).toEqual([
      { kind: "almanac", why: "no act declares that it creates this kind" },
    ]);
  });

  it("takes the cheapest door when a kind has two", () => {
    const quick = defineMutation("plant-anywhere", {
      creates: ["feature"],
      input: z.object({ label: z.string() }),
      apply: (ctx, args) => ctx.addNode({ id: ctx.freshId(args.label, "feature"), kind: "feature", label: args.label }),
    });
    const chain = beginning(defineApp({ name: "g", schema, mutations: [stakeOut, placeFeature, quick] }));
    /* One open door is enough, so the feature is a root and waits for nothing. */
    expect(chain.order.find((entry) => entry.kind === "feature")).toMatchObject({ depth: 0, needs: [] });
    expect(chain.roots).toEqual(["feature", "zone"]);
  });

  it("asks first for the root that the most other kinds wait on", () => {
    /*
     * Batch, equipment and site all begin on an empty graph, and the site is
     * the one nearly everything else stands in. By name it came last.
     */
    const kind = (id: string) => defineNode(id, { fields: z.object({ label: z.string() }) });
    const yard = createSchema([kind("batch"), kind("equipment"), kind("site"), kind("shift"), kind("pour"), kind("crew")]);
    const make = bindSchema(yard).defineMutation;
    const act = (kindId: string, needs: Record<string, string> = {}) =>
      make(`make-${kindId}`, {
        creates: [kindId],
        input: z.object({
          label: z.string(),
          ...Object.fromEntries(Object.entries(needs).map(([arg, of]) => [arg, nodeRef([of])])),
        }),
        apply: () => {},
      });
    const chain = beginning(
      defineApp({
        name: "yard",
        schema: yard,
        mutations: [
          act("batch"),
          act("equipment"),
          act("site"),
          act("crew", { siteId: "site" }),
          act("shift", { siteId: "site", equipmentId: "equipment" }),
          act("pour", { shiftId: "shift", batchId: "batch" }),
        ],
      }),
    );
    /* site opens crew, shift and pour; equipment opens shift and pour; batch opens pour. */
    expect(chain.roots).toEqual(["site", "equipment", "batch"]);
    expect(chain.order.map((entry) => `${entry.kind}@${entry.depth}`)).toEqual([
      "site@0",
      "equipment@0",
      "batch@0",
      "shift@1",
      "crew@1",
      "pour@2",
    ]);
  });

  it("keeps to the name among kinds that open as much as each other", () => {
    const quick = defineMutation("plant-anywhere", {
      creates: ["feature"],
      input: z.object({ label: z.string() }),
      apply: () => {},
    });
    const chain = beginning(defineApp({ name: "g", schema, mutations: [stakeOut, quick] }));
    expect(chain.roots).toEqual(["feature", "zone"]);
  });

  it("calls a cycle unreachable rather than looping in it", () => {
    const eggFirst = defineMutation("egg-first", {
      creates: ["feature"],
      input: z.object({ routineId: nodeRef(["routine"]) }),
      apply: () => {},
    });
    const henFirst = defineMutation("hen-first", {
      creates: ["routine"],
      input: z.object({ featureId: nodeRef(["feature"]) }),
      apply: () => {},
    });
    const chain = beginning(defineApp({ name: "g", schema, mutations: [eggFirst, henFirst] }));
    expect(chain.unreachable.map((entry) => entry.kind).sort()).toEqual([
      "almanac",
      "feature",
      "routine",
      "zone",
    ]);
    expect(chain.doors).toEqual([]);
  });

  it("does not count an optional reference as something to wait for", () => {
    const loose = defineMutation("note-a-feature", {
      creates: ["feature"],
      input: z.object({ label: z.string(), zoneId: nodeRef(["zone"]).optional() }),
      apply: () => {},
    });
    const chain = beginning(defineApp({ name: "g", schema, mutations: [loose] }));
    expect(chain.roots).toEqual(["feature"]);
  });
});

describe("what the checker says about a blank installation", () => {
  const codes = <S extends AnySchema>(a: GraviewApp<S>) =>
    checkApp(a).findings.map((finding) => `${finding.severity}:${finding.code}`);

  it("notes the kinds that cannot arrive, and names the way in", () => {
    const said = checkApp(app).findings.find((f) => f.code === "blank-graph-unreachable")!;
    expect(said.severity).toBe("note");
    expect(said.message).toContain('"almanac"');
    expect(said.message).toContain('"stake-out"');
    expect(checkApp(app).ok).toBe(true);
  });

  it("notes an app nothing can begin at all", () => {
    const shut = defineApp({ name: "g", schema, mutations: [placeFeature] });
    expect(codes(shut)).toContain("note:blank-graph-has-no-door");
  });

  it("says nothing about an app whose every kind has a door", () => {
    const small = bindSchema(createSchema([zone, feature]));
    const open = defineApp({
      name: "g",
      schema: small.schema,
      mutations: [
        small.defineMutation("stake-out", { title: "Stake out some ground", creates: ["zone"], input: z.object({ label: z.string() }), apply: () => {} }),
        small.defineMutation("place-feature", {
          title: "Place a feature",
          creates: ["feature"],
          input: z.object({ label: z.string(), zoneId: nodeRef(["zone"]) }),
          apply: () => {},
        }),
      ],
    });
    expect(codes(open)).not.toContain("note:blank-graph-unreachable");
    expect(codes(open)).not.toContain("note:blank-graph-has-no-door");
  });
});
