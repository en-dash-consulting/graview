import { describe, expect, it } from "vitest";
import { bindPerson, unbindPerson } from "../../src/binding.js";
import { ActRefusal, BIND_PERSON, bindSchema, createSchema, defineNode, nameOfAuthor, nodeRef, PermissionDeniedError, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * A HOST CAN END A PERSON'S BINDING (Roadmap f-unbind-person). An owner who
 * accepted the wrong invitation takes the binding back — after somebody
 * edited the record, which says nothing of whose record it is — and is told
 * in words why when it may not be. And a member who leaves stops being their
 * record, while what they did stays said as that person and is handed to
 * nobody bound there after them.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string(), age: z.number() }), edges: { memberOf: { to: ["household"] } } } as never);
const household = defineNode("household", { label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { givenBy: { to: ["participant"] } } } as never);
const schema = createSchema([participant, household, gift]);
const { defineMutation } = bindSchema(schema);
const giveIt = defineMutation("give-it", { title: "I'll give it", doneAsMe: true, subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: ctx.me }) } as never);

const policy: Policy = {
  grants: [
    { roles: ["owner"], mutations: "*" },
    { roles: ["member"], mutations: ["give-it"] },
    { roles: ["member"], mutations: ["edit-participant"], self: true },
  ],
  sees: [
    { roles: ["owner"], kinds: ["participant", "household", "gift"] },
    { roles: ["member"], kinds: ["participant", "gift"] },
    { roles: ["member"], kinds: ["household"], own: true },
  ],
};

const organizer: Principal = { kind: "human", id: "acct-org", roles: ["owner"] };
const host: Principal = { kind: "system", id: "host" };
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const ann: Principal = { kind: "human", id: "acct-ann", roles: ["member"] };

function family(): Store<AnySchema> {
  return new Store<AnySchema>({
    schema,
    mutations: [giveIt] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "participant:bud", kind: "participant", name: "Bud", age: 12 },
        { id: "participant:ann", kind: "participant", name: "Ann", age: 40 },
        { id: "household:smith", kind: "household", name: "The Smiths" },
        { id: "gift:kite", kind: "gift", title: "A kite" },
      ],
      edges: [{ kind: "memberOf", from: "participant:bud", to: "household:smith" }],
    },
  } as never);
}

/** What a refusal may never say: an op's id, a batch's, or an account's. */
const saysNoIds = (store: Store<AnySchema>, message: string) => {
  for (const op of store.log.all()) {
    expect(message).not.toContain(op.id);
    expect(message).not.toContain(op.batch);
  }
  expect(message).not.toMatch(/\bop \w|\bbatch \w|acct-/);
};

describe("taking a binding back", () => {
  it("is open to the host after the organizer edited the record, while the seat never acted as it", () => {
    const store = family();
    const done = bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, { author: organizer });
    expect(store.mayUndo(done.batch, host)).toEqual({ ok: true });
    store.undo(done.batch, { author: host });
    expect(store.personOf(bud)).toBe("acct-bud");
    expect(store.graph.getNode("participant:bud")).toMatchObject({ age: 13 });
    expect(store.graph.getNode("participant:bud")).not.toHaveProperty("$seat");
  });

  it("is open after a record linked to it changed, and after another person was bound", () => {
    const store = family();
    const done = bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "edit-household", args: { id: "household:smith", name: "The Smith family" } }, { author: organizer });
    bindPerson(store, ann, "participant:ann", { author: host });
    expect(store.mayUndo(done.batch, host)).toEqual({ ok: true });
  });

  it("is refused once the seat edited its own record, in words that name no op or batch", () => {
    const store = family();
    const done = bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, { author: bud });
    const may = store.mayUndo(done.batch, host);
    expect(may).toMatchObject({ ok: false, refusal: { message: "Bud has acted here: unbinding would hand what they did to someone else." } });
    let said = "";
    try {
      store.undo(done.batch, { author: host });
    } catch (error) {
      said = (error as Error).message;
    }
    expect(said).toMatch(/Bud has acted here/);
    saysNoIds(store, said);
    expect(store.personOf(bud)).toBe("participant:bud");
  });

  it("is refused once the record was removed, in words that name no op or batch", () => {
    const store = family();
    const done = bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "remove-participant", args: { id: "participant:bud" } }, { author: organizer });
    const may = store.mayUndo(done.batch, host);
    expect(may.ok).toBe(false);
    const said = may.ok ? "" : (may.refusal?.message ?? (may.check && !may.check.ok ? may.check.message : ""));
    expect(said).toBe("This cannot be taken back: the record was removed, or whose record it is changed, since.");
    saysNoIds(store, said);
    expect(() => store.undo(done.batch, { author: host })).toThrow(/cannot be taken back/);
  });

  it("is still the host's alone", () => {
    const store = family();
    const done = bindPerson(store, bud, "participant:bud", { author: host });
    expect(store.mayUndo(done.batch, organizer).ok).toBe(false);
    expect(() => store.undo(done.batch, { author: organizer })).toThrow(PermissionDeniedError);
  });
});

describe("ending a binding", () => {
  it("makes the seat nobody's record, though it acted as the record", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    const ended = unbindPerson(store, bud, { author: host });
    expect(ended.ops).toHaveLength(1);
    expect(ended.ops[0]).toMatchObject({ mutation: { name: BIND_PERSON }, author: { kind: "system", id: "host" } });
    expect(store.personOf(bud)).toBe("acct-bud");
    expect(store.graph.getNode("participant:bud")).not.toHaveProperty("$seat");
    expect(store.sees(bud, "household:smith")).toBe(false);
    expect(store.permits({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, bud).ok).toBe(false);
  });

  it("keeps what the seat did said as the person, to everyone else and to the host", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    const given = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    unbindPerson(store, bud, { author: host });
    const view = store.seenBy(ann);
    const op = view.log.all().find((one) => one.id === given.ops[0]!.id)!;
    expect(op.author).toMatchObject({ id: "participant:bud" });
    expect(nameOfAuthor(op.author, { graph: view.graph as never, schema: store.schema })).toBe("Bud");
    expect(JSON.stringify(view.log.all())).not.toContain("acct-bud");
    expect(store.graph.out("gift:kite", "givenBy" as never).map((one) => one.id)).toEqual(["participant:bud"]);
  });

  it("hands the record to nobody bound after", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    unbindPerson(store, bud, { author: host });
    expect(() => bindPerson(store, ann, "participant:bud", { author: host })).toThrow(/Bud is already someone else's record here/);
  });

  it("binds the seat to no other record after, so what it did is said as nobody else", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    unbindPerson(store, bud, { author: host });
    expect(() => bindPerson(store, bud, "participant:ann", { author: host })).toThrow(/That account was Bud here: bind it to them again/);
    expect(bindPerson(store, bud, "participant:bud", { author: host }).ops).toHaveLength(1);
    expect(store.personOf(bud)).toBe("participant:bud");
  });

  it("is the host's alone", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    expect(() => unbindPerson(store, bud, { author: organizer })).toThrow(PermissionDeniedError);
    expect(() => unbindPerson(store, bud, { author: bud })).toThrow(PermissionDeniedError);
    expect(store.personOf(bud)).toBe("participant:bud");
  });

  it("is refused, in words, for a seat bound to nobody", () => {
    const store = family();
    expect(() => unbindPerson(store, bud, { author: host })).toThrow(ActRefusal);
    expect(() => unbindPerson(store, bud, { author: host })).toThrow(/is nobody's record here/);
  });

  it("is taken back by the host, and the seat is the record again", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    const ended = unbindPerson(store, bud, { author: host });
    store.undo(ended.batch, { author: host });
    expect(store.personOf(bud)).toBe("participant:bud");
  });

  it("says nothing of the account to anybody but the host", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    unbindPerson(store, bud, { author: host });
    expect(JSON.stringify(store.seenBy(ann).log.all())).not.toContain("acct-bud");
    expect(JSON.stringify(store.seenBy(organizer).log.all())).not.toContain("acct-bud");
  });
});

describe("a binding taken back, ended or put back again", () => {
  const author = (store: Store<AnySchema>, reader: Principal, id: string) => store.seenBy(reader).log.all().find((one) => one.id === id)!.author;

  it("keeps what the seat did said as the person through an ending taken back and made again", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    const given = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    const ended = unbindPerson(store, bud, { author: host });
    const back = store.undo(ended.batch, { author: host });
    store.undo(back.batch, { author: host });
    expect(store.personOf(bud)).toBe("acct-bud");
    expect(author(store, ann, given.ops[0]!.id)).toMatchObject({ id: "participant:bud" });
    expect(JSON.stringify(store.seenBy(ann).log.all())).not.toContain("acct-bud");
  });

  it("keeps a binding put back once its seat has acted as the record since", () => {
    const store = family();
    const done = bindPerson(store, bud, "participant:bud", { author: host });
    const undone = store.undo(done.batch, { author: host });
    const redone = store.undo(undone.batch, { author: host });
    expect(store.personOf(bud)).toBe("participant:bud");
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    expect(store.mayUndo(redone.batch, host)).toMatchObject({ ok: false, refusal: { message: "Bud has acted here: unbinding would hand what they did to someone else." } });
    expect(() => store.undo(redone.batch, { author: host })).toThrow(/Bud has acted here/);
    expect(JSON.stringify(store.seenBy(ann).log.all())).not.toContain("acct-bud");
  });

  it("binds nobody else to the record after an ending, though the seat never acted", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    unbindPerson(store, bud, { author: host });
    expect(() => bindPerson(store, ann, "participant:bud", { author: host })).toThrow(/Bud is already someone else's record here/);
    expect(() => bindPerson(store, bud, "participant:ann", { author: host })).toThrow(/That account was Bud here/);
  });

  it("is ended and put back by the host alone", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    const ended = unbindPerson(store, bud, { author: host });
    expect(store.mayUndo(ended.batch, organizer).ok).toBe(false);
    expect(() => store.undo(ended.batch, { author: organizer })).toThrow(PermissionDeniedError);
    expect(() => store.undo(ended.batch, { author: bud })).toThrow(PermissionDeniedError);
    expect(store.personOf(bud)).toBe("acct-bud");
  });

  it("says what stands in its way in words a member may read", () => {
    const store = family();
    const done = bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "remove-participant", args: { id: "participant:bud" } }, { author: organizer });
    for (const reader of [ann, organizer]) {
      const may = store.mayUndo(done.batch, reader);
      expect(may.ok).toBe(false);
      expect(JSON.stringify(may)).not.toContain("acct-bud");
    }
  });

  it("says what stands in the way of a bound member's own undo in words they may read", () => {
    const store = family();
    const budOwner: Principal = { ...bud, roles: ["owner"] };
    const annOwner: Principal = { ...ann, roles: ["owner"] };
    bindPerson(store, budOwner, "participant:bud", { author: host });
    bindPerson(store, annOwner, "participant:ann", { author: host });
    const hers = store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: annOwner });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A blue kite" } }, { author: budOwner });
    const may = store.mayUndo(hers.batch, annOwner);
    expect(may.ok).toBe(false);
    expect(JSON.stringify(may)).not.toMatch(/acct-/);
  });

  it("keeps a seat the record it acted as, though that record is gone", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    store.apply({ name: "remove-participant", args: { id: "participant:bud" } }, { author: organizer });
    expect(() => bindPerson(store, bud, "participant:ann", { author: host })).toThrow(ActRefusal);
  });

  it("refuses putting a binding back in plain words where whose record it is changed since", () => {
    const store = family();
    const done = bindPerson(store, bud, "participant:bud", { author: host });
    const undone = store.undo(done.batch, { author: host });
    bindPerson(store, ann, "participant:bud", { author: host });
    const may = store.mayUndo(undone.batch, host);
    expect(may.ok).toBe(false);
    const said = may.ok ? "" : (may.refusal?.message ?? (may.check && !may.check.ok ? may.check.message : ""));
    saysNoIds(store, said);
  });
});
