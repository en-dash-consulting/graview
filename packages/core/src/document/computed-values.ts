import type { AnyGraphNode, GraphReader } from "../graph/types.js";
import type { AnySchema } from "../schema/schema.js";
import { labelOf } from "../schema/define-node.js";
import { computedOf } from "./computed.js";
import { evaluateExpr, ExprEvalError, NodeSet, type KindShape, type Value } from "./expr/evaluate.js";
import { shapesOfSchema } from "./rules.js";

/*
 * A RECORD'S COMPUTED VALUES, READ (FR-83).
 *
 * WHAT A SEAT IS SERVED IS WORKED OUT FROM WHAT IT MAY SEE. A computed
 * value is never stored and never travels in the op log: it is evaluated
 * on demand, over the graph the reader is handed. A seat reads through
 * `store.seenBy(principal)`, whose graph holds only the records that seat
 * may see, so a hidden record adds nothing to a sum, wins no sort and is
 * never the record a value names — a partner who may not see the client is
 * served a package's price before the client's discount, and never learns
 * the discount from it. Hand this the seat's graph, never the store's.
 */

export interface ComputedRecord {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
}

/** A computed value as plain data: a record as its id, kind and name; a set as a list of them. */
export type PlainComputed = string | number | boolean | null | ComputedRecord | readonly PlainComputed[];

export interface ComputedValues {
  /** Each computed field that could be worked out, by name. */
  readonly values: Readonly<Record<string, PlainComputed>>;
  /** Each that could not, and the sentence that says why — a cycle, a mistake, or its budget spent. */
  readonly refused: Readonly<Record<string, string>>;
}

const SHAPES = new WeakMap<object, Map<string, KindShape>>();
function shapesFor(schema: AnySchema): Map<string, KindShape> {
  let shapes = SHAPES.get(schema);
  if (!shapes) SHAPES.set(schema, (shapes = shapesOfSchema(schema)));
  return shapes;
}

/**
 * Every computed field of one record, worked out over `graph` — the graph
 * of the seat it is for. Each field has its own budget (`budget`, else the
 * language's default); one that cannot be worked out is `refused`, not thrown.
 */
export function computedValues(
  schema: AnySchema,
  graph: GraphReader,
  node: AnyGraphNode,
  options: { readonly budget?: number; readonly today?: string } = {},
): ComputedValues {
  const kinds = shapesFor(schema);
  const values: Record<string, PlainComputed> = {};
  const refused: Record<string, string> = {};
  const plain = (value: Value): PlainComputed => {
    if (value instanceof NodeSet) return value.nodes.map((n) => plain(n));
    if (Array.isArray(value)) return value.map((v) => plain(v as Value));
    if (value !== null && typeof value === "object") {
      const record = value as AnyGraphNode;
      return { id: record.id, kind: record.kind, label: labelOf(schema.tryDefinition(record.kind), record) };
    }
    return value as PlainComputed;
  };
  for (const [name, expr] of kinds.get(node.kind)?.computed ?? []) {
    try {
      values[name] = plain(evaluateExpr(expr, { graph, subject: node, kinds, ...(options.today ? { today: options.today } : {}), ...(options.budget ? { budget: options.budget } : {}) }));
    } catch (e) {
      if (!(e instanceof ExprEvalError)) throw e;
      refused[name] = e.sentence;
    }
  }
  return { values, refused };
}

/**
 * A record with its computed values beside its stored ones, as words a
 * surface shows (a record as its name, a set as their names) — for the
 * facts a page or an agent reads, never for a write.
 */
export function withComputed(schema: AnySchema, graph: GraphReader, node: AnyGraphNode): AnyGraphNode {
  const { values } = computedValues(schema, graph, node);
  if (Object.keys(values).length === 0) return node;
  const said = (v: PlainComputed): unknown => (Array.isArray(v) ? v.map(said) : v !== null && typeof v === "object" ? (v as ComputedRecord).label : v);
  return { ...node, ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, said(v)])) } as AnyGraphNode;
}

/** The names of a kind's computed fields, in declaration order. */
export function computedNames(schema: AnySchema, kind: string): readonly string[] {
  return [...computedOf(schema.tryDefinition(kind) as Parameters<typeof computedOf>[0]).keys()];
}
