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
    expect(answers.every((one) => [...one].sort().join() === "enquiry,shopper")).toBe(true);
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

/** What the store works out, rather than answers from what it kept. */
const workedOut = (store: object) => vi.spyOn(store as unknown as { kindsKeptNow(principal: Principal): ReadonlySet<string> }, "kindsKeptNow");
const keptSeats = (store: object) => (store as unknown as { keptKinds?: { seats: Map<string, unknown> } }).keptKinds?.seats.size ?? 0;

describe("what a seat is kept from, handed out", () => {
  it("is each caller's own: what one caller does to it is never the next caller's answer", () => {
    const store = showroom();
    const first = store.kindsKeptFrom(visitor) as Set<string>;
    first.clear();
    first.add("car");
    expect([...store.kindsKeptFrom(visitor)].sort()).toEqual(["enquiry", "shopper"]);
  });
});

describe("the seat an answer is kept for", () => {
  it("is what working it out reads: every visitor of one shared seat is one answer, whatever its session, name or key", () => {
    const store = showroom();
    const judged = workedOut(store);
    for (let i = 0; i < 500; i += 1) store.kindsKeptFrom({ kind: "visitor", id: "visitor:anyone", roles: [], shared: true, visitorKey: `v${i}`, session: `s${i}`, name: `Visitor ${i}` } as unknown as Principal);
    expect(judged).toHaveBeenCalledTimes(1);
    expect(keptSeats(store)).toBe(1);
  });

  it("reads its roles in one order: the same roles, said in another order, are the same seat", () => {
    const store = showroom();
    const judged = workedOut(store);
    store.kindsKeptFrom({ kind: "human", id: "x", roles: ["staff", "shopper"] });
    store.kindsKeptFrom({ kind: "human", id: "x", roles: ["shopper", "staff", "staff"] });
    expect(judged).toHaveBeenCalledTimes(1);
  });

  it("reads each field by name, so a principal that is not plain data is never taken for another", () => {
    const store = showroom();
    expect([...store.kindsKeptFrom(visitor)].sort()).toEqual(["enquiry", "shopper"]);
    /* Its roles on a getter, and a `toJSON` that would say it is a visitor with none: it is staff. */
    class Seat {
      readonly kind = "human";
      readonly id = "staff:sian";
      get roles() {
        return ["staff"];
      }
      toJSON() {
        return { kind: "visitor", id: "visitor:someone", roles: [] };
      }
    }
    expect([...store.kindsKeptFrom(new Seat() as unknown as Principal)]).toEqual([]);
    const proxied = new Proxy({} as Principal, { get: (_, key) => (key === "kind" ? "human" : key === "id" ? "staff:rhian" : key === "roles" ? ["staff"] : undefined) });
    expect([...store.kindsKeptFrom(proxied)]).toEqual([]);
    /* Acting for somebody is part of the seat: an agent for one person and the agent alone are kept apart, each answered as worked out afresh. */
    const fresh = (principal: Principal) => [...(store as unknown as { kindsKeptNow(principal: Principal): ReadonlySet<string> }).kindsKeptNow(principal)].sort();
    const alone: Principal = { kind: "agent", id: "agent:helper", roles: ["shopper"] };
    const forStaff: Principal = { ...alone, onBehalfOf: staff };
    const before = keptSeats(store);
    expect([...store.kindsKeptFrom(forStaff)].sort()).toEqual(fresh(forStaff));
    expect([...store.kindsKeptFrom(alone)].sort()).toEqual(fresh(alone));
    expect(keptSeats(store)).toBe(before + 2);
  });

  it("keeps at most 64 seats at once, however many ask", () => {
    const store = showroom();
    for (let i = 0; i < 1_000; i += 1) store.kindsKeptFrom({ kind: "human", id: `shopper:${i}`, roles: ["shopper"] });
    expect(keptSeats(store)).toBeLessThanOrEqual(64);
    expect([...store.kindsKeptFrom(shopperSeat)]).toEqual(["shopper"]);
  });
});
