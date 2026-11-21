import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bindPerson, hostSeat, mergePerson, rebindPerson } from "../../src/binding.js";
import { bindSchema, createSchema, defineNode, nodeRef, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * A MOVE OR A MERGE OF A PERSON SAYS WHICH LINKS IT LEFT BEHIND (Roadmap
 * f-merge-profile-seat-and-links-past-horizon). Bud's account was bound to
 * Ann's record before this store's history begins — it was loaded from a
 * snapshot, or its log compacted — and the links on Ann from then cannot be
 * told apart: some Bud may have made "as me", some somebody made naming Ann.
 * A move takes what the log shows he made, and says how many of the older
 * ones it left on Ann, of which relations, in a sentence a host can show the
 * owner; none when there are none.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }), edges: { minds: { to: ["participant"] } } } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { givenBy: { to: ["participant"] } } } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const giveIt = defineMutation("give-it", { title: "I'll give it", doneAsMe: true, subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: ctx.me }) } as never);

const ungive = defineMutation("ungive", { title: "Not given by", subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]), by: nodeRef(["participant"]) }), apply: (ctx: any, args: any) => ctx.removeEdge({ kind: "givenBy", from: args.id, to: args.by }) } as never);
const giveTo = defineMutation("give-to", { title: "Given by", subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]), by: nodeRef(["participant"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: args.by }) } as never);

const policy: Policy = {
  grants: [
    { roles: ["owner"], mutations: "*" },
    { roles: ["member"], mutations: ["give-it"] },
  ],
  sees: [{ roles: ["owner", "member"], kinds: ["participant", "gift"] }],
};

const host = hostSeat({ id: "host" });
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const organizer: Principal = { kind: "human", id: "acct-org", roles: ["owner"] };

const nodes = [
  { id: "participant:bud", kind: "participant", name: "Bud" },
  { id: "participant:ann", kind: "participant", name: "Ann" },
  { id: "participant:cy", kind: "participant", name: "Cy" },
  { id: "gift:kite", kind: "gift", title: "A kite" },
  { id: "gift:book", kind: "gift", title: "A book" },
  { id: "gift:pen", kind: "gift", title: "A pen" },
];
/** On Ann before the log begins: two gifts given by her, Cy minded by her, and Bud minded by her — a link between the two records, which a move leaves anyway. */
const older = [
  { kind: "givenBy", from: "gift:kite", to: "participant:ann" },
  { kind: "givenBy", from: "gift:book", to: "participant:ann" },
  { kind: "minds", from: "participant:ann", to: "participant:cy" },
  { kind: "minds", from: "participant:ann", to: "participant:bud" },
];

const load = (seated: boolean, extra: readonly object[] = []) =>
  new Store<AnySchema>({
    schema,
    mutations: [giveIt, ungive, giveTo] as never,
    policy,
    snapshot: { nodes: [...nodes.map((node) => (seated && node.id === "participant:ann" ? { ...node, $seat: "acct-bud" } : node)), ...extra], edges: older },
  } as never);

const givers = (store: Store<AnySchema>, id: string) => store.graph.out(id, "givenBy" as never).map((one) => one.id);

describe("a move of a person bound before the log begins", () => {
  it("says how many links older than the log it left on the record, per relation", () => {
    const store = load(true);
    store.apply({ name: "give-it", args: { id: "gift:pen" } }, { author: bud });
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    expect(givers(store, "gift:pen")).toEqual(["participant:bud"]);
    expect(givers(store, "gift:kite")).toEqual(["participant:ann"]);
    expect(moved.leftBehind).toMatchObject({ count: 3, relations: { givenBy: 2, minds: 1 } });
  });

  it("says so in a sentence a host can show the owner", () => {
    const store = load(true);
    const { leftBehind } = rebindPerson(store, bud, "participant:bud", { author: host });
    expect(leftBehind.sentence).toBe("3 links on Ann are older than this app's history, so the move could not tell whether Bud made them and left them on Ann: given by (2), minds (1).");
  });

  it("counts an older link the log took off and put back, whose maker it still cannot tell", () => {
    const store = load(true);
    const removed = store.apply({ name: "ungive", args: { id: "gift:kite", by: "participant:ann" } }, { author: organizer });
    store.undo(removed.batch, { author: organizer });
    expect(givers(store, "gift:kite")).toEqual(["participant:ann"]);
    expect(rebindPerson(store, bud, "participant:bud", { author: host }).leftBehind).toMatchObject({ count: 3, relations: { givenBy: 2, minds: 1 } });
  });

  it("does not count an older link taken off since", () => {
    const store = load(true);
    store.apply({ name: "ungive", args: { id: "gift:kite", by: "participant:ann" } }, { author: organizer });
    expect(rebindPerson(store, bud, "participant:bud", { author: host }).leftBehind).toMatchObject({ count: 2, relations: { givenBy: 1, minds: 1 } });
  });

  it("does not count an older link taken off and made again by a call that named the record, nor once that call is redone", () => {
    const store = load(true);
    store.apply({ name: "ungive", args: { id: "gift:kite", by: "participant:ann" } }, { author: organizer });
    const given = store.apply({ name: "give-to", args: { id: "gift:kite", by: "participant:ann" } }, { author: organizer });
    const undone = store.undo(given.batch, { author: organizer });
    store.undo(undone.batch, { author: organizer });
    expect(givers(store, "gift:kite")).toEqual(["participant:ann"]);
    expect(rebindPerson(store, bud, "participant:bud", { author: host }).leftBehind).toMatchObject({ count: 2, relations: { givenBy: 1, minds: 1 } });
  });

  it("follows an older link of the person's own record through a merge, and counts it when they move on", () => {
    const store = new Store<AnySchema>({
      schema,
      mutations: [giveIt, ungive, giveTo] as never,
      policy,
      snapshot: { nodes: [...nodes, { id: "acct-bud", kind: "participant", name: "bud" }], edges: [{ kind: "givenBy", from: "gift:pen", to: "acct-bud" }] },
    } as never);
    expect(mergePerson(store, bud, "participant:ann", { author: host }).leftBehind).toEqual({ count: 0, relations: {} });
    expect(givers(store, "gift:pen")).toEqual(["participant:ann"]);
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    expect(givers(store, "gift:pen")).toEqual(["participant:ann"]);
    expect(moved.leftBehind).toMatchObject({ count: 1, relations: { givenBy: 1 } });
  });

  it("says one link as one", () => {
    const store = new Store<AnySchema>({ schema, mutations: [giveIt, ungive, giveTo] as never, policy, snapshot: { nodes: nodes.map((node) => (node.id === "participant:ann" ? { ...node, $seat: "acct-bud" } : node)), edges: [older[0]!] } } as never);
    expect(rebindPerson(store, bud, "participant:bud", { author: host }).leftBehind.sentence).toBe("1 link on Ann is older than this app's history, so the move could not tell whether Bud made it and left it on Ann: given by (1).");
  });
});

describe("a move or a merge that leaves nothing behind says none", () => {
  const none = { count: 0, relations: {} };

  it("a move whose binding the log holds: what the person made is all in it", () => {
    const store = load(false);
    bindPerson(store, bud, "participant:ann", { author: host });
    store.apply({ name: "give-it", args: { id: "gift:pen" } }, { author: bud });
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    expect(moved.leftBehind).toEqual(none);
    expect(givers(store, "gift:pen")).toEqual(["participant:bud"]);
  });

  it("a move of a person bound before the log begins to a record with no older links", () => {
    const store = new Store<AnySchema>({ schema, mutations: [giveIt, ungive, giveTo] as never, policy, snapshot: { nodes: nodes.map((node) => (node.id === "participant:ann" ? { ...node, $seat: "acct-bud" } : node)), edges: [] } } as never);
    expect(rebindPerson(store, bud, "participant:bud", { author: host }).leftBehind).toEqual(none);
  });

  it("a merge, which moves every link of the person's own record", () => {
    const store = load(false, [{ id: "acct-bud", kind: "participant", name: "bud" }]);
    const own = new Store<AnySchema>({ schema, mutations: [giveIt, ungive, giveTo] as never, policy, snapshot: { nodes: store.graph.allNodes(), edges: [...older, { kind: "givenBy", from: "gift:pen", to: "acct-bud" }] } } as never);
    const merged = mergePerson(own, bud, "participant:bud", { author: host });
    expect(merged.leftBehind).toEqual(none);
    expect(givers(own, "gift:pen")).toEqual(["participant:bud"]);
  });
});

describe("the host's own seat across a wire", () => {
  it("is said, in the graview-sight skill, to lose its mark as JSON, with what a host does instead", () => {
    const skill = readFileSync(new URL("../../../skills/skills/graview-sight/SKILL.md", import.meta.url), "utf8").replace(/\s+/g, " ");
    expect(skill).toMatch(/hostSeat\(\)[^.]*JSON[^.]*\./);
    expect(skill).toMatch(/calls? `?hostSeat\(\)`? on its own side/);
  });
});
