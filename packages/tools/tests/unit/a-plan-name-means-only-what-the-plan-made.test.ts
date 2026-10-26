import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { applyPlan, planFrom } from "../../src/index.js";

/**
 * A PLAN'S NAME MEANS ONLY WHAT THE PLAN MADE. `{ $plan: "lawn" }` is the
 * thing an earlier call in the same plan made, and nothing else: not a
 * record that happens to have that id, not the name itself when the call
 * that should have made it made nothing. A plan comes from a model, and a
 * model can see the graph's ids; a name it chose equal to one of them must
 * never turn a review of something new into an act on something standing.
 */
const bed = defineNode("bed", { fields: z.object({ label: z.string() }), plural: "Beds" });
const schema = createSchema([bed]);
const { defineMutation } = bindSchema(schema);
const plant = defineMutation("plant-bed", {
  title: "Plant a bed",
  creates: ["bed"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "bed"), kind: "bed", label: args.label } as never),
});
const rename = defineMutation("rename-bed", {
  title: "Rename a bed",
  subject: { kinds: ["bed"], arg: "bedId" },
  input: z.object({ bedId: nodeRef(["bed"]), label: z.string() }),
  apply: (ctx, args) => void ctx.patchNode(args.bedId, { label: args.label } as never),
});
const dig = defineMutation("dig-up", {
  title: "Dig up a bed",
  subject: { kinds: ["bed"], arg: "bedId" },
  input: z.object({ bedId: nodeRef(["bed"]) }),
  apply: (ctx, args) => void ctx.removeNode(args.bedId),
});
const make = (policy?: unknown) =>
  new Store({
    schema,
    mutations: [plant, rename, dig],
    ...(policy ? { policy: policy as never } : {}),
    snapshot: { nodes: [{ id: "b_roses", kind: "bed", label: "Rose Bed" }, { id: "b_herbs", kind: "bed", label: "Herb Bed" }] as never, edges: [] },
  });
const beds = (store: Store<typeof schema>) => store.graph.nodesOfKind("bed").map((node) => node.id).sort();

describe("a plan's name means only what the plan made", () => {
  it("refuses a name that is already a record's id", () => {
    const store = make();
    const plan = planFrom(store, [{ mutation: "plant-bed", as: "b_herbs", args: { label: "New Tomatoes" } }]);
    expect(plan.ready).toEqual([]);
    expect(plan.refused[0]!.refusal!.message).toMatch(/b_herbs.*already/);
  });

  it("refuses what waits for a call the seat may not make", () => {
    const store = make({ roles: ["keeper", "crew"], grants: [{ roles: ["keeper"], mutations: ["plant-bed"] }, { roles: ["crew"], mutations: ["dig-up", "rename-bed"] }] });
    const crew: Principal = { kind: "human", id: "p9", roles: ["crew"] } as Principal;
    const plan = planFrom(
      store,
      [
        { mutation: "plant-bed", as: "seedlings", args: { label: "Seedlings" } },
        { mutation: "dig-up", args: { bedId: { $plan: "seedlings" } } },
      ],
      { principal: crew },
    );
    expect(plan.ready).toEqual([]);
    expect(plan.refused.map((entry) => entry.call.mutation)).toEqual(["plant-bed", "dig-up"]);
    expect(plan.refused[1]!.refusal!.message).toMatch(/seedlings/);
  });

  it("stops, and takes back what ran, when a name it refers to was never made", () => {
    const store = make();
    // A call that makes nothing, named; and one that acts on the name.
    const plan = planFrom(store, [
      { mutation: "rename-bed", as: "fresh", args: { bedId: "b_herbs", label: "Herbs 2" } },
      { mutation: "dig-up", args: { bedId: { $plan: "fresh" } } },
    ]);
    expect(plan.ready.length).toBe(2);
    const result = applyPlan(store, plan);
    expect(result.stoppedAt?.why).toMatch(/fresh/);
    expect(result.undone).toBe(true);
    expect(beds(store)).toEqual(["b_herbs", "b_roses"]);
    expect((store.graph.getNode("b_herbs") as { label: string }).label).toBe("Herb Bed");
  });

  it("never acts on the record a name spells, even when a plan is handed straight to applyPlan", () => {
    const store = make();
    const plan = planFrom(store, [
      { mutation: "rename-bed", as: "b_roses", args: { bedId: "b_herbs", label: "Herbs 2" } },
      { mutation: "dig-up", args: { bedId: { $plan: "b_roses" } } },
    ]);
    applyPlan(store, plan);
    expect(beds(store)).toEqual(["b_herbs", "b_roses"]);
  });

  it("still runs a name it made", () => {
    const store = make();
    const plan = planFrom(store, [
      { mutation: "plant-bed", as: "fresh", args: { label: "Fresh" } },
      { mutation: "rename-bed", args: { bedId: { $plan: "fresh" }, label: "Fresher" } },
    ]);
    const result = applyPlan(store, plan);
    expect(result.applied).toBe(2);
    expect((store.graph.getNode(result.made["fresh"]!) as { label: string }).label).toBe("Fresher");
  });
});
