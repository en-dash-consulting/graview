import { describe, expect, it } from "vitest";
import { z } from "zod";
import "../../src/field-sight.js";
import { bindPerson, hostSeat } from "../../src/binding.js";
import { archivedSeenBy, archiveFrom } from "../../src/seat.js";
import { answerJob } from "../../src/jobs.js";
import { arrangeable } from "../../src/arrange.js";
import { shapesOfSchema } from "../../src/document/rules.js";
import { evaluateExpr, parseExpr } from "../../src/document/index.js";
import { offersTouches } from "../../src/index.js";
import { planMigration, templateSeedPrimitives, type GraviewDocument } from "../../src/document/index.js";
import { BIND_PERSON, bindSchema, createSchema, defineNode, nodeRef, Store, touchedOf, unseatedSnapshot, type AnySchema, type Policy, type Principal } from "../../src/index.js";

/**
 * A RECORD'S TIMES ARE KEPT AS EACH SEAT MAY SEE THEM (Graview HQ
 * feature:f-record-last-touched). A seat from whom nothing is kept is
 * served each record's `createdAt`, `createdBy`, `updatedAt` and
 * `updatedBy` as the store keeps them, a seat since bound to a person said
 * as that person; a seat from whom anything is kept is served none of them,
 * in its graph, its log and its epochs, compacted or not — none rather
 * than a time made up. Nothing outside the framework's own undo and rename
 * says when a record was made, and nothing leaving an installation as a
 * seed or a template carries them.
 */

const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }).strict(), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean(), note: z.string().optional() }).strict() });
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const addTask = defineMutation("add-task", { title: "Add a task", creates: ["task"], input: z.object({ label: z.string().min(1) }), apply(ctx, args) { ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label, done: false }); } });
const putOn = defineMutation("put-on", { title: "Put it on", input: z.object({ listId: nodeRef(["list"]), taskId: nodeRef(["task"]) }), apply(ctx, args) { ctx.addEdge({ kind: "holds", from: args.listId, to: args.taskId }); } });
const ann: Principal = { kind: "human", id: "ann", roles: ["member"] };
const gus: Principal = { kind: "human", id: "gus", roles: ["guest"] };
// The guest sees tasks, not their note, and no list at all.
const policy: Policy = { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["member"], kinds: ["list", "task"] }, { roles: ["guest"], kinds: ["task"], hide: ["note"] }] };
const clock = (start = Date.UTC(2026, 10, 20, 12, 0)) => { let at = start; return () => new Date((at += 60_000)).toISOString(); };
const opened = () => new Store<AnySchema>({ schema, mutations: [addTask, putOn], policy, now: clock(), snapshot: { nodes: [{ id: "secret-list", kind: "list", label: "Secret list" }], edges: [] } } as never);
const STAMP = /"(createdAt|createdBy|updatedAt|updatedBy)"/;

describe("a seat from whom anything is kept is told none of the four", () => {
  it("not after an edit of a field it may not see, nor a link to a record it may not see, before or after compaction", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    store.apply({ name: "edit-task", args: { id, note: "private" } }, { author: ann });
    store.apply({ name: "put-on", args: { listId: "secret-list", taskId: id } }, { author: ann });
    for (const moment of ["live", "compacted"]) {
      if (moment === "compacted") store.compact(store.checkpoint({ seq: store.log.length })!);
      const view = store.seenBy(gus);
      expect(view.graph.getNode(id), moment).toMatchObject({ label: "Book the van" });
      expect(JSON.stringify(view.graph.snapshot()), moment).not.toMatch(STAMP);
      expect(JSON.stringify(view.log.epochs()), moment).not.toMatch(STAMP);
      expect(JSON.stringify(view.log.all()), moment).not.toMatch(STAMP);
      // What the seat folds of its log stamps nothing either.
      expect(view.log.all().every((op) => op.stamps === false), moment).toBe(true);
    }
    // The member, from whom nothing is kept, is told when it last changed.
    expect(touchedOf(store.seenBy(ann).graph.getNode(id)).updatedBy).toBe("ann");
  });

  it("nor of a record that came into its sight", () => {
    const note = defineNode("note", { fields: z.object({ label: z.string().min(1), about: z.string() }).strict() });
    const sights = createSchema([defineNode("list", { fields: z.object({ label: z.string().min(1) }).strict() }), note]);
    const { defineMutation: define } = bindSchema(sights);
    const addNote = define("add-note", { title: "Add a note", creates: ["note"], input: z.object({ label: z.string(), about: z.string() }), apply(ctx, args) { ctx.addNode({ id: ctx.freshId(args.label, "note"), kind: "note", label: args.label, about: args.about }); } });
    const store = new Store<AnySchema>({ schema: sights, mutations: [addNote], policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["member"], kinds: ["list", "note"] }, { roles: ["guest"], kinds: ["note"] }] }, now: clock(), snapshot: { nodes: [{ id: "secret", kind: "list", label: "Secret" }], edges: [] } } as never);
    const id = store.apply({ name: "add-note", args: { label: "Plan", about: "secret" } }, { author: ann }).minted![0]!;
    expect(store.seenBy(gus).graph.getNode(id)).toBeUndefined();
    store.apply({ name: "edit-note", args: { id, about: "nothing" } }, { author: ann });
    expect(touchedOf(store.seenBy(gus).graph.getNode(id))).toEqual({});
    store.compact(store.checkpoint({ seq: store.log.length })!);
    expect(touchedOf(store.seenBy(gus).graph.getNode(id))).toEqual({});
  });
});

describe("a seat since bound to a person is said as that person", () => {
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
  const home = () => new Store<AnySchema>({ schema: family, policy: rules, now: clock(), snapshot: { nodes: [{ id: "participant:bud", kind: "participant", name: "Bud" }, { id: "participant:amy", kind: "participant", name: "Amy" }, { id: "gift:kite", kind: "gift", title: "A kite" }], edges: [] } } as never);

  it("to another member, of an edit made before the binding, live and after compaction", () => {
    const store = home();
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    bindPerson(store, bud, "participant:bud", { author: host });
    bindPerson(store, amy, "participant:amy", { author: host });
    expect(touchedOf(store.seenBy(amy).graph.getNode("gift:kite")).updatedBy).toBe("participant:bud");
    expect(JSON.stringify(store.seenBy(amy).graph.snapshot())).not.toContain("acct-bud");
    store.compact(store.checkpoint({ seq: store.log.length })!);
    expect(JSON.stringify(store.seenBy(amy).graph.snapshot())).not.toContain("acct-bud");
    expect(JSON.stringify(store.seenBy(amy).log.epochs())).not.toContain("acct-bud");
  });

  it("as nobody, where an account is bound and acted as a profile of its own, or a profile is bound and the account acted bare", () => {
    for (const [bound, acting] of [
      [bud, { ...bud, profile: { id: "prf_x", name: "X" } }],
      [{ ...bud, profile: { id: "prf_b", name: "B" } }, bud],
    ] as const) {
      const store = home();
      bindPerson(store, bound as Principal, "participant:bud", { author: host });
      bindPerson(store, amy, "participant:amy", { author: host });
      store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: acting as Principal });
      const view = store.seenBy(amy);
      expect(touchedOf(view.graph.getNode("gift:kite")).updatedBy).toBe(view.log.all().at(-1)!.author.id);
      for (const said of [view.graph.snapshot(), view.log.all(), view.log.epochs()]) expect(JSON.stringify(said)).not.toContain("acct-bud");
    }
  });

  it("in an epoch of the archive behind where it begins, judged on its own", () => {
    const store = home();
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A blue kite" } }, { author: amy });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    const archives = [store.compact(store.checkpoint({ seq: store.log.length })!)];
    bindPerson(store, bud, "participant:bud", { author: host });
    bindPerson(store, amy, "participant:amy", { author: host });
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A kite" } }, { author: amy });
    archives.push(store.compact(store.checkpoint({ seq: store.log.length })!));
    const archive = { ops: archives.flatMap((one) => one.ops), epochs: [...archives.flatMap((one) => one.epochs), ...store.log.epochs()] };
    const window = archiveFrom(store, archive, store.log.horizon - 1);
    const stops = archive.epochs.filter((epoch) => epoch.seq > 0 && epoch.seq < window.epochs[0]!.seq && epoch.removed !== undefined);
    expect(stops.length).toBeGreaterThan(0);
    const answer = archivedSeenBy(store, { ops: window.ops, epochs: [...stops, ...window.epochs] }, amy, { from: 0, to: window.epochs[0]!.seq });
    expect(JSON.stringify(answer.epochs)).not.toContain("acct-bud");
  });

  it("in what a removal and its undo carry", () => {
    const store = home();
    store.apply({ name: "edit-gift", args: { id: "gift:kite", title: "A red kite" } }, { author: bud });
    bindPerson(store, bud, "participant:bud", { author: host });
    bindPerson(store, amy, "participant:amy", { author: host });
    const removed = store.apply({ name: "remove-gift", args: { id: "gift:kite" } }, { author: amy });
    store.undo(removed.batch, { author: amy });
    expect(JSON.stringify(store.seenBy(amy).graph.snapshot())).not.toContain("acct-bud");
    expect(JSON.stringify(store.seenBy(amy).log.all())).not.toContain("acct-bud");
  });
});

describe("nothing outside the framework says when a record was made", () => {
  it("a host's op that adds a record saying when and by whom it was made is not believed", () => {
    const store = opened();
    const [op] = store.append([{ author: { kind: "system", id: "host" }, intent: "Seed", primitives: [{ op: "add-node", node: { id: "task:bike", kind: "task", label: "Bike", done: false, createdAt: "1999-01-01T00:00:00.000Z", createdBy: "ann", updatedBy: "x" } }] } as never]);
    expect(touchedOf(store.graph.getNode("task:bike"))).toEqual({ createdAt: op!.at, createdBy: "host", updatedAt: op!.at, updatedBy: "host" });
  });

  it("a record a visitor makes says when, and not who", () => {
    const store = opened();
    const made = store.applyPrimitives([{ op: "add-node", node: { id: "task:rsvp", kind: "task", label: "RSVP", done: false } }], { author: { kind: "visitor", id: "form:token-123" } });
    expect(touchedOf(store.graph.getNode("task:rsvp"))).toEqual({ createdAt: made.ops[0]!.at, updatedAt: made.ops[0]!.at });
  });

  it("a seed or a template carries none of the four out of the installation it came from", () => {
    const record = { id: "a", kind: "task", label: "A", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "acct-ann", updatedAt: "2026-01-02T00:00:00.000Z", updatedBy: "acct-bo" };
    expect(unseatedSnapshot({ nodes: [record], edges: [] }).nodes[0]).toEqual({ id: "a", kind: "task", label: "A" });
    // An export of this installation keeps them, to restore it.
    expect(unseatedSnapshot({ nodes: [record], edges: [] }, { touched: "kept" }).nodes[0]).toEqual(record);
    const doc = { format: "graview-document", formatVersion: 1, name: "T", kinds: { task: { noun: "task", plural: "tasks", fields: { label: { type: "string" } } } } } as never;
    const [first] = templateSeedPrimitives({ nodes: [record], edges: [] } as never, doc);
    expect(touchedOf((first as { node: object }).node)).toEqual({});
  });
});

describe("a value a kind kept under one of the names is no stamp", () => {
  const before: GraviewDocument = { format: "graview-document", formatVersion: 1, name: "Chores", kinds: { chore: { noun: "chore", plural: "chores", label: "{title}", fields: { title: { type: "string", required: true }, updatedAt: { type: "date" } } } } } as never;
  const after: GraviewDocument = { ...before, kinds: { chore: { noun: "chore", plural: "chores", label: "{title}", fields: { title: { type: "string", required: true }, lastSwept: { type: "date", renamedFrom: "updatedAt" } } } } } as never;

  it("is never read as one: a day is not an instant", () => {
    expect(touchedOf({ id: "c1", kind: "chore", updatedAt: "2025-01-01", updatedBy: "Nick" })).toEqual({});
  });

  it("renamed away, its value moves to the new field and is no stamp; the migration touches nothing", () => {
    const chore = defineNode("chore", { fields: z.object({ title: z.string(), lastSwept: z.string().optional() }) });
    const store = new Store<AnySchema>({ schema: createSchema([chore]), now: clock(), snapshot: { nodes: [{ id: "c1", kind: "chore", title: "Sweep", updatedAt: "2025-01-01" }], edges: [] } } as never);
    const plan = planMigration(before, after, { nodes: [{ id: "c1", kind: "chore", title: "Sweep", updatedAt: "2025-01-01" }], edges: [] } as never);
    store.applyPrimitives(plan.primitives, { author: { kind: "system", id: "ship:migration" } });
    expect(store.graph.getNode("c1")).toMatchObject({ lastSwept: "2025-01-01" });
    expect(touchedOf(store.graph.getNode("c1"))).toEqual({});
  });

  it("a migration that reshapes a record leaves when it was made and last touched as they were", () => {
    const store = opened();
    const id = store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann }).minted![0]!;
    const was = touchedOf(store.graph.getNode(id));
    store.applyPrimitives([{ op: "patch-node", id, before: { done: false }, after: { done: true } }], { author: { kind: "system", id: "ship:migration" } });
    expect(store.graph.getNode(id)).toMatchObject({ done: true });
    expect(touchedOf(store.graph.getNode(id))).toEqual(was);
  });
});

describe("only the framework's own undo puts back when a record was made", () => {
  it("an undo a host appends is not believed of a record's making", () => {
    const store = opened();
    store.append([{ author: { kind: "system", id: "host" }, intent: "Put back", undoes: "op0", primitives: [{ op: "add-node", node: { id: "task:kept", kind: "task", label: "Kept", done: false, createdAt: "1999-01-01T00:00:00.000Z", createdBy: "ann" } }] } as never]);
    expect(touchedOf(store.graph.getNode("task:kept")).createdAt).toBeUndefined();
  });

  it("an undo of the removal of a record from before them says none of its making, never the undo's time", () => {
    const store = new Store<AnySchema>({ schema, mutations: [addTask], policy, now: clock(), snapshot: { nodes: [{ id: "task:old", kind: "task", label: "Old", done: false }], edges: [] } } as never);
    const removed = store.apply({ name: "remove-task", args: { id: "task:old" } }, { author: ann });
    const back = store.undo(removed.batch, { author: ann });
    expect(touchedOf(store.graph.getNode("task:old"))).toEqual({ updatedAt: back.ops[0]!.at, updatedBy: "ann" });
  });
});

describe("a seat told none of the four reads none, wherever it reads", () => {
  it("a job it asks, a computed value worked out over what it sees, and a list it is offered", () => {
    const store = opened();
    store.apply({ name: "add-task", args: { label: "Book the van" } }, { author: ann });
    const seen = store.seenBy(gus);
    const node = seen.graph.nodesOfKind("task")[0]!;
    expect(answerJob(store, { kind: "task", where: "present(updatedAt)" }, gus).ids).toEqual([]);
    expect(answerJob(store, { kind: "task", where: "present(updatedAt)" }, ann).count).toBe(1);
    expect(evaluateExpr(parseExpr("updatedAt"), { graph: seen.graph as never, subject: node as never, kinds: shapesOfSchema(schema) })).toBeNull();
    expect(arrangeable(schema, "task", { touched: offersTouches(seen) }).sorts.map((offer) => offer.key)).not.toContain("updatedAt");
  });
});
