import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileDocument } from "../../src/check.js";
import { bindSchema, createSchema, defineNode, nodeRef, PastError, Store, type AnySchema, type Principal } from "../../src/index.js";
import { declarationSentence, makerOf, restoreBatches, ticksOf } from "../../src/history.js";
import { declarationAt, pastAt, pastOf, seqAt } from "../../src/past.js";

/**
 * THE PAST IS THE LOG FOLDED TO THAT POINT (Roadmap f-playback). A person
 * scrubs back through an app's history and watches it being built: each
 * moment is `pastOf(store, seq)` — the records, the links and the declaration
 * as they stood — read, never changed, folded from the nearest kept point
 * rather than from the start, and served to a seat as that seat could see
 * it then.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), edges: { blocks: { to: ["task"] } }, plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add a task",
  description: "Add one.",
  input: z.object({ id: z.string(), label: z.string() }),
  describe: (args) => `Add “${args.label}”`,
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label } as never);
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  description: "Call it something else.",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string() }),
  describe: (args) => `Rename to “${args.label}”`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const block = defineMutation("block", {
  title: "Block",
  description: "One task waits on another.",
  input: z.object({ from: nodeRef(["task"]), to: nodeRef(["task"]) }),
  describe: () => "Block",
  apply(ctx, args) {
    ctx.addEdge({ kind: "blocks", from: args.from, to: args.to } as never);
  },
});

const me: Principal = { kind: "human", id: "nick" };

/** A store with a history: tasks added, renamed and linked, one gesture a minute. */
function built(gestures: number, options: { pastEvery?: number } = {}) {
  let minute = 0;
  const at = () => new Date(Date.UTC(2026, 9, 13, 9, minute)).toISOString();
  const store = new Store({ schema, mutations: [add, rename, block], snapshot: { nodes: [], edges: [] }, now: at, ...options });
  for (minute = 0; minute < gestures; minute++) {
    const n = Math.floor(minute / 3);
    if (minute % 3 === 0) store.apply({ name: "add", args: { id: `t${n}`, label: `Task ${n}` } }, { author: me });
    else if (minute % 3 === 1) store.apply({ name: "rename", args: { id: `t${n}`, label: `Task ${n}, renamed` } }, { author: { kind: "agent", id: "claude" } });
    else if (n > 0) store.apply({ name: "block", args: { from: `t${n}`, to: `t${n - 1}` } }, { author: { kind: "human", id: "ann" } });
    else store.apply({ name: "rename", args: { id: "t0", label: "First" } }, { author: me });
  }
  return store;
}

/** The graph the log folds to at `seq`, the long way: a fresh store handed only the ops before it. */
const foldedTo = (store: Store<AnySchema>, seq: number) =>
  new Store({ schema: store.schema, log: store.log.all().slice(0, seq), epochs: store.log.epochs().filter((epoch) => epoch.seq <= seq) }).graph.snapshot();
const sorted = (snapshot: { nodes: readonly { id: string }[]; edges: readonly { kind: string; from: string; to: string }[] }) => ({
  nodes: [...snapshot.nodes].sort((a, b) => a.id.localeCompare(b.id)),
  edges: [...snapshot.edges].map((edge) => `${edge.kind}:${edge.from}->${edge.to}`).sort(),
});

describe("pastOf", () => {
  it("is the store folded to that point: its records, its links and its log, at every seq", () => {
    const store = built(30) as unknown as Store<AnySchema>;
    for (let seq = 0; seq <= store.log.length; seq++) {
      const past = pastOf(store, seq);
      expect(sorted(past.graph.snapshot()), `seq ${seq}`).toEqual(sorted(foldedTo(store, seq)));
      expect(past.log.length).toBe(seq);
      expect(past.past?.seq).toBe(seq);
    }
    expect(pastOf(store, 3).graph.getNode("t0")).toMatchObject({ label: "First" });
    expect(pastOf(store, 1).graph.getNode("t0")).toMatchObject({ label: "Task 0" });
    expect(pastOf(store, 5).graph.allEdges()).toEqual([]);
    expect(pastOf(store, 6).graph.allEdges().map((edge) => `${edge.from}->${edge.to}`)).toEqual(["t1->t0"]);
  });

  it("is the moment a time names: every op made at or before it, none after", () => {
    const store = built(10);
    expect(seqAt(store, "2026-10-13T09:04:00.000Z")).toBe(5);
    expect(pastOf(store, "2026-10-13T09:04:30.000Z").log.length).toBe(5);
    expect(pastOf(store, new Date(Date.UTC(2026, 9, 13, 8))).graph.allNodes()).toEqual([]);
    expect(pastOf(store, "2027-01-01T00:00:00.000Z").log.length).toBe(10);
    expect(pastOf(store, 5).past?.at).toBe("2026-10-13T09:04:00.000Z");
  });

  it("folds from a point it kept, never from the start again", () => {
    const store = built(300, { pastEvery: 64 });
    const first = pastOf(store, 200);
    expect(first.past).toMatchObject({ seq: 200, foldedFrom: 0, folded: 200 });
    // The seek kept points every 64 ops on its way, and where it stopped.
    expect(pastOf(store, 190).past).toMatchObject({ foldedFrom: 128, folded: 62 });
    expect(pastOf(store, 201).past).toMatchObject({ foldedFrom: 200, folded: 1 });
    expect(pastOf(store, 64).past).toMatchObject({ foldedFrom: 64, folded: 0 });
    expect(sorted(pastOf(store, 190).graph.snapshot())).toEqual(sorted(foldedTo(store as unknown as Store<AnySchema>, 190)));
  });

  it("does not trust a kept point once the log under it was cut back and grew again", () => {
    const store = built(80, { pastEvery: 32 });
    pastOf(store, 70);
    store.log.truncate(40);
    store.apply({ name: "add", args: { id: "fresh", label: "Fresh" } });
    for (let n = 0; n < 30; n++) store.apply({ name: "rename", args: { id: "fresh", label: `Fresh ${n}` } });
    const past = pastOf(store, 70);
    expect(past.past?.foldedFrom).toBeLessThanOrEqual(40);
    expect(past.graph.getNode("fresh")).toBeDefined();
  });

  it("offers no act and refuses every change: the past is read, never changed", () => {
    const store = built(9);
    const past = pastOf(store, 4);
    expect(past.allMutations()).toEqual([]);
    expect(past.permittedMutations(me)).toEqual([]);
    expect(past.permits({ name: "add", args: { id: "x", label: "X" } }, me)).toMatchObject({ ok: false, refusal: { message: "Nothing changes while you look back." } });
    expect(() => past.apply({ name: "add", args: { id: "x", label: "X" } })).toThrow();
    expect(() => past.applyPrimitives([{ op: "addNode", node: { id: "x", kind: "task", label: "X" } } as never])).toThrow(PastError);
    expect(() => past.undo(past.batches()[0]!.id)).toThrow(PastError);
    expect(() => past.append([])).toThrow(PastError);
    expect(past.graph.allNodes()).toHaveLength(2);
  });

  it("is under the declaration the host says the moment was made under", () => {
    const store = built(9);
    const note = defineNode("note", { fields: z.object({ body: z.string() }) });
    const before = createSchema([task]);
    const after = createSchema([task, note]);
    const marks = [{ seq: 6, sentence: declarationSentence(before, after), declaration: { schema: after } }];
    expect(marks[0]!.sentence).toBe("Added a Note kind");
    expect(declarationAt(marks, 5)).toBeUndefined();
    expect(pastAt(store, 5, { declarations: marks }).schema.kinds).toEqual(["task"]);
    expect(pastAt(store, 7, { declarations: marks }).schema.kinds).toEqual(["task", "note"]);
    expect(declarationSentence(createSchema([note]), createSchema([defineNode("note", { fields: z.object({ body: z.string(), due: z.string() }) })]))).toBe("Added due to Note");
  });

  it("begins where the log began, though a store reopened without the epoch its seed began cannot say so", () => {
    const seeded = new Store({ schema, mutations: [add, rename], snapshot: { nodes: [{ id: "seed", kind: "task", label: "From the seed", done: false }] as never, edges: [] } });
    seeded.apply({ name: "add", args: { id: "t1", label: "One" } });
    seeded.apply({ name: "rename", args: { id: "seed", label: "Renamed" } });
    seeded.apply({ name: "rename", args: { id: "t1", label: "Uno" } });
    // As a page's browser adapter reopens it: the graph and the log, and no epoch.
    const reopened = new Store({ schema, mutations: [add, rename], snapshot: seeded.graph.snapshot(), log: seeded.log.all() });
    expect(reopened.log.epochs()).toEqual([]);
    for (let seq = 0; seq <= 3; seq++) expect(sorted(pastOf(reopened, seq).graph.snapshot()), `seq ${seq}`).toEqual(sorted(pastOf(seeded, seq).graph.snapshot()));
    expect(pastOf(reopened, 0).graph.getNode("seed")).toMatchObject({ label: "From the seed" });
  });

  it("is refused behind the undo horizon: that is the archive's", () => {
    const store = built(40);
    store.compact(store.checkpoint({ seq: 20 })!);
    expect(() => pastOf(store, 10)).toThrow(/archive/);
    expect(sorted(pastOf(store, 30).graph.snapshot())).toEqual(sorted(built(30).graph.snapshot()));
  });
});

describe("a timeline", () => {
  it("has a tick per gesture, marked by who made it, and a bigger one with its sentence where the declaration changed", () => {
    const store = built(6);
    const ticks = ticksOf(store, { me, declarations: [{ seq: 3, sentence: "Added a Budget kind" }] });
    expect(ticks.map((tick) => [tick.seq, tick.maker, tick.declaration])).toEqual([
      [1, "you", false],
      [2, "agent", false],
      [3, "you", true],
      [4, "you", false],
      [5, "agent", false],
      [6, "person", false],
    ]);
    expect(ticks[2]!.said).toBe("Added a Budget kind");
    expect(makerOf({ kind: "system", id: "ship:migration" })).toBe("app");
    expect(makerOf({ kind: "human", id: "ann" }, me)).toBe("person");
  });
});

describe("restore to here", () => {
  it("is one undo of every gesture since, and brings the app back to exactly that moment", () => {
    const store = built(12);
    const seq = 5;
    store.undo(store.batches()[7]!.id, { author: me });
    const now = sorted(store.graph.snapshot());
    const batches = restoreBatches(store, seq);
    const check = store.canUndo(batches);
    expect(check.ok, check.ok ? "" : check.message).toBe(true);
    const result = store.undo(batches, { author: me });
    expect(sorted(store.graph.snapshot())).toEqual(sorted(pastOf(store, seq).graph.snapshot()));
    // One change, and undone as one.
    expect(new Set(result.ops.map((op) => op.batch)).size).toBe(1);
    store.undo(result.batch, { author: me });
    expect(sorted(store.graph.snapshot())).toEqual(now);
  });
});

describe("a seat's past", () => {
  const santa = JSON.parse(readFileSync(new URL("../document/fixtures/secret-santa.gdd.json", import.meta.url), "utf8"));
  const compiled = compileDocument(santa);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app;
  const ann: Principal = { kind: "human", id: "p_ann", roles: ["participant"] };
  const organizer: Principal = { kind: "human", id: "p_org", roles: ["organizer"] };

  it("withholds what the seat could not see then, through its own view and through the past's", () => {
    const store = new Store<AnySchema>({
      schema: app.schema,
      mutations: app.mutations ?? [],
      policy: app.policy!,
      snapshot: { nodes: [{ id: "p_ann", kind: "participant", name: "Ann" }, { id: "p_bo", kind: "participant", name: "Bo" }, { id: "p_cy", kind: "participant", name: "Cy" }] as never, edges: [] },
    });
    store.apply({ name: "draw", args: { note: "Ann for Bo", giver: "p_ann", receiver: "p_bo" } }, { author: organizer });
    store.apply({ name: "draw", args: { note: "Bo for Cy", giver: "p_bo", receiver: "p_cy" } }, { author: organizer });
    store.apply({ name: "draw", args: { note: "Cy for Ann", giver: "p_cy", receiver: "p_ann" } }, { author: organizer });
    const notes = (seen: Store<AnySchema>) => seen.graph.nodesOfKind("match" as never).map((node) => (node as { note?: string }).note);
    const seq = store.batches()[1]!.ops.at(-1)!.seq + 1;
    expect(notes(pastOf(store, seq))).toHaveLength(2);
    expect(notes(pastOf(store, seq).seenBy(ann))).toEqual(["Ann for Bo"]);
    expect(notes(pastOf(store.seenBy(ann), seq))).toEqual(["Ann for Bo"]);
    expect(notes(pastOf(store.seenBy(organizer), seq))).toHaveLength(2);
    // Its timeline says the change it may not see happened, and nothing of it.
    const ticks = ticksOf(pastOf(store.seenBy(ann), store.log.length), { me: ann });
    expect(ticks.filter((tick) => tick.withheld).length).toBeGreaterThan(0);
    expect(ticks.filter((tick) => tick.withheld).every((tick) => tick.author === undefined)).toBe(true);
  });
});
