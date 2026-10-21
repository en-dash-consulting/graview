import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, PastError, Store, type LogArchive, type Principal } from "../../src/index.js";
import type { HistoryHost } from "../../src/history.js";
import { askArchived, pastAt, pastOf } from "../../src/past.js";

/**
 * THE PAST BEHIND THE HORIZON IS READ FROM THE HOST'S ARCHIVE (FR-196). A
 * compacted store holds a checkpoint and a short tail; what it archived is
 * the host's. Given `HistoryHost.archived(from, to)`, playback asks for the
 * ops (and the epochs) of a range behind the horizon, in chunks and once,
 * and folds the moment from the nearest epoch it was handed — read, never
 * changed, and drawn exactly as the uncompacted store stood there.
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
const me: Principal = { kind: "human", id: "nick" };

/** A store with `gestures` changes, one a minute: a task added, then renamed. Seeded with one task when `seeded`. */
function built(gestures: number, seeded = false) {
  let minute = 0;
  const at = () => new Date(Date.UTC(2026, 9, 13, 9, minute)).toISOString();
  const snapshot = { nodes: seeded ? [{ id: "seed", kind: "task", label: "From the seed", done: false }] : [], edges: [] } as never;
  const store = new Store({ schema, mutations: [add, rename], snapshot, now: at });
  for (minute = 0; minute < gestures; minute++) {
    const n = Math.floor(minute / 2);
    if (minute % 2 === 0) store.apply({ name: "add", args: { id: `t${n}`, label: `Task ${n}` } }, { author: me });
    else store.apply({ name: "rename", args: { id: `t${n}`, label: `Task ${n}, renamed` } }, { author: me });
  }
  return store;
}

const sorted = (snapshot: { nodes: readonly { id: string }[]; edges: readonly { kind: string; from: string; to: string }[] }) => ({
  nodes: [...snapshot.nodes].sort((a, b) => a.id.localeCompare(b.id)),
  edges: [...snapshot.edges].map((edge) => `${edge.kind}:${edge.from}->${edge.to}`).sort(),
});

/** A host whose archive is what the compactions moved out, served a range at a time, as a bucket of ops and checkpoints would be. */
function archiveHost(archives: readonly LogArchive[]) {
  const asked: [number, number][] = [];
  const ops = archives.flatMap((one) => one.ops);
  const epochs = archives.flatMap((one) => one.epochs);
  const host: HistoryHost = {
    archived: async (from, to) => {
      asked.push([from, to]);
      return { ops: ops.filter((op) => op.seq >= from && op.seq < to), epochs: epochs.filter((epoch) => epoch.seq >= from && epoch.seq < to) };
    },
  };
  return { host, asked };
}

/** Asks until the archive has handed every range the moment needs; what it says when it cannot. */
async function read(store: Store<typeof schema>, seq: number, host: HistoryHost) {
  for (let turn = 0; turn < 20; turn++) {
    const answer = askArchived(store, seq, host);
    if (!answer) return undefined;
    if ("refused" in answer) return answer.refused;
    await answer.waiting;
  }
  throw new Error("the archive never finished");
}

describe("the past behind the horizon", () => {
  it("is the uncompacted store's graph at seq 1, folded from the archived ops the host hands back", async () => {
    const whole = built(40);
    const store = built(40);
    const archive = store.compact(store.checkpoint({ seq: 30 })!);
    expect(store.log.horizon).toBe(30);
    expect(() => pastOf(store, 1)).toThrow(/archive/);
    const { host, asked } = archiveHost([archive]);
    expect(await read(store, 1, host)).toBeUndefined();
    const past = pastAt(store, 1, host);
    expect(sorted(past.graph.snapshot())).toEqual(sorted(pastOf(whole, 1).graph.snapshot()));
    expect(past.past).toMatchObject({ seq: 1, at: whole.log.all()[0]!.at });
    // Every moment behind the horizon, and the first ones after it, as the whole store stood.
    for (let seq = 0; seq <= 35; seq++) {
      expect(await read(store, seq, host)).toBeUndefined();
      expect(sorted(pastAt(store, seq, host).graph.snapshot()), `seq ${seq}`).toEqual(sorted(pastOf(whole, seq).graph.snapshot()));
    }
    // One chunk, asked once: scrubbing through it asks nothing more.
    expect(asked).toEqual([[0, 30]]);
  });

  it("folds from the nearest epoch the host hands, a seed's included, across two compactions", async () => {
    const whole = built(60, true);
    const store = built(60, true);
    const first = store.compact(store.checkpoint({ seq: 20 })!);
    const second = store.compact(store.checkpoint({ seq: 50 })!);
    expect(second.epochs.map((epoch) => epoch.seq)).toEqual([20]);
    const { host } = archiveHost([first, second]);
    for (const seq of [0, 1, 19, 20, 21, 49]) {
      expect(await read(store, seq, host)).toBeUndefined();
      expect(sorted(pastAt(store, seq, host).graph.snapshot()), `seq ${seq}`).toEqual(sorted(pastOf(whole, seq).graph.snapshot()));
    }
    expect(pastAt(store, 0, host).graph.getNode("seed")).toMatchObject({ label: "From the seed" });
  });

  it("is fetched in chunks from the moment back, and each chunk once, never per tick", async () => {
    const store = built(700);
    const archive = store.compact(store.checkpoint({ seq: 600 })!);
    // Only the ops: no epoch behind the horizon, so the fold reaches back to an empty seq 0.
    const { host, asked } = archiveHost([{ ops: archive.ops, epochs: [] }]);
    expect(await read(store, 590, host)).toBeUndefined();
    expect(asked).toEqual([
      [512, 600],
      [256, 512],
      [0, 256],
    ]);
    for (let seq = 1; seq < 600; seq += 7) expect(await read(store, seq, host)).toBeUndefined();
    expect(asked).toHaveLength(3);
    expect(sorted(pastAt(store, 300, host).graph.snapshot())).toEqual(sorted(pastOf(built(700), 300).graph.snapshot()));
  });

  it("accepts a bare list of ops for an answer", async () => {
    const store = built(20);
    const archive = store.compact(store.checkpoint({ seq: 10 })!);
    const host: HistoryHost = { archived: async (from, to) => archive.ops.filter((op) => op.seq >= from && op.seq < to) };
    expect(await read(store, 3, host)).toBeUndefined();
    expect(sorted(pastAt(store, 3, host).graph.snapshot())).toEqual(sorted(pastOf(built(20), 3).graph.snapshot()));
  });

  it("says so when the host refuses, fails or leaves a gap, and leaves the present untouched", async () => {
    const store = built(20);
    const archive = store.compact(store.checkpoint({ seq: 10 })!);
    const now = sorted(store.graph.snapshot());
    const refusing: HistoryHost = { archived: () => Promise.reject(new Error("Forbidden")) };
    expect(await read(store, 3, refusing)).toMatch(/Forbidden/);
    expect(() => pastAt(store, 3, refusing)).toThrow(/Forbidden/);
    const gap: HistoryHost = { archived: async () => ({ ops: archive.ops.filter((op) => op.seq !== 2) }) };
    expect(await read(store, 5, gap)).toMatch(/missing a change this moment needs \(seq 2\)/);
    const throwing: HistoryHost = {
      archived: () => {
        throw new Error("No archive here");
      },
    };
    expect(await read(store, 5, throwing)).toMatch(/No archive here/);
    expect(sorted(store.graph.snapshot())).toEqual(now);
    expect(store.log.length).toBe(20);
    expect(store.log.horizon).toBe(10);
  });

  it("is read, never changed, and the undo horizon stays where the compaction put it", async () => {
    const store = built(20);
    const archive = store.compact(store.checkpoint({ seq: 10 })!);
    const { host } = archiveHost([archive]);
    await read(store, 4, host);
    const past = pastAt(store, 4, host);
    expect(past.allMutations()).toEqual([]);
    expect(() => past.apply({ name: "add", args: { id: "x", label: "X" } })).toThrow();
    expect(() => past.applyPrimitives([{ op: "addNode", node: { id: "x", kind: "task", label: "X" } } as never])).toThrow(PastError);
    expect(store.log.horizon).toBe(10);
    expect(store.batches().every((batch) => batch.ops[0]!.seq >= 10)).toBe(true);
  });

  it("asks nothing in front of the horizon, nor of a host without an archive", () => {
    const store = built(20);
    store.compact(store.checkpoint({ seq: 10 })!);
    const asked: number[] = [];
    const host: HistoryHost = { archived: async (from) => (asked.push(from), []) };
    expect(askArchived(store, 12, host)).toBeUndefined();
    expect(askArchived(store, 3, {})).toBeUndefined();
    expect(() => pastAt(store, 3, {})).toThrow(/archive/);
    expect(asked).toEqual([]);
  });
});
