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
    expect(check.blockedBy[0]!.op.intent).toBe("Match the evening run");
    expect(check.blockedBy[0]!.overlap).toEqual(["d1"]);
    expect(check.message).toContain("Match the evening run");
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
