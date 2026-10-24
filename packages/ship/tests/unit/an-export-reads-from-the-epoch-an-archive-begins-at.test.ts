import { bindSchema, createMemoryAdapter, createSchema, defineApp, defineNode, nodeRef, snapshotHash, Store, type LogArchive, type PersistenceAdapter } from "@graview/core";
import { archiveFrom } from "@graview/core/seat";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { exportBundle, openStore } from "../../src/index.js";

/**
 * AN EXPORT READS FROM THE EPOCH AN ARCHIVE BEGINS AT (FR-214). A host that
 * keeps a plan's window of history deletes what lies behind it and keeps
 * the epoch it made there (`archiveFrom`). A full export read the whole
 * archive and refused one that did not reach back to seq 0; now it carries
 * everything kept — the log from that epoch, `horizon` its seq and the
 * epoch itself as `checkpoint` — and restores as a compacted store opened
 * on it. Any bundle that begins past seq 0 carries its checkpoint, so it
 * restores.
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

/** Twelve gestures, compacted to keep the last four ops: the archive holds seqs 0 to 7. */
async function lived(adapter: PersistenceAdapter<string>) {
  const opened = await openStore({ app, adapter });
  opened.store.apply({ name: "add-task", args: { label: "Sweep" } });
  const id = opened.store.graph.allNodes()[0]!.id;
  for (let n = 1; n < 12; n++) opened.store.apply({ name: "rename-task", args: { id, label: `Sweep ${n}` } });
  await opened.flush();
  await opened.compact({ keepOps: 4, keepDays: 0 });
  const hash = snapshotHash(opened.store.snapshot());
  opened.close();
  return hash;
}

/** The adapter as a host keeps it after deleting what lies behind `seq`: its archive begins at the epoch made there. */
async function windowed(adapter: PersistenceAdapter<string>, seq: number): Promise<PersistenceAdapter<string>> {
  const opened = await openStore({ app, adapter });
  const window: LogArchive = archiveFrom(opened.store, await adapter.loadArchive!("chores"), seq);
  opened.close();
  return Object.assign(Object.create(adapter) as PersistenceAdapter<string>, { loadArchive: async () => window });
}

/** A bundle restored as a host restores one: its log, from its checkpoint when it begins past seq 0. */
const restored = (bundle: Awaited<ReturnType<typeof exportBundle>>) =>
  new Store({ schema, mutations: [add, rename], snapshot: bundle.snapshot as never, log: bundle.log, epochs: bundle.checkpoint ? [bundle.checkpoint] : [] });

describe("an export of a store whose archive begins at an epoch", () => {
  it("carries everything kept from the epoch, and restores as a compacted store opened on it", async () => {
    const adapter = createMemoryAdapter();
    const hash = await lived(adapter);
    const again = await openStore({ app, adapter: await windowed(adapter, 4) });
    const full = await exportBundle(app, again.store, { full: true });
    expect(full.log.map((op) => op.seq)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
    expect(full.horizon).toBe(4);
    expect(full.checkpoint).toMatchObject({ seq: 4, horizon: true, removed: {} });
    const back = restored(full);
    expect(back.verify()).toMatchObject({ ok: true });
    expect(back.log.horizon).toBe(4);
    expect(snapshotHash(back.snapshot())).toBe(hash);
    again.close();
  });

  it("still carries every op ever made when the archive reaches back to seq 0, with no checkpoint", async () => {
    const adapter = createMemoryAdapter();
    await lived(adapter);
    const again = await openStore({ app, adapter });
    const full = await exportBundle(app, again.store, { full: true });
    expect(full.log.map((op) => op.seq)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(full.horizon).toBeUndefined();
    expect(full.checkpoint).toBeUndefined();
    again.close();
  });

  it("carries the store's own checkpoint when it is not full, so the tail restores too", async () => {
    const adapter = createMemoryAdapter();
    const hash = await lived(adapter);
    const again = await openStore({ app, adapter });
    const tail = exportBundle(app, again.store);
    expect(tail.horizon).toBe(8);
    expect(tail.checkpoint).toMatchObject({ seq: 8, horizon: true });
    expect(snapshotHash(restored(tail).snapshot())).toBe(hash);
    expect(restored(tail).verify().ok).toBe(true);
    again.close();
  });

  it("refuses an archive with a gap and no epoch after it that keeps what was removed", async () => {
    const adapter = createMemoryAdapter();
    await lived(adapter);
    const archive = await adapter.loadArchive!("chores");
    const gapped = Object.assign(Object.create(adapter) as PersistenceAdapter<string>, { loadArchive: async () => ({ ops: archive.ops.filter((op) => op.seq !== 2), epochs: [] }) });
    const again = await openStore({ app, adapter: gapped });
    await expect(exportBundle(app, again.store, { full: true })).rejects.toThrow(/seq 2 is missing/);
    again.close();
  });
});
