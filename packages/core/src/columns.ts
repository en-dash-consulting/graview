import { fieldsWrittenBy, subjectKindsOf } from "./mutations/derive-edits.js";
import type { AnyMutationDefinition, MutationCall } from "./mutations/types.js";
import type { Principal } from "./permissions/types.js";
import { fieldWords, valueWords } from "./schema/define-node.js";
import type { AnySchema } from "./schema/schema.js";
import type { Store } from "./store.js";
import { defOf } from "./schema/zod.js";

/**
 * A STATUS BOARD'S COLUMNS AND ITS MOVES (FR-97).
 *
 * The `columns` lens draws a kind's records in columns by one choice field
 * — a task's status, an application's stage — and offers to move a card to
 * another column only where the declaration already has an act that does
 * it. Both halves are read here, below the package that draws them, so the
 * picture, `describePlace` and `graview describe` say the same columns in
 * the same order and the same moves for the same seat.
 */

/** One column: a value the field takes, and how the declaration says it; `null` is the column of records with no value. */
export interface StatusColumn {
  readonly value: string | null;
  readonly label: string;
}

/** A choice field, as a status board reads it (FR-97). */
export interface Choice {
  readonly values: readonly string[];
  /** Whether a record may have no value at all: optional or nullable, and no default fills it. */
  readonly empty: boolean;
}

/** A field's choices, in their declared order, and whether it may be left empty; undefined when it is not a choice. */
export function choiceOf(schema: AnySchema, kind: string, field: string): Choice | undefined {
  // Read from zod's own definition, through optional and default, rather than through the JSON-schema writer a page need not carry.
  const shape = schema.tryDefinition(kind)?.fields.shape as Record<string, unknown> | undefined;
  let def = defOf(shape?.[field]);
  let empty = false;
  let filled = false;
  while (def && (def.type === "optional" || def.type === "default" || def.type === "nullable" || def.type === "prefault")) {
    if (def.type === "optional" || def.type === "nullable") empty = true;
    if (def.type === "default" || def.type === "prefault") filled = true;
    def = defOf(def.innerType);
  }
  if (def?.type !== "enum") return undefined;
  const values = (def.entries ? Object.values(def.entries) : (def.values ?? [])).filter((value): value is string => typeof value === "string");
  return values.length > 0 ? { values, empty: empty && !filled } : undefined;
}

/**
 * THE COLUMNS, IN THE FIELD'S DECLARED ORDER — "todo, doing, done" as the
 * declaration lists them, never alphabetised — each said as the declaration
 * says the value. When a record may have no value, a last column holds
 * those ("No status"), as a grouped list puts its "No …" group last: the
 * board's columns are the work's order, and the unsorted pile follows it.
 */
export function statusColumns(schema: AnySchema, kind: string, field: string): readonly StatusColumn[] {
  const choice = choiceOf(schema, kind, field);
  if (!choice) return [];
  const definition = schema.tryDefinition(kind);
  const columns: StatusColumn[] = choice.values.map((value) => ({ value, label: valueWords(definition, field, value) }));
  if (choice.empty) columns.push({ value: null, label: `No ${fieldWords(definition, field).toLowerCase()}` });
  return columns;
}

/** Which column a record stands in: its value when it is one of the columns, the empty column otherwise. */
export function columnOf(record: Readonly<Record<string, unknown>>, field: string, columns: readonly StatusColumn[]): string | null {
  const value = record[field];
  return typeof value === "string" && columns.some((column) => column.value === value) ? value : null;
}

/** A move a seat may make: the act that sets the field to this column's value, as the call it would run. */
export interface ColumnMove {
  readonly to: string;
  readonly call: MutationCall;
  /** The act's title, for saying what the move does. */
  readonly title: string;
}

/**
 * THE MOVES A SEAT MAY MAKE WITH ONE RECORD, derived from the acts rather
 * than invented by the lens.
 *
 * A move to a column is offered only where an act the declaration has —
 * declared, or the derived edit of the kind when nothing else writes the
 * field — says it writes the field (`writes`, read as the checker reads
 * it), stands on this record's kind, and can be TOLD the value: its input
 * takes the record as its subject and the value under the field's own
 * name, and nothing else it requires. "Finish" writes the status and has
 * no opinion you can hand it, so it moves nothing here. Then the store is
 * asked whether this seat may run that exact call (`store.permits`, the
 * answer `apply` would give). A seat with no such act has no moves, and a
 * board drawn for it offers none. The first act that can make a move is
 * the one it runs, in the order the declaration gives them; declared acts
 * before the derived edit.
 */
export function columnMoves<S extends AnySchema>(store: Store<S>, principal: Principal, record: { readonly id: string; readonly kind: string } & Readonly<Record<string, unknown>>, field: string, columns: readonly StatusColumn[] = statusColumns(store.schema, record.kind, field)): readonly ColumnMove[] {
  const acts = columnActs(store.schema, store.allMutations(), record.kind, field);
  const here = columnOf(record, field, columns);
  const moves: ColumnMove[] = [];
  for (const column of columns) {
    if (column.value === null || column.value === here) continue;
    for (const act of acts) {
      const call: MutationCall = { name: act.name, args: { [act.subject!.arg]: record.id, [field]: column.value } };
      if (!(act.input as unknown as { safeParse(value: unknown): { success: boolean } }).safeParse(call.args).success) continue;
      if (!store.permits(call, principal).ok) continue;
      moves.push({ to: column.value, call, title: act.title ?? act.name });
      break;
    }
  }
  return moves;
}

/**
 * The acts that could move a record of this kind between columns, for any
 * seat: they write the field, stand on the kind, and take the value under
 * the field's own name. Declared acts first, then the derived edit. What
 * `graview describe` names, and what `columnMoves` asks the policy about.
 */
export function columnActs<S extends AnySchema>(schema: S, mutations: readonly AnyMutationDefinition<S>[], kind: string, field: string): readonly AnyMutationDefinition<S>[] {
  const definition = schema.tryDefinition(kind);
  if (!definition) return [];
  return mutations
    .filter((mutation) => {
      if (!mutation.subject || !subjectKindsOf(schema, mutation).includes(kind) || !fieldsWrittenBy(mutation, definition).includes(field)) return false;
      const shape = (mutation.input as unknown as { shape?: Record<string, unknown> }).shape;
      return shape !== undefined && field in shape;
    })
    .sort((a, b) => Number(a.derived !== undefined) - Number(b.derived !== undefined));
}
