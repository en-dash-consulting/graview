import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/index.js";

/**
 * The strip's reason for an act, on a hover, said "this is a staff" of a
 * staff member: the one sentence W-131 did not reach.
 */
const staff = defineNode("staff", { fields: z.object({ label: z.string() }), plural: "Staff", noun: "staff member" });
const schema = createSchema([staff]);
const { defineMutation } = bindSchema(schema);
const hire = defineMutation("hire", {
  title: "Hire somebody",
  creates: ["staff"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "staff"), kind: "staff", label: args.label }),
});

describe("the reason an act is offered", () => {
  it("names one of a kind by its noun", () => {
    const store = new Store({ schema, mutations: [hire], invariants: [] });
    store.apply({ name: "hire", args: { label: "Mei Lin Chow" } });
    const { affordances } = deriveAffordances(store, ["staff:mei-lin-chow"]);
    const why = affordances.map((affordance) => affordance.why).filter(Boolean);
    expect(why).toContain("this is a staff member");
    expect(why).not.toContain("this is a staff");
  });
});
