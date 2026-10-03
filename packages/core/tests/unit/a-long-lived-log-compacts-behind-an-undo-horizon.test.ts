import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineNode,
  nodeRef,
  OperationLog,
  snapshotHash,
  Store,
  UndoBlockedError,
} from "../../src/index.js";

/**
 * FR-23. An app used daily for a year carries every op, and the whole log
 * was loaded to fold and to undo. A checkpoint (an epoch whose base is the
 * graph at seq N) becomes the UNDO HORIZON: the ops before it are archived
 * where a normal open does not load them, the log begins at N, undo does
 * not reach behind it and says so, and the archive is still there to export.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks" });
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

/** A store with `days` days of history, one gesture a day, the clock at the last. */
function lived(days: number) {
  let day = 0;
  const at = () => new Date(Date.UTC(2026, 0, 1 + day)).toISOString();
  const store = new Store({ schema, mutations: [add, rename], snapshot: { nodes: [], edges: [] }, now: at });
  store.apply({ name: "add", args: { id: "t1", label: "Pay the deposit" } });
  for (day = 1; day < days; day++) store.apply({ name: "rename", args: { id: "t1", label: `Pay the deposit (day ${day})` } });
  day = days - 1;
  return { store, now: at() };
}

describe("a log that begins at a horizon", () => {
  it("begins at its checkpoint's seq and counts on from there", () => {
    const { store } = lived(6);
    const checkpoint = store.checkpoint({ seq: 4 })!;
    const tail = store.log.all().slice(4);
    const log = OperationLog.from(tail, [checkpoint]);
    expect(log.horizon).toBe(4);
    expect(log.length).toBe(6);
    expect(log.all().map((op) => op.seq)).toEqual([4, 5]);
    expect(snapshotHash(log.fold(schema, { from: checkpoint }).snapshot())).toBe(snapshotHash(store.snapshot()));
  });

  it("is refused without a checkpoint or a horizon, naming the seq it begins at", () => {
    const { store } = lived(6);
    expect(() => OperationLog.from(store.log.all().slice(4))).toThrow(/begins at seq 4/);
  });

  it("may say its horizon outright, for a store that hydrates from a snapshot and has no base to fold", () => {
    const { store } = lived(6);
    const log = OperationLog.from(store.log.all().slice(4), [], { horizon: 4 });
    expect(log.horizon).toBe(4);
    expect(() => log.fold(schema)).toThrow(/does not fold from empty/);
  });

  it("does not fold from an epoch behind it", () => {
    const { store } = lived(6);
    const checkpoint = store.checkpoint({ seq: 4 })!;
    const log = OperationLog.from(store.log.all().slice(4), [checkpoint]);
    expect(() => log.fold(schema, { from: { seq: 0, base: { nodes: [], edges: [] } } })).toThrow(/behind the horizon/);
  });
});

describe("store.compact", () => {
  it("keeps only the checkpoint and the tail, and the graph is what it was", () => {
    const { store } = lived(10);
    const before = snapshotHash(store.snapshot());
    const checkpoint = store.checkpoint({ seq: 7 })!;
    const archived = store.compact(checkpoint);
    expect(archived.ops.map((op) => op.seq)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(store.log.horizon).toBe(7);
    expect(store.log.all().map((op) => op.seq)).toEqual([7, 8, 9]);
    expect(store.log.epochs()[0]).toMatchObject({ seq: 7, horizon: true });
    expect(snapshotHash(store.snapshot())).toBe(before);
    expect(store.verify()).toEqual({ ok: true, hash: before });
    // The next op takes the seq after the last, as if nothing had moved.
    expect(store.apply({ name: "rename", args: { id: "t1", label: "Paid" } }).ops[0]!.seq).toBe(10);
  });

  it("archives what is older than the horizon by days and by ops, whichever keeps more", () => {
    const { store, now } = lived(200);
    // Ninety days and twenty ops: the ninety days keep more. The op made
    // exactly ninety days before (day 109 of 199) is not in the last ninety.
    expect(store.checkpoint({ keepDays: 90, keepOps: 20, now })!.seq).toBe(200 - 90);
    // Ten days and twenty ops: the twenty ops keep more.
    expect(store.checkpoint({ keepDays: 10, keepOps: 20, now })!.seq).toBe(200 - 20);
    // Nothing old enough: no checkpoint.
    expect(store.checkpoint({ keepDays: 365, keepOps: 20, now })).toBeUndefined();
  });

  it("never puts the horizon inside a gesture", () => {
    const store = new Store({ schema, mutations: [add, rename], snapshot: { nodes: [], edges: [] } });
    store.apply({ name: "add", args: { id: "t1", label: "One" } });
    store.applyAll([
      { name: "add", args: { id: "t2", label: "Two" } },
      { name: "add", args: { id: "t3", label: "Three" } },
      { name: "add", args: { id: "t4", label: "Four" } },
    ]);
    store.apply({ name: "add", args: { id: "t5", label: "Five" } });
    // seq 2 is the middle of the second gesture: the horizon moves to its start.
    expect(store.checkpoint({ seq: 2 })!.seq).toBe(1);
  });

  it("compacts again behind a later horizon, from the checkpoint it has", () => {
    const { store } = lived(10);
    store.compact(store.checkpoint({ seq: 4 })!);
    const again = store.compact(store.checkpoint({ seq: 8 })!);
    expect(again.ops.map((op) => op.seq)).toEqual([4, 5, 6, 7]);
    expect(again.epochs.map((epoch) => epoch.seq)).toEqual([4]);
    expect(store.log.all().map((op) => op.seq)).toEqual([8, 9]);
    expect(store.verify().ok).toBe(true);
  });
});

describe("undo behind the horizon", () => {
  it("is refused with a sentence naming the horizon", () => {
    const { store } = lived(10);
    const first = store.batches()[0]!.id;
    store.compact(store.checkpoint({ seq: 7 })!);
    const check = store.canUndo(first);
    expect(check.ok).toBe(false);
    expect(check.ok ? "" : check.message).toMatch(/undo horizon at op 7/);
    expect(() => store.undo(first)).toThrow(UndoBlockedError);
    expect(() => store.undo(first)).toThrow(/archived, and undo does not reach behind it/);
  });

  it("still undoes what is after it", () => {
    const { store } = lived(10);
    store.compact(store.checkpoint({ seq: 7 })!);
    const last = store.batches().at(-1)!.id;
    store.undo(last);
    expect(store.graph.getNode("t1")?.label).toBe("Pay the deposit (day 8)");
  });
});
