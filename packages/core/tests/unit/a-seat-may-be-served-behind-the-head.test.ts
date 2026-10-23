import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "../../src/index.js";
import { pastOf } from "../../src/past.js";

/**
 * THE HOOKS A PUBLISHING LIFECYCLE NEEDS, MADE TRUE BEFORE 1.0
 * (Roadmap f-1-0-publishing-hooks). What a seat is served may end before
 * the store's head — narrowing by seq, as FR-55 narrows by record — so no
 * contract may say a seat's view is the head: the view says where it is
 * served through (`servedSeq`, the head today), its cache is keyed by what
 * serving reads, and a compaction never passes a seq somebody is served at.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "t"), kind: "task", label: args.label } as never);
  },
});
const rename = defineMutation("rename-task", {
  title: "Rename the task",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const policy = { grants: [{ roles: ["keeper"], mutations: "*" as const }], sees: [{ roles: ["keeper"], kinds: ["task"] }] };
const kim: Principal = { kind: "human", id: "kim", name: "Kim", roles: ["keeper"] };

const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}T00:00:00.000Z`;
function lived(gestures = 10) {
  let at = 1;
  const store = new Store({ schema, mutations: [add, rename], policy, now: () => day(at) });
  store.apply({ name: "add-task", args: { label: "Sweep" } }, { author: kim });
  const id = store.graph.allNodes()[0]!.id;
  for (let n = 1; n < gestures; n++) {
    at = Math.min(n + 1, 28);
    store.apply({ name: "rename-task", args: { id, label: `Sweep ${n}` } }, { author: kim });
  }
  return { store, id };
}

describe("a seat's served state says where it ends", () => {
  it("a store, and a seat's view of it, are served through the head, which moves as the log grows", () => {
    const { store, id } = lived(3);
    const view = store.seenBy(kim);
    expect(view).not.toBe(store);
    expect(store.servedSeq).toBe(store.log.length);
    expect(view.servedSeq).toBe(store.log.length);
    store.apply({ name: "rename-task", args: { id, label: "Swept" } }, { author: kim });
    expect(view.servedSeq).toBe(store.log.length);
  });

  it("a past is served through its own seq, and so is a seat's view of it", () => {
    const { store } = lived(5);
    const past = pastOf(store, 2);
    expect(past.servedSeq).toBe(2);
    expect(past.seenBy(kim).servedSeq).toBe(2);
    expect(pastOf(store.seenBy(kim), 3).servedSeq).toBe(3);
  });

  it("is read-only: nothing sets where a seat is served through", () => {
    const { store } = lived(2);
    expect(() => {
      (store as { servedSeq: number }).servedSeq = 0;
    }).toThrow(TypeError);
    expect(() => {
      (store.seenBy(kim) as { servedSeq: number }).servedSeq = 0;
    }).toThrow(TypeError);
    expect(store.servedSeq).toBe(store.log.length);
  });
});

describe("a seat's view is kept by what serving reads", () => {
  it("is shared by the tabs and names of one seat, and apart for another seat's roles, id or agency", () => {
    const { store } = lived(2);
    const view = store.seenBy(kim);
    expect(store.seenBy({ ...kim, session: "tab-2" })).toBe(view);
    expect(store.seenBy({ ...kim, name: "Kimberly" })).toBe(view);
    expect(store.seenBy({ ...kim, roles: [] })).not.toBe(view);
    expect(store.seenBy({ ...kim, id: "sam" })).not.toBe(view);
    expect(store.seenBy({ kind: "agent", id: "helper", roles: ["keeper"], onBehalfOf: kim })).not.toBe(view);
  });

  it("is a past's own, apart from the head's, for the same seat", () => {
    const { store } = lived(4);
    expect(pastOf(store, 2).seenBy(kim)).not.toBe(store.seenBy(kim));
    expect(pastOf(store, 2).seenBy(kim).graph.allNodes()[0]).toMatchObject({ label: "Sweep 1" });
  });
});

describe("a compaction never passes a seq somebody is served at", () => {
  it("stops the horizon at the lowest pin, so the reader's past still folds from the log", () => {
    const { store } = lived(12);
    const checkpoint = store.checkpoint({ seq: 9, pins: [6, 4] });
    expect(checkpoint?.seq).toBe(4);
    store.compact(checkpoint!);
    expect(store.log.horizon).toBe(4);
    expect(pastOf(store, 4).graph.allNodes()[0]).toMatchObject({ label: "Sweep 3" });
  });

  it("holds the days and the ops kept to the pin as well as a seq asked for", () => {
    const { store } = lived(12);
    expect(store.checkpoint({ keepOps: 2, keepDays: 0, now: day(28) })?.seq).toBe(10);
    expect(store.checkpoint({ keepOps: 2, keepDays: 0, now: day(28), pins: [5] })?.seq).toBe(5);
  });

  it("compacts nothing when a pin is at the horizon, and is not held back by a pin past the head", () => {
    const { store } = lived(12);
    expect(store.checkpoint({ seq: 9, pins: [0] })).toBeUndefined();
    expect(store.checkpoint({ seq: 9, pins: [store.log.length + 5] })?.seq).toBe(9);
  });

  it("without a pin, a compaction past a reader's seq leaves that past unreadable from the log", () => {
    const { store } = lived(12);
    store.compact(store.checkpoint({ seq: 9 })!);
    expect(() => pastOf(store, 4)).toThrow(RangeError);
  });
});
