import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, FieldRevisions, NEVER_WRITTEN, nodeRef, Store, writtenBy } from "../../src/index.js";

/**
 * EVERY FIELD CARRIES THE SEQ THAT LAST WROTE IT (FR-05), read off the log.
 *
 * A stale write is refused by comparing the revision a call says it saw
 * with the field's revision now. The revision is derived, not stored: the
 * snapshot and op formats are unchanged, and any two parties folding one
 * log agree on it.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), note: z.string().optional() }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add", {
  title: "Add",
  input: z.object({ id: z.string(), label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "task", label: args.label } as never);
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const annotate = defineMutation("annotate", {
  title: "Note",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), note: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { note: args.note });
  },
});
const seed = { nodes: [{ id: "t1", kind: "task", label: "Seeded" }] as never, edges: [] };

describe("field revisions", () => {
  it("gives each field the seq of the op that last wrote it, and a seeded field none", () => {
    const store = new Store({ schema, mutations: [add, rename, annotate], snapshot: seed });
    expect(FieldRevisions.of(store.log.all()).of("t1", "label")).toBe(NEVER_WRITTEN);
    store.apply({ name: "add", args: { id: "t2", label: "Two" } });
    const renamed = store.apply({ name: "rename", args: { id: "t1", label: "One" } });
    const undone = store.undo(renamed.batch);
    store.apply({ name: "annotate", args: { id: "t1", note: "Soon" } });
    const revisions = FieldRevisions.of(store.log.all());
    expect(revisions.of("t2", "label")).toBe(0);
    // The undo wrote the label back: that is its revision now.
    expect(revisions.of("t1", "label")).toBe(undone.ops[0]!.seq);
    expect(revisions.of("t1", "note")).toBe(3);
    expect(revisions.of("t1", "nothing")).toBe(NEVER_WRITTEN);
  });

  it("only moves forward, keeps up as ops are noted, and says which claims are stale", () => {
    const store = new Store({ schema, mutations: [add, rename, annotate], snapshot: seed });
    const revisions = FieldRevisions.of([]);
    store.subscribe((_diff, ops) => revisions.note(ops));
    store.apply({ name: "rename", args: { id: "t1", label: "A" } });
    store.apply({ name: "rename", args: { id: "t1", label: "B" } });
    revisions.note(store.log.all().slice(0, 1));
    expect(revisions.of("t1", "label")).toBe(1);
    expect(revisions.stale([{ node: "t1", field: "label", rev: 0 }, { node: "t1", field: "note", rev: NEVER_WRITTEN }])).toEqual([{ node: "t1", field: "label", rev: 0 }]);
  });

  it("makes a call's base of the fields it patches, leaving out records it adds and fields an earlier pending call wrote", () => {
    const store = new Store({ schema, mutations: [add, rename, annotate], snapshot: seed });
    store.apply({ name: "rename", args: { id: "t1", label: "A" } });
    const revisions = FieldRevisions.of(store.log.all());
    const earlier = store.apply({ name: "annotate", args: { id: "t1", note: "Mine" } });
    const made = store.applyAll([
      { name: "add", args: { id: "t9", label: "Nine" } },
      { name: "rename", args: { id: "t9", label: "Nine again" } },
      { name: "rename", args: { id: "t1", label: "B" } },
      { name: "annotate", args: { id: "t1", note: "Mine again" } },
    ]);
    expect(revisions.baseFor(made.ops, writtenBy(earlier.ops))).toEqual([{ node: "t1", field: "label", rev: 0 }]);
  });

  /*
   * A LOG THAT BEGINS AT A HORIZON (FR-23, Roadmap f-heavy-apps-fast): a
   * page opened on the snapshot and a short tail knows nothing of a field
   * written before the tail, only that it was written before it. It is at
   * the seq before the horizon, and the server, holding the whole log,
   * takes a claim at or after a field's revision as seen: only a write
   * since the claim is stale.
   */
  it("puts a field no op of a tail wrote at the seq before the tail, and takes a claim at or after a field's revision as seen", () => {
    const store = new Store({ schema, mutations: [add, rename, annotate], snapshot: seed });
    for (const label of ["A", "B", "C"]) store.apply({ name: "rename", args: { id: "t1", label } });
    store.apply({ name: "annotate", args: { id: "t1", note: "Soon" } });
    const whole = FieldRevisions.of(store.log.all());
    const tail = FieldRevisions.of(store.log.all().slice(3), { horizon: 3 });
    // The label was last written at seq 2, before the tail: the tail says "before 3".
    expect(tail.of("t1", "label")).toBe(2);
    expect(tail.of("t1", "note")).toBe(3);
    expect(tail.of("t1", "nothing")).toBe(2);
    const claims = [
      { node: "t1", field: "label", rev: tail.of("t1", "label") },
      { node: "t1", field: "note", rev: tail.of("t1", "note") },
    ];
    // The whole log does not call the tail's claims stale; a write since a claim is.
    expect(whole.stale(claims)).toEqual([]);
    expect(whole.stale([{ node: "t1", field: "label", rev: 1 }])).toEqual([{ node: "t1", field: "label", rev: 1 }]);
    store.apply({ name: "rename", args: { id: "t1", label: "D" } });
    expect(FieldRevisions.of(store.log.all()).stale(claims)).toEqual([claims[0]]);
    expect(FieldRevisions.of([], { horizon: 0 }).of("t1", "label")).toBe(NEVER_WRITTEN);
  });
});
