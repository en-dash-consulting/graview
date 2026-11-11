import { describe, expect, it } from "vitest";
import { ActRefusal, BIND_PERSON, bindSchema, createSchema, defineNode, nameOfAuthor, nodeRef, PermissionDeniedError, Store, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * A PERSON ENTERED BEFORE THEY JOINED IS THE ONE WHO JOINS: an organizer
 * enters Bud as a participant — his household, the gift he is down to give —
 * and when Bud's account joins, the host binds it to that record rather than
 * making a second Bud. From then on `$me`, his own sight, `self` grants and
 * acts done as him are that record; the binding is an op, blamed on whoever
 * bound it and undone like any other; and every answer kept for his seat is
 * worked out again.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string(), age: z.number() }), edges: { memberOf: { to: ["household"] } } } as never);
const household = defineNode("household", { label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { givenBy: { to: ["participant"] } } } as never);
const secret = defineNode("secret", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { keptBy: { to: ["participant"] } } } as never);
const schema = createSchema([participant, household, gift, secret]);
const { defineMutation } = bindSchema(schema);
const giveIt = defineMutation("give-it", { title: "I'll give it", doneAsMe: true, subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: ctx.me }) } as never);
const keepSecret = defineMutation("keep-secret", { title: "Keep a secret", doneAsMe: true, creates: ["secret"], input: z.object({ title: z.string() }), apply: (ctx: any, args: any) => {
  const id = ctx.freshId(args.title, "secret");
  ctx.addNode({ id, kind: "secret", title: args.title });
  ctx.addEdge({ kind: "keptBy", from: id, to: ctx.me });
} } as never);

const policy: Policy = {
  grants: [
    { roles: ["owner"], mutations: "*" },
    { roles: ["member"], mutations: ["give-it", "keep-secret"] },
    { roles: ["member"], mutations: ["edit-participant"], self: true },
  ],
  sees: [
    { roles: ["owner"], kinds: ["participant", "household", "gift", "secret"] },
    { roles: ["member"], kinds: ["participant", "gift"] },
    { roles: ["member"], kinds: ["household"], own: true },
  ],
};

const organizer: Principal = { kind: "human", id: "acct-org", roles: ["owner"] };
const host: Principal = { kind: "system", id: "host" };
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const ann: Principal = { kind: "human", id: "acct-ann", roles: ["member"] };
const budAtHome: Principal = { kind: "human", id: "acct-family", roles: ["member"], profile: { id: "prf_bud", name: "Bud" } };

function family(): Store<AnySchema> {
  return new Store<AnySchema>({
    schema,
    mutations: [giveIt, keepSecret] as never,
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

const participants = (store: Store<AnySchema>) => store.graph.nodesOfKind("participant" as never).length;

describe("binding a joining account to the person entered for it", () => {
  it("is one named op, blamed on whoever bound it, and makes no second person", () => {
    const store = family();
    const done = store.bindPerson(bud, "participant:bud", { author: organizer });
    expect(done.ops).toHaveLength(1);
    expect(done.ops[0]).toMatchObject({ mutation: { name: BIND_PERSON }, author: { id: "acct-org" } });
    expect(done.ops[0]!.intent).toMatch(/Bud/);
    expect(participants(store)).toBe(2);
    expect(store.personOf(bud)).toBe("participant:bud");
    // Acting as him afterwards makes nobody new either.
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    expect(participants(store)).toBe(2);
    expect(store.graph.has("acct-bud")).toBe(false);
  });

  it("makes $me, his own sight, a self grant and an act done as him that record", () => {
    const store = family();
    expect(store.sees(bud, "household:smith")).toBe(false);
    expect(store.permits({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, bud).ok).toBe(false);
    store.bindPerson(bud, "participant:bud", { author: organizer });
    expect(store.sees(bud, "household:smith")).toBe(true);
    expect(store.permits({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, bud).ok).toBe(true);
    expect(store.permits({ name: "edit-participant", args: { id: "participant:ann", age: 41 } }, bud).ok).toBe(false);
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    expect(store.graph.out("gift:kite", "givenBy" as never).map((one) => one.id)).toEqual(["participant:bud"]);
    // What he does is still his account's: the record he makes is his own, as ever.
    expect(store.log.all().at(-1)!.author.id).toBe("acct-bud");
  });

  it("binds a profile's person, so no record is made for it on first use", () => {
    const store = family();
    store.bindPerson(budAtHome, "participant:bud", { author: host });
    expect(store.personOf(budAtHome)).toBe("participant:bud");
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: budAtHome });
    expect(participants(store)).toBe(2);
    expect(store.graph.out("gift:kite", "givenBy" as never).map((one) => one.id)).toEqual(["participant:bud"]);
    // The account's other profiles are not him.
    expect(store.personOf({ ...budAtHome, profile: { id: "prf_sue", name: "Sue" } })).not.toBe("participant:bud");
    expect(store.personOf({ ...budAtHome, profile: undefined } as never)).not.toBe("participant:bud");
  });

  it("is undone like any act, and he is nobody's record again", () => {
    const store = family();
    const done = store.bindPerson(bud, "participant:bud", { author: organizer });
    store.undo(done.batch, { author: organizer });
    expect(store.personOf(bud)).toBe("acct-bud");
    expect(store.sees(bud, "household:smith")).toBe(false);
    expect(store.permits({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, bud).ok).toBe(false);
    // And once unbound, it may be bound to somebody else.
    store.bindPerson(ann, "participant:bud", { author: organizer });
    expect(store.personOf(ann)).toBe("participant:bud");
  });

  it("is said in Activity as the person, not the account", () => {
    const store = family();
    store.bindPerson(bud, "participant:bud", { author: organizer });
    const done = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    expect(nameOfAuthor(done.ops[0]!.author, { graph: store.graph as never, schema: store.schema })).toBe("Bud");
  });
});

describe("a binding is refused, in a sentence a host can show", () => {
  it("to a record already bound to another account", () => {
    const store = family();
    store.bindPerson(bud, "participant:bud", { author: organizer });
    expect(() => store.bindPerson(ann, "participant:bud", { author: organizer })).toThrow(ActRefusal);
    expect(() => store.bindPerson(ann, "participant:bud", { author: organizer })).toThrow(/Bud is already someone else's record here/);
    expect(store.personOf(ann)).toBe("acct-ann");
  });

  it("to a record of a kind that is not the people", () => {
    const store = family();
    expect(() => store.bindPerson(bud, "household:smith", { author: organizer })).toThrow(/The Smiths is a household, not a participant/);
    expect(() => store.bindPerson(bud, "participant:nobody", { author: organizer })).toThrow();
  });

  it("for an account already bound to a different record", () => {
    const store = family();
    store.bindPerson(bud, "participant:bud", { author: organizer });
    expect(() => store.bindPerson(bud, "participant:ann", { author: organizer })).toThrow(/That account is already Bud here/);
    // Binding it to the record it is bound to again changes nothing.
    expect(store.bindPerson(bud, "participant:bud", { author: organizer }).ops).toEqual([]);
  });

  it("for an account that already has its own record here", () => {
    const store = family();
    store.applyPrimitives([{ op: "add-node", node: { id: "acct-bud", kind: "participant", name: "Bud B.", age: 12 } as never }], { author: host });
    expect(() => store.bindPerson(bud, "participant:bud", { author: organizer })).toThrow(/already has its own record here, Bud B\./);
  });

  it("to a record that is another account's own", () => {
    const store = family();
    store.applyPrimitives([{ op: "add-node", node: { id: "acct-ann", kind: "participant", name: "Ann A.", age: 40 } as never }], { author: host });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: ann });
    expect(() => store.bindPerson(bud, "acct-ann", { author: organizer })).toThrow(/Ann A\. is already someone else's record here/);
  });

  it("to a seat that is nobody in particular", () => {
    const store = family();
    expect(() => store.bindPerson({ kind: "human", id: "anonymous", shared: true }, "participant:bud", { author: organizer })).toThrow(/signed in/);
    expect(() => store.bindPerson({ kind: "visitor", id: "form:1" }, "participant:bud", { author: organizer })).toThrow(/signed in/);
  });
});

describe("who may bind", () => {
  it("is the policy's: an owner, or the host's system seat", () => {
    expect(family().bindPerson(bud, "participant:bud", { author: organizer }).ops).toHaveLength(1);
    expect(family().bindPerson(bud, "participant:bud", { author: host }).ops).toHaveLength(1);
    expect(() => family().bindPerson(bud, "participant:bud", { author: ann })).toThrow(PermissionDeniedError);
  });

  it("is never a member binding themselves, even one the policy grants every act", () => {
    const store = family();
    expect(() => store.bindPerson(bud, "participant:ann", { author: bud })).toThrow(PermissionDeniedError);
    const everything = { ...bud, roles: ["owner"] };
    expect(() => store.bindPerson(everything, "participant:ann", { author: everything })).toThrow(/cannot bind yourself/i);
    expect(store.permits({ name: BIND_PERSON, args: { record: "participant:ann", seat: "acct-bud" } }, everything).ok).toBe(false);
    expect(store.personOf(bud)).toBe("acct-bud");
  });

  it("is offered on no list: no face or agent tool makes one", () => {
    const store = family();
    expect(store.allMutations().map((one) => one.name)).not.toContain(BIND_PERSON);
    expect(store.permittedMutations(organizer).map((one) => one.name)).not.toContain(BIND_PERSON);
  });
});

describe("every answer kept for the seat is worked out again after a binding", () => {
  it("the kinds kept from it", () => {
    const store = family();
    // A profile whose person cannot be made (its kind asks for an age) has no record: nothing done as it is offered, so a kind only it makes is kept.
    expect(store.kindsKeptFrom(budAtHome).has("secret")).toBe(true);
    const done = store.bindPerson(budAtHome, "participant:bud", { author: host });
    expect(store.kindsKeptFrom(budAtHome).has("secret")).toBe(false);
    store.undo(done.batch, { author: host });
    expect(store.kindsKeptFrom(budAtHome).has("secret")).toBe(true);
  });

  it("its view, held across the binding and its undo, never shows what it no longer may", () => {
    const store = family();
    const before = store.seenBy(bud);
    expect(before.graph.getNode("household:smith")).toBeUndefined();
    const done = store.bindPerson(bud, "participant:bud", { author: organizer });
    // The view held from before is judged as he is now, and so is one asked for afresh.
    expect(before.graph.getNode("household:smith")).toBeDefined();
    const after = store.seenBy(bud);
    expect(after.graph.getNode("household:smith")).toBeDefined();
    store.undo(done.batch, { author: organizer });
    for (const view of [before, after, store.seenBy(bud)]) {
      expect(view.graph.getNode("household:smith")).toBeUndefined();
      expect(view.graph.out("participant:bud").map((one) => one.id)).not.toContain("household:smith");
    }
  });

  it("its log: a change to what it now sees is served, and withheld again once the binding is undone", () => {
    const store = family();
    const edit = store.apply({ name: "edit-household", args: { id: "household:smith", name: "The Smith family" } }, { author: organizer }).ops[0]!;
    const renamed = (view: Store<AnySchema>) => view.log.all()[edit.seq]!;
    const view = store.seenBy(bud);
    expect(JSON.stringify(renamed(view))).not.toContain("Smith family");
    const done = store.bindPerson(bud, "participant:bud", { author: organizer });
    expect(JSON.stringify(renamed(view))).toContain("Smith family");
    store.undo(done.batch, { author: organizer });
    expect(JSON.stringify(renamed(view))).not.toContain("Smith family");
    expect(JSON.stringify(renamed(store.seenBy(bud)))).not.toContain("Smith family");
  });

  it("a bound seat's id given by a caller is never believed", () => {
    const store = family();
    const forged = { ...ann, person: "participant:bud", [Symbol.for("@graview/core:bound-person")]: "participant:bud" } as unknown as Principal;
    expect(store.personOf(forged)).toBe("acct-ann");
    expect(store.sees(forged, "household:smith")).toBe(false);
    expect(store.permits({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, forged).ok).toBe(false);
  });
});
