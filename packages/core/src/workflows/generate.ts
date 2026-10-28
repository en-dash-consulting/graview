import { dayOfMoment, isoToday, ISO_DAY } from "../days.js";
import { evaluateExpr, NodeSet, type KindShape, type Value } from "../document/expr/evaluate.js";
import { parseExpr, type Expr } from "../document/expr/parse.js";
import { shapesOfSchema } from "../document/rules.js";
import { startOfWeekOf } from "../document/expr/when.js";
import type { AnyGraphNode } from "../graph/types.js";
import type { Graph } from "../graph/graph.js";
import { isRepeat, occurrences, repeatKey, WEEKDAYS } from "../repeat.js";
import type { AnySchema } from "../schema/schema.js";
import { weekdaysOf } from "../sync/recurrence.js";
import { addDays, weekdayOf } from "../wall-time.js";
import type { GenerateStep, GenerateWindow, WorkflowValue } from "../workflow-shape.js";

/*
 * WHAT A GENERATE STEP WANTS MADE (Roadmap f-job-generate-from-pattern),
 * worked out and never kept: the days of its window, every day a source
 * record's date falls on in them — a date, a date that repeats
 * (`repeat.ts`: skipped days are not among them), a set of weekdays — and
 * for each, the record it wants: its key, the id that key gives it, and
 * its fields as `set` reads them on the source. Running it — making what
 * is not there yet, changing what the source changed and leaving what a
 * person changed — is `@graview/tools/workflows`'.
 */

/** A key when the step says none: one record per source and day. */
export const DEFAULT_GENERATE_KEY = "{source}:{date}";

/** The longest window a step makes records for, in days. */
export const MOST_WINDOW_DAYS = 366;

/** The most records one step wants in one run. */
export const MOST_GENERATED = 2000;

const WINDOW_WORDS = /^(?:today|tomorrow|this week|next week|next (\d{1,3}) days?)$/;

/** What a window says in words, or why it cannot be read. */
export function windowWordsProblem(window: string): string | undefined {
  const found = WINDOW_WORDS.exec(window.trim().toLowerCase());
  if (!found) return `"${window}" is not a window it can read: say "today", "tomorrow", "this week", "next week" or "next 7 days", or give { "from": …, "to": … }`;
  if (found[1] !== undefined && (+found[1] < 1 || +found[1] > MOST_WINDOW_DAYS)) return `"${window}" is not between 1 and ${MOST_WINDOW_DAYS} days`;
  return undefined;
}

/** The days a window covers, from and to (both included), on a day and the app's clock. A week starts on Monday. */
export function windowDays(window: GenerateWindow, at: { readonly today: string; readonly zone: string; readonly evaluate?: (expr: string) => Value }): { readonly from: string; readonly to: string } {
  const { today } = at;
  if (typeof window === "string") {
    const said = window.trim().toLowerCase();
    const problem = windowWordsProblem(said);
    if (problem) throw new Error(problem);
    const monday = startOfWeekOf({ day: today }, "mon");
    if (said === "today") return { from: today, to: today };
    if (said === "tomorrow") return { from: addDays(today, 1), to: addDays(today, 1) };
    if (said === "this week") return { from: monday, to: addDays(monday, 6) };
    if (said === "next week") return { from: addDays(monday, 7), to: addDays(monday, 13) };
    const days = Number(WINDOW_WORDS.exec(said)![1]);
    return { from: today, to: addDays(today, days - 1) };
  }
  const day = (expr: string, end: string): string => {
    const value = at.evaluate ? at.evaluate(expr) : null;
    const read = typeof value === "string" ? dayOfMoment(value, at.zone) : undefined;
    if (!read) throw new Error(`the window's ${end} (${expr}) is not a day`);
    return read;
  };
  const from = day(window.from, "from");
  const to = day(window.to, "to");
  if (to < from) throw new Error(`the window ends (${to}) before it begins (${from})`);
  if (addDays(from, MOST_WINDOW_DAYS - 1) < to) throw new Error(`the window is longer than ${MOST_WINDOW_DAYS} days`);
  return { from, to };
}

/** The days a record's date falls on between two days: a date, a date that repeats, or a set of weekdays. Each as the record says it (a moment keeps its time of day). */
export function datesIn(node: Readonly<Record<string, unknown>>, field: string, window: { readonly from: string; readonly to: string }, zone: string): string[] {
  const value = node[field];
  const repeat = node[repeatKey(field)];
  if (typeof value === "string" && isRepeat(repeat)) return occurrences(value, repeat, { from: window.from, to: window.to });
  if (typeof value === "string") {
    const day = dayOfMoment(value, zone);
    if (day) return day >= window.from && day <= window.to ? [value] : [];
  }
  const weekdays = weekdaysOf(value);
  if (weekdays.length === 0) return [];
  const out: string[] = [];
  for (let day = window.from; day <= window.to; day = addDays(day, 1)) if (weekdays.includes(WEEKDAYS[weekdayOf(day)]!)) out.push(day);
  return out;
}

/** One record a generate step wants. */
export interface WantedRecord {
  /** The record it comes from, and its kind. */
  readonly source: string;
  readonly sourceKind: string;
  /** The occurrence, as the source says it, and its day. */
  readonly date: string;
  readonly day: string;
  /** The step's key, read on the source and the occurrence. */
  readonly key: string;
  /** The id the key gives what the step makes: the same key, the same record. */
  readonly id: string;
  /** Its fields, as `set` reads them. */
  readonly values: Readonly<Record<string, unknown>>;
}

/** What a generate step wants for one run. */
export interface GenerateWants {
  readonly from: string;
  readonly to: string;
  readonly wanted: readonly WantedRecord[];
  /** What could not be read, by source record, in words. */
  readonly problems: readonly { readonly source?: string; readonly why: string }[];
}

/** A short, steady hash: FNV-1a, as eight hex digits. */
const hashOf = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
};

/**
 * THE ID A KEY GIVES: `<kind>:<workflow>.<key>`, the key's letters kept
 * where an id may hold them, and a hash of it when they are not all kept or
 * it runs long. The store makes a record under an id asked for and refuses
 * a second, so the same key is the same record however often a run repeats.
 */
export function keyedId(kind: string, workflow: string, key: string): string {
  const kept = key.replace(/[^A-Za-z0-9._:-]+/g, "-");
  const head = `${kind}:${workflow}.`;
  if (kept === key && head.length + kept.length <= 200) return head + kept;
  return `${(head + kept).slice(0, 180)}.${hashOf(key)}`;
}

const asValue = (value: Value): unknown => (value instanceof NodeSet ? value.nodes.map((node) => node.id) : value !== null && typeof value === "object" && !Array.isArray(value) && typeof (value as AnyGraphNode).id === "string" ? (value as AnyGraphNode).id : value);

/** A key's `{field}` template read: `source`, `date` (the day), `kind`, or the source's own field. */
function keyOf(template: string, node: AnyGraphNode, kind: string, day: string): string {
  return template.replace(/\{([^{}|\s]+)(?:\s*\|[^{}]*)?\}/g, (_all, name: string) => {
    if (name === "source" || name === "id") return node.id;
    if (name === "date") return day;
    if (name === "kind") return kind;
    const value = (node as unknown as Record<string, unknown>)[name];
    return value === undefined || value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  });
}

/** What a generate step reads a run with. */
export interface GenerateReading {
  readonly graph: Graph<AnySchema>;
  readonly schema: AnySchema;
  /** The workflow's name: in every id the step makes. */
  readonly workflow: string;
  readonly now: number;
  readonly timeZone?: string | undefined;
  readonly locale?: string | undefined;
}

/** WHAT A GENERATE STEP WANTS, on the graph as it stands: every record, in day order. */
export function generateWants(step: GenerateStep, reading: GenerateReading): GenerateWants {
  const zone = reading.timeZone ?? "UTC";
  const today = isoToday(zone, reading.now);
  const now = new Date(reading.now).toISOString();
  const kinds: ReadonlyMap<string, KindShape> = shapesOfSchema(reading.schema);
  const base = { graph: reading.graph, kinds, today, now, timeZone: zone, ...(reading.locale ? { locale: reading.locale } : {}) };
  const parsed = new Map<string, Expr>();
  const parse = (source: string): Expr => {
    let expr = parsed.get(source);
    if (!expr) parsed.set(source, (expr = parseExpr(source)));
    return expr;
  };
  const problems: { source?: string; why: string }[] = [];
  let window: { from: string; to: string };
  try {
    window = windowDays(step.window, { today, zone, evaluate: (expr) => evaluateExpr(parse(expr), { ...base, subject: null }) });
  } catch (e) {
    return { from: today, to: today, wanted: [], problems: [{ why: e instanceof Error ? e.message : String(e) }] };
  }
  const wanted: WantedRecord[] = [];
  const seen = new Set<string>();
  const template = step.key ?? DEFAULT_GENERATE_KEY;
  for (const from of step.from) {
    if (!reading.schema.tryDefinition(from.kind)) {
      problems.push({ why: `"${from.kind}" is not a kind of this app` });
      continue;
    }
    for (const node of reading.graph.nodesOfKind(from.kind) as AnyGraphNode[]) {
      try {
        if (from.where !== undefined && evaluateExpr(parse(from.where), { ...base, subject: node }) !== true) continue;
        for (const date of datesIn(node as unknown as Record<string, unknown>, from.dates, window, zone)) {
          const day = ISO_DAY.test(date) ? date : (dayOfMoment(date, zone) ?? date.slice(0, 10));
          const key = keyOf(template, node, from.kind, day);
          if (seen.has(key)) continue;
          seen.add(key);
          const values: Record<string, unknown> = {};
          for (const [field, spec] of Object.entries(step.set ?? {})) values[field] = valueOf(spec, { node, date, today, now, read: (expr) => evaluateExpr(parse(expr), { ...base, subject: node, bindings: { date, source: node.id } }) });
          wanted.push({ source: node.id, sourceKind: from.kind, date, day, key, id: keyedId(step.generate, reading.workflow, key), values });
          if (wanted.length >= MOST_GENERATED) {
            problems.push({ why: `it wants more than ${MOST_GENERATED} records in one run; the rest wait for the next` });
            return { ...window, wanted: sorted(wanted), problems };
          }
        }
      } catch (e) {
        problems.push({ source: node.id, why: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return { ...window, wanted: sorted(wanted), problems };
}

const sorted = (wanted: WantedRecord[]): WantedRecord[] => wanted.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

/** A value `set` gives, read on the source: `$date`, `$source`, `$today`, `$now`, `{ expr }`, or itself. */
function valueOf(spec: WorkflowValue, at: { readonly node: AnyGraphNode; readonly date: string; readonly today: string; readonly now: string; readonly read: (expr: string) => Value }): unknown {
  if (typeof spec === "string") {
    if (spec === "$date") return at.date;
    if (spec === "$source" || spec === "$subject") return at.node.id;
    if (spec === "$today") return at.today;
    if (spec === "$now") return at.now;
    return spec;
  }
  if (spec !== null && typeof spec === "object" && !Array.isArray(spec)) return asValue(at.read((spec as { expr: string }).expr));
  return spec;
}

/** The `$` names a generate step's values may give. */
export const GENERATE_REFS = ["$date", "$source", "$subject", "$today", "$now"] as const;
