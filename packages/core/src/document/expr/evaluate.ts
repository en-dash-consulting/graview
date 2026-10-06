import { withArticle } from "../../schema/define-node.js";
import type { AnyGraphNode, GraphReader } from "../../index.js";
import type { Expr } from "./parse.js";

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
}

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

const describe = (v: Value): string =>
  v === null ? "nothing" : v instanceof NodeSet ? "a set of records" : Array.isArray(v) ? "a list" : isNode(v) ? "a record" : typeof v === "string" ? "a word" : typeof v;

/** Evaluate an expression. Throws `ExprEvalError` (with a sentence) on a type mistake or an exhausted budget. */
export function evaluateExpr(expr: Expr, ctx: EvalContext): Value {
  let steps = ctx.budget ?? DEFAULT_BUDGET;
  const spend = (n: number, at: number) => {
    steps -= n;
    if (steps < 0) throw new ExprBudgetError("this rule looks at too much of the graph to judge in one go", at);
  };
  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  const now = ctx.now ?? new Date().toISOString();
  /*
   * A COMPUTED FIELD IS WORKED OUT ONCE PER EVALUATION, and never while it
   * is being worked out: a cycle the check could not see (across kinds,
   * through a relation) is a sentence here, not a stack overflow. Its own
   * expression sees the record's fields and nothing an act was handed.
   */
  const worked = new Map<string, Value>();
  const working = new Set<string>();
  let bindings = ctx.bindings;
  const computed = (node: AnyGraphNode, name: string, expr: Expr, at: number): Value => {
    const key = `${node.id}\u0000${name}`;
    if (worked.has(key)) return worked.get(key)!;
    if (working.has(key)) throw new ExprEvalError(`"${name}" of ${withArticle(node.kind)} depends on itself`, at);
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
    // A record's OWN values only: `constructor` or `__proto__` is not a field of anything, and reading one would hand a template a function.
    const own = Object.prototype.hasOwnProperty.call(node, name);
    if (shape?.fields.has(name) || own) {
      const v = own ? node[name] : undefined;
      return v === undefined ? null : (v as Value);
    }
    const card = shape?.edges.get(name);
    if (card) {
      const targets = ctx.graph.out(node.id, name);
      spend(targets.length, at);
      return card === "one" ? (targets[0] ?? null) : new NodeSet(targets);
    }
    if (name === "id") return node.id;
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
    const t = Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s);
    if (Number.isNaN(t)) throw new ExprEvalError(`${fn}(…) needs a date, and "${s}" is not one`, at);
    return t;
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
        const bound = bindings && Object.prototype.hasOwnProperty.call(bindings, e.name) ? bindings[e.name] : undefined;
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
        arity(1);
        const edge = word(0);
        if (!subject) throw new ExprEvalError(`${e.fn}('${edge}') needs a record to start from`, e.at);
        const nodes = e.fn === "out" ? ctx.graph.out(subject.id, edge) : ctx.graph.in(subject.id, edge);
        spend(nodes.length, e.at);
        return new NodeSet(nodes);
      }
      case "all": {
        arity(1);
        const nodes = ctx.graph.nodesOfKind(word(0));
        spend(nodes.length, e.at);
        return new NodeSet(nodes);
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
  "contains", "startsWith", "lower", "today", "now", "date", "days", "hours", "if", "first", "sort", "either",
] as const;
