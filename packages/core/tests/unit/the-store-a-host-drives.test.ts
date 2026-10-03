import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, GraphError, nodeRef, ReceiveError, Store, UndoBlockedError } from "../../src/index.js";

/**
 * FR-18. A host — Graview Cloud's room, a server, a migration — drives a
 * store rather than a person at a keyboard. It used to pass its own clock,
 * call `describe` itself to keep each op's sentence, preview a whole batch on
 * a copy, append its own ops through `receive`, and call `canUndo` before
 * every undo to tell a blocked one from any other error.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks" });
const schema = createSchema([task]);
const { defineMutation, defineInvariant } = bindSchema(schema);

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
    ctx.graph.getNode(args.id);
    ctx.patchNode(args.id, { label: args.label });
  },
});
const noBlank = defineInvariant("no-blank", {
  scope: { kind: "task" },
  evaluate: ({ subject }) =>
    subject.label.trim() === "" ? [{ invariant: "no-blank", label: "No blank task", message: "A task has no words", subjectId: subject.id, nodeIds: [subject.id], repairs: [] }] : [],
});

const mutations = [add, rename];
const store = (options: Partial<ConstructorParameters<typeof Store<typeof schema>>[0]> = {}) => new Store({ schema, mutations, invariants: [noBlank], ...options });

describe("the store a host drives", () => {
  it("an op made without a now option is stamped with the current time", () => {
    const s = store();
    const before = Date.now();
    const { ops } = s.apply({ name: "add", args: { id: "t1", label: "Pay the deposit" } });
    const after = Date.now();
    const at = Date.parse(ops[0]!.at);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(after);
    // A host's own clock still wins.
    const fixed = store({ now: () => "2026-10-02T09:00:00.000Z" });
    expect(fixed.apply({ name: "add", args: { id: "t1", label: "x" } }).ops[0]!.at).toBe("2026-10-02T09:00:00.000Z");
  });

  it("applyAll with intent keeps each op's describe sentence and puts the intent beside it, on the batch", () => {
    const s = store();
    const result = s.applyAll(
      [
        { name: "add", args: { id: "t1", label: "Pay the deposit" } },
        { name: "add", args: { id: "t2", label: "Book the van" } },
      ],
      { intent: "Plan the move" },
    );
    expect(result.ops.map((op) => op.intent)).toEqual(["Add “Pay the deposit”", "Add “Book the van”"]);
    expect(result.ops.map((op) => op.batchIntent)).toEqual(["Plan the move", "Plan the move"]);
    expect(result.intent).toBe("Plan the move");
    expect(s.batches()[0]!.intent).toBe("Plan the move");
    // Without one, the batch reads as its ops, as before, and no op carries a batch intent.
    const plain = s.apply({ name: "rename", args: { id: "t1", label: "Pay it" } });
    expect(plain.ops[0]!.intent).toBe("Rename to “Pay it”");
    expect("batchIntent" in plain.ops[0]!).toBe(false);
    expect(s.batches()[1]!.intent).toBe("Rename to “Pay it”");
  });

  it("an act with no describe of its own takes the caller's words as its sentence", () => {
    const close = defineMutation("close", {
      title: "Close",
      input: z.object({ id: nodeRef(["task"]) }),
      apply(ctx, args) {
        ctx.patchNode(args.id, { done: true });
      },
    });
    const s = new Store({ schema, mutations: [add, close] });
    s.apply({ name: "add", args: { id: "t1", label: "Pay the deposit" } });
    const { ops } = s.apply({ name: "close", args: { id: "t1" } }, { intent: "Close it" });
    expect(ops[0]!.intent).toBe("Close it");
    expect(ops[0]!.batchIntent).toBe("Close it");
  });

  it("an undo given an intent keeps its own sentence too", () => {
    const s = store();
    const made = s.apply({ name: "add", args: { id: "t1", label: "Pay the deposit" } });
    const undone = s.undo(made.batch, { intent: "Take the plan back" });
    expect(undone.ops[0]!.intent).toBe("Undo: Add “Pay the deposit”");
    expect(undone.ops[0]!.batchIntent).toBe("Take the plan back");
    expect(s.batches().at(-1)!.intent).toBe("Take the plan back");
  });

  it("previewAll previews several calls without writing", () => {
    const s = store();
    s.apply({ name: "add", args: { id: "t1", label: "Pay the deposit" } });
    const before = JSON.stringify(s.snapshot());
    const length = s.log.length;
    const heard: unknown[] = [];
    s.subscribe((diff) => heard.push(diff));

    // The second call reads what the first made: each compiles on the graph the one before it left.
    const preview = s.previewAll([
      { name: "add", args: { id: "t2", label: "Book the van" } },
      { name: "rename", args: { id: "t2", label: " " } },
    ]);
    expect(preview.diff.addedNodes.map((node) => [node.id, (node as { label: string }).label])).toEqual([["t2", " "]]);
    expect(preview.primitives).toHaveLength(2);
    expect(preview.intent).toBe("Add “Book the van”; Rename to “ ”");
    expect(preview.writes).toContain("t2");
    expect(preview.introduces.map((v) => v.subjectId)).toEqual(["t2"]);

    expect(JSON.stringify(s.snapshot())).toBe(before);
    expect(s.log.length).toBe(length);
    expect(heard).toEqual([]);
    // And it agrees with what applying the same calls does.
    const applied = s.applyAll([
      { name: "add", args: { id: "t2", label: "Book the van" } },
      { name: "rename", args: { id: "t2", label: " " } },
    ]);
    expect(applied.diff).toEqual(preview.diff);
  });

  it("previewAll of a call that cannot compile throws and still writes nothing", () => {
    const s = store();
    const before = JSON.stringify(s.snapshot());
    expect(() =>
      s.previewAll([
        { name: "add", args: { id: "t2", label: "Book the van" } },
        { name: "rename", args: { id: "t9", label: "Nobody" } },
      ]),
    ).toThrow();
    expect(JSON.stringify(s.snapshot())).toBe(before);
  });

  it("store.append lands host-made ops as ordinary, undoable history", () => {
    const s = store({ now: () => "2026-10-02T09:00:00.000Z" });
    s.apply({ name: "add", args: { id: "t1", label: "Pay the deposit" } });
    const heard: Array<readonly string[]> = [];
    s.subscribe((_diff, ops) => heard.push(ops.map((op) => op.id)));

    const landed = s.append([
      {
        author: { kind: "system", id: "cloud:template" },
        intent: "Example content — undo to remove it",
        primitives: [
          { op: "add-node", node: { id: "e1", kind: "task", label: "An example", done: false } },
          { op: "add-node", node: { id: "e2", kind: "task", label: "Another", done: false } },
        ],
      },
    ]);

    expect(landed).toHaveLength(1);
    const op = landed[0]!;
    // Filled in the way the store fills its own: seq, id, batch, the inverse, what it wrote, when.
    expect(op.seq).toBe(1);
    expect(op.mutation).toBeNull();
    expect(op.at).toBe("2026-10-02T09:00:00.000Z");
    expect(op.writes).toEqual(["e1", "e2"]);
    expect(op.inverse.map((p) => p.op)).toEqual(["remove-node", "remove-node"]);
    expect(s.log.all().at(-1)).toEqual(op);
    expect(heard).toEqual([[op.id]]);
    expect(s.graph.getNode("e1")).toBeDefined();

    // Ordinary history: in the activity, by its own author, and one undo takes it back.
    const batch = s.batches().at(-1)!;
    expect(batch.id).toBe(op.batch);
    expect(batch.author.kind).toBe("system");
    expect(s.canUndo(op.batch).ok).toBe(true);
    s.undo(op.batch);
    expect(s.graph.getNode("e1")).toBeUndefined();
    expect(s.graph.getNode("t1")).toBeDefined();
  });

  it("store.append keeps what the host said and refuses a duplicate id or an op that does not fit, landing nothing", () => {
    const s = store();
    const [kept] = s.append([
      {
        id: "seed-1",
        batch: "examples",
        author: { kind: "system", id: "cloud:template" },
        intent: "Example content",
        at: "2026-01-01T00:00:00.000Z",
        via: "api",
        primitives: [{ op: "add-node", node: { id: "e1", kind: "task", label: "An example" } }],
      },
    ]);
    expect(kept).toMatchObject({ id: "seed-1", batch: "examples", at: "2026-01-01T00:00:00.000Z", via: "api" });
    // Judged as a write on the way in, like any: the default is filled.
    expect((s.graph.getNode("e1") as { done?: boolean }).done).toBe(false);

    const before = JSON.stringify(s.snapshot());
    const length = s.log.length;
    expect(() => s.append([{ id: "seed-1", author: { kind: "system" }, intent: "Again", primitives: [{ op: "add-node", node: { id: "e3", kind: "task", label: "x" } }] }])).toThrow(/seed-1/);
    expect(() =>
      s.append([
        { author: { kind: "system" }, intent: "Fine", primitives: [{ op: "add-node", node: { id: "e4", kind: "task", label: "x" } }] },
        { author: { kind: "system" }, intent: "Not there", primitives: [{ op: "patch-node", id: "nope", before: {}, after: { label: "y" } }] },
      ]),
    ).toThrow(ReceiveError);
    expect(JSON.stringify(s.snapshot())).toBe(before);
    expect(s.log.length).toBe(length);
  });

  it("reopening on a snapshot keeps a log that names a kind the new declaration dropped, as history, without folding it", () => {
    const note = defineNode("note", { fields: z.object({ text: z.string() }) });
    const older = createSchema([task, note]);
    const before = new Store({ schema: older, mutations: [] });
    before.append([{ author: { kind: "system" }, intent: "A note", primitives: [{ op: "add-node", node: { id: "n1", kind: "note", text: "Hello" } }] }]);
    const migrated = before.append([{ author: { kind: "system", id: "ship:migration" }, intent: "migration 1→2: notes go", primitives: [{ op: "remove-node", node: { id: "n1", kind: "note", text: "Hello" } }] }]);

    // The new declaration has no `note`. The snapshot is the graph; the log is only history.
    const reopened = store({
      snapshot: before.snapshot() as never,
      log: before.log.all(),
      epochs: [{ seq: before.log.length, base: before.snapshot() as never, version: 2, change: "migration 1→2: notes go" }],
    });
    expect(reopened.log.length).toBe(2);
    expect(reopened.snapshot().nodes).toEqual([]);
    expect(reopened.verify().ok).toBe(true);
    // Undo does not reach back across the change that dropped the kind.
    expect(reopened.canUndo(migrated[0]!.batch).ok).toBe(false);

    // A log alone is folded, and the record of the dropped kind is held as written, and named.
    const folded = store({ log: before.log.all().slice(0, 1) });
    expect(folded.graph.getNode("n1")).toBeDefined();
    expect(folded.findings().map((f) => f.code)).toEqual(["kind-unknown"]);
  });

  it("a blocked undo throws UndoBlockedError with the blocking op", () => {
    const s = store();
    const made = s.apply({ name: "add", args: { id: "t1", label: "Pay the deposit" } });
    const renamed = s.apply({ name: "rename", args: { id: "t1", label: "Pay it" } });
    let thrown: unknown;
    try {
      s.undo(made.batch);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(UndoBlockedError);
    // Still a GraphError, so a host that caught those catches this.
    expect(thrown).toBeInstanceOf(GraphError);
    const blocked = thrown as UndoBlockedError;
    expect(blocked.check.ok).toBe(false);
    expect(blocked.blockedBy.map((b) => b.op.id)).toEqual([renamed.ops[0]!.id]);
    expect(blocked.check.includeBatches).toEqual([renamed.batch]);
    expect(blocked.message).toMatch(/later operation depends on it/);
  });
});
