import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineNode,
  nodeRef,
  Store,
  type Author,
} from "../../src/index.js";

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  edges: { "assigned-to": { to: ["duty"] } },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string(), at: z.number() }) });
const schema = createSchema([person, duty]);
const { defineMutation } = bindSchema(schema);

const reassign = defineMutation("reassign", {
  input: z.object({ dutyId: nodeRef(["duty"]), toPersonId: nodeRef(["person"]) }),
  subject: { kinds: ["duty"], arg: "dutyId" },
  describe: (args) => `Reassign ${args.dutyId} to ${args.toPersonId}`,
  apply(ctx, args) {
    ctx.setSingleSource("assigned-to", args.dutyId, args.toPersonId);
  },
});

const retime = defineMutation("retime", {
  input: z.object({ dutyId: nodeRef(["duty"]), at: z.number() }),
  subject: { kinds: ["duty"], arg: "dutyId" },
  describe: (args) => `Retime ${args.dutyId} to ${args.at}`,
  apply(ctx, args) {
    ctx.patchNode(args.dutyId, { at: args.at });
  },
});

/** Reads a duty it does not write — the shape that creates a dependency. */
const mirror = defineMutation("mirror", {
  input: z.object({ fromDutyId: nodeRef(["duty"]), toDutyId: nodeRef(["duty"]) }),
  describe: (args) => `Mirror ${args.fromDutyId} onto ${args.toDutyId}`,
  apply(ctx, args) {
    const source = ctx.graph.getNode(args.fromDutyId);
    if (!source) throw new Error("missing");
    ctx.patchNode(args.toDutyId, { at: (source as { at: number }).at });
  },
});

const rename = defineMutation("rename", {
  input: z.object({ id: nodeRef("*"), label: z.string() }),
  describe: (args) => `Rename ${args.id}`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const addDuty = defineMutation("add-duty", {
  input: z.object({ label: z.string(), at: z.number(), assigneeId: nodeRef(["person"]) }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    const id = ctx.freshId(args.label);
    ctx.addNode({ id, kind: "duty", label: args.label, at: args.at });
    ctx.addEdge({ kind: "assigned-to", from: args.assigneeId, to: id });
  },
});

const addPerson = defineMutation("add-person", {
  input: z.object({ label: z.string() }),
  describe: (args) => `Add ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label), kind: "person", label: args.label });
  },
});

const AGENT: Author = { kind: "agent", id: "claude", session: "s1" };
const HUMAN: Author = { kind: "human", id: "nick" };

function store() {
  return new Store({
    schema,
    mutations: [reassign, retime, mirror, rename, addDuty, addPerson],
    snapshot: {
      nodes: [
        { id: "p1", kind: "person", label: "Ana" },
        { id: "p2", kind: "person", label: "Bo" },
        { id: "d1", kind: "duty", label: "Morning", at: 480 },
        { id: "d2", kind: "duty", label: "Evening", at: 1000 },
      ],
      edges: [{ kind: "assigned-to", from: "p1", to: "d1" }],
    },
  });
}

describe("operation log", () => {
  it("records author, batch, intent, inverse, reads and writes", () => {
    const s = store();
    const result = s.apply(
      { name: "retime", args: { dutyId: "d1", at: 500 } },
      { author: AGENT },
    );
    const op = result.ops[0]!;
    expect(op.author).toEqual(AGENT);
    expect(op.batch).toBe(result.batch);
    expect(op.intent).toBe("Retime d1 to 500");
    expect(op.writes).toEqual(["d1"]);
    expect(op.reads).toContain("d1");
    expect(op.inverse).toEqual([
      { op: "patch-node", id: "d1", before: { at: 500 }, after: { at: 480 } },
    ]);
  });

  /*
   * "REMOVE THIS KEY" HAS TO SURVIVE BEING WRITTEN DOWN.
   *
   * A patch says it by carrying the key with the value `undefined`, which
   * JSON drops — and the log, every adapter and the export bundle are JSON.
   * So a persisted op that cleared a field came back with an empty half and
   * its inverse silently did nothing, which is the one thing an op log
   * exists to prevent.
   */
  it("keeps a cleared field's instruction through JSON", () => {
    const note = defineNode("note", {
      fields: z.object({ label: z.string(), pinned: z.string().optional() }),
    });
    const small = createSchema([note]);
    const bound = bindSchema(small);
    const unpin = bound.defineMutation("unpin", {
      input: z.object({ id: nodeRef(["note"]) }),
      subject: { kinds: ["note"], arg: "id" },
      apply(ctx, args) {
        ctx.patchNode(args.id, { pinned: undefined });
      },
    });
    const store = new Store({
      schema: small,
      mutations: [unpin],
      invariants: [],
      snapshot: { nodes: [{ id: "n1", kind: "note", label: "One", pinned: "top" }] as never, edges: [] },
    });
    store.apply({ name: "unpin", args: { id: "n1" } });
    expect(store.graph.getNode("n1")).toEqual({ id: "n1", kind: "note", label: "One" });

    const recorded = store.log.all()[0]!;
    const written = JSON.parse(JSON.stringify(recorded)) as typeof recorded;
    // The instruction is a VALUE, so it is still there.
    expect(Object.keys((written.primitives[0] as { after: object }).after)).toEqual(["pinned"]);
    expect((written.inverse[0] as { after: Record<string, unknown> }).after["pinned"]).toBe("top");

    // And the re-read op still does what it says, both ways round: a store
    // that has been reopened holds these, not the objects that made them.
    const reopened = new Store({
      schema: small,
      mutations: [unpin],
      invariants: [],
      snapshot: { nodes: [{ id: "n1", kind: "note", label: "One", pinned: "top" }] as never, edges: [] },
    });
    reopened.graph.applyPrimitives(written.primitives);
    expect(reopened.graph.getNode("n1")).toEqual({ id: "n1", kind: "note", label: "One" });
    reopened.graph.applyPrimitives(written.inverse);
    expect(reopened.graph.getNode("n1")).toEqual({ id: "n1", kind: "note", label: "One", pinned: "top" });
  });

  it("reconstructs the graph by folding the log from empty", () => {
    const s = new Store({ schema, mutations: [addPerson, addDuty, retime, reassign] });
    s.apply({ name: "add-person", args: { label: "Ana" } });
    s.apply({ name: "add-person", args: { label: "Bo" } });
    s.apply({ name: "add-duty", args: { label: "Morning", at: 480, assigneeId: "ana" } });
    s.apply({ name: "retime", args: { dutyId: "morning", at: 500 } }, { author: AGENT });
    s.apply({ name: "reassign", args: { dutyId: "morning", toPersonId: "bo" } });
    s.undo(s.batches()[3]!.id);

    const folded = s.log.fold(schema);
    expect(folded.snapshot()).toEqual(s.graph.snapshot());
    // The undo is in the fold too — history is replayed, not rewound.
    expect(folded.getNode("morning")).toMatchObject({ at: 480 });
  });

  it("never mutates or removes an entry — undo appends", () => {
    const s = store();
    const applied = s.apply({ name: "retime", args: { dutyId: "d1", at: 500 } });
    const lengthBefore = s.log.length;
    s.undo(applied.batch);
    expect(s.log.length).toBe(lengthBefore + 1);
    expect(s.log.all()[0]).toEqual(applied.ops[0]);
    expect(s.log.all()[1]?.undoes).toBe(applied.ops[0]!.id);
    expect(s.graph.getNode("d1")).toMatchObject({ at: 480 });
  });

  it("makes redo the undo of an undo", () => {
    const s = store();
    const applied = s.apply({ name: "retime", args: { dutyId: "d1", at: 500 } });
    const undone = s.undo(applied.batch);
    expect(s.graph.getNode("d1")).toMatchObject({ at: 480 });
    s.redo(undone.batch);
    expect(s.graph.getNode("d1")).toMatchObject({ at: 500 });
  });
});

/**
 * A HYDRATED STORE COUNTS ON FROM WHERE THE LOG LEFT OFF.
 *
 * Both id counters started at zero whatever history was handed in, so the
 * first change after a reload was minted `op1` in `batch:1` — ids the log
 * already held. `batches()` groups by batch id, so new work was filed under
 * the FIRST turn ever taken: the activity rail went on naming that turn and
 * never grew, undoing it would have taken the new change with it, and
 * `log.get(id)` answered with the older of the two ops. Every app that
 * remembers anything did this on its second visit.
 */
describe("a store hydrated from a log", () => {
  const reloaded = () => {
    const first = store();
    first.apply({ name: "add-person", args: { label: "Cal" } });
    first.apply({ name: "retime", args: { dutyId: "d1", at: 500 } });
    return new Store({
      schema,
      mutations: [reassign, retime, mirror, rename, addDuty, addPerson],
      log: [...first.log.all()],
      snapshot: first.graph.snapshot(),
    });
  };

  it("puts new work in a turn of its own, not into the first one ever taken", () => {
    const after = reloaded();
    expect(after.batches().length).toBe(2);
    after.apply({ name: "rename", args: { id: "d1", label: "Early" } });
    expect(after.batches().length).toBe(3);
    expect(after.batches()[2]?.intent).toBe("Rename d1");
    // And the turns it hydrated with keep their own contents.
    expect(after.batches()[0]?.ops.length).toBe(1);
  });

  it("mints op ids the log does not already hold", () => {
    const after = reloaded();
    after.apply({ name: "rename", args: { id: "d1", label: "Early" } });
    const ids = after.log.all().map((op) => op.id);
    expect(new Set(ids).size).toBe(ids.length);
    const batches = after.log.all().map((op) => op.batch);
    expect(new Set(batches).size).toBe(3);
  });

  it("keeps undo honest across the reload", () => {
    const after = reloaded();
    after.apply({ name: "rename", args: { id: "d1", label: "Early" } });
    const renamed = after.batches()[2]!;
    after.undo(renamed.id);
    expect((after.graph.getNode("d1") as { label: string }).label).toBe("Morning");
    // The turn it was filed beside is untouched.
    expect((after.graph.getNode("d1") as { at: number }).at).toBe(500);
  });
});

describe("selective undo", () => {
  it("drops the agent's turn and keeps the human edits under it", () => {
    const s = store();
    const agentTurn = s.apply(
      { name: "reassign", args: { dutyId: "d1", toPersonId: "p2" } },
      { author: AGENT, intent: "Balance the week" },
    );
    const humanEdit = s.apply(
      { name: "rename", args: { id: "d2", label: "Late pickup" } },
      { author: HUMAN },
    );

    const check = s.canUndo(agentTurn.batch);
    expect(check.ok).toBe(true);

    s.undo(agentTurn.batch);
    expect(s.graph.in("d1", "assigned-to").map((n) => n.id)).toEqual(["p1"]);
    expect(s.graph.getNode("d2")).toMatchObject({ label: "Late pickup" });
    expect(s.log.get(humanEdit.ops[0]!.id)).toBeDefined();
  });

  it("names the blocking op when a later op read what it wrote", () => {
    const s = store();
    const first = s.apply({ name: "retime", args: { dutyId: "d1", at: 700 } }, { author: AGENT });
    s.apply(
      { name: "mirror", args: { fromDutyId: "d1", toDutyId: "d2" } },
      { author: HUMAN, intent: "Match the evening run" },
    );

    const check = s.canUndo(first.batch);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("expected a block");
    expect(check.blockedBy).toHaveLength(1);
    // Named by what the op did, in its act's own words; what the gesture was for is beside it (FR-18).
    expect(check.blockedBy[0]!.op.intent).toBe("Mirror d1 onto d2");
    expect(check.blockedBy[0]!.op.batchIntent).toBe("Match the evening run");
    expect(check.blockedBy[0]!.overlap).toEqual(["d1"]);
    expect(check.message).toContain("Mirror d1 onto d2");
    expect(check.includeBatches).toHaveLength(1);
    expect(() => s.undo(first.batch)).toThrow(/later operation depends on it/);
  });

  it("goes through once the blocking batch comes along", () => {
    const s = store();
    const first = s.apply({ name: "retime", args: { dutyId: "d1", at: 700 } }, { author: AGENT });
    const second = s.apply({ name: "mirror", args: { fromDutyId: "d1", toDutyId: "d2" } });

    const blocked = s.canUndo(first.batch);
    if (blocked.ok) throw new Error("expected a block");
    expect(blocked.includeBatches).toEqual([second.batch]);

    s.undo([first.batch, ...blocked.includeBatches]);
    expect(s.graph.getNode("d1")).toMatchObject({ at: 480 });
    expect(s.graph.getNode("d2")).toMatchObject({ at: 1000 });
  });

  it("refuses to undo the same batch twice", () => {
    const s = store();
    const applied = s.apply({ name: "retime", args: { dutyId: "d1", at: 500 } });
    s.undo(applied.batch);
    const again = s.canUndo(applied.batch);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.message).toContain("already undone");
  });
});

describe("preview", () => {
  it("shows an undo as a diff before applying it", () => {
    const s = store();
    const applied = s.apply({ name: "retime", args: { dutyId: "d1", at: 500 } });
    const preview = s.previewUndo(applied.batch);
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error("expected an undoable batch");
    expect(preview.diff.changedNodes[0]?.after).toMatchObject({ at: 480 });
    // Nothing applied.
    expect(s.graph.getNode("d1")).toMatchObject({ at: 500 });
  });

  it("previews a mutation without applying it", () => {
    const s = store();
    const preview = s.preview({ name: "reassign", args: { dutyId: "d1", toPersonId: "p2" } });
    expect(preview.diff.addedEdges).toEqual([
      { kind: "assigned-to", from: "p2", to: "d1" },
    ]);
    expect(s.graph.in("d1", "assigned-to").map((n) => n.id)).toEqual(["p1"]);
  });

  it("rolls the graph back when one mutation in a batch throws", () => {
    const s = store();
    expect(() =>
      s.applyAll([
        { name: "retime", args: { dutyId: "d1", at: 600 } },
        { name: "retime", args: { dutyId: "nope", at: 600 } },
      ]),
    ).toThrow();
    expect(s.graph.getNode("d1")).toMatchObject({ at: 480 });
  });
});
