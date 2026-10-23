import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assertReadable,
  createSchema,
  defineNode,
  FieldRevisions,
  FORMATS,
  formatStamp,
  Graph,
  GraphError,
  invert,
  NewerFormatError,
  OperationLog,
  PRIMITIVE_OPS,
  redact,
  Store,
  upgradeOp,
  writesOf,
  type Author,
  type Operation,
  type Primitive,
} from "../../src/index.js";
import { withoutKeptFields } from "../../src/ops/kept-fields.js";
import { writtenBy } from "../../src/ops/revisions.js";
import { lensOf } from "../../src/ops/withheld.js";

/**
 * COLLABORATIVE TEXT, PHASE 1: the `splice-text` primitive (op format 3).
 *
 * Part of one text field changes: at `at` (UTF-16 code units) the field
 * holds `removed`, and `inserted` takes its place. It folds like any
 * primitive, all or nothing; a splice whose text is not there is a corrupt
 * op and refused; its inverse is the same splice turned round, so undo is
 * mechanical; and it moves its field's revision as any write does.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), note: z.string().optional(), done: z.boolean().optional() }) });
const schema = createSchema([task]);
const ana: Author = { kind: "human", id: "ana" };

const op = (seq: number, primitives: readonly Primitive[], author: Author = ana): Operation =>
  ({
    id: `op-${seq}`,
    seq,
    batch: `batch:t:${seq}`,
    author,
    intent: "Something",
    mutation: null,
    primitives,
    reads: [],
    writes: [...new Set(primitives.flatMap(writesOf))],
    at: "2026-10-22T00:00:00.000Z",
  }) as Operation;

/** The graph a log folds to, from nothing. */
const fold = (ops: readonly Operation[]) => {
  const graph = Graph.from(schema, { nodes: [], edges: [] });
  for (const one of ops) graph.applyPrimitives(one.primitives);
  return graph.snapshot();
};

const node = { id: "t1", kind: "task", label: "Water the beds" } as const;
const added: Primitive = { op: "add-node", node };
const splice = (at: number, removed: string, inserted: string, field = "label"): Primitive => ({ op: "splice-text", id: "t1", field, at, removed, inserted });

describe("a text field takes a splice", () => {
  it("is the sixth primitive, at op format 3, and a format-2 op reads as written", () => {
    expect(PRIMITIVE_OPS).toContain("splice-text");
    expect(FORMATS.op).toBe(3);
    expect(formatStamp().formats.op).toBe(3);
    expect(() => assertReadable({ formats: { op: 3 } })).not.toThrow();
    // An older build reads a stamp of 3 as newer than it reads; this build does the same to 4.
    expect(() => assertReadable({ formats: { op: 4 } })).toThrow(NewerFormatError);
    const fixture = JSON.parse(readFileSync(new URL("../fixtures/formats/format-2.json", import.meta.url), "utf8")) as { formats: { op: number }; ops: Operation[] };
    expect(fixture.formats.op).toBe(2);
    for (const one of fixture.ops) expect(upgradeOp(one, 2)).toEqual(one);
    const store = new Store({ schema, snapshot: fold(fixture.ops), log: fixture.ops });
    expect(store.graph.getNode("t1")).toMatchObject({ label: "Water the raised beds", done: true });
    expect(store.verify().ok).toBe(true);
  });

  it("folds: the field's text with the splice made", () => {
    const graph = Graph.from(schema, { nodes: [node], edges: [] });
    const diff = graph.applyPrimitives([splice(6, "the", "all the"), splice(0, "", "Now: ")]);
    expect(graph.getNode("t1")?.label).toBe("Now: Water all the beds");
    expect(diff.changedNodes.map((change) => change.after.id)).toEqual(["t1"]);
    expect(writesOf(splice(0, "", "x"))).toEqual(["t1"]);
  });

  it("refuses a splice whose text is not there as a corrupt op, all or nothing", () => {
    const graph = Graph.from(schema, { nodes: [node], edges: [] });
    const refused = (primitives: Primitive[]) => {
      expect(() => graph.applyPrimitives(primitives)).toThrow(GraphError);
      expect(graph.getNode("t1")).toEqual(node);
    };
    refused([splice(6, "a", "b")]);
    refused([splice(0, "", "Now: "), splice(99, "", "!")]);
    refused([splice(-1, "", "!")]);
    refused([splice(0, "", "x", "note")]); // no text in the field
    refused([{ op: "splice-text", id: "t1", field: "kind", at: 0, removed: "", inserted: "x" }]);
    expect(() => graph.applyPrimitives([{ ...splice(0, "", "x"), id: "t9" } as Primitive])).toThrow(/missing node "t9"/);
    expect(() => graph.applyPrimitives([splice(0, "W", "w")])).not.toThrow();
  });

  it("is judged as a patch of its field is: a text the kind refuses is refused", () => {
    const strict = createSchema([defineNode("task", { fields: z.object({ label: z.string().max(16) }) })]);
    const graph = Graph.from(strict, { nodes: [node], edges: [] });
    expect(() => graph.applyPrimitives([splice(14, "", ", and the lawn")])).toThrow(GraphError);
    expect(graph.getNode("t1")).toEqual(node);
  });

  it("its inverse is the splice turned round, so an undo puts the text back", () => {
    const one = splice(6, "the", "all the");
    expect(invert(one)).toEqual(splice(6, "all the", "the"));
    expect(invert(invert(one))).toEqual(one);
    const store = new Store({ schema, snapshot: { nodes: [], edges: [] } });
    store.receive([op(0, [added]), op(1, [one, splice(0, "", "Now: ")])]);
    expect(store.graph.getNode("t1")?.label).toBe("Now: Water all the beds");
    store.undo("batch:t:1", { author: ana });
    expect(store.graph.getNode("t1")?.label).toBe("Water the beds");
    expect(store.verify().ok).toBe(true);
  });

  it("a log with splices opens, and folds the same every time", () => {
    const log = [op(0, [added]), op(1, [splice(6, "the", "the raised")]), op(2, [splice(0, "Water", "Weed")])];
    const opened = OperationLog.from(log);
    expect(opened.all()).toHaveLength(3);
    expect(fold(opened.all()).nodes[0]).toMatchObject({ label: "Weed the raised beds" });
    const store = new Store({ schema, snapshot: fold(log), log });
    expect(store.verify().ok).toBe(true);
    expect(JSON.stringify(fold(log))).toBe(JSON.stringify(fold(opened.all())));
  });

  it("moves its field's revision, so a whole write made against the text before it is stale", () => {
    const log = [op(0, [added]), op(1, [{ op: "patch-node", id: "t1", before: {}, after: { done: true } }]), op(2, [splice(0, "", "Now: ")])];
    const revisions = FieldRevisions.of(log);
    expect(revisions.of("t1", "label")).toBe(2);
    expect(revisions.of("t1", "done")).toBe(1);
    expect(revisions.stale([{ node: "t1", field: "label", rev: 0 }])).toHaveLength(1);
    expect(writtenBy([log[2]!]).has("t1\u0000label")).toBe(true);
    // A splice claims no base of its own: it is transformed, not refused as stale (phase 3).
    expect(revisions.baseFor([log[2]!])).toEqual([]);
  });

  it("is served to a seat that sees the record, and withheld from one that does not", () => {
    const log = [op(0, [added]), op(1, [splice(0, "", "Now: ")])];
    expect(redact(log, () => true)[1]!.primitives).toEqual([splice(0, "", "Now: ")]);
    expect(redact(log, (id) => id !== "t1").map((one) => one.primitives.length)).not.toContain(1);
    // A splice whose text names a record the seat may not see goes, as a patch it could not clear does.
    const naming = [op(0, [added]), op(1, [splice(0, "", "t2")])];
    expect(redact(naming, (id) => id !== "t2")[1]!.primitives).toEqual([]);
  });

  it("is no part of what a seat is served when its field is kept from the seat", () => {
    const lens = { ...lensOf(() => true), kindOf: () => "task", kept: () => (field: string) => field === "note" };
    expect(withoutKeptFields([splice(0, "", "x", "note")], lens)).toEqual([]);
    expect(withoutKeptFields([splice(0, "", "x")], lens)).toEqual([splice(0, "", "x")]);
  });
});
