import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineNode,
  GraphError,
  nodeRef,
  OperationLog,
  snapshotHash,
  Store,
  type Epoch,
  type Operation,
} from "../../src/index.js";

/**
 * FR-27. A log that spans a declaration change cannot be folded from
 * empty under the new declaration: the ops before the change wrote the old
 * shape. So the log carries epochs, a base graph and the seq it starts at
 * for each declaration version, and it folds from the last one. Undo does
 * not reach back across one, and says which change stands in the way.
 */

// Version 1 says how big a plot is in a word; version 2 counts its beds.
const plotV1 = defineNode("plot", { fields: z.object({ label: z.string(), size: z.enum(["small", "large"]) }) });
const plotV2 = defineNode("plot", { fields: z.object({ label: z.string(), beds: z.number().int().min(1) }) });
const v1 = createSchema([plotV1]);
const v2 = createSchema([plotV2]);

const addV1 = bindSchema(v1).defineMutation("add-plot", {
  title: "Stake out a plot",
  description: "Add ground.",
  input: z.object({ id: z.string(), label: z.string(), size: z.enum(["small", "large"]) }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "plot", label: args.label, size: args.size } as never);
  },
});
const { defineMutation } = bindSchema(v2);
const addV2 = defineMutation("add-plot", {
  title: "Stake out a plot",
  description: "Add ground.",
  input: z.object({ id: z.string(), label: z.string(), beds: z.number().int().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: args.id, kind: "plot", label: args.label, beds: args.beds } as never);
  },
});
const rename = defineMutation("rename", {
  title: "Rename",
  description: "Call it something else.",
  subject: { kinds: ["plot"], arg: "id" },
  input: z.object({ id: nodeRef(["plot"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const CHANGE = "migration 1→2: size words become bed counts";

/** A version-1 history, then the migration run, as ship records it. */
function spanningTwoVersions() {
  const old = new Store({ schema: v1, mutations: [addV1] });
  old.apply({ name: "add-plot", args: { id: "back", label: "Back bed", size: "large" } });
  old.apply({ name: "add-plot", args: { id: "front", label: "Front bed", size: "small" } });
  const migration: Operation[] = old.snapshot().nodes.map((node, index) => ({
    id: `migration:${index}`,
    seq: old.log.length + index,
    batch: "migration:1->2",
    author: { kind: "system", id: "ship:migration" },
    intent: CHANGE,
    mutation: null,
    primitives: [{ op: "patch-node", id: node.id, before: { size: node["size"] }, after: { size: "\u0000graview:unset", beds: node["size"] === "large" ? 6 : 2 } }],
    inverse: [{ op: "patch-node", id: node.id, before: { beds: node["size"] === "large" ? 6 : 2 }, after: { size: node["size"], beds: "\u0000graview:unset" } }],
    reads: [],
    writes: [node.id],
    at: new Date(0).toISOString(),
  }));
  const migrated = {
    nodes: old.snapshot().nodes.map((node) => ({ id: node.id, kind: node.kind, label: node.label, beds: node["size"] === "large" ? 6 : 2 })),
    edges: [],
  };
  const log = [...old.log.all(), ...migration];
  const epoch: Epoch = { seq: log.length, base: migrated, version: 2, change: CHANGE };
  return { firstBatch: old.batches()[0]!.id, log, migrated, epoch };
}

describe("log.fold({ from })", () => {
  it("folds the ops from an epoch's seq onto its base", () => {
    const { log, migrated, epoch } = spanningTwoVersions();
    const after: Operation = { ...log[0]!, id: "later", seq: log.length, primitives: [{ op: "patch-node", id: "back", before: { label: "Back bed" }, after: { label: "Far bed" } }], inverse: [] };
    const folded = OperationLog.from([...log, after], [epoch]).fold(v2, { from: epoch });
    expect(folded.getNode("back")).toEqual({ id: "back", kind: "plot", label: "Far bed", beds: 6 });
    expect(folded.size.nodes).toBe(migrated.nodes.length);
  });

  it("keeps the epochs it was given, and refuses one that starts past the end of the log", () => {
    const { log, epoch } = spanningTwoVersions();
    const restored = OperationLog.from(log, [epoch]);
    expect(restored.epochs()).toEqual([epoch]);
    expect(() => restored.markEpoch({ ...epoch, seq: log.length + 3 })).toThrow(/past the end/);
  });
});

describe("a store whose log spans two declaration versions", () => {
  it("verifies by folding from the last epoch", () => {
    const { log, migrated, epoch } = spanningTwoVersions();
    const store = new Store({ schema: v2, mutations: [addV2, rename], snapshot: migrated, log, epochs: [epoch] });
    store.apply({ name: "add-plot", args: { id: "side", label: "Side bed", beds: 1 } });
    store.apply({ name: "rename", args: { id: "back", label: "Far bed" } });
    expect(store.verify()).toEqual({ ok: true, hash: snapshotHash(store.snapshot()) });
    expect(store.log.epochs()).toEqual([epoch]);

    // Without its epoch the same log does not fold under version 2: the
    // first op adds a plot with a size word and no beds.
    const unmarked = new Store({ schema: v2, mutations: [addV2, rename], snapshot: store.snapshot(), log: store.log.all() });
    expect(unmarked.verify().ok).toBe(false);
  });

  it("still finds a graph that drifted after the epoch", () => {
    const { log, migrated, epoch } = spanningTwoVersions();
    const store = new Store({ schema: v2, mutations: [addV2, rename], snapshot: migrated, log, epochs: [epoch] });
    const renamed = store.apply({ name: "rename", args: { id: "back", label: "Far bed" } }).ops[0]!;
    const drifted = new Store({ schema: v2, snapshot: migrated, log: store.log.all(), epochs: [epoch] });
    const verdict = drifted.verify();
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.divergedAfter).toBe(renamed.id);
  });

  it("refuses undo across an epoch boundary with a sentence naming the change", () => {
    const { firstBatch, log, migrated, epoch } = spanningTwoVersions();
    const store = new Store({ schema: v2, mutations: [addV2, rename], snapshot: migrated, log, epochs: [epoch] });
    const check = store.canUndo(firstBatch);
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.message).toContain(CHANGE);
      expect(check.message).toContain(log[0]!.intent);
    }
    expect(() => store.undo(firstBatch)).toThrow(GraphError);
    expect(() => store.undo(firstBatch)).toThrow(CHANGE);
    expect(store.canUndo("migration:1->2").ok).toBe(false);

    // What was done after the change undoes as ever.
    const renamed = store.apply({ name: "rename", args: { id: "back", label: "Far bed" } });
    expect(store.canUndo(renamed.batch).ok).toBe(true);
    store.undo(renamed.batch);
    expect(store.graph.getNode("back")?.label).toBe("Back bed");
  });
});

describe("a store opened on a snapshot alone", () => {
  it("takes the snapshot as its first epoch, so it verifies without a log to fold it from", () => {
    const seed = { nodes: [{ id: "back", kind: "plot" as const, label: "Back bed", beds: 6 }], edges: [] };
    const store = new Store({ schema: v2, mutations: [addV2, rename], snapshot: seed });
    store.apply({ name: "rename", args: { id: "back", label: "Far bed" } });
    expect(store.log.epochs()).toEqual([{ seq: 0, base: seed }]);
    expect(store.verify().ok).toBe(true);
  });
});
