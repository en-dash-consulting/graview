import { afterEach, describe, expect, it, vi } from "vitest";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type Policy, type Principal } from "../../src/index.js";

/*
 * WHAT A SEAT IS KEPT FROM IS WORKED OUT ONCE A STATE (Roadmap
 * f-visitor-link-check-off-the-draw-clock). For a seat under a `sees` rule,
 * `kindsKeptFrom` judges every act the seat may do, and a page asks it for
 * each link it draws: six hundred and more times a draw, for a visitor. It
 * is now kept per seat while nothing it reads has changed — and never
 * answered from what it kept once a change is committed, the day turns,
 * something read beside the graph answers, or another seat asks.
 */
const car = defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" });
const shopper = defineNode("shopper", { fields: z.object({ label: z.string() }), plural: "Shoppers" });
const enquiry = defineNode("enquiry", { fields: z.object({ label: z.string() }), plural: "Enquiries", edges: { from: { to: ["shopper"], cardinality: "one" } } });
const schema = createSchema([car, shopper, enquiry]);
const { defineMutation } = bindSchema(schema);
const ask = defineMutation("ask", {
  subject: { kinds: ["shopper"], arg: "shopperId" },
  creates: ["enquiry"],
  input: z.object({ shopperId: nodeRef(["shopper"]), label: z.string() }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "enquiry");
    ctx.addNode({ id, kind: "enquiry", label: args.label });
    ctx.addEdge({ kind: "from", from: id, to: args.shopperId });
  },
});
const addCar = defineMutation("add-car", {
  creates: ["car"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "car"), kind: "car", label: args.label });
  },
});
const policy: Policy = {
  grants: [{ roles: ["shopper"], mutations: ["ask"] }, { roles: ["staff"], mutations: "*" }],
  sees: [
    { roles: "*", kinds: ["car"] },
    { roles: ["staff"], kinds: ["shopper", "enquiry"] },
  ],
};
const showroom = () =>
  new Store({ schema, mutations: [ask, addCar], policy, snapshot: { nodes: [{ id: "car:golf", kind: "car", label: "Golf" }, { id: "shopper:bethan", kind: "shopper", label: "Bethan" }] as never, edges: [] } });
const visitor: Principal = { kind: "visitor", id: "visitor:someone", roles: [] };
const shopperSeat: Principal = { kind: "human", id: "shopper:bethan", roles: ["shopper"] };
const staff: Principal = { kind: "human", id: "staff:rhian", roles: ["staff"] };

afterEach(() => vi.restoreAllMocks());

describe("what a seat is kept from", () => {
  it("is worked out once however many times a draw asks it, while nothing has changed", () => {
    const store = showroom();
    const judged = vi.spyOn(store, "permittedMutations");
    const answers = Array.from({ length: 700 }, () => store.kindsKeptFrom(visitor));
    expect(judged).toHaveBeenCalledTimes(1);
    expect([...answers[0]!].sort()).toEqual(["enquiry", "shopper"]);
    expect(answers.every((one) => one === answers[0])).toBe(true);
  });

  it("is answered for the seat that asks: another seat, or the same seat with other roles, is worked out for itself", () => {
    const store = showroom();
    expect([...store.kindsKeptFrom(visitor)].sort()).toEqual(["enquiry", "shopper"]);
    /* A shopper may begin an enquiry, so the kind is not kept from them, though no sight shows them one. */
    expect([...store.kindsKeptFrom(shopperSeat)]).toEqual(["shopper"]);
    expect([...store.kindsKeptFrom(staff)]).toEqual([]);
    expect([...store.kindsKeptFrom({ ...visitor, roles: ["staff"] })]).toEqual([]);
    expect([...store.kindsKeptFrom(visitor)].sort()).toEqual(["enquiry", "shopper"]);
  });

  it("is worked out again once a change is committed", () => {
    const store = showroom();
    store.kindsKeptFrom(visitor);
    const judged = vi.spyOn(store, "permittedMutations");
    store.apply({ name: "add-car", args: { label: "Polo" } }, { author: staff });
    store.kindsKeptFrom(visitor);
    store.kindsKeptFrom(visitor);
    expect(judged).toHaveBeenCalledTimes(1);
  });

  it("is worked out again once the store tells its subscribers anything else: something read beside the graph", () => {
    const store = showroom();
    store.kindsKeptFrom(visitor);
    const judged = vi.spyOn(store, "permittedMutations");
    store.reread();
    store.kindsKeptFrom(visitor);
    expect(judged).toHaveBeenCalledTimes(1);
  });

  it("is never one store's answer in another, though both hold the same graph", () => {
    const first = showroom();
    const second = new Store({ schema, mutations: [ask, addCar], policy: { ...policy, grants: [...policy.grants, { roles: "*", mutations: ["ask"] }] }, snapshot: first.graph.snapshot() as never });
    expect([...first.kindsKeptFrom(visitor)].sort()).toEqual(["enquiry", "shopper"]);
    expect([...second.kindsKeptFrom(visitor)]).toEqual(["shopper"]);
  });
});
