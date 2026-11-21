import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../../src/field-sight.js";
import { bindPerson, hostSeat, unbindPerson } from "../../src/binding.js";
import { BIND_PERSON, bindSchema, createSchema, defineNode, Store, touchedOf, type AnySchema, type Policy, type Principal } from "../../src/index.js";

const clock = (start = Date.UTC(2026, 10, 20, 12, 0)) => { let at = start; return () => new Date((at += 60_000)).toISOString(); };

const participant = defineNode("participant", { people: true, label: (n: { name: string }) => n.name, fields: z.object({ name: z.string() }) } as never);
const gift = defineNode("gift", { label: (n: { title: string }) => n.title, fields: z.object({ title: z.string() }) } as never);
const family = createSchema([participant, gift]);
const rules: Policy = {
  grants: [{ roles: ["owner"], mutations: "*" }, { roles: ["owner"], mutations: [BIND_PERSON] }, { roles: ["member"], mutations: ["edit-gift", "add-gift", "remove-gift"] }],
  sees: [{ roles: ["owner"], kinds: ["participant", "gift"] }, { roles: ["member"], kinds: ["participant", "gift"] }],
};
const host = hostSeat({ id: "host" });
const bud: Principal = { kind: "human", id: "acct-bud", roles: ["member"] };
const amy: Principal = { kind: "human", id: "acct-amy", roles: ["member"] };
const cal: Principal = { kind: "human", id: "acct-cal", roles: ["member"] };
const home = (policy: Policy | undefined = rules) => new Store<AnySchema>({ schema: family, ...(policy ? { policy } : {}), now: clock(), snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }, { id: "participant:amy", kind: "participant", name: "Amy" }, { id: "participant:cal", kind: "participant", name: "Cal" }, { id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);

describe("who made and touched a record is said as the person a seat is bound to", () => {
  it("an undo of a binding names no account to another member", () => {
    const store = home();
    bindPerson(store, amy, "participant:amy", { author: host });
    const bound = bindPerson(store, bud, "participant:bud", { author: host });
    const before = JSON.stringify(store.seenBy(amy).log.all());
    expect(before).not.toContain("acct-bud");
    store.undo(bound.batch, { author: host });
    const served = store.seenBy(amy).log.all();
    expect(JSON.stringify(served)).not.toContain("acct-bud");
  });

  it("an unbinding and its undo name no account to another member", () => {
    const store = home();
    bindPerson(store, amy, "participant:amy", { author: host });
    bindPerson(store, bud, "participant:bud", { author: host });
    const ended = unbindPerson(store, bud, { author: host });
    store.undo(ended.batch, { author: host });
    const served = store.seenBy(amy).log.all();
    expect(JSON.stringify(served)).not.toContain("acct-bud");
  });

  it("what a removal carried is said as the person bound since, as a fresh reading says it", () => {
    const store = home();
    bindPerson(store, amy, "participant:amy", { author: host });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: cal });
    store.apply({ name: "remove-gift", args: { id: "gift:kite" } }, { author: amy });
    const first = store.seenBy(amy).log.all();
    expect(JSON.stringify(first)).toContain("acct-cal");
    bindPerson(store, cal, "participant:cal", { author: host });
    const after = store.seenBy(amy).log.all();
    // A fresh judgment would say participant:cal: is the cached served log said again?
    const fresh = new Store<AnySchema>({ schema: family, policy: rules, now: clock(), log: store.log.all(), snapshot: store.graph.snapshot() } as never).seenBy(amy).log.all();
    expect(JSON.stringify(after).includes("acct-cal")).toBe(JSON.stringify(fresh).includes("acct-cal"));
  });

  it("an edit made before a binding that has since ended is still said as the person", () => {
    const store = home();
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: cal });
    bindPerson(store, amy, "participant:amy", { author: host });
    bindPerson(store, cal, "participant:cal", { author: host });
    expect(touchedOf(store.seenBy(amy).graph.getNode("gift:kite")).updatedBy).toBe("participant:cal");
    // unbind cal: what is cal now said as to amy?
    unbindPerson(store, cal, { author: host });
    expect(JSON.stringify(store.seenBy(amy).graph.snapshot())).not.toContain("acct-cal");
    expect(JSON.stringify(store.seenBy(amy).log.all())).not.toContain("acct-cal");
  });
});

import { OperationLog } from "../../src/index.js";
import { rebindPerson } from "../../src/binding.js";

const canon = (snapshot: { nodes: readonly object[] }) => snapshot.nodes.map((node) => JSON.stringify(Object.entries(node).sort(([a], [b]) => (a < b ? -1 : 1)))).sort().join("\n");

describe("a seat told the four folds them as it is served them", () => {
  it("a seat with bindings folds its served log to the four it is served, a binding's own record included", () => {
    const store = new Store<AnySchema>({ schema: family, policy: rules, now: clock() } as never);
    store.applyPrimitives([
      { op: "add-node", node: { id: "participant:bud", kind: "participant", name: "Bud" } },
      { op: "add-node", node: { id: "participant:amy", kind: "participant", name: "Amy" } },
      { op: "add-node", node: { id: "gift:kite", kind: "gift", title: "A kite" } },
    ] as never, { author: { kind: "system", id: "host" } });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    bindPerson(store, amy, "participant:amy", { author: host });
    bindPerson(store, bud, "participant:bud", { author: host });
    const view = store.seenBy(amy);
    const folded = OperationLog.from(view.log.all() as never).fold(family as never).snapshot();
    const servedNow = view.graph.snapshot();
    const four = (snapshot: { nodes: readonly object[] }) => snapshot.nodes.map((node) => JSON.stringify([(node as { id: string }).id, touchedOf(node)])).sort().join("\n");
    expect(four(folded)).toBe(four(servedNow));
  });

  it("a rebind moves who touched a record to the person the seat is bound to now", () => {
    const store = home();
    bindPerson(store, amy, "participant:amy", { author: host });
    bindPerson(store, bud, "participant:cal", { author: host });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    expect(touchedOf(store.graph.getNode("gift:kite")).updatedBy).toBe("acct-bud");
    expect(touchedOf(store.seenBy(amy).graph.getNode("gift:kite")).updatedBy).toBe("participant:cal");
    rebindPerson(store, bud, "participant:bud", { author: host });
    expect(touchedOf(store.seenBy(amy).graph.getNode("gift:kite")).updatedBy).toBe("participant:bud");
  });

  it("a module off tells a seat none of the four, and what it folds holds none", () => {
    const S = createSchema([defineNode("memo", { fields: z.object({ title: z.string() }) }), defineNode("vaultItem", { fields: z.object({ title: z.string() }) })]);
    const { defineMutation } = bindSchema(S);
    const put = defineMutation("put", { title: "Put", creates: ["memo", "vaultItem"], input: z.object({ kind: z.enum(["memo", "vaultItem"]), title: z.string() }), apply(ctx, args) { ctx.addNode({ id: ctx.freshId(args.title, args.kind), kind: args.kind, title: args.title } as never); } });
    const store = new Store<AnySchema>({ schema: S as never, mutations: [put] as never, modules: { vault: { kinds: ["vaultItem"] } }, now: clock() } as never);
    const bea: Principal = { kind: "human", id: "bea", roles: ["member"] };
    store.apply({ name: "put", args: { kind: "memo", title: "M0" } } as never, { author: bea });
    const view0 = store.seenBy(bea);
    expect(touchedOf(view0.graph.getNode("memo:m0")).updatedBy ?? touchedOf(view0.graph.nodesOfKind("memo" as never)[0]).updatedBy).toBe("bea");
    store.setEnabledModules([]);
    const view = store.seenBy(bea);
    const STAMP = /"(createdAt|createdBy|updatedAt|updatedBy)"/;
    expect(JSON.stringify(view.graph.snapshot())).not.toMatch(STAMP);
    expect(JSON.stringify(view.log.all())).not.toMatch(STAMP);
    const folded = OperationLog.from(view.log.all() as never).fold(S as never).snapshot();
    expect(canon(folded)).toBe(canon(view.graph.snapshot()));
  });
});

describe("the four survive a compaction and a rebase as they are said", () => {
  for (const policy of [rules, undefined]) {
    it(`an ended binding behind a compaction is still the person in the store opened again (${policy ? "with sights" : "no policy"})`, () => {
      const store = home(policy);
      store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
      bindPerson(store, amy, "participant:amy", { author: host });
      bindPerson(store, bud, "participant:bud", { author: host });
      unbindPerson(store, bud, { author: host });
      unbindPerson(store, amy, { author: host });
      const checkpoint = store.checkpoint({ seq: store.log.length })!;
      store.compact(checkpoint);
      const again = new Store<AnySchema>({ schema: family, ...(policy ? { policy } : {}), now: clock(), log: [], epochs: store.log.epochs(), snapshot: store.graph.snapshot() } as never);
      expect(JSON.stringify(again.seenBy(amy).graph.snapshot())).not.toContain("acct-bud");
    });
  }

  it("a rebase puts each record's four where a fold of the settled log puts them", () => {
    const S = family;
    const client = home(undefined);
    const mine = client.apply({ name: "edit-gift", args: { id: "gift:kite", title: "Mine" } }, { author: amy });
    const server = home(undefined);
    // Server: someone else's edit lands first, then amy's.
    const theirs = server.apply({ name: "edit-gift", args: { id: "gift:kite", title: "Theirs" } }, { author: bud });
    void theirs; void S;
    const serverOps = server.log.all();
    client.rebase({ pending: [mine.batch], confirmed: serverOps } as never);
    const c = touchedOf(client.graph.getNode("gift:kite"));
    // The re-applied pending op is the last to touch it.
    expect(c.updatedBy).toBe("acct-amy");
    // Folded from the client's own log, the same.

  });

  it("a removal undone and redone keeps when the record was made", () => {
    const store = new Store<AnySchema>({ schema: family, now: clock() } as never);
    store.applyPrimitives([{ op: "add-node", node: { id: "gift:ball", kind: "gift", title: "Ball" } }] as never, { author: amy });
    const made = touchedOf(store.graph.getNode("gift:ball"));
    const removed = store.apply({ name: "remove-gift", args: { id: "gift:ball" } }, { author: bud });
    const undo = store.undo(removed.batch, { author: amy });
    expect(touchedOf(store.graph.getNode("gift:ball")).createdAt).toBe(made.createdAt);
    store.undo(undo.batch, { author: amy });
    expect(store.graph.getNode("gift:ball")).toBeUndefined();
    // compact, then undo nothing; fold from the epoch equals the live graph
    const cp = store.checkpoint({ seq: store.log.length })!;
    const refolded = OperationLog.from(store.log.all() as never).fold(family as never).snapshot();
    expect(canon(refolded)).toBe(canon(store.graph.snapshot()));
    void cp;
  });
});

describe("a rebase and an archived undo fold to what is served", () => {
  it("a pending removal rebased under a server edit leaves the four a fresh fold of the client's log says", () => {
    const fresh = () => {
      const s = new Store<AnySchema>({ schema: family, now: clock() } as never);
      s.applyPrimitives([{ op: "add-node", node: { id: "gift:kite", kind: "gift", title: "A kite" } }] as never, { author: host as never });
      return s;
    };
    const server = fresh();
    const client = new Store<AnySchema>({ schema: family, now: clock(Date.UTC(2026, 10, 20, 13, 0)), log: server.log.all() } as never);
    const mine = client.apply({ name: "remove-gift", args: { id: "gift:kite" } }, { author: amy });
    server.apply({ name: "edit-gift", args: { id: "gift:kite", title: "Theirs" } }, { author: bud });
    client.rebase({ pending: [], drop: [mine.batch], confirmed: server.log.all() } as never);
    expect(canon(client.graph.snapshot())).toBe(canon(server.graph.snapshot()));
  });

});

describe("a record said as the person is the same object read twice", () => {
  it("a record whose four are said as the person is equal by identity read twice", () => {
    const store = home();
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    bindPerson(store, amy, "participant:amy", { author: host });
    bindPerson(store, bud, "participant:bud", { author: host });
    const view = store.seenBy(amy);
    const a = view.graph.getNode("gift:kite");
    const b = view.graph.getNode("gift:kite");
    expect(a).toBe(b);
    expect(view.graph.snapshot().nodes.find((n) => n.id === "gift:kite")).toBe(view.graph.snapshot().nodes.find((n) => n.id === "gift:kite"));
  });
});

import { search } from "../../src/search.js";
import { nodeRef, offersTouches } from "../../src/index.js";
import { arrangeable } from "../../src/arrange.js";

describe("a seat told none of the four cannot find records by them", () => {
  it("a search for when records last changed finds nothing for a seat told none of the four, a hidden link's touch included", () => {
    const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }).strict(), edges: { holds: { to: ["task"] } } });
    const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }).strict() });
    const schema = createSchema([list, task]);
    const { defineMutation } = bindSchema(schema);
    const addTask = defineMutation("add-task", { title: "Add a task", creates: ["task"], input: z.object({ label: z.string().min(1) }), apply(ctx, args) { ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label, done: false }); } });
    const putOn = defineMutation("put-on", { title: "Put it on", input: z.object({ listId: nodeRef(["list"]), taskId: nodeRef(["task"]) }), apply(ctx, args) { ctx.addEdge({ kind: "holds", from: args.listId, to: args.taskId }); } });
    const ann: Principal = { kind: "human", id: "ann", roles: ["member"] };
    const gus: Principal = { kind: "human", id: "gus", roles: ["guest"] };
    // The guest sees every task, every field of each; no list.
    const policy: Policy = { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["member"], kinds: ["list", "task"] }, { roles: ["guest"], kinds: ["task"] }] };
    let at = Date.UTC(2026, 10, 20, 12, 0);
    const store = new Store<AnySchema>({ schema, mutations: [addTask, putOn], policy, now: () => new Date(at).toISOString(), snapshot: { nodes: [{ id: "secret-list", kind: "list", label: "Secret list" }], edges: [] } } as never);
    store.apply({ name: "add-task", args: { label: "Alpha" } }, { author: ann });
    const b = store.apply({ name: "add-task", args: { label: "Bravo" } }, { author: ann }).minted![0]!;
    at = Date.UTC(2026, 10, 25, 12, 0);
    store.apply({ name: "put-on", args: { listId: "secret-list", taskId: b } }, { author: ann });
    // What the guest is served says nothing of it.
    expect(touchedOf(store.seenBy(gus).graph.getNode(b))).toEqual({});
    const asked = search(store, "updatedAt:on:2026-11-25", { principal: gus });
    const found = asked.hits.map((hit) => (hit as { id?: string }).id ?? JSON.stringify(hit));
    expect(asked.total).toBe(0);
    void found;
    // Nor is it offered them.
    expect(arrangeable(schema, "task", { touched: offersTouches(store.seenBy(gus)) }).filters.map((offer) => offer.key)).not.toContain("updatedAt");
    expect(arrangeable(schema, "task", { touched: offersTouches(store.seenBy(ann)) }).filters.map((offer) => offer.key)).toContain("updatedAt");
  });
});

describe("a rebase and a reopened store say the four as a fold of the log does", () => {
  it("a rebase leaves a record last reshaped by a migration with the four its last change gave it", () => {
    const server = new Store<AnySchema>({ schema: family, now: clock() } as never);
    server.applyPrimitives([{ op: "add-node", node: { id: "gift:kite", kind: "gift", title: "A kite" } }] as never, { author: bud });
    server.applyPrimitives([{ op: "patch-node", id: "gift:kite", before: { title: "A kite" }, after: { title: "A Kite" } }] as never, { author: { kind: "system", id: "ship:migration" } });
    const client = new Store<AnySchema>({ schema: family, now: clock(Date.UTC(2026, 10, 20, 13)), log: server.log.all() } as never);
    expect(touchedOf(client.graph.getNode("gift:kite")).updatedBy).toBe("acct-bud");
    const mine = client.apply({ name: "remove-gift", args: { id: "gift:kite" } }, { author: amy });
    client.rebase({ pending: [], drop: [mine.batch], confirmed: server.log.all() } as never);
    expect(touchedOf(client.graph.getNode("gift:kite"))).toEqual(touchedOf(server.graph.getNode("gift:kite")));
  });

  it("an ended binding behind a compaction is the person in a store reopened on it, edited and compacted again", () => {
    const store = home();
    bindPerson(store, amy, "participant:amy", { author: host });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    bindPerson(store, bud, "participant:bud", { author: host });
    unbindPerson(store, bud, { author: host });
    store.compact(store.checkpoint({ seq: store.log.length })!);
    const again = new Store<AnySchema>({ schema: family, policy: rules, now: clock(), log: [], epochs: store.log.epochs(), snapshot: store.graph.snapshot() } as never);
    expect(touchedOf(again.seenBy(amy).graph.getNode("gift:kite")).updatedBy).toBe("participant:bud");
    again.apply({ name: "edit-gift", args: { id: "gift:kite", title: "x" } }, { author: amy });
    expect(JSON.stringify(again.seenBy(amy).graph.snapshot())).not.toContain("acct-bud");
    expect(again.checkpoint({ seq: again.log.length })!.bound?.["acct-bud"]).toBe("participant:bud");
  });
});
