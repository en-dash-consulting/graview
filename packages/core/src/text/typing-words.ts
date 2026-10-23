import { capitalize } from "../capital.js";
import { isUnset } from "../graph/primitives.js";
import { fieldWords, labelOf } from "../schema/define-node.js";
import type { Author, Operation } from "../ops/types.js";
import { TYPE_TEXT } from "./typing-hook.js";

/*
 * TYPING, SAID (Roadmap f-collab-text, phase 5). A keystroke is a splice,
 * and a run of them is a batch: a person writing a paragraph is dozens of
 * batches. History, Activity and a subscription say them as one thing —
 * "Ada wrote in Notes (+42 −3)". Read where history and a notification are
 * said, never with a page's first load: Activity folds and says a run with
 * the little it needs of its own (`../ops/digest.js`). What was put in and
 * taken out, span by span, is `typedSpans`' (`./typing-spans.js`).
 */

/** What a run of typing did to one field of one record: how much it put in and took out. */
export interface TypedRun {
  readonly node: string;
  readonly field: string;
  /** Characters put in, counted as a person counts them: an emoji is one. */
  readonly inserted: number;
  /** Characters taken out. */
  readonly removed: number;
}

/** The field a keystroke op typed into, by its call: `type-text`'s node and field. None for an undo, an op withheld from the reader, or any other act. */
export function typedField(op: Operation): { readonly node: string; readonly field: string } | undefined {
  if (op.withheld === true || op.undoes !== undefined || op.mutation?.name !== TYPE_TEXT) return undefined;
  const { node, field } = (op.mutation.args ?? {}) as { node?: unknown; field?: unknown };
  return typeof node === "string" && typeof field === "string" ? { node, field } : undefined;
}

/** Whether two authors are the one person typing: the same kind and id (any tab of theirs), or the same name where neither has an id. */
export function sameTypist(a: Author, b: Author): boolean {
  if (a.kind !== b.kind) return false;
  if (a.id !== undefined || b.id !== undefined) return a.id === b.id && a.onBehalfOf === b.onBehalfOf;
  return (a.name ?? "") === (b.name ?? "");
}

const characters = (text: string): number => {
  let count = 0;
  for (const _ of text) count++;
  return count;
};

/**
 * WHAT A RUN OF TYPING DID: the field these ops typed into and how much,
 * when every one of them is a keystroke (`type-text`) into that one field —
 * a batch a person typed, or several in a row. None for anything else: an
 * act, an undo, an op withheld from the reader, typing into two fields.
 */
export function typedRun(ops: readonly Operation[]): TypedRun | undefined {
  if (ops.length === 0) return undefined;
  const into = typedField(ops[0]!);
  if (!into) return undefined;
  let inserted = 0;
  let removed = 0;
  for (const op of ops) {
    const field = typedField(op);
    if (!field || field.node !== into.node || field.field !== into.field) return undefined;
    for (const primitive of op.primitives) {
      if (primitive.op === "splice-text" && primitive.id === into.node && primitive.field === into.field) {
        inserted += characters(primitive.inserted);
        removed += characters(primitive.removed);
      } else if (primitive.op === "patch-node" && primitive.id === into.node && Object.prototype.hasOwnProperty.call(primitive.after, into.field)) {
        // The first text, written whole into a field holding none.
        const before = primitive.before[into.field];
        const after = primitive.after[into.field];
        inserted += typeof after === "string" ? characters(after) : 0;
        removed += typeof before === "string" && !isUnset(before) ? characters(before) : 0;
      }
    }
  }
  return { ...into, inserted, removed };
}

/** Two runs of typing into one field as one: the counts added. */
export const joinRuns = (a: TypedRun, b: TypedRun): TypedRun => ({ node: a.node, field: a.field, inserted: a.inserted + b.inserted, removed: a.removed + b.removed });

/** How much a run changed, in the brackets a sentence ends with: "(+42 −3)", "(+5)", "(−3)". */
export function typedCounts(run: Pick<TypedRun, "inserted" | "removed">): string {
  const parts = [...(run.inserted > 0 || run.removed === 0 ? [`+${run.inserted}`] : []), ...(run.removed > 0 ? [`−${run.removed}`] : [])];
  return `(${parts.join(" ")})`;
}

type Declared = { tryDefinition(kind: string): unknown };
type Records = { getNode(id: string): unknown };

/**
 * A RUN OF TYPING, AS A CHANGE IS SAID — "Wrote in Kitchen's notes (+42
 * −3)", the field in the declaration's words, named with its record when a
 * graph is handed that holds it; "Wrote in Notes (+42 −3)" without one, or
 * where the record is named beside it (`named: false`).
 */
export function typingWords(run: Pick<TypedRun, "node" | "field" | "inserted" | "removed">, schema: Declared, graph?: Records, named = true): string {
  const record = graph?.getNode(run.node) as ({ id: string; kind: string } & Record<string, unknown>) | undefined;
  const definition = record ? (schema.tryDefinition(record.kind) as Parameters<typeof fieldWords>[0]) : undefined;
  const field = fieldWords(definition, run.field);
  const where = record && named ? `${labelOf(definition as never, record)}'s ${field.toLowerCase()}` : field;
  return `Wrote in ${where} ${typedCounts(run)}`;
}

/** Who wrote and what, in one sentence: "Ada wrote in Notes (+42 −3)". */
export function typingSentence(name: string, run: Pick<TypedRun, "node" | "field" | "inserted" | "removed">, schema: Declared, graph?: Records): string {
  const said = typingWords(run, schema, graph);
  return `${capitalize(name)} ${said.charAt(0).toLowerCase()}${said.slice(1)}`;
}
