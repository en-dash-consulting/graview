import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, FORMATS, formatStamp, PUBLISH, Store, type Principal, type Publishing } from "../../src/index.js";
import "../../src/publishing.js";

/**
 * A CHECKPOINT ASKED FOR FORMAT 1 HOLDS THE HORIZON AT WHAT STOOD
 * PUBLISHED (FR-31, Roadmap f-publishing-lifecycle). A checkpoint past
 * what stood published at its seq keeps the app as readers are served
 * there (`Epoch.published`) and is snapshot format 2. `format: 1` on
 * `store.checkpoint` holds the horizon at that publish instead — and
 * again where that lands past an earlier one — wherever the days, the ops
 * and the pins would have put it, so the store stays readable by a build
 * before format 2; the checkpoint's seq says where it stopped.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-note", {
  title: "Add a note",
  creates: ["note"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "n"), kind: "note", label: args.label } as never);
  },
});
const editor: Principal = { kind: "human", id: "pat", name: "Pat", roles: ["editor"] };
const reader: Principal = { kind: "human", id: "rae", name: "Rae", roles: ["reader"] };
const publishing: Publishing = { mode: "on-publish", working: ["editor"], publishers: ["editor"] };
const policy = { grants: [{ roles: ["editor"], mutations: "*" as const }], sees: [{ roles: "*" as const, kinds: ["note"] }] };

const fresh = () => new Store({ schema, mutations: [add], policy, publishing, snapshot: { nodes: [], edges: [] } as never });
const note_ = (store: Store<typeof schema>, label: string) => store.apply({ name: "add-note", args: { label } }, { author: editor });
const publish = (store: Store<typeof schema>, through?: number) => store.apply({ name: PUBLISH, args: through === undefined ? {} : { through } }, { author: editor }).ops[0]!.publishedThrough!;
const readerSees = (store: Store<typeof schema>) => store.seenBy(reader).graph.allNodes().map((node) => node.label).sort();

/** One note, a publish, two notes, a publish, two notes: P1 and P2 are what each publish served readers through. */
function publishedTwice() {
  const store = fresh();
  note_(store, "One");
  const p1 = publish(store);
  note_(store, "Two");
  note_(store, "Three");
  const p2 = publish(store);
  note_(store, "Four");
  note_(store, "Five");
  return { store, p1, p2 };
}

describe("a checkpoint asked for format 1 holds the horizon at what stood published", () => {
  it("stops at the publish standing where the days and ops would have put the horizon, and is stamped 1", () => {
    const { store, p1, p2 } = publishedTwice();
    const asked = store.checkpoint({ keepOps: 3, keepDays: 0 })!;
    expect(asked.seq).toBeGreaterThan(p1);
    expect(asked.seq).toBeLessThan(p2);
    expect(formatStamp(asked).formats.snapshot).toBe(2);

    const held = store.checkpoint({ keepOps: 3, keepDays: 0, format: 1 })!;
    expect(held.seq).toBe(p1);
    expect(held.published).toBeUndefined();
    expect(held.publishedThrough).toBe(p1);
    expect(formatStamp(held).formats.snapshot).toBe(1);
    store.compact(held);
    expect(store.log.horizon).toBe(p1);
    expect(readerSees(store)).toEqual(["One", "Three", "Two"]);
  });

  it("holds it there whatever the pins say, and makes no checkpoint when that publish is the horizon already", () => {
    const { store, p1, p2 } = publishedTwice();
    const pinned = store.checkpoint({ keepOps: 3, keepDays: 0, pins: [store.publishedSeq!] })!;
    expect(pinned.seq).toBeGreaterThan(p1);
    expect(formatStamp(pinned).formats.snapshot).toBe(2);
    const held = store.checkpoint({ keepOps: 3, keepDays: 0, pins: [store.publishedSeq!], format: 1 })!;
    expect(held.seq).toBe(p1);
    store.compact(held);

    // Nothing moves until the standing publish is past the horizon: at P2 the horizon lands on it, and is format 1 there.
    expect(store.checkpoint({ keepOps: 3, keepDays: 0, format: 1 })).toBeUndefined();
    const atLatest = store.checkpoint({ seq: p2, format: 1 })!;
    expect(atLatest.seq).toBe(p2);
    expect(formatStamp(atLatest).formats.snapshot).toBe(1);
  });

  it("steps back through more than one publish, and past one that took an earlier seq back, until the stamp says 1", () => {
    const store = fresh();
    note_(store, "One");
    const p1 = publish(store);
    note_(store, "Two");
    const p2 = publish(store);
    note_(store, "Three");
    const p3 = publish(store);
    note_(store, "Four");
    // Between P2 and P3: held at P2, not at P1.
    const held = store.checkpoint({ seq: p3 - 1, format: 1 })!;
    expect(held.seq).toBe(p2);
    expect(held.seq).toBeGreaterThan(p1);
    expect(formatStamp(held).formats.snapshot).toBe(1);

    // A publish that takes readers back to P1 stands at the head: a horizon past P1 is held at P1.
    const back = publish(store, p1);
    expect(back).toBe(p1);
    expect(store.publishedSeq).toBe(p1);
    const taken = store.checkpoint({ seq: p3, format: 1 })!;
    expect(taken.seq).toBe(p1);
    expect(formatStamp(taken).formats.snapshot).toBe(1);
    store.compact(taken);
    expect(readerSees(store)).toEqual(["One"]);
  });

  it("writes this build's format unless asked, and refuses a format it does not write", () => {
    const { store, p1 } = publishedTwice();
    expect(store.checkpoint({ keepOps: 3, keepDays: 0, format: FORMATS.snapshot })!.seq).toBeGreaterThan(p1);
    expect(() => store.checkpoint({ keepOps: 3, keepDays: 0, format: FORMATS.snapshot + 1 })).toThrow(RangeError);
    expect(() => store.checkpoint({ keepOps: 3, keepDays: 0, format: 0 })).toThrow(/formats 1 to 2/);
  });
});
