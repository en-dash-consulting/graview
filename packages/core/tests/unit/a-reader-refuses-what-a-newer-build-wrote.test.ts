import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AUTHOR_KINDS,
  authorKindOf,
  createSchema,
  defineNode,
  FORMATS,
  Graph,
  nameOfAuthor,
  NewerFormatError,
  OperationLog,
  PRIMITIVE_OPS,
  Store,
  upgradeOp,
  VALUE_TYPES,
  type Author,
  type Operation,
} from "../../src/index.js";
import { makerOf } from "../../src/history.js";
import { SYNC_STATE_FORMAT, SyncEngine, type RemoteSystem, type SyncMapping } from "../../src/sync/index.js";

/**
 * FORMATS FAIL CLOSED (1.0's foundation, docs/stability.md §1, §2).
 *
 * An older reader that skipped a primitive it did not know would fold a
 * different graph from the same log and never say so: the switch had no
 * default. Now a primitive, or a typed value, that this build does not
 * know is refused with `NewerFormatError` wherever ops are folded. An
 * author kind is the other way round: open, because an op is history and
 * must fold whoever wrote it — one this build does not know reads as the
 * app itself.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), note: z.unknown().optional() }) });
const schema = createSchema([task]);

const op = (seq: number, primitives: readonly unknown[], author: Author = { kind: "human", id: "ana" }): Operation =>
  ({
    id: `op-${seq}`,
    seq,
    batch: `batch:t:${seq}`,
    author,
    intent: "Something",
    mutation: null,
    primitives,
    reads: [],
    writes: [],
    at: "2026-10-22T00:00:00.000Z",
  }) as unknown as Operation;

const added = { op: "add-node", node: { id: "t1", kind: "task", label: "Water the beds" } };
const spliced = { op: "move-text", id: "t1", field: "label", from: 0, to: 4, length: 3 };

describe("a reader refuses what a newer build wrote", () => {
  it("names the six primitives it folds, at op format 3", () => {
    expect([...PRIMITIVE_OPS]).toEqual(["add-node", "remove-node", "patch-node", "add-edge", "remove-edge", "splice-text"]);
    expect(FORMATS.op).toBe(3);
  });

  it("an older reader refuses a log with an unknown primitive instead of diverging", () => {
    const log = [op(0, [added]), op(1, [spliced])];
    // Opening the log: refused at the op, nothing half-read.
    expect(() => OperationLog.from(log)).toThrow(NewerFormatError);
    expect(() => new Store({ schema, snapshot: { nodes: [added.node as never], edges: [] }, log })).toThrow(/primitive "move-text" that @graview .* does not know/);
    // Folding it by hand: the graph is as it was, not the graph without the splice.
    const graph = Graph.from(schema, { nodes: [], edges: [] });
    expect(() => graph.applyPrimitives([added, spliced] as never)).toThrow(NewerFormatError);
    expect(graph.size).toEqual({ nodes: 0, edges: 0 });
    // Received from a newer server: refused, and nothing joins the log.
    const store = new Store({ schema, snapshot: { nodes: [], edges: [] } });
    expect(() => store.receive([op(0, [added]), op(1, [spliced])])).toThrow();
    expect(store.log.length).toBe(0);
    expect(store.graph.size).toEqual({ nodes: 0, edges: 0 });
    // Brought up by hand: refused too, said as a newer format.
    try {
      upgradeOp(op(1, [spliced]), 1);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(NewerFormatError);
      expect((error as NewerFormatError).what).toBe("op");
      expect((error as NewerFormatError).found).toBe(FORMATS.op + 1);
      expect((error as NewerFormatError).unknown).toBe('primitive "move-text"');
    }
  });

  it("refuses to apply a value whose $type it does not know, and keeps one it only passes along", () => {
    expect(VALUE_TYPES.size).toBe(0);
    const rich = { $type: "rich-text", runs: [{ text: "Water", bold: true }] };
    const writes = op(1, [{ op: "patch-node", id: "t1", before: {}, after: { note: rich } }]);
    // The log holds it as written: an adapter, an export, the wire pass it through.
    const log = OperationLog.from([op(0, [added]), writes]);
    expect(log.all()[1]!.primitives).toEqual(writes.primitives);
    // Applying it is refused, whole: the record is as it was.
    const graph = Graph.from(schema, { nodes: [added.node as never], edges: [] });
    expect(() => graph.applyPrimitives(writes.primitives)).toThrow(/value type "rich-text" in "note"/);
    expect(graph.getNode("t1")).toEqual(added.node);
    expect(() => Graph.from(schema, { nodes: [], edges: [] }).applyPrimitives([{ op: "add-node", node: { ...added.node, note: rich } } as never])).toThrow(NewerFormatError);
    // An object without a `$type`, and `$type`-less JSON in general, is an ordinary value.
    graph.applyPrimitives([{ op: "patch-node", id: "t1", before: {}, after: { note: { runs: 1 } } }]);
    expect(graph.getNode("t1")?.["note"]).toEqual({ runs: 1 });
  });

  it("an op by a visitor reads, as a person's", () => {
    expect(AUTHOR_KINDS).toContain("visitor");
    const visitor: Author = { kind: "visitor", id: "form:tok-1", name: "a visitor via the RSVP form" };
    const store = new Store({ schema, snapshot: { nodes: [], edges: [] } });
    store.receive([op(0, [added], visitor)]);
    expect(store.graph.getNode("t1")).toMatchObject({ label: "Water the beds" });
    expect(authorKindOf(store.log.all()[0]!.author)).toBe("visitor");
    expect(makerOf(visitor, { kind: "human", id: "hana" })).toBe("person");
    expect(nameOfAuthor(visitor, { graph: store.graph as never, schema })).toBe("a visitor via the RSVP form");
    expect(nameOfAuthor({ kind: "visitor", id: "form:tok-2" }, { graph: store.graph as never, schema })).toBe("a visitor via a form");
  });

  it("an unknown author kind reads as system, and its op folds as any other", () => {
    const stranger = { kind: "robot-arm", id: "arm:7" } as unknown as Author;
    expect(authorKindOf(stranger)).toBe("system");
    expect(authorKindOf(undefined)).toBe("system");
    const store = new Store({ schema, snapshot: { nodes: [], edges: [] } });
    store.receive([op(0, [added], stranger)]);
    expect(store.graph.getNode("t1")).toBeDefined();
    // History is never rewritten: the log keeps the kind as written.
    expect(store.log.all()[0]!.author.kind).toBe("robot-arm");
    expect(makerOf(stranger)).toBe("app");
    expect(nameOfAuthor(stranger, { graph: store.graph as never, schema })).toBe("the system");
    expect(nameOfAuthor({ kind: "robot-arm" } as unknown as Author, { graph: store.graph as never, schema })).toBe("system");
  });
});

describe("a sync state carries its format", () => {
  const mapping: SyncMapping = { system: "remote", resources: [] } as unknown as SyncMapping;
  const remote: RemoteSystem = { name: "remote", pull: async () => ({ changes: [], cursor: "c1" }), push: async () => [] };

  it("is stamped with the format this build writes, and a state from before stamps reads as format 1", async () => {
    const store = new Store({ schema, snapshot: { nodes: [], edges: [] } });
    const engine = new SyncEngine({ store, remote, mapping } as never, { links: {}, outbox: [] });
    expect(SYNC_STATE_FORMAT).toBe(1);
    expect(engine.snapshot.format).toBe(SYNC_STATE_FORMAT);
    const ran = await engine.run();
    expect(ran.state.format).toBe(SYNC_STATE_FORMAT);
    expect(ran.state.cursor).toBe("c1");
  });

  it("is refused when a newer build wrote it", () => {
    const store = new Store({ schema, snapshot: { nodes: [], edges: [] } });
    expect(() => new SyncEngine({ store, remote, mapping } as never, { format: SYNC_STATE_FORMAT + 1, links: {}, outbox: [] })).toThrow(NewerFormatError);
  });
});
