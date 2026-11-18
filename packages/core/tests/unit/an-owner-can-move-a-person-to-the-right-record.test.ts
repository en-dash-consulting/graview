import { describe, expect, it } from "vitest";
import { bindPerson, mayBind, rebindPerson } from "../../src/binding.js";
import { checkApp, compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { ActRefusal, bindSchema, createSchema, defineApp, defineNode, nameOfAuthor, nodeRef, PermissionDeniedError, REBIND_PERSON, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * AN OWNER CAN MOVE A PERSON BOUND TO THE WRONG RECORD, AND WHAT THEY DID,
 * TO THE RIGHT ONE (Roadmap f-rebind-after-acting). Bud's account was bound
 * to Ann's record, and he acted as Ann before anybody noticed. Undoing the
 * binding is refused once he has acted, and an ended binding keeps both the
 * account and the record from anybody else, so the mistake stood for good.
 * The host moves him: he is Bud's record from now on, everything he did is
 * said as Bud, Ann's record is nobody's and may be Ann's, and it is one
 * change that undo takes back whole. Nothing earlier in the log is
 * rewritten: the move is an op of its own, read forward.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string(), age: z.number() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { givenBy: { to: ["participant"] } } } as never);
const schema = createSchema([participant, gift]);
const { defineMutation } = bindSchema(schema);
const giveIt = defineMutation("give-it", { title: "I'll give it", doneAsMe: true, subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: ctx.me }) } as never);

const policy: Policy = {
  grants: [
    { roles: ["owner"], mutations: "*" },
    { roles: ["member"], mutations: ["give-it"] },
    { roles: ["member"], mutations: ["edit-participant"], self: true },
  ],
  sees: [{ roles: ["owner", "member"], kinds: ["participant", "gift"] }],
};

const host: Principal = { kind: "system", id: "host" };
const organizer: Principal = { kind: "human", id: "acct-org", roles: ["owner"] };
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
        { id: "participant:cy", kind: "participant", name: "Cy", age: 9 },
        { id: "gift:kite", kind: "gift", title: "A kite" },
        { id: "gift:book", kind: "gift", title: "A book" },
      ],
      edges: [],
    },
  } as never);
}

/** Bud's account bound to Ann's record by mistake, and two things he did as her. */
function misbound(): { readonly store: Store<AnySchema>; readonly acted: readonly string[] } {
  const store = family();
  bindPerson(store, bud, "participant:ann", { author: host });
  const gave = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
  const edited = store.apply({ name: "edit-participant", args: { id: "participant:ann", age: 12 } }, { author: bud });
  return { store, acted: [gave.ops[0]!.id, edited.ops[0]!.id] };
}

/** Whom an op's author is said as, to a reader: its record's id and its name. */
const saidAs = (store: Store<AnySchema>, reader: Principal, id: string) => {
  const view = store.seenBy(reader);
  const op = view.log.all().find((one) => one.id === id)!;
  return { id: op.author.id, name: nameOfAuthor(op.author, { graph: view.graph as never, schema: store.schema }) };
};

describe("moving a person who has acted", () => {
  it("is what the host does where undoing the binding is refused", () => {
    const { store } = misbound();
    const binding = store.log.all()[0]!;
    expect(store.mayUndo(binding.batch, host)).toMatchObject({ ok: false, refusal: { message: /has acted here/ } });
    expect(mayBind(store, "participant:ann").ok).toBe(false);
  });

  it("binds the seat to the right record and says every act it did as the wrong one as the right one", () => {
    const { store, acted } = misbound();
    expect(acted.map((id) => saidAs(store, organizer, id))).toEqual([{ id: "participant:ann", name: "Ann" }, { id: "participant:ann", name: "Ann" }]);
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(store.personOf(bud)).toBe("participant:bud");
    for (const reader of [organizer, ann, host]) for (const id of acted) expect(saidAs(store, reader, id)).toMatchObject({ name: "Bud" });
    for (const id of acted) expect(saidAs(store, organizer, id)).toEqual({ id: "participant:bud", name: "Bud" });
  });

  it("leaves the wrong record nobody's, so it may be bound again, and its new person's acts are theirs", () => {
    const { store, acted } = misbound();
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(store.graph.getNode("participant:ann")).not.toHaveProperty("$seat");
    expect(mayBind(store, "participant:ann")).toEqual({ ok: true });
    const bound = bindPerson(store, ann, "participant:ann", { author: host });
    expect(store.personOf(ann)).toBe("participant:ann");
    // What Bud did is Bud's: Ann's binding is not held by his acts.
    expect(store.mayUndo(bound.batch, host)).toEqual({ ok: true });
    const hers = store.apply({ name: "give-it", args: { id: "gift:book" } }, { author: ann });
    expect(saidAs(store, organizer, hers.ops[0]!.id)).toEqual({ id: "participant:ann", name: "Ann" });
    for (const id of acted) expect(saidAs(store, organizer, id)).toEqual({ id: "participant:bud", name: "Bud" });
  });

  it("is one change, which undo takes back whole: the binding and who did what", () => {
    const { store, acted } = misbound();
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    expect(moved.ops).toHaveLength(1);
    expect(moved.ops[0]).toMatchObject({ mutation: { name: REBIND_PERSON }, author: { kind: "system", id: "host" } });
    expect(store.mayUndo(moved.batch, host)).toEqual({ ok: true });
    store.undo(moved.batch, { author: host });
    expect(store.personOf(bud)).toBe("participant:ann");
    expect(store.graph.getNode("participant:bud")).not.toHaveProperty("$seat");
    for (const id of acted) expect(saidAs(store, organizer, id)).toEqual({ id: "participant:ann", name: "Ann" });
    expect(mayBind(store, "participant:ann").ok).toBe(false);
    expect(mayBind(store, "participant:bud")).toEqual({ ok: true });
  });

  it("keeps the log append-only: the move is one op more, and every op before it is as it was", () => {
    const { store } = misbound();
    const before = JSON.stringify(store.log.all());
    const length = store.log.all().length;
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(store.log.all()).toHaveLength(length + 1);
    expect(JSON.stringify(store.log.all().slice(0, length))).toBe(before);
  });

  it("leaves what the acts wrote as they wrote it", () => {
    const { store } = misbound();
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(store.graph.out("gift:kite", "givenBy" as never).map((one) => one.id)).toEqual(["participant:ann"]);
    expect(store.graph.getNode("participant:ann")).toMatchObject({ age: 12 });
  });

  it("is not taken back once the record it left is somebody else's", () => {
    const { store } = misbound();
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    bindPerson(store, ann, "participant:ann", { author: host });
    const may = store.mayUndo(moved.batch, host);
    expect(may.ok).toBe(false);
    expect(() => store.undo(moved.batch, { author: host })).toThrow(/cannot be taken back/);
    expect(store.personOf(bud)).toBe("participant:bud");
    expect(store.personOf(ann)).toBe("participant:ann");
  });
});

describe("what a move refuses, in words", () => {
  it("a record that is somebody else's: bound, or done as by another account", () => {
    const { store } = misbound();
    bindPerson(store, { kind: "human", id: "acct-cy", roles: ["member"] }, "participant:cy", { author: host });
    expect(() => rebindPerson(store, bud, "participant:cy", { author: host })).toThrow(/Cy is already someone else's record here/);
    expect(store.personOf(bud)).toBe("participant:ann");
  });

  it("a record that is not of the people", () => {
    const { store } = misbound();
    expect(() => rebindPerson(store, bud, "gift:kite", { author: host })).toThrow(ActRefusal);
  });

  it("an account bound to nobody", () => {
    const store = family();
    expect(() => rebindPerson(store, bud, "participant:bud", { author: host })).toThrow(/is nobody's record here/);
  });

  it("the record the account is bound to already", () => {
    const { store } = misbound();
    expect(() => rebindPerson(store, bud, "participant:ann", { author: host })).toThrow(/Ann here already/);
  });
});

describe("moving a person is the host's system seat alone", () => {
  const call = { name: REBIND_PERSON, args: { seat: "acct-bud", from: "participant:ann", to: "participant:bud" } };
  const refusedTo: readonly [string, Principal][] = [
    ["the owner, whom a grant gives every act", organizer],
    ["the person moved", bud],
    ["another member", ann],
    ["an agent", { kind: "agent", id: "agent:helper" }],
    ["an agent acting for the host", { kind: "agent", id: "agent:helper", onBehalfOf: host } as Principal],
    ["the app's own actor", { kind: "system", id: "app:tidy", automated: true } as Principal],
    ["a workflow", { kind: "system", id: "workflow:weekly" }],
  ];
  for (const [who, principal] of refusedTo) {
    it(`refuses ${who}`, () => {
      const { store } = misbound();
      expect(store.permits(call, principal).ok).toBe(false);
      expect(() => rebindPerson(store, bud, "participant:bud", { author: principal })).toThrow(PermissionDeniedError);
      expect(store.personOf(bud)).toBe("participant:ann");
    });
  }

  it("is permitted to the host", () => {
    const { store } = misbound();
    expect(store.permits(call, host).ok).toBe(true);
  });

  it("is offered by no list of acts", () => {
    const { store } = misbound();
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(store.allMutations().map((one) => one.name)).not.toContain(REBIND_PERSON);
  });
});

describe("graview check knows the act", () => {
  it("refuses a grant of it as a binding no grant gives, never as an act nobody declared", () => {
    const found = checkApp(defineApp({ name: "binding", schema, mutations: [giveIt] as never, policy: { ...policy, grants: [...policy.grants, { roles: ["member"], mutations: [REBIND_PERSON] }] } }) as never).findings;
    const said = found.filter((one) => one.code === "grant-gives-binding");
    expect(said).toHaveLength(1);
    expect(said[0]!.message).toMatch(/no grant gives it/i);
    expect(found.map((one) => one.code)).not.toContain("grant-unknown-mutation");
  });

  it("refuses an act of the app's own under its name", () => {
    const own = { name: REBIND_PERSON, title: "Move", input: z.object({}), apply: () => undefined };
    const found = checkApp(defineApp({ name: "binding", schema, mutations: [own] as never }) as never).findings;
    expect(found.filter((one) => one.code === "binding-act-taken" && one.severity === "error")).toHaveLength(1);
  });

  it("refuses it in a document, compiled and as an edit adds it", () => {
    const doc = {
      format: "graview-document",
      formatVersion: 1,
      name: "Binding",
      kinds: { member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true } } } },
      roles: ["owner", "editor"],
      policy: { grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["editor"], mutations: [REBIND_PERSON] }] },
    };
    const made = compileDocument(doc as never);
    expect(made.findings.map((one) => one.code)).toContain("grant-gives-binding");
    expect(made.findings.map((one) => one.code)).not.toContain("grant-act");
    const own = compileDocument({ ...doc, policy: { grants: [{ roles: ["owner"], mutations: "*" }] }, acts: { [REBIND_PERSON]: { title: "Move", on: "member", effects: [{ set: { name: "x" } }] } } } as never);
    expect(own.findings.filter((one) => one.code === "binding-act-taken" && one.severity === "error")).toHaveLength(1);
    const plain = { ...doc, policy: { grants: [{ roles: ["owner"], mutations: "*" }] } };
    const edited = editDocument(plain as never, [{ op: "add-grant", roles: ["editor"], mutations: [REBIND_PERSON] }] as never);
    expect(edited.ok).toBe(false);
    expect(JSON.stringify(edited.ok ? [] : edited.findings)).toMatch(/grant-gives-binding/);
  });
});

describe("a move stands aside for undoing what was done before it", () => {
  const batchOf = (store: Store<AnySchema>, id: string) => store.log.all().find((one) => one.id === id)!.batch;

  /** Bud's account bound to Ann's record, and one thing he did as her: the kite given by "me". */
  const gaveAsAnn = () => {
    const store = family();
    bindPerson(store, bud, "participant:ann", { author: host });
    const gave = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    return { store, gave: gave.batch };
  };

  it("leaves an earlier edit of the record the person left open to whoever could take it back before", () => {
    const { store, acted } = misbound();
    rebindPerson(store, bud, "participant:bud", { author: host });
    // The owner takes back the edit Bud made as Ann; before this, the move stood in the way of everybody.
    expect(store.mayUndo(batchOf(store, acted[1]!), organizer)).toEqual({ ok: true });
    store.undo(batchOf(store, acted[1]!), { author: organizer });
    expect(store.graph.getNode("participant:ann")).toMatchObject({ age: 40 });
    // Ann's record is not Bud's any more, so editing it is not his to take back.
    expect(store.mayUndo(batchOf(store, acted[0]!), host)).toEqual({ ok: true });
  });

  it("offers nobody the move as a change to bring along", () => {
    const { store, gave } = gaveAsAnn();
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    for (const who of [ann, organizer, bud]) {
      const said = JSON.stringify(store.mayUndo(gave, who));
      expect(said).not.toContain(moved.batch);
      expect(said).not.toContain(moved.ops[0]!.id);
    }
  });

  it("keeps what the person did as the record they left theirs: another member may not take it back, and they may", () => {
    const { store, gave } = gaveAsAnn();
    rebindPerson(store, bud, "participant:bud", { author: host });
    bindPerson(store, ann, "participant:ann", { author: host });
    const refused = store.mayUndo(gave, ann);
    expect(refused.ok).toBe(false);
    expect(JSON.stringify(refused)).toMatch(/done as somebody else/);
    expect(() => store.undo(gave, { author: ann })).toThrow(PermissionDeniedError);
    expect(store.mayUndo(gave, bud)).toEqual({ ok: true });
    store.undo(gave, { author: bud });
    expect(store.graph.out("gift:kite", "givenBy" as never)).toEqual([]);
  });
});

describe("a move taken back keeps what was done since with whoever did it", () => {
  it("is refused once the person acted as the record they moved to, as an unbinding is", () => {
    const { store } = misbound();
    const moved = rebindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "give-it", args: { id: "gift:book" } }, { author: bud });
    expect(store.mayUndo(moved.batch, host)).toMatchObject({ ok: false, refusal: { message: "Bud has acted here: undoing the move would hand what they did to someone else." } });
    expect(() => store.undo(moved.batch, { author: host })).toThrow(/Bud has acted here/);
    expect(store.personOf(bud)).toBe("participant:bud");
  });
});

describe("a record set aside is nobody's to be bound or moved to", () => {
  it("refuses both, in words, until it is brought back", () => {
    const { store } = misbound();
    store.apply({ name: "archive-participant", args: { id: "participant:bud" } }, { author: organizer });
    expect(() => rebindPerson(store, bud, "participant:bud", { author: host })).toThrow(/Bud is set aside/);
    expect(() => bindPerson(store, { kind: "human", id: "acct-new", roles: ["member"] }, "participant:bud", { author: host })).toThrow(/Bud is set aside/);
    expect(mayBind(store, "participant:bud").ok).toBe(false);
    store.apply({ name: "unarchive-participant", args: { id: "participant:bud" } }, { author: organizer });
    expect(rebindPerson(store, bud, "participant:bud", { author: host }).ops).toHaveLength(1);
  });
});

describe("a store loaded with its people already bound", () => {
  /** Bud's account bound to Ann's record before the log begins, as a snapshot or a compaction leaves it. */
  const loaded = () => {
    const store = family();
    const fresh = new Store<AnySchema>({
      schema,
      mutations: [giveIt] as never,
      policy,
      snapshot: { nodes: store.graph.allNodes().map((node) => (node.id === "participant:ann" ? { ...node, $seat: "acct-bud" } : node)), edges: [] },
    } as never);
    return fresh;
  };

  it("says what the person did after it as the record bound before it, as a store whose log holds the binding does", () => {
    for (const store of [loaded(), misbound().store]) {
      store.apply({ name: "give-it", args: { id: "gift:book" } }, { author: bud });
      store.apply({ name: "remove-participant", args: { id: "participant:ann" } }, { author: organizer });
      expect(() => bindPerson(store, bud, "participant:bud", { author: host })).toThrow(/That account was another participant here: bind it to them again/);
    }
  });

  it("moves what they did after it with them", () => {
    const store = loaded();
    store.apply({ name: "give-it", args: { id: "gift:book" } }, { author: bud });
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(mayBind(store, "participant:ann")).toEqual({ ok: true });
    const given = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    const moved = store.log.all().find((one) => one.mutation?.name === REBIND_PERSON)!;
    expect(given.ops[0]!.seq).toBeGreaterThan(moved.seq);
    expect(store.mayUndo(moved.batch, host)).toMatchObject({ ok: false, refusal: { message: /Bud has acted here/ } });
  });
});
