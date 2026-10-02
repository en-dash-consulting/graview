import { bindSchema, createSchema, defineNode, nodeRef, Store, type Policy, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { deriveAffordances } from "../../src/index.js";

/**
 * "YOU, ON YOURS", OFFERED WHERE YOU ARE STANDING.
 *
 * A shopper's acts take the shopper as their subject, so a self grant can
 * say a shopper shortlists for themselves and nobody else. Standing on a
 * car, the same act is offered from its far end with the shopper still to
 * choose — and the derivation asked the policy with the subject unfilled,
 * which no self grant can pass. Bethan, signed in, was told "Not permitted:
 * “Shortlist a car” — a manager or a shopper can" on every car in the
 * showroom: every job the storefront exists for, refused to the one person
 * it is for, by a sentence naming her own role (the seventh walk).
 */
const car = defineNode("car", { description: "A car.", fields: z.object({ label: z.string() }), plural: "Cars", label: (node) => node.label });
const shopper = defineNode("shopper", {
  description: "Somebody looking.",
  fields: z.object({ label: z.string() }),
  plural: "Shoppers",
  label: (node) => node.label,
  edges: { shortlisted: { to: ["car"], description: "the cars on their shortlist", inverse: "who shortlisted it" } },
});
const schema = createSchema([car, shopper]);
const { defineMutation } = bindSchema(schema);
const shortlist = defineMutation("shortlist", {
  title: "Shortlist a car",
  fromTheOtherEnd: "Save to a shortlist",
  description: "Keep a car to come back to.",
  subject: { kinds: ["shopper"], arg: "shopperId" },
  connects: ["shortlisted"],
  input: z.object({ shopperId: nodeRef(["shopper"]), carId: nodeRef(["car"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "shortlisted", from: args.shopperId, to: args.carId });
  },
});
const policy: Policy = {
  roles: ["shopper", "manager"],
  grants: [
    { roles: ["manager"], mutations: "*" },
    { roles: ["shopper"], mutations: ["shortlist"], self: true, describe: "A shopper keeps their own shortlist." },
  ],
};
const store = new Store({
  schema,
  mutations: [shortlist],
  policy,
  snapshot: {
    nodes: [
      { id: "car:golf", kind: "car", label: "2022 Volkswagen Golf" },
      { id: "shopper:bethan", kind: "shopper", label: "Bethan" },
      { id: "shopper:freya", kind: "shopper", label: "Freya" },
    ] as never,
    edges: [],
  },
});
const bethan: Principal = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };
const browsing: Principal = { kind: "human", id: "browsing", roles: [] };

describe("an act granted on your own record, offered from the far end", () => {
  it("is offered to you, on yourself, with nothing left to ask about who", () => {
    const { affordances, withheld } = deriveAffordances(store, ["car:golf"], { principal: bethan });
    const offered = affordances.find((one) => one.mutation === "shortlist");
    expect(withheld.map((one) => one.mutation)).not.toContain("shortlist");
    expect(offered?.args).toMatchObject({ carId: "car:golf", shopperId: "shopper:bethan" });
    expect(offered?.open.map((one) => one.name)).not.toContain("shopperId");
    store.apply({ name: "shortlist", args: { ...offered!.args } }, { author: bethan });
    expect(store.graph.out("shopper:bethan", "shortlisted").map((node) => node.id)).toEqual(["car:golf"]);
  });

  it("once done for you, is neither offered nor refused; withheld from somebody with no record of that kind; and no reason names a role you hold", () => {
    const { withheld } = deriveAffordances(store, ["car:golf"], { principal: browsing });
    expect(withheld.map((one) => one.mutation)).toContain("shortlist");
    const all = deriveAffordances(store, ["car:golf"], { principal: bethan });
    expect([...all.affordances, ...all.withheld].map((one) => one.mutation)).not.toContain("shortlist");
    for (const one of all.withheld) {
      expect(one.refusal.wouldNeed.filter((role) => bethan.roles!.includes(role)), `${one.mutation}: ${one.refusal.message}`).toEqual([]);
    }
  });
});
