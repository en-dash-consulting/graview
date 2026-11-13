import { describe, expect, it } from "vitest";
import { bindPerson } from "../../src/binding.js";
import { answerSeenBy } from "../../src/seat.js";
import { matchSubscriptions } from "../../src/subscriptions.js";
import { acceptSuggestion, suggest, suggestions } from "../../src/tidying.js";
import { BIND_PERSON, PROPOSE_CHANGES, bindSchema, createSchema, defineNode, nodeRef, Store, z, type AnySchema, type Operation, type Policy, type Principal } from "../../src/index.js";

/**
 * A PERSON BOUND TO A RECORD IS THAT RECORD TO EVERYONE ELSE. Bud joined and
 * was bound to the participant the organizer entered for him. What he does
 * is said to the other members as done by that record — its id and its name
 * — and never by his account, on every reading of the log: a seat's view, a
 * change's answer, a checkpoint, an undo. His own seat and the host are told
 * his account, as they always were; somebody bound to nobody is told as they
 * were.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: any) => n.title, fields: z.object({ title: z.string() }), edges: { givenBy: { to: ["participant"] } } } as never);
const secret = defineNode("secret", { label: (n: any) => n.title, fields: z.object({ title: z.string() }) } as never);
const schema = createSchema([participant, gift, secret]);
const { defineMutation } = bindSchema(schema);
const giveIt = defineMutation("give-it", { title: "I'll give it", doneAsMe: true, subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]) }), apply: (ctx: any, args: any) => ctx.addEdge({ kind: "givenBy", from: args.id, to: ctx.me }) } as never);
const addGift = defineMutation("add-gift", { title: "Add a gift", creates: ["gift"], input: z.object({ title: z.string() }), apply: (ctx: any, args: any) => ctx.addNode({ id: ctx.freshId(args.title, "gift"), kind: "gift", title: args.title }) } as never);
const renameGift = defineMutation("rename-gift", { title: "Rename a gift", subject: { kinds: ["gift"], arg: "id" }, input: z.object({ id: nodeRef(["gift"]), title: z.string() }), apply: (ctx: any, args: any) => ctx.patchNode(args.id, { title: args.title }) } as never);
const keepSecret = defineMutation("keep-secret", { title: "Keep a secret", creates: ["secret"], input: z.object({ title: z.string() }), apply: (ctx: any, args: any) => ctx.addNode({ id: ctx.freshId(args.title, "secret"), kind: "secret", title: args.title }) } as never);

const host: Principal = { kind: "system", id: "host" };
const bud: Principal = { kind: "human", id: "acct-bud", name: "budster", roles: ["member"] };
const ann: Principal = { kind: "human", id: "acct-ann", name: "Ann A.", roles: ["member"] };
const blind: Principal = { kind: "human", id: "acct-cy", roles: ["blind"] };
const helper: Principal = { kind: "agent", id: "helper", roles: ["member"], onBehalfOf: bud };
const budAtHome: Principal = { kind: "human", id: "acct-family", roles: ["member"], profile: { id: "prf_bud", name: "Buddy" } };

const policy: Policy = {
  grants: [{ roles: ["member", "blind"], mutations: ["give-it", "add-gift", "keep-secret"] }],
  sees: [
    { roles: ["member"], kinds: ["participant", "gift"] },
    { roles: ["blind"], kinds: ["gift"] },
  ],
};

function family(): Store<AnySchema> {
  return new Store<AnySchema>({
    schema,
    mutations: [giveIt, addGift, keepSecret] as never,
    policy,
    snapshot: {
      nodes: [
        { id: "participant:bud", kind: "participant", name: "Bud" },
        { id: "participant:ann", kind: "participant", name: "Ann" },
        { id: "gift:kite", kind: "gift", title: "A kite" },
      ],
      edges: [],
    },
  } as never);
}

/** A store where Bud is bound and has given the kite, made a gift and kept a secret. */
function acted(who: Principal = bud) {
  const store = family();
  bindPerson(store, who, "participant:bud", { author: host });
  const given = store.apply({ name: "give-it", args: { id: "gift:kite" } }, { author: who });
  const made = store.apply({ name: "add-gift", args: { title: "A ball" } }, { author: who });
  const kept = store.apply({ name: "keep-secret", args: { title: "Hidden" } }, { author: who });
  return { store, given, made, kept };
}

const tells = (value: unknown, account = "acct-bud") => JSON.stringify(value ?? null).includes(account);
const byBud = (ops: readonly Operation[]) => ops.filter((op) => op.mutation?.name !== BIND_PERSON && !op.withheld);

describe("a bound person's acts, read by another member", () => {
  it("are authored by Bud's record, its id and its name, in the log a member is served", () => {
    const { store } = acted();
    const ops = byBud(store.seenBy(ann).log.all());
    expect(ops).toHaveLength(2);
    for (const op of ops) expect(op.author).toMatchObject({ kind: "human", id: "participant:bud", name: "Bud" });
    expect(tells(store.seenBy(ann).log.all())).toBe(false);
  });

  it("never carry his account in what a change answers", () => {
    const { store, given, made, kept } = acted();
    for (const done of [given, made, kept]) {
      const answer = answerSeenBy(store as never, ann, { ops: done.ops });
      expect(tells(answer)).toBe(false);
    }
    expect(answerSeenBy(store as never, ann, { ops: given.ops }).ops?.[0]?.author).toMatchObject({ id: "participant:bud", name: "Bud" });
  });

  it("never carry his account in a checkpoint a member is served", () => {
    const { store } = acted();
    expect(tells(store.seenBy(ann).checkpoint())).toBe(false);
    expect(tells(store.seenBy(ann).log.epochs?.())).toBe(false);
  });

  it("never carry his account in who made each record, once the log is compacted", () => {
    const { store } = acted();
    const at = store.checkpoint({ seq: store.log.length });
    expect(at).toBeDefined();
    expect(tells(at!.creators)).toBe(true);
    store.compact(at!);
    const view = store.seenBy(ann);
    expect(tells(view.checkpoint())).toBe(false);
    expect(tells(view.log.epochs?.())).toBe(false);
    expect(Object.values(view.log.horizonEpoch?.()?.creators ?? {})).toContain("participant:bud");
  });

  it("never carry his account in an undo of his, nor in an op withheld from the member", () => {
    const { store, made } = acted();
    store.undo(made.batch, { author: bud });
    const log = store.seenBy(ann).log.all();
    expect(tells(log)).toBe(false);
    // The secret he kept is withheld from Ann, and its author is still his record, not his account.
    const withheld = log.filter((op) => op.withheld);
    expect(withheld.length).toBeGreaterThan(0);
    for (const op of withheld) expect(op.author.id).not.toBe("acct-bud");
  });

  it("are his record's in what a member who asked to be told is told", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    const done = store.apply({ name: "add-gift", args: { title: "A drum" } }, { author: bud });
    const told = matchSubscriptions(store, done.ops, [{ id: "sub-1", who: ann, app: "family", when: { on: "created", kind: "gift" }, at: "2026-11-13T00:00:00.000Z" } as never]);
    expect(told).toHaveLength(1);
    expect(told[0]!.by).toMatchObject({ id: "participant:bud", name: "Bud" });
    expect(told[0]!.byName).toBe("Bud");
    expect(tells(told)).toBe(false);
  });

  it("are his record's id, with no name it does not show, to a member who may not see his record", () => {
    const { store } = acted();
    const log = store.seenBy(blind).log.all();
    expect(tells(log)).toBe(false);
    expect(JSON.stringify(log)).not.toContain('"name":"Bud"');
    // No id the member may not see is served either (FR-55): his acts are nobody's id to them, under the name he gave.
    for (const op of byBud(log)) expect(op.author).toEqual({ kind: "human", id: "someone", name: "Someone" });
    expect(JSON.stringify(log)).not.toContain("budster");
    expect(JSON.stringify(log)).not.toContain("participant:bud");
  });

  it("stay his record's once the record is removed, so nothing said as the record is said again as the account", () => {
    const { store } = acted();
    const before = byBud(store.seenBy(ann).log.all()).map((op) => op.id);
    store.applyPrimitives([{ op: "remove-node", node: store.graph.getNode("participant:bud") as never }], { author: host });
    const log = store.seenBy(ann).log.all();
    expect(tells(log)).toBe(false);
    for (const id of before) expect(log.find((op) => op.id === id)!.author.id).not.toBe("acct-bud");
  });

  it("name his record, never his account, as who proposed a change", () => {
    const store = new Store<AnySchema>({ schema, mutations: [giveIt, addGift, keepSecret, renameGift] as never, policy: { ...policy, grants: [...policy.grants, { roles: ["member"], mutations: [], propose: ["rename-gift"] } as never] }, snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }, { id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);
    bindPerson(store, bud, "participant:bud", { author: host });
    store.applyAll([{ name: PROPOSE_CHANGES, args: { calls: [{ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }] } }], { author: bud });
    const op = store.seenBy(ann).log.all().at(-1)!;
    expect(op.lineage?.proposedBy).toBe("participant:bud");
    expect(tells(op)).toBe(false);
    expect(JSON.stringify(op)).not.toContain("budster");
    expect(tells(suggestions(store, ann))).toBe(false);
  });

  it("name his record, never his account, among who voted a suggestion in", () => {
    const store = new Store<AnySchema>({ schema, mutations: [giveIt, addGift, keepSecret, renameGift] as never, policy, tidying: { autoAcceptAt: 1 }, snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }, { id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);
    bindPerson(store, bud, "participant:bud", { author: host });
    const op = suggest(store, [{ name: "rename-gift", args: { id: "gift:kite", title: "A red kite" } }], { author: { kind: "system", id: "tidying", name: "Graview, tidying", automated: true } as never, lineage: { basis: "Tidier" } })!;
    acceptSuggestion(store, op.id, { author: bud });
    const log = store.seenBy(ann).log.all();
    expect(tells(log)).toBe(false);
    expect(log.some((one) => one.lineage?.voters?.includes("participant:bud"))).toBe(true);
  });

  it("are his record's, through an agent acting for him", () => {
    const store = family();
    bindPerson(store, bud, "participant:bud", { author: host });
    store.apply({ name: "add-gift", args: { title: "A drum" } }, { author: helper });
    const op = store.seenBy(ann).log.all().at(-1)!;
    expect(op.author.onBehalfOf).toMatchObject({ id: "participant:bud", name: "Bud" });
    expect(tells(op)).toBe(false);
  });

  it("are his record's, where the record is a profile's person", () => {
    const { store } = acted(budAtHome);
    const log = store.seenBy(ann).log.all();
    expect(tells(log, "acct-family")).toBe(false);
    for (const op of byBud(log)) expect(op.author).toMatchObject({ id: "participant:bud", name: "Bud" });
  });

  it("are his record's once bound, though he acted before the binding", () => {
    const store = family();
    store.apply({ name: "add-gift", args: { title: "A top" } }, { author: bud });
    bindPerson(store, bud, "participant:bud", { author: host });
    expect(tells(store.seenBy(ann).log.all())).toBe(false);
    expect(store.seenBy(ann).log.all()[0]!.author.id).toBe("participant:bud");
  });

  it("go back to his account once the binding is undone, as he is then nobody's record", () => {
    const store = family();
    const bound = bindPerson(store, bud, "participant:bud", { author: host });
    const view = store.seenBy(ann);
    store.apply({ name: "add-gift", args: { title: "A top" } }, { author: bud });
    expect(view.log.all().at(-1)!.author.id).toBe("participant:bud");
    // Undone before he acts as the record: an op of his own account is his account's, as it is for anyone bound to nobody.
    const fresh = family();
    const once = bindPerson(fresh, bud, "participant:bud", { author: host });
    fresh.undo(once.batch, { author: host });
    fresh.apply({ name: "add-gift", args: { title: "A top" } }, { author: bud });
    expect(fresh.seenBy(ann).log.all().at(-1)!.author.id).toBe("acct-bud");
    expect(bound.ops).toHaveLength(1);
  });
});

describe("who is still told the account", () => {
  it("is Bud himself, and the host", () => {
    const { store } = acted();
    for (const op of byBud(store.seenBy(bud).log.all())) expect(op.author.id).toBe("acct-bud");
    for (const op of byBud(store.log.all())) expect(op.author.id).toBe("acct-bud");
    for (const op of byBud(store.seenBy(host).log.all())) expect(op.author.id).toBe("acct-bud");
  });

  it("is everyone, for an author bound to nobody", () => {
    const { store } = acted();
    store.apply({ name: "add-gift", args: { title: "A hoop" } }, { author: ann });
    expect(store.seenBy(bud).log.all().at(-1)!.author).toMatchObject({ id: "acct-ann", name: "Ann A." });
  });
});
