import { compileMutation } from "./mutations/define-mutation.js";
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
 * Two kinds of act move a card, read from the declaration (`columnReach`):
 *
 *  - A NAMED STEP (FR-108) sets the field to one value whatever it is told
 *    — `book`, `mark-fixed`, `reopen` — and is the move to that value's
 *    column. It is called with the record alone, so a step that needs
 *    anything else the board cannot supply (a reason, a date, another
 *    record) is not offered.
 *  - A FREE ACT writes the field (`writes`, read as the checker reads it)
 *    and can be TOLD the value: its input takes the record as its subject
 *    and the value under the field's own name, and nothing else it
 *    requires — `set-status`, or the kind's derived edit when nothing
 *    declared writes the field.
 *
 * A column a named step reaches is reached ONLY by its steps: the step
 * wins over a free act, and where the step's condition does not hold for
 * this record the free act does not stand in for it — the condition, and
 * what the step also records, are never skipped by a drag.
 *
 * Each candidate call is then asked two things, in the order of the acts
 * (declared order, the derived edit last): may this seat run it
 * (`store.permits`, the answer `apply` would give), and would it run for
 * THIS record — compiled against the graph without applying, so its
 * `allowedWhen` is judged by the rule language under its budget and a
 * refusal is no move. The first that passes is the move; a seat with no
 * such act has no moves, and a board drawn for it offers none. The cost is
 * at most one compile per act per column per card, and a column stops at
 * the first act that passes.
 */
export function columnMoves<S extends AnySchema>(store: Store<S>, principal: Principal, record: { readonly id: string; readonly kind: string } & Readonly<Record<string, unknown>>, field: string, columns: readonly StatusColumn[] = statusColumns(store.schema, record.kind, field)): readonly ColumnMove[] {
  const reach = columnReach(store.schema, store.allMutations(), record.kind, field, columns);
  const here = columnOf(record, field, columns);
  const moves: ColumnMove[] = [];
  for (const { value, by, acts } of reach) {
    if (value === here) continue;
    for (const act of acts) {
      const args: Record<string, unknown> = by === "step" ? { [act.subject!.arg]: record.id } : { [act.subject!.arg]: record.id, [field]: value };
      const call: MutationCall = { name: act.name, args };
      if (!(act.input as unknown as { safeParse(value: unknown): { success: boolean } }).safeParse(args).success) continue;
      if (!store.permits(call, principal).ok) continue;
      try {
        compileMutation(store.graph, act, args);
      } catch {
        continue;
      }
      moves.push({ to: value, call, title: act.title ?? act.name });
      break;
    }
  }
  return moves;
}

/** One column, and the acts that may move a record into it: its named steps, or else the free acts that take the value. */
export interface ColumnReach<S extends AnySchema = AnySchema> {
  readonly value: string;
  readonly label: string;
  /** `step` when named steps reach it (and only they do), `value` when free acts are told the value, `none` when nothing does. */
  readonly by: "step" | "value" | "none";
  readonly acts: readonly AnyMutationDefinition<S>[];
}

/**
 * WHICH ACTS REACH WHICH COLUMN, for any seat (FR-108): each column with a
 * value, with the named steps that set the field to it, in declared order —
 * or, where no step does, the free acts that take the value (`columnActs`).
 * What `graview describe` says column by column, and what `columnMoves`
 * asks the policy and the record about.
 */
export function columnReach<S extends AnySchema>(schema: S, mutations: readonly AnyMutationDefinition<S>[], kind: string, field: string, columns: readonly StatusColumn[] = statusColumns(schema, kind, field)): readonly ColumnReach<S>[] {
  const steps = columnSteps(schema, mutations, kind, field);
  const free = columnActs(schema, mutations, kind, field);
  return columns.flatMap((column): ColumnReach<S>[] => {
    if (column.value === null) return [];
    const here = steps.filter((act) => act.sets?.[field] === column.value);
    return [{ value: column.value, label: column.label, by: here.length > 0 ? "step" : free.length > 0 ? "value" : "none", acts: here.length > 0 ? here : free }];
  });
}

/** The named steps of a kind's field: acts that stand on the kind and set the field to a value of their own (`sets`), in declared order. */
export function columnSteps<S extends AnySchema>(schema: S, mutations: readonly AnyMutationDefinition<S>[], kind: string, field: string): readonly AnyMutationDefinition<S>[] {
  return mutations.filter((mutation) => mutation.subject !== undefined && mutation.derived === undefined && typeof mutation.sets?.[field] === "string" && subjectKindsOf(schema, mutation).includes(kind));
}

/**
 * The free acts that could move a record of this kind between columns, for
 * any seat: they write the field, stand on the kind, and take the value
 * under the field's own name. Declared acts first, then the derived edit.
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
