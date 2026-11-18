import { describe, expect, it } from "vitest";
import { bindPerson, hostSeat, mayBind, mergePerson, rebindPerson, unbindPerson } from "../../src/binding.js";
import { BIND_PERSON, bindSchema, createSchema, defineNode, BIND_OWN_RECORD, nameOfAuthor, nodeRef, PermissionDeniedError, REBIND_PERSON, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * MOVING A PERSON TO THE RIGHT RECORD COVERS AN ENDED BINDING, WHAT THEIR
 * ACTS LINKED, AND ONLY THE HOST (Roadmap f-rebind-follow-ups). Bud's
 * account was bound to Ann's record and he gave the kite "as me" before
 * anybody noticed. The host moves him to his own record, whether or not his
 * binding has ended since, and the kite moves with him: given by Bud, in
 * the same change. The binding acts are run by the host's own seat alone.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string(), age: z.number() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { givenBy: { to: ["participant"] } } } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const giveIt = defineMutation("give-it", { title: "I'll give it", doneAsMe: true, subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: ctx.me }) } as never);
const giveFor = defineMutation("give-for", { title: "Give it for", subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]), by: nodeRef(["participant"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: args.by }) } as never);

const policy: Policy = {
  grants: [
    { roles: ["owner"], mutations: "*" },
    { roles: ["member"], mutations: ["give-it", "give-for"] },
    { roles: ["member"], mutations: ["edit-participant"], self: true },
  ],
  sees: [{ roles: ["owner", "member"], kinds: ["participant", "gift"] }],
};

const host = hostSeat({ id: "host" });
const organizer: Principal = { kind: "human", id: "acct-org", roles: ["owner"] };
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const ann: Principal = { kind: "human", id: "acct-ann", roles: ["member"] };

function family(): Store<AnySchema> {
  return new Store<AnySchema>({
    schema,
    mutations: [giveIt, giveFor] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "participant:bud", kind: "participant", name: "Bud", age: 12 },
        { id: "participant:ann", kind: "participant", name: "Ann", age: 40 },
        { id: "gift:kite", kind: "gift", title: "A kite" },
        { id: "gift:book", kind: "gift", title: "A book" },
      ],
      edges: [],
    },
  } as never);
}

/** Bud's account bound to Ann's record: the kite given "as me", the book given naming Ann, and Ann's age edited. */
function misbound(): { readonly store: Store<AnySchema>; readonly acted: readonly string[] } {
  const store = family();
  bindPerson(store, bud, "participant:ann", { author: host });
  const kite = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
  const book = store.apply({ name: "give-for", args: { id: "gift:book", by: "participant:ann" } }, { author: bud });
  const age = store.apply({ name: "edit-participant", args: { id: "participant:ann", age: 12 } }, { author: bud });
  return { store, acted: [kite.ops[0]!.id, book.ops[0]!.id, age.ops[0]!.id] };
}

const givers = (store: Store<AnySchema>, id: string) => store.graph.out(id, "givenBy" as never).map((one) => one.id);
const saidAs = (store: Store<AnySchema>, id: string) => {
  const view = store.seenBy(organizer);
  const op = view.log.all().find((one) => one.id === id)!;
  return nameOfAuthor(op.author, { graph: view.graph as never, schema: store.schema });
};

describe("a binding that already ended can be moved", () => {
  it("says what the person did as the wrong record as the right one, and frees the wrong one", () => {
    const { store, acted } = misbound();
    unbindPerson(store, bud, { author: host });
    expect(mayBind(store, "participant:ann").ok).toBe(false);
    rebindPerson(store, bud, "participant:bud", { author: host });
    for (const id of acted) expect(saidAs(store, id)).toBe("Bud");
    expect(mayBind(store, "participant:ann")).toEqual({ ok: true });
    expect(store.graph.getNode("participant:bud")).not.toHaveProperty("$seat");
    expect(store.graph.getNode("participant:ann")).not.toHaveProperty("$seat");
  });

  it("leaves the binding ended, on the right record: the account is nobody's, and may be bound again only to it", () => {
    const { store } = misbound();
    unbindPerson(store, bud, { author: host });
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(store.personOf(bud)).toBe("acct-bud");
    expect(mayBind(store, "participant:bud").ok).toBe(false);
    expect(() => bindPerson(store, bud, "participant:ann", { author: host })).toThrow(/That account was Bud here: bind it to them again/);
    bindPerson(store, bud, "participant:bud", { author: host });
    expect(store.personOf(bud)).toBe("participant:bud");
  });

  it("is one change, which undo takes back whole", () => {
    const { store, acted } = misbound();
    unbindPerson(store, bud, { author: host });
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    expect(moved.ops).toHaveLength(1);
    expect(store.mayUndo(moved.batch, host)).toEqual({ ok: true });
    store.undo(moved.batch, { author: host });
    for (const id of acted) expect(saidAs(store, id)).toBe("Ann");
    expect(givers(store, "gift:kite")).toEqual(["participant:ann"]);
    expect(mayBind(store, "participant:ann").ok).toBe(false);
    expect(mayBind(store, "participant:bud")).toEqual({ ok: true });
    expect(() => bindPerson(store, bud, "participant:bud", { author: host })).toThrow(/That account was Ann here/);
  });
});

describe("links the person's acts made as them move with them", () => {
  it("moves a link made through $me to the right record, in the same change", () => {
    const { store } = misbound();
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    expect(moved.ops).toHaveLength(1);
    expect(givers(store, "gift:kite")).toEqual(["participant:bud"]);
  });

  it("leaves what an act wrote naming the record itself as it wrote it", () => {
    const { store } = misbound();
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(givers(store, "gift:book")).toEqual(["participant:ann"]);
    expect(store.graph.getNode("participant:ann")).toMatchObject({ age: 12 });
    expect(store.graph.getNode("participant:bud")).toMatchObject({ age: 12 });
  });

  it("moves them for an ended binding too", () => {
    const { store } = misbound();
    unbindPerson(store, bud, { author: host });
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(givers(store, "gift:kite")).toEqual(["participant:bud"]);
  });

  it("puts them back when the move is taken back", () => {
    const { store } = misbound();
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    store.undo(moved.batch, { author: host });
    expect(givers(store, "gift:kite")).toEqual(["participant:ann"]);
    expect(store.personOf(bud)).toBe("participant:ann");
  });

  it("leaves a link nobody's act made as them, or one taken back since, where it is", () => {
    const store = family();
    bindPerson(store, bud, "participant:ann", { author: host });
    store.apply({ name: "give-for", args: { id: "gift:book", by: "participant:ann" } }, { author: organizer });
    const kite = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    store.undo(kite.batch, { author: bud });
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(givers(store, "gift:book")).toEqual(["participant:ann"]);
    expect(givers(store, "gift:kite")).toEqual([]);
  });
});

describe("only the host's own seat runs the binding acts", () => {
  const systemSeats: readonly [string, Principal][] = [
    ["a system seat named as the host is, not minted by it", { kind: "system", id: "host" }],
    ["a system seat with no id", { kind: "system" }],
    ["a sync", { kind: "system", id: "notion" }],
    ["a migration", { kind: "system", id: "ship:migration" }],
    ["another app's change", { kind: "system", id: "app:elsewhere" }],
    ["the app's own actor", { kind: "system", id: "tidying", automated: true } as Principal],
    ["a host's seat run as automated", { ...hostSeat({ id: "host" }), automated: true } as Principal],
  ];
  for (const [who, principal] of systemSeats) {
    it(`refuses ${who}`, () => {
      const store = family();
      expect(() => bindPerson(store, bud, "participant:ann", { author: principal })).toThrow(PermissionDeniedError);
      bindPerson(store, bud, "participant:ann", { author: host });
      expect(() => rebindPerson(store, bud, "participant:bud", { author: principal })).toThrow(PermissionDeniedError);
      expect(() => unbindPerson(store, bud, { author: principal })).toThrow(PermissionDeniedError);
      for (const name of [BIND_PERSON, REBIND_PERSON, BIND_OWN_RECORD]) expect(store.permits({ name, args: { seat: "acct-ann", record: "participant:bud", from: "participant:ann", to: "participant:bud" } }, principal).ok).toBe(false);
      expect(store.personOf(bud)).toBe("participant:ann");
    });
  }

  it("refuses taking a binding back to every seat but the host's own", () => {
    const store = family();
    const bound = bindPerson(store, bud, "participant:bud", { author: host });
    expect(store.mayUndo(bound.batch, { kind: "system", id: "host" }).ok).toBe(false);
    expect(store.mayUndo(bound.batch, host)).toEqual({ ok: true });
  });

  it("keeps the host's own seat its own: a copy made as a record is written is no host", () => {
    const store = family();
    const copied = JSON.parse(JSON.stringify(host)) as Principal;
    expect(() => bindPerson(store, bud, "participant:bud", { author: copied })).toThrow(PermissionDeniedError);
    expect(bindPerson(store, bud, "participant:bud", { author: { ...host } }).ops).toHaveLength(1);
  });

  it("runs all four as the host's own seat, whatever it is called", () => {
    const store = family();
    const cloud = hostSeat({ id: "graview-cloud", name: "Graview" });
    bindPerson(store, bud, "participant:ann", { author: cloud });
    rebindPerson(store, bud, "participant:bud", { author: cloud });
    unbindPerson(store, bud, { author: cloud });
    expect(store.personOf(bud)).toBe("acct-bud");
    const own = new Store<AnySchema>({ schema, policy, snapshot: { nodes: [{ id: "acct-ann", kind: "participant", name: "ann", age: 1 }, { id: "participant:ann", kind: "participant", name: "Ann", age: 40 }], edges: [] } } as never);
    mergePerson(own, ann, "participant:ann", { author: cloud });
    expect(own.personOf(ann)).toBe("participant:ann");
  });
});
