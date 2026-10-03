import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, snapshotHash, Store, UndoBlockedError, type PersistenceAdapter } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createBrowserAdapter, createFileAdapter, createStoreHandler, exportBundle, openStore } from "../../src/index.js";

/**
 * FR-23. A host bounds memory and wake time: an app used daily for a year
 * carried every op into every open. Compacting makes a checkpoint (the
 * graph at seq N) the undo horizon and has the adapter archive the ops
 * before it, so an open loads the checkpoint and the tail and nothing
 * older, undo behind the horizon is refused by a sentence naming it, and a
 * full export still carries every op ever made.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  description: "Add one.",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "t"), kind: "task", label: args.label } as never);
  },
});
const rename = defineMutation("rename-task", {
  title: "Rename the task",
  description: "Call it something else.",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const app = defineApp({ name: "chores", schema, mutations: [add, rename], invariants: [] });

const scratches: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "graview-compact-"));
  scratches.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of scratches.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** An adapter that remembers whether anything asked for its archive. */
function watched<A extends PersistenceAdapter<string>>(adapter: A): A & { archiveReads: number } {
  const counted = Object.assign(Object.create(adapter) as A, { archiveReads: 0 });
  if (adapter.loadArchive) {
    counted.loadArchive = async (scope: string) => {
      counted.archiveReads++;
      return adapter.loadArchive!(scope);
    };
  }
  return counted;
}

/** Twelve gestures on one task, compacted to keep the last four ops. */
async function lived(adapter: PersistenceAdapter<string>) {
  const opened = await openStore({ app, adapter });
  const first = opened.store.apply({ name: "add-task", args: { label: "Sweep" } });
  const id = opened.store.graph.allNodes()[0]!.id;
  for (let n = 1; n < 12; n++) opened.store.apply({ name: "rename-task", args: { id, label: `Sweep ${n}` } });
  await opened.flush();
  const hash = snapshotHash(opened.store.snapshot());
  const compaction = await opened.compact({ keepOps: 4, keepDays: 0 });
  opened.close();
  return { first: first.batch, id, hash, compaction };
}

const adapters: [string, () => PersistenceAdapter<string>][] = [
  ["memory", () => createMemoryAdapter()],
  ["file", () => createFileAdapter(scratch())],
];

describe.each(adapters)("a compacted store, on the %s adapter", (_name, make) => {
  it("opens on only the checkpoint and the tail", async () => {
    const adapter = watched(make());
    const { hash, compaction } = await lived(adapter);
    expect(compaction).toMatchObject({ horizon: 8, archived: 8 });

    const again = await openStore({ app, adapter, verify: true });
    expect(adapter.archiveReads).toBe(0);
    expect(again.store.log.horizon).toBe(8);
    expect(again.store.log.all().map((op) => op.seq)).toEqual([8, 9, 10, 11]);
    expect(again.store.log.epochs()).toHaveLength(1);
    expect(again.store.log.epochs()[0]).toMatchObject({ seq: 8, horizon: true });
    expect(snapshotHash(again.store.snapshot())).toBe(hash);
    expect(again.verified?.ok).toBe(true);
    // It counts on from where the log left off, ids and all.
    const next = again.store.apply({ name: "rename-task", args: { id: again.store.graph.allNodes()[0]!.id, label: "Swept" } });
    expect(next.ops[0]!.seq).toBe(12);
    await again.flush();
    again.close();
    const third = await openStore({ app, adapter, verify: true });
    expect(third.verified?.ok).toBe(true);
    expect(third.store.log.length).toBe(13);
    third.close();
  });

  it("refuses undo behind the horizon with a sentence naming it", async () => {
    const adapter = make();
    const { first } = await lived(adapter);
    const again = await openStore({ app, adapter });
    const check = again.store.canUndo(first);
    expect(check.ok).toBe(false);
    expect(check.ok ? "" : check.message).toMatch(/not after the undo horizon at op 8/);
    expect(() => again.store.undo(first)).toThrow(UndoBlockedError);
    // What is after it still comes undone.
    again.store.undo(again.store.batches().at(-1)!.id);
    expect(again.store.graph.allNodes()[0]!.label).toBe("Sweep 10");
    again.close();
  });

  it("exports every op ever made when the export is full, and says where the log begins when it is not", async () => {
    const adapter = make();
    await lived(adapter);
    const again = await openStore({ app, adapter });
    const full = await exportBundle(app, again.store, { full: true });
    expect(full.log.map((op) => op.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(full.horizon).toBeUndefined();
    const tail = exportBundle(app, again.store);
    expect(tail.log.map((op) => op.seq)).toEqual([8, 9, 10, 11]);
    expect(tail.horizon).toBe(8);
    again.close();
  });
});

describe("compaction where it cannot be kept", () => {
  it("is refused by the browser adapter, which keeps no epochs and so no checkpoint", async () => {
    const entries = new Map<string, string>();
    const storage = { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => void entries.set(k, v), removeItem: (k: string) => void entries.delete(k) };
    const opened = await openStore({ app, adapter: createBrowserAdapter({ storage }) });
    opened.store.apply({ name: "add-task", args: { label: "Sweep" } });
    await expect(opened.compact({ seq: 1 })).rejects.toThrow(/keeps no archive/);
    expect(opened.store.log.horizon).toBe(0);
    opened.close();
  });

  it("refuses a full export of a compacted store whose archive it cannot reach", async () => {
    const adapter = createMemoryAdapter();
    await lived(adapter);
    const again = await openStore({ app, adapter });
    const loose = new Store({ schema, mutations: [add, rename], snapshot: again.store.snapshot(), log: again.store.log.all(), epochs: again.store.log.epochs() });
    await expect(exportBundle(app, loose, { full: true })).rejects.toThrow(/archive/);
    again.close();
  });
});

describe("the file adapter's archive", () => {
  it("is plain lines beside the log, where a person can read it", async () => {
    const adapter = createFileAdapter(scratch());
    await lived(adapter);
    const archived = readFileSync(join(adapter.root, "chores", "archive", "log.jsonl"), "utf8").trim().split("\n");
    expect(archived.map((line) => (JSON.parse(line) as { seq: number }).seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const tail = readFileSync(join(adapter.root, "chores", "log.jsonl"), "utf8").trim().split("\n");
    expect(tail).toHaveLength(4);
  });
});

describe("a compacted store over the wire", () => {
  it("hands a client the tail and the horizon, and the client's log begins there", async () => {
    const adapter = createMemoryAdapter();
    await lived(adapter);
    const handler = await createStoreHandler({ app, adapter, seatOf: () => ({ kind: "human", id: "u1" }) });
    const state = (await (await handler.handle(new Request("http://x/graview/state"))).json()) as { horizon?: number; log: { seq: number }[]; snapshot: never };
    expect(state.horizon).toBe(8);
    expect(state.log.map((op) => op.seq)).toEqual([8, 9, 10, 11]);
    const since = (await (await handler.handle(new Request("http://x/graview/since?seq=9"))).json()) as { ops: { seq: number }[] };
    expect(since.ops.map((op) => op.seq)).toEqual([10, 11]);
    const client = new Store({ schema, mutations: [add, rename], snapshot: state.snapshot, log: state.log as never, horizon: state.horizon! });
    expect(client.log.length).toBe(12);
    await handler.close();
  });
});
