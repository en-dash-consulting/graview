import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, checkApp, createSchema, defineApp, defineNode, nodeRef, Store, type Policy, type Principal } from "../../src/index.js";

/**
 * A SEAT SEES WHAT IT MAY. A policy said who may DO each act and nothing
 * about who may SEE each record, so a storefront showed a stranger every
 * customer's name, email and finance question (the seventh walk). `sees`
 * keeps a kind to the roles it names, and with `own` to the principal's
 * own record and what an edge joins to it; `seenBy` is the store as one
 * principal may see it, and every act still goes to the store itself.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const shopper = defineNode("shopper", { fields: z.object({ label: z.string(), email: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", {
  fields: z.object({ label: z.string() }),
  plural: "Enquiries",
  edges: { from: { to: ["shopper"], cardinality: "one", description: "who asked", inverse: "their enquiries" }, about: { to: ["car"], description: "the car", inverse: "the enquiries about it" } },
});
const schema = createSchema([car, shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
const ask = defineMutation("ask", {
  title: "Ask",
  subject: { kinds: ["shopper"], arg: "shopperId" },
  creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "enquiry");
    ctx.addNode({ id, kind: "enquiry", label: args.label });
    ctx.addEdge({ kind: "from", from: id, to: args.shopperId });
  },
});
const policy: Policy = {
  grants: [{ roles: ["shopper"], mutations: ["ask"], self: true }, { roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: ["staff"], kinds: ["shopper", "enquiry"] },
    { roles: ["shopper"], kinds: ["shopper", "enquiry"], own: true },
  ],
};
const make = () =>
  new Store({
    schema,
    mutations: [ask],
    policy,
    snapshot: {
      nodes: [
        { id: "car:golf", kind: "car", label: "Golf" },
        { id: "shopper:bethan", kind: "shopper", label: "Bethan Okonkwo", email: "bethan@mail.example" },
        { id: "shopper:freya", kind: "shopper", label: "Freya Davies", email: "freya@mail.example" },
        { id: "enquiry:1", kind: "enquiry", label: "Finance on the Golf" },
      ] as never,
      edges: [{ kind: "from", from: "enquiry:1", to: "shopper:freya" }, { kind: "about", from: "enquiry:1", to: "car:golf" }],
    },
  });
const bethan: Principal = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };
const staff: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };
const browsing: Principal = { kind: "human", id: "browsing", roles: [] };
const ids = (store: Store<never>) => store.graph.allNodes().map((node) => node.id).sort();

describe("the store as one seat may see it", () => {
  it("shows a stranger the shop window and nobody in it", () => {
    const store = make();
    expect(ids(store.seenBy(browsing) as never)).toEqual(["car:golf"]);
    expect(store.seenBy(browsing).graph.in("car:golf")).toEqual([]);
    expect(store.kindsKeptFrom(browsing)).toEqual(new Set(["shopper", "enquiry"]));
  });

  it("shows a shopper themselves and what is theirs, never another customer", () => {
    const store = make();
    expect(ids(store.seenBy(bethan) as never)).toEqual(["car:golf", "shopper:bethan"]);
    store.seenBy(bethan).apply({ name: "ask", args: { shopperId: "shopper:bethan", label: "Is it still there?" } }, { author: bethan });
    expect(ids(store.seenBy(bethan) as never)).toEqual(["car:golf", "enquiry:is-it-still-there", "shopper:bethan"]);
    expect(store.seenBy(bethan).batches().map((batch) => batch.intent)).toHaveLength(1);
    // Somebody else's enquiry is a change the stranger cannot see: in its place, and saying nothing of it (FR-16).
    expect(store.seenBy(browsing).batches().map((batch) => batch.intent)).toEqual(["A change you cannot see"]);
  });

  it("shows the store everything, and is the store itself where no sight is declared", () => {
    const store = make();
    expect(ids(store.seenBy(staff) as never)).toHaveLength(4);
    const open = new Store({ schema, mutations: [ask] });
    expect(open.seenBy(browsing)).toBe(open);
  });
});

describe("a sight the checker reads", () => {
  it("names a kind somebody declared", () => {
    const app = defineApp({ name: "Showroom", schema, mutations: [ask], policy: { ...policy, sees: [{ roles: ["staff"], kinds: ["customer"] }] } });
    expect(checkApp(app).findings.map((finding) => finding.code)).toContain("sight-unknown-kind");
  });
});
