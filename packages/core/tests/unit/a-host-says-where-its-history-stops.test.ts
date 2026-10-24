import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, Store, type Epoch, type Operation, type Principal } from "../../src/index.js";
import type { HistoryHost } from "../../src/history.js";
import { askArchived, keptOf, pastAt, pastOf } from "../../src/past.js";

/**
 * A HOST SAYS WHERE ITS HISTORY STOPS (FR-213). A plan that keeps the full
 * history for thirty days refuses `archived` behind that, and the timeline
 * said "The archive could not be read" with an alert. Now a host says the
 * time its history is kept since (`HistoryHost.kept`), and playback never
 * asks the archive for a range wholly before it; and an archive's answer
 * may say the seq it holds every op from (`keptFrom`), so the moments
 * behind it are only the ones it kept whole — its epochs, stepped through
 * as stops — and a moment between them is before what is kept, never a
 * refusal.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
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
const me: Principal = { kind: "human", id: "nick" };

/** The time of minute `minute` past nine: each gesture is made a minute after the one before. */
const minuteOf = (minute: number) => new Date(Date.UTC(2026, 9, 13, 9, minute)).toISOString();

/** A store of `gestures` tasks added a minute apart, compacted at `horizon`, and what the compaction archived. */
function built(gestures: number, horizon?: number) {
  let minute = 0;
  const store = new Store({ schema, mutations: [add], snapshot: { nodes: [], edges: [] }, now: () => minuteOf(minute) });
  for (minute = 0; minute < gestures; minute++) store.apply({ name: "add", args: { id: `t${minute}`, label: `Task ${minute}` } }, { author: me });
  const archive = horizon === undefined ? undefined : store.compact(store.checkpoint({ seq: horizon })!);
  return { store, archive };
}

/** Asks until the archive has handed every range the moment needs; what it says when it cannot. */
async function read(store: Store<typeof schema>, seq: number, host: HistoryHost) {
  for (let turn = 0; turn < 20; turn++) {
    const answer = askArchived(store, seq, host);
    if (!answer || !("waiting" in answer)) return answer;
    await answer.waiting;
  }
  throw new Error("the archive never finished");
}

const KEPT = { sentence: "The Free plan keeps 30 days of history.", action: { label: "See plans", href: "/plans" } };

describe("a host says where its history stops", () => {
  it("never asks the archive for a range wholly before the time its history is kept since, and says the moment is before it rather than refused", async () => {
    const { store } = built(40, 30);
    const asked: [number, number][] = [];
    // Kept since 9:35: every archived change, made by 9:29, is before it.
    const host: HistoryHost = { kept: { since: minuteOf(35), ...KEPT }, archived: async (from, to) => (asked.push([from, to]), { ops: [] }) };
    expect(await read(store, 5, host)).toEqual({ seq: 5, behindKept: true });
    expect(await read(store, 29, host)).toEqual({ seq: 29, behindKept: true });
    expect(asked).toEqual([]);
    // The scrubber stops at nothing behind the horizon, and every moment through 9:35 is at or before it.
    expect(keptOf(store, host)).toEqual({ stops: [], from: 30, through: 36 });
  });

  it("asks a range that reaches into the time it is kept since, and folds every moment it hands", async () => {
    const whole = built(40).store;
    const { store, archive } = built(40, 30);
    const asked: [number, number][] = [];
    const host: HistoryHost = { kept: { since: minuteOf(20), ...KEPT }, archived: async (from, to) => (asked.push([from, to]), archive!) };
    expect(await read(store, 25, host)).toBeUndefined();
    expect(asked).toEqual([[0, 30]]);
    expect(pastAt(store, 25, host).graph.snapshot()).toEqual(pastOf(whole, 25).graph.snapshot());
    // Read, the archive says the moments through seq 21 were made by 9:20: the scrubber stops at the seed's epoch, kept whole, and from there.
    expect(keptOf(store, host)).toEqual({ stops: [0, ...Array.from({ length: 9 }, (_, at) => 21 + at)], from: 21, through: 21 });
  });

  it("steps the past behind an answer's keptFrom by the epochs it kept, and a moment between them is before what is kept, never refused", async () => {
    const whole = built(40).store;
    const { store, archive } = built(40, 30);
    const epochAt = (seq: number): Epoch => whole.checkpoint({ seq })!;
    const kept = { ops: archive!.ops.filter((op: Operation) => op.seq >= 12), epochs: [epochAt(5), epochAt(12)], keptFrom: 12 };
    const asked: [number, number][] = [];
    const host: HistoryHost = { archived: async (from, to) => (asked.push([from, to]), kept) };
    expect(await read(store, 8, host)).toEqual({ seq: 8, behindKept: true });
    expect(await read(store, 5, host)).toBeUndefined();
    expect(pastAt(store, 5, host).graph.snapshot()).toEqual(pastOf(whole, 5).graph.snapshot());
    expect(await read(store, 12, host)).toBeUndefined();
    expect(pastAt(store, 12, host).graph.snapshot()).toEqual(pastOf(whole, 12).graph.snapshot());
    expect(await read(store, 20, host)).toBeUndefined();
    expect(pastAt(store, 20, host).graph.snapshot()).toEqual(pastOf(whole, 20).graph.snapshot());
    // Asked once; behind seq 12 the scrubber stops only where an epoch was kept.
    expect(asked).toEqual([[0, 30]]);
    expect(keptOf(store, host)).toEqual({ stops: [5, ...Array.from({ length: 18 }, (_, at) => 12 + at)], from: 12, through: -1 });
  });

  it("is every seq from the start until the host says otherwise", () => {
    const { store } = built(12, 6);
    expect(keptOf(store, { archived: async () => ({ ops: [] }) })).toEqual({ stops: [0, 1, 2, 3, 4, 5], from: 0, through: -1 });
    expect(keptOf(store, {})).toBeUndefined();
  });
});
