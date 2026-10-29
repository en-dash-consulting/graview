import { isArchived, type Archived } from "../../graph/archived.js";
import { withArticle } from "../../schema/define-node.js";
import { daySpanOf, ISO_MOMENT, isoToday, PARTIAL_DAY } from "../../days.js";
import { dateOn } from "../../repeat.js";
import type { AnyGraphNode, GraphReader } from "../../graph/types.js";
import type { Expr } from "./parse.js";
import { linkedReaderOf, linkedRefsOf, type LinkedReader, type LinkedRecord, type LinkedRecordRef, type LinkedRelation } from "../../schema/linked.js";
import { addMinutesTo, datetimeAt, formatWhen, isWeekday, minutesOfTime, startOfWeekOf, weekdayOfWhen, whenOf, zoneOf, type When } from "./when.js";

/*
 * THE RULE LANGUAGE, JUDGED.
 *
 * Every evaluation runs under a budget of steps. A rule cannot loop — the
 * language has no loops — but `count(all('task') where …)` inside a rule over
 * every task is quadratic, and a host of strangers' apps cannot let one
 * document spend another's CPU. Exceeding the budget is an answer
 * (`ExprBudgetError`), never a hang.
 */

export const DEFAULT_BUDGET = 10_000;

export class NodeSet {
  constructor(readonly nodes: readonly AnyGraphNode[]) {}
}

export type Value = string | number | boolean | null | AnyGraphNode | NodeSet | readonly Value[];

export interface KindShape {
  readonly fields: ReadonlySet<string>;
  /** Edge kinds declared FROM this kind, and whether each holds one target. */
  readonly edges: ReadonlyMap<string, "one" | "many">;
  /**
   * Values worked out rather than stored (FR-83), by name: read like a field,
   * evaluated with the record as their subject, from the same budget as the
   * expression that reads them.
   */
  readonly computed?: ReadonlyMap<string, Expr>;
  /**
   * Relations to kinds in another app (FR-171), by the field each link is
   * kept in: read like a relation — `forHouse.listPrice` — through the
   * reader of whoever is looking (`EvalContext.linked`).
   */
  readonly linked?: ReadonlyMap<string, LinkedRelation>;
  /**
   * The labels a choice field's options are given, by field (Roadmap
   * f-option-labels) — empty where none is. A template that names the
   * field bare — a kind's `describe`, its label, a rule's sentence — says
   * the option by its label, else its id spoken, never the id itself.
   */
  readonly choices?: ReadonlyMap<string, Readonly<Record<string, string>>>;
}

/** A link an expression walked and could not read: the viewer may not open the far app, or its record is not read (yet, or at all). */
export interface UnreadLink {
  readonly relation: string;
  readonly ref: LinkedRecordRef;
  readonly reason: "denied" | "unread";
}

/** A far record, as the rule language holds one: its fields this viewer may see, its label, and where it is. */
const FAR = Symbol.for("@graview/core:far-record");

/** Whether a value the language holds is a record of another app. */
export const isFarRecord = (v: unknown): boolean => typeof v === "object" && v !== null && (v as { [FAR]?: true })[FAR] === true;

function farRecord(record: LinkedRecord): AnyGraphNode {
  const node = { ...record.fields, id: `@${record.address}/${record.kind}:${record.id}`, kind: `@${record.address}/${record.kind}`, label: record.label } as unknown as AnyGraphNode;
  Object.defineProperty(node, FAR, { value: true });
  return node;
}

/** What a link that could not be read says: whom it is kept from, or that it is not read. */
export function unreadSaid(unread: UnreadLink): string {
  // A far kind's noun is its own app's to say, and this app has no words for it: the link is said as one.
  const what = `the linked record in ${unread.ref.address}`;
  return unread.reason === "denied" ? `${what} is not one this viewer may open` : `${what} has not been read`;
}

/**
 * WHERE THE WHOLE GRAPH'S FACTS STAND among the kinds: a shape no kind can
 * have the name of (kinds are words), whose `computed` are the app's facts
 * (a document's top-level `computed`), read as `fact('<name>')`.
 */
export const GRAPH_FACTS = "";

export interface EvalContext {
  readonly graph: GraphReader;
  /** The node bare names refer to; null for graph-wide rules. */
  readonly subject: AnyGraphNode | null;
  readonly kinds: ReadonlyMap<string, KindShape>;
  /** Named values beyond the subject's fields: act arguments, `$new`, … */
  readonly bindings?: Readonly<Record<string, Value>>;
  readonly today?: string;
  readonly now?: string;
  readonly budget?: number;
  /**
   * The app's locale and time zone (`brand.locale`, `brand.timeZone`): what
   * `format(…)` says a moment in and the clock `datetime(…)`, `weekday(…)`
   * and `startOfWeek(…)` read it on. Unsaid, the app the page draws; else
   * en-US and UTC — never the reader's, since a value the language builds
   * may be kept on a record.
   */
  readonly locale?: string;
  readonly timeZone?: string;
  /**
   * How far records are read (FR-171), as whoever is looking: else the
   * reader registered for the graph (`readLinkedThrough`), else none — and
   * every link reads as unread.
   */
  readonly linked?: LinkedReader;
  /** Told of each link walked that could not be read, so its reader can say so: the expression reads nothing there and goes on. */
  readonly onUnread?: (unread: UnreadLink) => void;
}

export class ExprEvalError extends Error {
  constructor(
    readonly sentence: string,
    readonly at: number,
  ) {
    super(sentence);
  }
}

export class ExprBudgetError extends ExprEvalError {}

const isNode = (v: Value): v is AnyGraphNode =>
  v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof NodeSet) && typeof (v as AnyGraphNode).id === "string";

/** Each record once, in the order first given. */
const distinct = (nodes: readonly AnyGraphNode[]): NodeSet => {
  const seen = new Set<string>();
  return new NodeSet(nodes.filter((n) => !seen.has(n.id) && seen.add(n.id)));
};

const describe = (v: Value): string =>
  v === null ? "nothing" : v instanceof NodeSet ? "a set of records" : Array.isArray(v) ? "a list" : isNode(v) ? "a record" : typeof v === "string" ? "a word" : typeof v;

/** The days two values cover, when one is a year or a month alone and the other a day, a moment or such a date too: what they are compared by. Undefined otherwise. */
function spansOf(a: string, b: string): readonly [{ readonly from: string; readonly to: string }, { readonly from: string; readonly to: string }] | undefined {
  if (!PARTIAL_DAY.test(a) && !PARTIAL_DAY.test(b)) return undefined;
  const span = (s: string) => daySpanOf(ISO_MOMENT.test(s) ? s.slice(0, 10) : s);
  const x = span(a);
  const y = span(b);
  return x && y ? [x, y] : undefined;
}

/** Evaluate an expression. Throws `ExprEvalError` (with a sentence) on a type mistake or an exhausted budget. */
export function evaluateExpr(expr: Expr, ctx: EvalContext): Value {
  let steps = ctx.budget ?? DEFAULT_BUDGET;
  const spend = (n: number, at: number) => {
    steps -= n;
    if (steps < 0) throw new ExprBudgetError("this rule looks at too much of the graph to judge in one go", at);
  };
  const today = ctx.today ?? isoToday();
  const now = ctx.now ?? new Date().toISOString();
  const zone = zoneOf(ctx.timeZone);
  /*
   * A COMPUTED FIELD IS WORKED OUT ONCE PER EVALUATION, and never while it
   * is being worked out: a cycle the check could not see (across kinds,
   * through a relation) is a sentence here, not a stack overflow. Its own
   * expression sees the record's fields and nothing an act was handed.
   */
  const worked = new Map<string, Value>();
  const working = new Set<string>();
  let bindings = ctx.bindings;
  const computed = (node: AnyGraphNode | null, name: string, expr: Expr, at: number): Value => {
    const key = `${node?.id}\u0000${name}`;
    if (worked.has(key)) return worked.get(key)!;
    if (working.has(key)) throw new ExprEvalError(`"${name}"${node ? ` of ${withArticle(node.kind)}` : ""} depends on itself`, at);
    working.add(key);
    const outer = bindings;
    bindings = undefined;
    try {
      const value = run(expr, node);
      worked.set(key, value);
      return value;
    } finally {
      bindings = outer;
      working.delete(key);
    }
  };

  const field = (node: AnyGraphNode, name: string, at: number): Value => {
    spend(1, at);
    const shape = ctx.kinds.get(node.kind);
    const worksOut = shape?.computed?.get(name);
    if (worksOut) return computed(node, name, worksOut, at);
    /*
     * A RELATION TO ANOTHER APP (FR-171): the records the link keeps, read
     * as the viewer. One that cannot be read — not theirs to open, or not
     * read — is not there, and is said (`onUnread`), never thrown.
     */
    const link = shape?.linked?.get(name);
    if (link) {
      const refs = linkedRefsOf(Object.hasOwn(node, name) ? node[name] : undefined, link);
      spend(refs.length, at);
      const reader = ctx.linked ?? linkedReaderOf(ctx.graph);
      const records = refs.flatMap((ref) => {
        const read = reader ? reader(ref) : ({ unread: true } as const);
        if ("record" in read) return [farRecord(read.record)];
        ctx.onUnread?.({ relation: name, ref, reason: "denied" in read ? "denied" : "unread" });
        return [];
      });
      return link.cardinality === "one" ? (records[0] ?? null) : new NodeSet(records);
    }
    // A record's OWN values only: `constructor` or `__proto__` is not a field of anything, and reading one would hand a template a function.
    const own = Object.hasOwn(node, name);
    if (shape?.fields.has(name) || own) {
      // A date that repeats reads as its next occurrence on the day judged (`repeat.ts`).
      const v = own ? dateOn(node, name, today) : undefined;
      return v === undefined ? null : (v as Value);
    }
    const card = shape?.edges.get(name);
    if (card) {
      const targets = ctx.graph.out(node.id, name);
      spend(targets.length, at);
      return card === "one" ? (targets[0] ?? null) : new NodeSet(targets);
    }
    if (name === "id") return node.id;
    // A far record holds only what this viewer may see there: what it does not hold reads as nothing.
    if (isFarRecord(node)) return null;
    throw new ExprEvalError(`${withArticle(node.kind)} has no field or relation called "${name}"`, at);
  };

  const asSet = (v: Value, at: number, fn: string): NodeSet => {
    if (v instanceof NodeSet) return v;
    if (v === null) return new NodeSet([]);
    if (isNode(v)) return new NodeSet([v]);
    throw new ExprEvalError(`${fn}(…) needs a set of records, and was given ${describe(v)}`, at);
  };
  const asString = (v: Value, at: number, fn: string): string | null => {
    if (v === null) return null;
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    throw new ExprEvalError(`${fn}(…) needs a word, and was given ${describe(v)}`, at);
  };
  const asDate = (v: Value, at: number, fn: string): number | null => {
    const s = asString(v, at, fn);
    if (s === null) return null;
    // A year or a month alone (Roadmap f-partial-dates-arithmetic) is measured from the first day it covers: days('2006', '2016-05') is from Jan 1, 2006 to May 1, 2016.
    const day = PARTIAL_DAY.test(s) ? daySpanOf(s)!.from : s;
    const t = Date.parse(day.length === 10 ? `${day}T00:00:00Z` : day);
    if (Number.isNaN(t)) throw new ExprEvalError(`${fn}(…) needs a date, and "${s}" is not one`, at);
    return t;
  };
  // A moment on the app's wall (`when.ts`): a day, a wall time or an instant; nothing is nothing.
  const asWhen = (v: Value, at: number, fn: string): When | null => {
    if (v === null) return null;
    if (typeof v !== "string") throw new ExprEvalError(`${fn}(…) needs a date, and was given ${describe(v)}`, at);
    const when = whenOf(v, zone);
    if (!when) throw new ExprEvalError(`${fn}(…) needs a date, and "${v}" is not one`, at);
    return when;
  };
  const equal = (a: Value, b: Value): boolean => {
    if (isNode(a) && isNode(b)) return a.id === b.id;
    if (isNode(a) && typeof b === "string") return a.id === b;
    if (typeof a === "string" && isNode(b)) return a === b.id;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]!));
    return a === b;
  };
  const truthy = (v: Value, at: number, where: string): boolean => {
    if (v === null) return false;
    if (typeof v === "boolean") return v;
    throw new ExprEvalError(`${where} must be true or false, and was ${describe(v)}`, at);
  };

  const withSubject = (subject: AnyGraphNode | null, e: Expr): Value => run(e, subject);

  function run(e: Expr, subject: AnyGraphNode | null): Value {
    spend(1, e.at);
    switch (e.t) {
      case "lit":
        return e.value;
      case "list":
        return e.items.map((item) => run(item, subject));
      case "ident": {
        const bound = bindings && Object.hasOwn(bindings, e.name) ? bindings[e.name] : undefined;
        if (bound !== undefined) return bound;
        if (subject) return field(subject, e.name, e.at);
        throw new ExprEvalError(`"${e.name}" means nothing in a rule over the whole graph`, e.at);
      }
      case "member": {
        const object = run(e.object, subject);
        if (object === null) return null;
        if (isNode(object)) return field(object, e.name, e.at);
        throw new ExprEvalError(`".${e.name}" needs a record before it, and was given ${describe(object)}`, e.at);
      }
      case "unary": {
        const v = run(e.operand, subject);
        if (e.op === "!") return !truthy(v, e.at, "what follows not");
        if (v === null) return null;
        if (typeof v !== "number") throw new ExprEvalError(`"-" needs a number, and was given ${describe(v)}`, e.at);
        return -v;
      }
      case "where": {
        const set = asSet(run(e.set, subject), e.at, "where");
        spend(set.nodes.length, e.at);
        return new NodeSet(set.nodes.filter((member) => truthy(withSubject(member, e.filter), e.at, "a where condition")));
      }
      case "binary":
        return binary(e, subject);
      case "call":
        return call(e, subject);
    }
  }

  function binary(e: Extract<Expr, { t: "binary" }>, subject: AnyGraphNode | null): Value {
    if (e.op === "&&") return truthy(run(e.left, subject), e.at, "each side of and") && truthy(run(e.right, subject), e.at, "each side of and");
    if (e.op === "||") return truthy(run(e.left, subject), e.at, "each side of or") || truthy(run(e.right, subject), e.at, "each side of or");
    const a = run(e.left, subject);
    const b = run(e.right, subject);
    // Sets meet, join and part (FR-101): each record once, in the order the left side has them, then the right's.
    if (e.op === "&" || e.op === "|" || (e.op === "-" && (a instanceof NodeSet || b instanceof NodeSet))) {
      const left = asSet(a, e.at, e.op).nodes;
      const right = asSet(b, e.at, e.op).nodes;
      spend(left.length + right.length, e.at);
      const inRight = new Set(right.map((n) => n.id));
      return distinct(e.op === "|" ? [...left, ...right] : left.filter((n) => inRight.has(n.id) === (e.op === "&")));
    }
    switch (e.op) {
      case "==":
        return equal(a, b);
      case "!=":
        return !equal(a, b);
      case "in": {
        if (b === null) return false;
        if (b instanceof NodeSet) return b.nodes.some((n) => equal(a, n));
        if (Array.isArray(b)) return b.some((x) => equal(a, x));
        if (typeof b === "string" && typeof a === "string") return b.includes(a);
        throw new ExprEvalError(`"in" needs a list or a set on its right, and was given ${describe(b)}`, e.at);
      }
      case "<":
      case "<=":
      case ">":
      case ">=": {
        if (a === null || b === null) return false;
        const comparable = (typeof a === "number" && typeof b === "number") || (typeof a === "string" && typeof b === "string");
        if (!comparable) throw new ExprEvalError(`cannot compare ${describe(a)} with ${describe(b)}`, e.at);
        /*
         * A DATE THAT KNOWS ONLY ITS YEAR OR ITS MONTH IS COMPARED BY THE
         * SPAN IT COVERS (Roadmap f-partial-dates-arithmetic). `2006` is
         * the whole of 2006: before a day only when all of it is, after one
         * only when all of it is, and equal to another date only when the
         * two cover the same days. A span that overlaps the other date is
         * none of these, so `firstSeen <= today()` is false of a month the
         * day is in. As written, "2006" < "2006-03-04" would have been true
         * by its letters alone.
         */
        const spans = typeof a === "string" && typeof b === "string" ? spansOf(a, b) : undefined;
        if (spans) {
          const [x, y] = spans;
          const before = x.to < y.from;
          const after = x.from > y.to;
          const same = x.from === y.from && x.to === y.to;
          return e.op === "<" ? before : e.op === "<=" ? before || same : e.op === ">" ? after : after || same;
        }
        return e.op === "<" ? a < b : e.op === "<=" ? a <= b : e.op === ">" ? a > b : a >= b;
      }
      default: {
        if (a === null || b === null) return null;
        if (e.op === "+" && (typeof a === "string" || typeof b === "string")) {
          const s = `${asString(a, e.at, "+")}${asString(b, e.at, "+")}`;
          if (s.length > 10_000) throw new ExprEvalError("that makes a word too long", e.at);
          return s;
        }
        if (typeof a !== "number" || typeof b !== "number") throw new ExprEvalError(`"${e.op}" needs numbers, and was given ${describe(a)} and ${describe(b)}`, e.at);
        if ((e.op === "/" || e.op === "%") && b === 0) return null;
        return e.op === "+" ? a + b : e.op === "-" ? a - b : e.op === "*" ? a * b : e.op === "/" ? a / b : a % b;
      }
    }
  }

  function call(e: Extract<Expr, { t: "call" }>, subject: AnyGraphNode | null): Value {
    const arity = (n: number, m = n) => {
      if (e.args.length < n || e.args.length > m) {
        throw new ExprEvalError(`${e.fn}(…) takes ${n === m ? n : `${n} to ${m}`} argument${m === 1 ? "" : "s"}`, e.at);
      }
    };
    const arg = (i: number) => run(e.args[i]!, subject);
    const word = (i: number) => {
      const v = arg(i);
      if (typeof v !== "string") throw new ExprEvalError(`${e.fn}(…) needs a quoted name, like ${e.fn}('name')`, e.at);
      return v;
    };
    switch (e.fn) {
      case "out":
      case "in": {
        arity(1, 2);
        const walk = (id: string, edge: string) => (e.fn === "out" ? ctx.graph.out(id, edge) : ctx.graph.in(id, edge));
        // A walk from every member of a set (FR-101): out(S, 'edge') reaches each record once, in the order first reached.
        if (e.args.length === 2) {
          const from = asSet(arg(0), e.at, e.fn).nodes;
          const edge = word(1);
          return distinct(
            from.flatMap((node) => {
              const reached = walk(node.id, edge);
              spend(reached.length + 1, e.at);
              return reached;
            }),
          );
        }
        const edge = word(0);
        if (!subject) throw new ExprEvalError(`${e.fn}('${edge}') needs a record to start from`, e.at);
        const nodes = walk(subject.id, edge);
        spend(nodes.length, e.at);
        return new NodeSet(nodes);
      }
      case "all": {
        /*
         * THE LIVE RECORDS of a kind, unless the rule asks for others
         * (FR-173): all('task', true) the archived ones, all('task', 'all')
         * both. An archived record counts in no rule that does not ask.
         */
        arity(1, 2);
        const nodes = ctx.graph.nodesOfKind(word(0), { archived: e.args.length === 2 ? (arg(1) as Archived) : false });
        spend(nodes.length, e.at);
        return new NodeSet(nodes);
      }
      case "archived": {
        // Whether a record is archived: the subject's own, or the one given (FR-173).
        arity(0, 1);
        return isArchived(e.args.length === 1 ? arg(0) : subject);
      }
      case "count":
        arity(1);
        return asSet(arg(0), e.at, "count").nodes.length;
      case "exists":
        arity(1);
        return asSet(arg(0), e.at, "exists").nodes.length > 0;
      case "every":
      case "some": {
        arity(2);
        const set = asSet(arg(0), e.at, e.fn);
        spend(set.nodes.length, e.at);
        const test = (n: AnyGraphNode) => truthy(withSubject(n, e.args[1]!), e.at, `the condition in ${e.fn}(…)`);
        return e.fn === "every" ? set.nodes.every(test) : set.nodes.some(test);
      }
      case "sum":
      case "min":
      case "max": {
        arity(2);
        const set = asSet(arg(0), e.at, e.fn);
        spend(set.nodes.length, e.at);
        /*
         * Each member's value: a field named bare or quoted — sum(S, quote),
         * sum(S, 'quote') — or any expression read with the member as its
         * subject: sum(out('includes'), list * units).
         */
        const second = e.args[1]!;
        const quoted = second.t === "lit" && typeof second.value === "string" ? second.value : undefined;
        const what = second.t === "ident" ? `'${second.name}'` : quoted !== undefined ? `'${quoted}'` : "…";
        const values = set.nodes
          .map((n) => (second.t === "ident" ? field(n, second.name, e.at) : quoted !== undefined ? field(n, quoted, e.at) : withSubject(n, second)))
          .filter((v): v is number => {
            if (v === null) return false;
            if (typeof v !== "number") throw new ExprEvalError(`${e.fn}(…, ${what}) needs a number for each member, and found ${describe(v)}`, e.at);
            return true;
          });
        if (e.fn === "sum") return values.reduce((s, v) => s + v, 0);
        if (values.length === 0) return null;
        return e.fn === "min" ? Math.min(...values) : Math.max(...values);
      }
      case "fact": {
        arity(1);
        const name = word(0);
        const expr = ctx.kinds.get(GRAPH_FACTS)?.computed?.get(name);
        if (!expr) throw new ExprEvalError(`no fact is called "${name}"`, e.at);
        return computed(null, name, expr, e.at);
      }
      case "first": {
        arity(1);
        return asSet(arg(0), e.at, "first").nodes[0] ?? null;
      }
      case "sort": {
        arity(2, 3);
        const set = asSet(arg(0), e.at, "sort");
        const direction = e.args.length === 3 ? arg(2) : "asc";
        if (direction !== "asc" && direction !== "desc") throw new ExprEvalError("sort(…) goes 'asc' or 'desc'", e.at);
        const n = set.nodes.length;
        // Each member's key, then the comparisons: n log n of them, paid for before they are made.
        spend(n + n * Math.ceil(Math.log2(n + 1)), e.at);
        const keyed = set.nodes.map((node, i) => ({ node, i, key: withSubject(node, e.args[1]!) }));
        const sign = direction === "desc" ? -1 : 1;
        keyed.sort((a, b) => compareKeys(a.key, b.key, sign, e.at) || a.i - b.i);
        return new NodeSet(keyed.map((k) => k.node));
      }
      case "either": {
        if (e.args.length < 1) throw new ExprEvalError("either(…) takes at least one argument", e.at);
        for (let i = 0; i < e.args.length; i++) {
          const v = arg(i);
          if (v !== null && !(v instanceof NodeSet && v.nodes.length === 0)) return v;
        }
        return null;
      }
      case "present": {
        arity(1);
        const v = arg(0);
        if (v === null || v === "") return false;
        if (Array.isArray(v)) return v.length > 0;
        if (v instanceof NodeSet) return v.nodes.length > 0;
        return true;
      }
      case "len": {
        arity(1);
        const v = arg(0);
        if (v === null) return 0;
        if (typeof v === "string" || Array.isArray(v)) return v.length;
        if (v instanceof NodeSet) return v.nodes.length;
        throw new ExprEvalError(`len(…) needs a word or a list, and was given ${describe(v)}`, e.at);
      }
      case "contains":
      case "startsWith": {
        arity(2);
        const a = arg(0);
        const b = arg(1);
        if (a === null || b === null) return false;
        if (e.fn === "contains" && Array.isArray(a)) return a.some((x) => equal(x, b));
        const s = asString(a, e.at, e.fn)!;
        const t = asString(b, e.at, e.fn)!;
        return e.fn === "contains" ? s.toLowerCase().includes(t.toLowerCase()) : s.startsWith(t);
      }
      case "lower": {
        arity(1);
        const s = asString(arg(0), e.at, "lower");
        return s === null ? null : s.toLowerCase();
      }
      case "concat": {
        /*
         * WORDS JOINED (Roadmap f-formula-text-datetime): concat(name, ' · ',
         * place). Nothing joins as no words at all, where `+` would make the
         * whole nothing: a title with an empty middle is still a title.
         */
        if (e.args.length < 1) throw new ExprEvalError("concat(…) takes at least one argument", e.at);
        let s = "";
        for (let i = 0; i < e.args.length; i++) s += asString(arg(i), e.at, "concat") ?? "";
        if (s.length > 10_000) throw new ExprEvalError("that makes a word too long", e.at);
        return s;
      }
      case "format": {
        // A moment said by a pattern — format(start, 'EEE d MMM, h:mm a') — in the app's locale, on its clock.
        arity(2);
        const when = asWhen(arg(0), e.at, "format");
        const pattern = arg(1);
        if (typeof pattern !== "string") throw new ExprEvalError("format(…) says its pattern in quotes, like format(start, 'EEE h:mm a')", e.at);
        if (when === null) return null;
        const said = formatWhen(when, pattern, ctx.locale);
        if (typeof said !== "string") throw new ExprEvalError(said.problem, e.at);
        return said;
      }
      case "datetime":
      case "at": {
        // A day at a time of day on the app's wall, as an instant: datetime(due, '09:30'), at(due, startTime).
        arity(2);
        const when = asWhen(arg(0), e.at, e.fn);
        const time = arg(1);
        if (time === null || when === null) return null;
        const minutes = typeof time === "string" ? minutesOfTime(time) : undefined;
        if (minutes === undefined) throw new ExprEvalError(`${e.fn}(…) needs a time of day written like '09:30', and was given ${typeof time === "string" ? `"${time}"` : describe(time)}`, e.at);
        return datetimeAt(when, minutes, zone);
      }
      case "addMinutes": {
        arity(2);
        const when = asWhen(arg(0), e.at, "addMinutes");
        const count = arg(1);
        if (when === null || count === null) return null;
        if (typeof count !== "number" || !Number.isFinite(count)) throw new ExprEvalError(`addMinutes(…) needs a number of minutes, and was given ${describe(count)}`, e.at);
        return addMinutesTo(when, Math.round(count));
      }
      case "weekday": {
        arity(1);
        const when = asWhen(arg(0), e.at, "weekday");
        return when === null ? null : weekdayOfWhen(when);
      }
      case "startOfWeek": {
        arity(1, 2);
        const when = asWhen(arg(0), e.at, "startOfWeek");
        const first = e.args.length === 2 ? arg(1) : "mon";
        if (!isWeekday(first)) throw new ExprEvalError("startOfWeek(…) starts the week on a day said 'mon' to 'sun'", e.at);
        return when === null ? null : startOfWeekOf(when, first);
      }
      case "today":
        arity(0);
        return today;
      case "now":
        arity(0);
        return now;
      case "date": {
        arity(1);
        const t = asDate(arg(0), e.at, "date");
        return t === null ? null : new Date(t).toISOString().slice(0, 10);
      }
      case "days":
      case "hours": {
        arity(2);
        const a = asDate(arg(0), e.at, e.fn);
        const b = asDate(arg(1), e.at, e.fn);
        if (a === null || b === null) return null;
        const span = (b - a) / (e.fn === "days" ? 86_400_000 : 3_600_000);
        return e.fn === "days" ? Math.round(span) : span;
      }
      case "round": {
        /*
         * A NUMBER ROUNDED (FR-217): round(x) to a whole number, round(x, 2)
         * to two places — half away from zero, as people round. Nothing stays
         * nothing, so a share of no games is not a zero.
         */
        arity(1, 2);
        const x = arg(0);
        if (x === null) return null;
        if (typeof x !== "number") throw new ExprEvalError(`round(…) needs a number, and was given ${describe(x)}`, e.at);
        const places = e.args.length === 2 ? arg(1) : 0;
        if (typeof places !== "number" || !Number.isInteger(places) || places < 0 || places > 12) throw new ExprEvalError("round(…, places) takes a whole number of places from 0 to 12", e.at);
        const scale = 10 ** places;
        const rounded = (Math.sign(x) * Math.round(Math.abs(x) * scale * (1 + Number.EPSILON))) / scale;
        return Object.is(rounded, -0) ? 0 : rounded;
      }
      case "if": {
        arity(3);
        return truthy(arg(0), e.at, "the condition in if(…)") ? arg(1) : arg(2);
      }
      default:
        throw new ExprEvalError(`"${e.fn}" is not a function the rule language knows`, e.at);
    }
  }

  /*
   * ORDER, for sort(…): numbers by size, words alphabetically, false before
   * true, dates as the words they are written in, a list by its first value
   * and then its next. Nothing sorts last whichever way, so "the top one"
   * is never a record with no value.
   */
  function compareKeys(a: Value, b: Value, sign: number, at: number): number {
    if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const c = compareKeys((a[i] ?? null) as Value, (b[i] ?? null) as Value, sign, at);
        if (c !== 0) return c;
      }
      return 0;
    }
    const kind = (v: Value) => (typeof v === "number" || typeof v === "string" || typeof v === "boolean" ? typeof v : describe(v));
    if (kind(a) !== kind(b) || typeof a === "object" || typeof b === "object") throw new ExprEvalError(`sort(…) cannot put ${describe(a)} and ${describe(b)} in order`, at);
    if (typeof a === "string") return sign * (a < (b as string) ? -1 : a > (b as string) ? 1 : 0);
    return sign * (Number(a) - Number(b));
  }

  return run(expr, ctx.subject);
}

/** The names of every function the language knows — the check reports any other. */
export const FUNCTIONS = [
  "out", "in", "all", "count", "exists", "every", "some", "sum", "min", "max", "present", "len",
  "contains", "startsWith", "lower", "today", "now", "date", "days", "hours", "if", "first", "sort", "either", "fact", "archived", "round",
  "concat", "format", "datetime", "at", "addMinutes", "weekday", "startOfWeek",
] as const;
