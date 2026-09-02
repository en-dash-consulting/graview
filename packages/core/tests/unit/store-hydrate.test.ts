import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "../../src/index.js";

/**
 * A store can reopen the way a persisted deployment does: the graph as
 * stored, the history as recorded — not folded, since the seed was never an
 * operation. The history is live: attributed, listed, undoable.
 */
const thing = defineNode("thing", { fields: z.object({ label: z.string() }) });
const schema = createSchema([thing]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename", {
  title: "Rename",
  description: "Call it something else.",
  subject: { kinds: ["thing"], arg: "id" },
  input: z.object({ id: nodeRef(["thing"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const seed = { nodes: [{ id: "a", kind: "thing", label: "One" }], edges: [] };

describe("hydrating a store from a snapshot and its log", () => {
  it("keeps the graph as stored and the history live", () => {
    const first = new Store({ schema, mutations: [rename], snapshot: seed as never });
    const done = first.apply({ name: "rename", args: { id: "a", label: "Uno" } });

    const second = new Store({
      schema,
      mutations: [rename],
      snapshot: first.snapshot(),
      log: first.log.all(),
    });
    expect((second.graph.getNode("a") as { label: string }).label).toBe("Uno");
    expect(second.batches().map((b) => b.id)).toEqual([done.batch]);
    expect(second.canUndo(done.batch).ok).toBe(true);
    second.undo(done.batch);
    expect((second.graph.getNode("a") as { label: string }).label).toBe("One");
    // Appended after the restored history, in sequence.
    expect(second.log.all().map((op) => op.seq)).toEqual([0, 1]);
  });

  it("still folds when only a log is given", () => {
    const make = defineMutation("make", {
      title: "Make",
      description: "Add one.",
      input: z.object({ label: z.string() }),
      apply(ctx, args) {
        ctx.addNode({ id: ctx.freshId(args.label), kind: "thing", label: args.label } as never);
      },
    });
    const first = new Store({ schema, mutations: [make] });
    first.apply({ name: "make", args: { label: "Two" } });
    const folded = new Store({ schema, mutations: [make], log: first.log.all() });
    expect(folded.graph.nodesOfKind("thing")).toHaveLength(1);
  });
});
