import { describe, expect, it } from "vitest";
import { bindPerson } from "../../src/binding.js";
import { compileDocument } from "../../src/check.js";
import { ActRefusal, BIND_PERSON, bindSchema, createSchema, defineNode, nameOfAuthor, nodeRef, PermissionDeniedError, Store, unseated, unseatedOp, unseatedSnapshot, z, type AnySchema, type Policy, type Principal } from "../../src/index.js";

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
    { roles: ["owner"], mutations: [BIND_PERSON] },
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
    const done = bindPerson(store, bud, "participant:bud", { author: organizer });
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
    bindPerson(store, bud, "participant:bud", { author: organizer });
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
    bindPerson(store, budAtHome, "participant:bud", { author: host });
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
    const done = bindPerson(store, bud, "participant:bud", { author: organizer });
    store.undo(done.batch, { author: organizer });
    expect(store.personOf(bud)).toBe("acct-bud");
    expect(store.sees(bud, "household:smith")).toBe(false);
    expect(store.permits({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, bud).ok).toBe(false);
    // And once unbound, it may be bound to somebody else.
    bindPerson(store, ann, "participant:bud", { author: organizer });
    expect(store.personOf(ann)).toBe("participant:bud");
  });

  it("is said in Activity as the person, not the account", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: organizer });
    const done = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    expect(nameOfAuthor(done.ops[0]!.author, { graph: store.graph as never, schema: store.schema })).toBe("Bud");
  });
});

describe("a binding is refused, in a sentence a host can show", () => {
  it("to a record already bound to another account", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: organizer });
    expect(() => bindPerson(store, ann, "participant:bud", { author: organizer })).toThrow(ActRefusal);
    expect(() => bindPerson(store, ann, "participant:bud", { author: organizer })).toThrow(/Bud is already someone else's record here/);
    expect(store.personOf(ann)).toBe("acct-ann");
  });

  it("to a record of a kind that is not the people", () => {
    const store = family();
    expect(() => bindPerson(store, bud, "household:smith", { author: organizer })).toThrow(/The Smiths is a household, not a participant/);
    expect(() => bindPerson(store, bud, "participant:nobody", { author: organizer })).toThrow();
  });

  it("for an account already bound to a different record", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: organizer });
    expect(() => bindPerson(store, bud, "participant:ann", { author: organizer })).toThrow(/That account is already Bud here/);
    // Binding it to the record it is bound to again changes nothing.
    expect(bindPerson(store, bud, "participant:bud", { author: organizer }).ops).toEqual([]);
  });

  it("for an account that already has its own record here", () => {
    const store = family();
    store.applyPrimitives([{ op: "add-node", node: { id: "acct-bud", kind: "participant", name: "Bud B.", age: 12 } as never }], { author: host });
    expect(() => bindPerson(store, bud, "participant:bud", { author: organizer })).toThrow(/already has its own record here, Bud B\./);
  });

  it("to a record that is another account's own", () => {
    const store = family();
    store.applyPrimitives([{ op: "add-node", node: { id: "acct-ann", kind: "participant", name: "Ann A.", age: 40 } as never }], { author: host });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: ann });
    expect(() => bindPerson(store, bud, "acct-ann", { author: organizer })).toThrow(/Ann A\. is already someone else's record here/);
  });

  it("to a seat that is nobody in particular", () => {
    const store = family();
    expect(() => bindPerson(store, { kind: "human", id: "anonymous", shared: true }, "participant:bud", { author: organizer })).toThrow(/signed in/);
    expect(() => bindPerson(store, { kind: "visitor", id: "form:1" }, "participant:bud", { author: organizer })).toThrow(/signed in/);
  });
});

describe("who may bind", () => {
  it("is the policy's: an owner, or the host's system seat", () => {
    expect(bindPerson(family(), bud, "participant:bud", { author: organizer }).ops).toHaveLength(1);
    expect(bindPerson(family(), bud, "participant:bud", { author: host }).ops).toHaveLength(1);
    expect(() => bindPerson(family(), bud, "participant:bud", { author: ann })).toThrow(PermissionDeniedError);
  });

  it("is never a member binding themselves, even one the policy grants every act", () => {
    const store = family();
    expect(() => bindPerson(store, bud, "participant:ann", { author: bud })).toThrow(PermissionDeniedError);
    const everything = { ...bud, roles: ["owner"] };
    expect(() => bindPerson(store, everything, "participant:ann", { author: everything })).toThrow(/cannot bind yourself/i);
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
    const done = bindPerson(store, budAtHome, "participant:bud", { author: host });
    expect(store.kindsKeptFrom(budAtHome).has("secret")).toBe(false);
    store.undo(done.batch, { author: host });
    expect(store.kindsKeptFrom(budAtHome).has("secret")).toBe(true);
  });

  it("its view, held across the binding and its undo, never shows what it no longer may", () => {
    const store = family();
    const before = store.seenBy(bud);
    expect(before.graph.getNode("household:smith")).toBeUndefined();
    const done = bindPerson(store, bud, "participant:bud", { author: organizer });
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
    const done = bindPerson(store, bud, "participant:bud", { author: organizer });
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

/* ── binding is held to the people who run the app ─────────────────────── */

const people = (grants: Policy["grants"] | undefined, sees?: Policy["sees"]) =>
  new Store<AnySchema>({
    schema,
    mutations: [giveIt, keepSecret] as never,
    ...(grants ? { policy: { grants, ...(sees ? { sees } : {}) } } : {}),
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
const sock: Principal = { kind: "human", id: "acct-sock", roles: ["member"] };

describe("only a grant that names binding, for a role, binds", () => {
  it("is never every act: a member every role may do anything binds no sock account and no made-up seat", () => {
    const store = people([{ roles: "*", mutations: "*" }], [{ roles: "*", kinds: ["participant", "household", "gift", "secret"] }]);
    expect(() => bindPerson(store, sock, "participant:bud", { author: ann })).toThrow(PermissionDeniedError);
    expect(() => store.apply({ name: BIND_PERSON, args: { record: "participant:bud", seat: "made-up-seat" } }, { author: ann })).toThrow(PermissionDeniedError);
    expect(store.personOf(sock)).toBe("acct-sock");
    expect(() => bindPerson(store, sock, "participant:bud", { author: organizer })).toThrow(PermissionDeniedError);
  });

  it("is never a grant to every role, even one that names it", () => {
    const store = people([{ roles: "*", mutations: [BIND_PERSON] }]);
    expect(() => bindPerson(store, sock, "participant:bud", { author: ann })).toThrow(PermissionDeniedError);
  });

  it("is a grant that names it for a role the seat holds", () => {
    const store = people([{ roles: ["owner"], mutations: [BIND_PERSON] }]);
    expect(() => bindPerson(store, bud, "participant:bud", { author: ann })).toThrow(PermissionDeniedError);
    expect(bindPerson(store, bud, "participant:bud", { author: organizer }).ops).toHaveLength(1);
  });

  it("is the host alone where the app has no policy", () => {
    expect(() => bindPerson(people(undefined), bud, "participant:bud", { author: organizer })).toThrow(/only the host/);
    expect(bindPerson(people(undefined), bud, "participant:bud", { author: host }).ops).toHaveLength(1);
  });
});

describe("a binding is never made by somebody nobody in particular", () => {
  const visitor: Principal = { kind: "visitor", id: "form:abc", roles: ["owner"] };
  const shared: Principal = { kind: "human", id: "anonymous", shared: true, roles: ["owner"] };
  for (const [said, store] of [["with a policy", () => family()], ["with none", () => people(undefined)]] as const) {
    it(`refuses a visitor and a shared seat as its author, ${said}`, () => {
      for (const author of [visitor, shared, { kind: "agent", id: "helper", onBehalfOf: visitor } as Principal]) {
        expect(() => bindPerson(store(), bud, "participant:bud", { author })).toThrow(/Sign in/);
      }
    });
  }
});

describe("the seat a person is bound to is served to that person, whoever binds people and the host alone", () => {
  const leaks = (value: unknown) => JSON.stringify(value ?? null).includes("acct-bud") || JSON.stringify(value ?? null).includes("$seat");
  it("is not in another member's records, log or answers, nor a visitor's, nor where nothing else is kept", () => {
    for (const store of [family(), people([{ roles: ["owner"], mutations: [BIND_PERSON] }, { roles: "*", mutations: ["give-it"] }])]) {
      const done = bindPerson(store, bud, "participant:bud", { author: organizer });
      for (const seat of [ann, { kind: "visitor", id: "form:1", roles: ["member"] } as Principal, { kind: "agent", id: "helper", roles: ["owner"], onBehalfOf: organizer } as Principal]) {
        const view = store.seenBy(seat);
        expect(leaks(view.graph.snapshot())).toBe(false);
        expect(leaks(view.graph.getNode("participant:bud"))).toBe(false);
        expect(leaks(view.log.all())).toBe(false);
        expect(leaks(view.checkpoint())).toBe(false);
      }
      expect(leaks(done.ops)).toBe(true);
      expect(store.seenBy(host).graph.getNode("participant:bud")).toMatchObject({ $seat: "acct-bud" });
      // Whoever binds people sees who is bound.
      expect(store.seenBy(organizer).graph.getNode("participant:bud")).toMatchObject({ $seat: "acct-bud" });
    }
  });

  it("is not shown by a sight that hides every field", () => {
    const store = people([{ roles: ["owner"], mutations: [BIND_PERSON] }], [{ roles: ["member"], kinds: ["participant"], fields: [] }, { roles: ["owner"], kinds: ["participant", "household", "gift", "secret"] }]);
    bindPerson(store, bud, "participant:bud", { author: organizer });
    expect(leaks(store.seenBy(ann).graph.snapshot())).toBe(false);
    expect(leaks(store.seenBy(ann).log.all())).toBe(false);
  });

  it("is not in what leaves the installation", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: organizer });
    expect(leaks(unseatedSnapshot(store.snapshot()))).toBe(false);
    expect(leaks(store.log.all().map((op) => unseatedOp(op)))).toBe(false);
    expect(unseated(store.graph.getNode("participant:bud"))).toEqual({ id: "participant:bud", kind: "participant", name: "Bud", age: 12 });
  });
});

describe("one person's history is never handed to another account", () => {
  it("keeps a binding once its seat has acted as the record, and binds nobody else there", () => {
    const store = family();
    const done = bindPerson(store, bud, "participant:bud", { author: organizer });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    expect(store.mayUndo(done.batch, organizer)).toMatchObject({ ok: false, refusal: { message: "Bud has acted here: unbinding would hand what they did to someone else." } });
    expect(() => store.undo(done.batch, { author: host })).toThrow(/Bud has acted here/);
    expect(() => bindPerson(store, ann, "participant:bud", { author: organizer })).toThrow(/already someone else's record/);
    // A host's own repair that unbinds him does not make his record anybody else's either.
    store.applyPrimitives([{ op: "patch-node", id: "participant:bud", before: { $seat: "acct-bud" }, after: { $seat: undefined } } as never], { author: host });
    expect(store.personOf(bud)).toBe("acct-bud");
    expect(() => bindPerson(store, ann, "participant:bud", { author: organizer })).toThrow(/Bud is already someone else's record here/);
    expect(bindPerson(store, bud, "participant:bud", { author: organizer }).ops).toHaveLength(1);
  });
});

describe("two records never share one seat", () => {
  it("brings a record back unbound when its seat is bound to another by then", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: organizer });
    const removed = store.apply({ name: "remove-participant", args: { id: "participant:bud" } }, { author: organizer });
    bindPerson(store, bud, "participant:ann", { author: organizer });
    store.undo(removed.batch, { author: organizer });
    expect(store.graph.getNode("participant:bud")).not.toHaveProperty("$seat");
    expect(store.personOf(bud)).toBe("participant:ann");
    expect(store.findings().filter((one) => one.code === "person-seat-shared")).toEqual([]);
  });

  it("is nobody's record where a graph loaded holds two, and says so", () => {
    const store = new Store<AnySchema>({ schema, mutations: [giveIt] as never, policy, snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud", age: 12, $seat: "acct-bud" }, { id: "participant:ann", kind: "participant", name: "Ann", age: 40, $seat: "acct-bud" }], edges: [] } } as never);
    expect(store.personOf(bud)).toBe("acct-bud");
    const shared = store.findings().filter((one) => one.code === "person-seat-shared");
    expect(shared.map((one) => one.id)).toEqual(["participant:ann", "participant:bud"]);
    expect(JSON.stringify(shared.map((one) => one.message))).not.toContain("acct-bud");
  });
});

describe("no act but binding writes the seat", () => {
  it("refuses a code act that writes the mark", () => {
    const squat = defineMutation("squat", { title: "Squat", input: z.object({ id: z.string() }), apply: (ctx: any, args: any) => ctx.patchNode(args.id, { $seat: "acct-sock" }) } as never);
    const store = new Store<AnySchema>({ schema, mutations: [squat] as never, snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud", age: 12 }], edges: [] } } as never);
    expect(() => store.apply({ name: "squat", args: { id: "participant:bud" } }, { author: host })).toThrow(/cannot say whose record a person is/);
    expect(store.personOf(sock)).toBe("acct-sock");
  });

  it("refuses a declaration whose act sets a mark", () => {
    const doc = { format: "graview-document", formatVersion: 1, name: "T", kinds: { member: { noun: "member", plural: "members", people: true, fields: { name: { type: "string", required: true } } } }, acts: { claim: { title: "Claim", on: "member", effects: [{ set: { $seat: "$me" } }] } } };
    const made = compileDocument(doc as never);
    expect(made.ok).toBe(false);
    expect(made.findings.filter((one) => one.severity === "error").map((one) => one.message).join(" ")).toMatch(/"\$seat" is the framework.s own mark|this effect is not one Graview knows/);
  });
});

describe("a bound person's own page knows who they are", () => {
  it("serves Bud the seat on his own record alone, so his page's store resolves $me and acts as him", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: organizer });
    store.applyPrimitives([{ op: "add-node", node: { id: "participant:sue", kind: "participant", name: "Sue", age: 9, $seat: "acct-sue" } as never }], { author: host });
    const served = store.seenBy(bud);
    const snapshot = served.graph.snapshot();
    expect(snapshot.nodes.filter((node) => "$seat" in node)).toEqual([expect.objectContaining({ id: "participant:bud", $seat: "acct-bud" })]);
    expect(JSON.stringify(served.log.all())).not.toContain("acct-sue");
    expect(served.graph.personBoundTo?.("acct-bud")).toBe("participant:bud");
    expect(served.graph.personBoundTo?.("acct-sue")).toBeUndefined();
    // His page's own store, made from what he is served.
    const page = new Store<AnySchema>({ schema, mutations: [giveIt, keepSecret] as never, policy, snapshot } as never);
    expect(page.personOf(bud)).toBe("participant:bud");
    page.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    expect(page.graph.out("gift:kite", "givenBy" as never).map((one) => one.id)).toEqual(["participant:bud"]);
    expect(page.sees(bud, "household:smith")).toBe(true);
  });

  it("serves Ann no seat anywhere, and her view says no seat is anybody's", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: organizer });
    const served = store.seenBy(ann);
    expect(JSON.stringify(served.graph.snapshot())).not.toContain("$seat");
    expect(JSON.stringify(served.log.all())).not.toContain("acct-bud");
    expect(served.graph.personBoundTo?.("acct-bud")).toBeUndefined();
  });
});

describe("an agent never binds", () => {
  it("refuses one acting for a person granted binding, and one holding the role itself", () => {
    const helper: Principal = { kind: "agent", id: "helper", roles: ["owner"], onBehalfOf: organizer };
    const bare: Principal = { kind: "agent", id: "helper", roles: ["owner"] };
    expect(() => bindPerson(family(), bud, "participant:bud", { author: helper })).toThrow(/An agent cannot bind/);
    expect(() => bindPerson(family(), bud, "participant:bud", { author: bare })).toThrow(/An agent cannot bind/);
  });
});

describe("two people bound to one account", () => {
  const shared = () => new Store<AnySchema>({ schema, mutations: [giveIt] as never, policy, snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud", age: 12, $seat: "acct-bud" }, { id: "participant:ann", kind: "participant", name: "Ann", age: 40, $seat: "acct-bud" }], edges: [] } } as never);

  it("is said to whoever binds people and the host, and to no other seat", () => {
    const store = shared();
    expect(store.seenBy(organizer).findings().filter((one) => one.code === "person-seat-shared")).toHaveLength(2);
    expect(store.findings().filter((one) => one.code === "person-seat-shared")).toHaveLength(2);
    expect(store.seenBy(ann).findings().filter((one) => one.code === "person-seat-shared")).toEqual([]);
    expect(JSON.stringify(store.seenBy(ann).findings())).not.toContain("acct-bud");
  });

  it("stays nobody's when either record is edited: an edit never changes whose record it is", () => {
    const store = shared();
    store.apply({ name: "edit-participant", args: { id: "participant:bud", age: 13 } }, { author: organizer });
    store.apply({ name: "edit-participant", args: { id: "participant:ann", age: 41 } }, { author: organizer });
    expect(store.graph.getNode("participant:bud")).toMatchObject({ $seat: "acct-bud" });
    expect(store.graph.getNode("participant:ann")).toMatchObject({ $seat: "acct-bud" });
    expect(store.personOf(bud)).toBe("acct-bud");
  });
});

describe("an app with no sight is served as it is again once nobody is bound", () => {
  it("reads the store as it is while nobody is bound, and never through a view for whoever binds people", () => {
    const store = people([{ roles: ["owner"], mutations: [BIND_PERSON] }, { roles: "*", mutations: ["give-it"] }]);
    const view = store.seenBy(ann);
    expect(view.graph.getNode("participant:bud")).toBe(store.graph.getNode("participant:bud"));
    const done = bindPerson(store, bud, "participant:bud", { author: organizer });
    expect(view.graph.getNode("participant:bud")).not.toHaveProperty("$seat");
    expect(store.seenBy(organizer).graph.getNode("participant:bud")).toBe(store.graph.getNode("participant:bud"));
    store.undo(done.batch, { author: organizer });
    expect(view.graph.getNode("participant:bud")).toBe(store.graph.getNode("participant:bud"));
  });

  it("never serves a binding made after a seat's view was taken to that view", () => {
    const store = people([{ roles: ["owner"], mutations: [BIND_PERSON] }, { roles: "*", mutations: ["give-it"] }]);
    const view = store.seenBy(ann);
    const graph = view.graph;
    const log = view.log;
    bindPerson(store, bud, "participant:bud", { author: organizer });
    for (const read of [view.graph.snapshot(), graph.snapshot(), graph.getNode("participant:bud"), log.all(), view.log.all(), view.checkpoint()]) {
      expect(JSON.stringify(read ?? null)).not.toContain("$seat");
      expect(JSON.stringify(read ?? null)).not.toContain("acct-bud");
    }
  });
});

describe("Activity names a bound person by their record", () => {
  it("says Bud, not his account, to a member who sees Bud", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: organizer });
    store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: bud });
    const view = store.seenBy(ann);
    const op = view.log.all().at(-1)!;
    expect(nameOfAuthor(op.author, { graph: view.graph as never, schema: store.schema })).toBe("Bud");
  });

  it("says nothing of the record to a seat that may not see Bud", () => {
    const store = people([{ roles: ["owner"], mutations: [BIND_PERSON] }, { roles: "*", mutations: ["give-it"] }], [{ roles: ["owner", "member"], kinds: ["gift", "household", "secret"] }, { roles: ["owner"], kinds: ["participant"] }]);
    bindPerson(store, bud, "participant:bud", { author: organizer });
    store.applyPrimitives([{ op: "add-edge", edge: { kind: "givenBy", from: "gift:kite", to: "participant:bud" } } as never], { author: bud });
    const ops = store.seenBy(ann).log.all();
    expect(JSON.stringify(ops)).not.toContain('"name":"Bud"');
  });
});

describe("an act's author is named as the viewer is shown them", () => {
  it("says no name a sight keeps from the viewer, in the log or in what a change answers", async () => {
    await import("../../src/field-sight.js");
    const { answerSeenBy } = await import("../../src/seat.js");
    const member = defineNode("member", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string().optional(), age: z.number() }) } as never);
    const prize = defineNode("prize", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { wonBy: { to: ["member"] } } } as never);
    const own = createSchema([member, prize]);
    const win = bindSchema(own).defineMutation("win", { title: "I won it", doneAsMe: true, subject: { kinds: ["prize"], arg: "id" }, input: z.object({ id: nodeRef(["prize"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "wonBy", from: args.id, to: ctx.me }) } as never);
    const store = new Store<AnySchema>({
      schema: own,
      mutations: [win] as never,
      policy: {
        grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["owner"], mutations: [BIND_PERSON] }, { roles: ["member"], mutations: ["win"] }],
        sees: [{ roles: ["owner"], kinds: ["member", "prize"] }, { roles: ["member"], kinds: ["member"], hide: ["name"] }, { roles: ["member"], kinds: ["prize"] }],
      },
      snapshot: { nodes: [{ id: "member:bud", kind: "member", name: "Budrick Secret", age: 12 }, { id: "prize:kite", kind: "prize", title: "A kite" }], edges: [] },
    } as never);
    bindPerson(store, bud, "member:bud", { author: organizer });
    const done = store.apply({ name: "win", args: { id: "prize:kite" } }, { author: bud });
    const view = store.seenBy(ann);
    expect(view.graph.getNode("member:bud")).toMatchObject({ id: "member:bud", age: 12 });
    expect(view.graph.getNode("member:bud")).not.toHaveProperty("name");
    expect(JSON.stringify(view.log.all())).not.toContain("Budrick");
    expect(JSON.stringify(answerSeenBy(store as never, ann, { ops: done.ops }))).not.toContain("Budrick");
    // Whoever is shown the name is told it.
    expect(store.seenBy(organizer).log.all().at(-1)!.author.id).toBe("acct-bud");
  });
});
