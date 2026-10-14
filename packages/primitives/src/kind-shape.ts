import { dateOn, labelOf, type AnySchema, type Arrangement, type Violation } from "@graview/core";
import { edgeWords } from "@graview/core/words";
import { fieldSpecOf } from "@graview/core/blocks";
import { districtState } from "@graview/core/city";
import { readableFields } from "@graview/core/words";
import type { DraftRecipe } from "@graview/tools/draft";

/*
 * WHAT A KIND OPENS TO WHEN THE APP DREW NO PICTURE OF IT, read from its
 * declaration and from its records — no React, so a test, the stop and a
 * harness agree on it (`kind-stop.tsx` draws it).
 *
 * A district opened used to be six chips and "+30 more" in a box floating
 * in an empty field. What a person wants from a set of records is what
 * they are, what is going on in them, and what to do; the SHAPE of the
 * picture follows the data rather than being chips for everything:
 *
 * - a kind with a main choice (its lifecycle's field, else one called
 *   status, stage, state or phase: `districtState`) and few enough records
 *   to stand in columns is a BOARD by that choice;
 * - a kind with a main date some of whose records fall in the month around
 *   today is a CALENDAR on it (a week when they all fall in one);
 * - everything else is a TABLE of a few columns that say something.
 */

/** Past this many records a board's columns are a wall; the table pages them. */
export const BOARD_AT_MOST = 300;

/** Records that typically last longer than this many days are not a calendar's: they would fill every square. */
export const LONGEST_DAYS = 14;

/** How many rows a table draws before it offers more. */
export const TABLE_PAGE = 50;

/** How many of the kind's own facts a table gives a column each, and how many relations. */
export const TABLE_FIELDS = 3;
export const TABLE_RELATIONS = 2;

export type KindShape =
  | { readonly shape: "board"; readonly field: string }
  | { readonly shape: "calendar"; readonly start: string; readonly end?: string; readonly done?: string; readonly range: "week" | "month" }
  | { readonly shape: "table" };

type Node = { readonly id: string; readonly kind: string } & Readonly<Record<string, unknown>>;

/** A field's declared type ("date", "enum", "boolean", …), through optional and default. */
export function fieldTypeOf(schema: AnySchema, kind: string, field: string): string | undefined {
  const shape = (schema.tryDefinition(kind)?.fields as { shape?: Record<string, unknown> } | undefined)?.shape;
  const spec = shape?.[field] === undefined ? undefined : (fieldSpecOf(shape[field]) as { type?: string } | undefined);
  return spec?.type;
}

const fieldsOf = (schema: AnySchema, kind: string): readonly string[] => Object.keys(((schema.tryDefinition(kind)?.fields as { shape?: Record<string, unknown> } | undefined)?.shape ?? {}) as object);

const isDate = (type: string | undefined) => type === "date" || type === "datetime";

/** A field that says when something is due, rather than when it happens. */
const DUE = /^(due|dueOn|dueAt|dueDate|deadline|by)$/i;
/** A field that says when something happens or starts. */
const WHEN = /^(date|on|day|when|at|start|starts|startsOn|startsAt|begins|from|sown|scheduled|scheduledFor|planned|plannedFor)$/i;
/** A yes-or-no that says something is finished. */
const DONE = /^(done|finished|complete|completed|closed)$/i;

/** The kind's main date: its `start` or `when` role, else a due date, else one named for when it happens. Undefined when it has none. */
export function mainDate(schema: AnySchema, kind: string): { readonly field: string; readonly due: boolean; readonly end?: string; readonly done?: string } | undefined {
  const definition = schema.tryDefinition(kind);
  const fields = fieldsOf(schema, kind);
  const dates = fields.filter((field) => isDate(fieldTypeOf(schema, kind, field)));
  if (dates.length === 0) return undefined;
  const roles = (definition?.fieldRoles ?? {}) as Readonly<Record<string, string>>;
  const role = (name: string) => (roles[name] !== undefined && dates.includes(roles[name]!) ? roles[name] : undefined);
  const field = role("start") ?? role("when") ?? dates.find((one) => DUE.test(one)) ?? dates.find((one) => WHEN.test(one));
  if (!field) return undefined;
  const end = role("end") ?? dates.find((one) => one !== field && /^(end|ends|until|to|finish|finished|harvested|through)$/i.test(one));
  const done = fields.find((one) => DONE.test(one) && fieldTypeOf(schema, kind, one) === "boolean");
  return { field, due: DUE.test(field), ...(end ? { end } : {}), ...(done ? { done } : {}) };
}

/** Days from `a` to `b`, both YYYY-MM-DD (or a moment, read by its day). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

const dayOf = (value: unknown): string | undefined => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined);

/** What a kind opens to: a board, a calendar or a table, chosen by its declaration and its records. */
export function kindShape(schema: AnySchema, kind: string, nodes: readonly Node[], today: string): KindShape {
  const state = districtState(schema, kind);
  if (state && nodes.length > 0 && nodes.length <= BOARD_AT_MOST) return { shape: "board", field: state.field };
  const date = mainDate(schema, kind);
  if (date && !date.due) {
    /*
     * A calendar opens on today: it is the picture only when today's month
     * has something in it, and a week when everything this month falls in
     * this week. A conference ten years long, or albums of thirty, is a
     * table in date order instead of an empty month.
     */
    // A date that repeats stands where its next occurrence falls, as long as its first lasted.
    const moved = (node: Node) => {
      const from = dayOf(node[date.field]);
      const next = dayOf(dateOn(node, date.field, today));
      return from && next ? daysBetween(from, next) : 0;
    };
    const spans = nodes
      .map((node) => ({ from: dayOf(dateOn(node, date.field, today)), to: date.end && dayOf(node[date.end]) ? dayAfter(dayOf(node[date.end])!, moved(node)) : undefined }))
      .filter((span): span is { from: string; to: string | undefined } => span.from !== undefined)
      .map((span) => ({ from: span.from, to: span.to && span.to > span.from ? span.to : span.from }));
    const first = `${today.slice(0, 7)}-01`;
    const last = dayAfter(`${dayAfter(first, 31).slice(0, 7)}-01`, -1);
    // What stands in today's month: what starts in it, or what is under way across it.
    const month = spans.filter((span) => span.from <= last && span.to >= first);
    /*
     * A calendar draws days. Records that each last a season — a plot's
     * rotation, March to October — fill every square of every month with
     * the same bars and say nothing; those are a table in date order.
     */
    const lengths = spans.map((span) => daysBetween(span.from, span.to)).sort((a, b) => a - b);
    const typical = lengths[Math.floor(lengths.length / 2)] ?? 0;
    if (month.length > 0 && typical <= LONGEST_DAYS) {
      const monday = dayAfter(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
      const sunday = dayAfter(monday, 6);
      const week = month.every((span) => span.from >= monday && span.to <= sunday);
      return { shape: "calendar", start: date.field, ...(date.end ? { end: date.end } : {}), ...(date.done ? { done: date.done } : {}), range: week ? "week" : "month" };
    }
  }
  return { shape: "table" };
}

/** The order a table of this kind opens in when nobody chose one: its main date, latest first, where it has one. */
export function tableOrder(schema: AnySchema, kind: string): Arrangement["sort"] | undefined {
  const date = mainDate(schema, kind);
  return date ? { by: date.field, direction: date.due ? "asc" : "desc" } : undefined;
}

/**
 * THE LENS A SHAPE IS, as the seat drafts one (`recipeDraft`): what keeping
 * the derived picture declares. A table is kept as a list of the kind's
 * records in the order and grouping it was arranged in.
 */
export function shapeRecipe(kind: string, shape: KindShape, arrangement: Arrangement = {}): DraftRecipe {
  switch (shape.shape) {
    case "board":
      return { lens: "columns", kind, column: shape.field };
    case "calendar":
      return { lens: "calendar", kind, start: shape.start, ...(shape.end ? { end: shape.end } : {}), ...(shape.done ? { done: shape.done } : {}), range: shape.range };
    case "table":
      return {
        lens: "blocks",
        kind,
        as: "row",
        ...(arrangement.group?.by ? { group: arrangement.group.by } : {}),
        ...(arrangement.sort ? { sort: { by: arrangement.sort.by, ...(arrangement.sort.direction === "desc" ? { direction: "desc" as const } : {}) } } : {}),
      };
  }
}

/** One column of a kind's table: a field of its own, or a relation read as the far records' names. */
export type TableColumn =
  | { readonly about: "field"; readonly key: string; readonly label: string }
  | { readonly about: "edge"; readonly key: string; readonly label: string; readonly edge: string; readonly direction: "out" | "in" };

interface EdgeReader {
  outEdges(id: string): readonly { readonly kind: string; readonly from: string; readonly to: string }[];
  inEdges(id: string): readonly { readonly kind: string; readonly from: string; readonly to: string }[];
  getNode(id: string): Node | undefined;
}

/** How many records a sample reads to choose the table's columns. */
const SAMPLE = 60;

/**
 * THE TABLE'S COLUMNS: the kind's glance — the facts its declaration says a
 * glance shows, else its fields in declared order — kept to the ones most
 * of its records actually have, never the name again and never prose; then
 * the relations most of its records have, said in the kind's own words
 * ("What is held there: sessions"), whose cells are the far records' names.
 */
export function tableColumns(schema: AnySchema, kind: string, nodes: readonly Node[], graph: EdgeReader): readonly TableColumn[] {
  const definition = schema.tryDefinition(kind);
  const sample = nodes.slice(0, SAMPLE);
  const seen = new Map<string, { label: string; count: number; at: number }>();
  sample.forEach((node) => {
    const label = labelOf(definition, node as never);
    readableFields(node, definition, { glance: true, said: [label] }).forEach((field, at) => {
      if (field.long || field.files || field.app) return;
      const held = seen.get(field.key);
      if (held) held.count++;
      else seen.set(field.key, { label: field.label, count: 1, at });
    });
  });
  const enough = Math.max(1, Math.ceil(sample.length / 3));
  const fields = [...seen.entries()]
    .filter(([, one]) => one.count >= enough)
    .sort((a, b) => a[1].at - b[1].at)
    .slice(0, TABLE_FIELDS)
    .map(([key, one]): TableColumn => ({ about: "field", key, label: one.label }));
  const relations = new Map<string, { edge: string; direction: "out" | "in"; far: string; count: number }>();
  for (const node of sample) {
    const counted = new Set<string>();
    for (const [direction, edges] of [["out", graph.outEdges(node.id)], ["in", graph.inEdges(node.id)]] as const) {
      for (const edge of edges) {
        const far = graph.getNode(direction === "out" ? edge.to : edge.from);
        if (!far || far.id === node.id) continue;
        const key = `${edge.kind}|${direction}`;
        if (counted.has(key)) continue;
        counted.add(key);
        const held = relations.get(key);
        if (held) held.count++;
        else relations.set(key, { edge: edge.kind, direction, far: far.kind, count: 1 });
      }
    }
  }
  const edges = [...relations.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TABLE_RELATIONS)
    .map(([key, one]): TableColumn => {
      const words = edgeWords(schema, one.direction === "out" ? kind : one.far, one.edge, one.direction);
      return { about: "edge", key, label: words.charAt(0).toUpperCase() + words.slice(1), edge: one.edge, direction: one.direction };
    });
  return [...fields, ...edges];
}

/** A table cell: a field's value in words, or the far records' names — the first, and how many more. */
export function cellOf(schema: AnySchema, node: Node, column: TableColumn, graph: EdgeReader): { readonly text: string; readonly title?: string } {
  if (column.about === "field") {
    const definition = schema.tryDefinition(node.kind);
    // A glance's reading: prose said by its start, Markdown's syntax taken out (FR-180).
    const field = readableFields(node, definition, { excerpt: true }).find((one) => one.key === column.key);
    return { text: field?.value ?? "" };
  }
  const edges = column.direction === "out" ? graph.outEdges(node.id) : graph.inEdges(node.id);
  const names = edges
    .filter((edge) => edge.kind === column.edge)
    .map((edge) => graph.getNode(column.direction === "out" ? edge.to : edge.from))
    .filter((far): far is Node => far !== undefined)
    .map((far) => labelOf(schema.tryDefinition(far.kind), far as never));
  if (names.length === 0) return { text: "" };
  return names.length === 1 ? { text: names[0]! } : { text: `${names[0]} +${names.length - 1}`, title: names.join(", ") };
}

/** A kind's problems by the rule that found them: how many, said in the rule's own words, the rows to reveal. */
export interface ProblemGroup {
  readonly invariant: string;
  readonly label: string;
  readonly violations: readonly Violation[];
  /** The records of this kind it names. */
  readonly records: readonly string[];
}

/** The broken rules that name one of these records, grouped by rule, most first. */
export function problemsByRule(
  violations: readonly Violation[],
  memberIds: ReadonlySet<string>,
  /** The rule's own name for itself (an invariant's `label`): a violation's label may be the record's. */
  ruleLabel: (invariant: string) => string | undefined = () => undefined,
): readonly ProblemGroup[] {
  const groups = new Map<string, { invariant: string; label: string; violations: Violation[]; records: Set<string> }>();
  for (const violation of violations) {
    const named = violation.nodeIds.filter((id) => memberIds.has(id));
    if (named.length === 0 && !(violation.subjectId !== undefined && memberIds.has(violation.subjectId))) continue;
    const held = groups.get(violation.invariant) ?? { invariant: violation.invariant, label: ruleLabel(violation.invariant) || violation.label || violation.message, violations: [], records: new Set<string>() };
    held.violations.push(violation);
    for (const id of named) held.records.add(id);
    if (violation.subjectId !== undefined && memberIds.has(violation.subjectId)) held.records.add(violation.subjectId);
    groups.set(violation.invariant, held);
  }
  return [...groups.values()]
    .sort((a, b) => b.violations.length - a.violations.length)
    .map((group) => ({ invariant: group.invariant, label: group.label, violations: group.violations, records: [...group.records] }));
}

/** What a kind's main date says about now: how many are overdue (a due date passed, not done) and how many fall in the next week. */
export interface DateFacts {
  readonly field: string;
  readonly due: boolean;
  readonly overdue: number;
  readonly soon: number;
}

/** How far ahead "soon" looks, in days: today and the six after it. */
export const SOON_DAYS = 6;

export function dateFacts(schema: AnySchema, kind: string, nodes: readonly Node[], today: string): DateFacts | undefined {
  const date = mainDate(schema, kind);
  if (!date) return undefined;
  const state = districtState(schema, kind);
  const finished = (node: Node): boolean => {
    if (date.done !== undefined && node[date.done] === true) return true;
    if (!state) return false;
    const at = state.values.indexOf(String(node[state.field]));
    return at >= 0 && state.tiers[at] === "done";
  };
  let overdue = 0;
  let soon = 0;
  for (const node of nodes) {
    // A date that repeats counts by its next occurrence.
    const day = dayOf(dateOn(node, date.field, today));
    if (!day || finished(node)) continue;
    const away = daysBetween(today, day);
    if (date.due && away < 0) overdue++;
    else if (away >= 0 && away <= SOON_DAYS) soon++;
  }
  if (overdue === 0 && soon === 0) return undefined;
  return { field: date.field, due: date.due, overdue, soon };
}

/** The day `days` after `day`, YYYY-MM-DD. */
export function dayAfter(day: string, days: number): string {
  return new Date(Date.parse(`${day.slice(0, 10)}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The filter that keeps what a date fact counts: before today, or from today through the next six days. */
export function dateFilter(facts: DateFacts, which: "overdue" | "soon", today: string): Arrangement["filter"] {
  return which === "overdue"
    ? [{ key: facts.field, value: `before:${today}` }]
    : [
        { key: facts.field, value: `after:${dayAfter(today, -1)}` },
        { key: facts.field, value: `before:${dayAfter(today, SOON_DAYS + 1)}` },
      ];
}

/** What has happened to a kind's records since a moment: how many were added and how many changed (added ones are not counted twice). */
export function changedSince(
  ops: readonly { readonly at: string; readonly undoes?: string; readonly primitives: readonly { readonly op: string; readonly node?: { readonly id: string; readonly kind: string }; readonly id?: string }[] }[],
  kind: string,
  since: string,
  kindOf: (id: string) => string | undefined,
): { readonly added: number; readonly changed: number } {
  const added = new Set<string>();
  const changed = new Set<string>();
  for (const op of ops) {
    if (op.at <= since) continue;
    for (const primitive of op.primitives) {
      if (primitive.op === "add-node" && primitive.node?.kind === kind) added.add(primitive.node.id);
      else if (primitive.op === "patch-node" && primitive.id !== undefined && kindOf(primitive.id) === kind) changed.add(primitive.id);
    }
  }
  for (const id of added) changed.delete(id);
  // Only what is still here: a record added and taken away again is no news.
  return { added: [...added].filter((id) => kindOf(id) === kind).length, changed: [...changed].filter((id) => kindOf(id) === kind).length };
}
