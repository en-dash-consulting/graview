import { bindSchema, createSchema, defineApp, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { applyPlan, describePlan, planFrom } from "../../src/index.js";

/**
 * A PLAN IS WHAT A MODEL WANTS TO DO, AS AN OBJECT.
 *
 * An act is declared, typed, permissioned, logged and undoable. A list of
 * proposed calls was none of those: applied in whatever order it was
 * written, by code each app wrote itself. The first product to seed a graph
 * from a model wrote the ordering, the review, the batch and the allowlist;
 * the second would have written all four again, slightly differently.
 */
const zone = defineNode("zone", { fields: z.object({ label: z.string() }), plural: "Zones" });
const feature = defineNode("feature", {
  fields: z.object({ label: z.string() }),
  plural: "Features",
  edges: { stands: { to: ["zone"], description: "where it stands", inverse: "what stands here" } },
});
const schema = createSchema([zone, feature]);
const { defineMutation } = bindSchema(schema);

const stakeOut = defineMutation("stake-out", {
  title: "Stake out some ground",
  creates: ["zone"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) =>
    void ctx.addNode({ id: ctx.freshId(args.label, "zone"), kind: "zone", label: args.label } as never),
});
const placeFeature = defineMutation("place-feature", {
  title: "Place a feature",
  creates: ["feature"],
  input: z.object({ label: z.string(), zoneId: nodeRef(["zone"]) }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "feature");
    ctx.addNode({ id, kind: "feature", label: args.label } as never);
    ctx.addEdge({ kind: "stands", from: id, to: args.zoneId });
  },
});

const app = defineApp({ name: "grounds", schema, mutations: [stakeOut, placeFeature] });
const store = (policy?: Parameters<typeof defineApp>[0]["policy"]) =>
  new Store({ schema, mutations: [stakeOut, placeFeature], ...(policy ? { policy } : {}) });

describe("ordering a plan", () => {
  it("makes what a later call points at, first", () => {
    const plan = planFrom(
      store(),
      [
        { mutation: "place-feature", args: { label: "The oak", zoneId: { $plan: "lawn" } }, why: "it stands there" },
        { mutation: "stake-out", as: "lawn", args: { label: "Back Lawn" } },
      ],
      { app },
    );
    expect(plan.entries.map((entry) => entry.call.mutation)).toEqual(["stake-out", "place-feature"]);
    expect(plan.refused).toEqual([]);
    expect(plan.makes).toEqual({ zone: 1, feature: 1 });
  });

  it("falls back to the chain the declaration states when nothing points anywhere", () => {
    /* No plan references at all: a zone still comes before a feature. */
    const plan = planFrom(
      store(),
      [
        { mutation: "place-feature", args: { label: "The oak", zoneId: "lawn-1" } },
        { mutation: "stake-out", args: { label: "Back Lawn" } },
      ],
      { app },
    );
    expect(plan.entries.map((entry) => entry.call.mutation)).toEqual(["stake-out", "place-feature"]);
  });

  it("refuses a reference to something the plan never makes", () => {
    const plan = planFrom(store(), [
      { mutation: "place-feature", args: { label: "The oak", zoneId: { $plan: "nowhere" } } },
    ]);
    expect(plan.refused).toHaveLength(1);
    expect(plan.refused[0]!.refusal!.message).toContain('"nowhere"');
  });

  it("refuses two calls that wait for each other rather than guessing", () => {
    const plan = planFrom(store(), [
      { mutation: "place-feature", as: "a", args: { label: "A", zoneId: { $plan: "b" } } },
      { mutation: "place-feature", as: "b", args: { label: "B", zoneId: { $plan: "a" } } },
    ]);
    expect(plan.ready).toEqual([]);
    expect(plan.refused.map((entry) => entry.refusal!.message)).toEqual([
      "This call and another wait for each other, so neither can go first.",
      "This call and another wait for each other, so neither can go first.",
    ]);
  });

  it("refuses an act nobody registered, by name", () => {
    const plan = planFrom(store(), [{ mutation: "invent-a-thing", args: {} }]);
    expect(plan.refused[0]!.refusal!.message).toContain('"invent-a-thing"');
  });
});

describe("judging a plan before any of it runs", () => {
  const policy = {
    roles: ["keeper", "visitor"],
    grants: [{ roles: ["keeper"], mutations: "*" as const, describe: "The keeper keeps it." }],
  };
  const visitor: Principal = { kind: "human", id: "sam", roles: ["visitor"] };

  it("keeps a refused call in the plan with its reason, rather than dropping it", () => {
    const plan = planFrom(store(policy), [{ mutation: "stake-out", args: { label: "Back Lawn" } }], {
      principal: visitor,
      app,
    });
    expect(plan.ready).toEqual([]);
    expect(plan.entries).toHaveLength(1);
    expect(plan.refused[0]!.refusal!.message).toContain("keeper");
  });

  it("reads out what it would do, refusals struck through", () => {
    const said = describePlan(
      planFrom(store(policy), [{ mutation: "stake-out", args: { label: "Back Lawn" } }], {
        principal: visitor,
      }),
    );
    expect(said).toContain("0 of 1 to run");
    expect(said).toContain("✗ stake-out");
    expect(said).toContain("REFUSED");
  });
});

describe("applying a plan", () => {
  it("resolves what earlier calls made, and lands as one turn", () => {
    const at = store();
    const plan = planFrom(
      at,
      [
        { mutation: "place-feature", args: { label: "The oak", zoneId: { $plan: "lawn" } } },
        { mutation: "stake-out", as: "lawn", args: { label: "Back Lawn" } },
      ],
      { app },
    );
    const done = applyPlan(at, plan);
    expect(done.applied).toBe(2);
    expect(done.stoppedAt).toBeUndefined();

    const zones = at.graph.nodesOfKind("zone");
    const features = at.graph.nodesOfKind("feature");
    expect(zones).toHaveLength(1);
    expect(features).toHaveLength(1);
    /* The edge points at the node the plan made a moment earlier. */
    expect(at.graph.outEdges(features[0]!.id, "stands").map((edge) => edge.to)).toEqual([zones[0]!.id]);
    expect(done.made["lawn"]).toBe(zones[0]!.id);
  });

  it("is one batch, so forty nodes go back the way they arrived", () => {
    const at = store();
    const plan = planFrom(
      at,
      [
        { mutation: "stake-out", as: "lawn", args: { label: "Back Lawn" } },
        { mutation: "place-feature", args: { label: "The oak", zoneId: { $plan: "lawn" } } },
      ],
      { app },
    );
    const done = applyPlan(at, plan);
    expect(at.graph.allNodes()).toHaveLength(2);
    at.undo(done.batch);
    expect(at.graph.allNodes()).toHaveLength(0);
  });

  it("stops where it stopped and says so, rather than vanishing", () => {
    const at = store();
    const plan = planFrom(at, [
      { mutation: "stake-out", as: "lawn", args: { label: "Back Lawn" } },
      /* A zoneId that is not a zone: the store refuses it when it runs. */
      { mutation: "place-feature", args: { label: "The oak", zoneId: "not-a-zone" } },
    ], { app });
    const done = applyPlan(at, plan);
    expect(done.applied).toBe(1);
    expect(done.stoppedAt?.at).toBe(1);
    expect(done.stoppedAt?.why).toBeTruthy();
    /* What did run stands, and the batch is the handle for taking it back. */
    expect(at.graph.nodesOfKind("zone")).toHaveLength(1);
    at.undo(done.batch);
    expect(at.graph.allNodes()).toHaveLength(0);
  });

  it("runs only what an agent was declared able to run", () => {
    const guarded = new Store({
      schema,
      mutations: [stakeOut, placeFeature],
      intelligence: [{ name: "surveyor", kind: "llm", may: ["stake-out"] }],
    });
    const surveyor: Principal = { kind: "agent", id: "surveyor" };
    const plan = planFrom(guarded, [
      { mutation: "stake-out", as: "lawn", args: { label: "Back Lawn" } },
      { mutation: "place-feature", args: { label: "The oak", zoneId: { $plan: "lawn" } } },
    ], { app });
    const done = applyPlan(guarded, plan, { author: surveyor });
    expect(done.applied).toBe(1);
    expect(done.stoppedAt?.why).toContain("declared able to");
  });
});
