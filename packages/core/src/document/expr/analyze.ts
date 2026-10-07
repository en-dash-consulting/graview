import { FUNCTIONS } from "./evaluate.js";
import type { Expr } from "./parse.js";

export interface ExprShape {
  /** Bare names read from the subject (or from bindings). */
  readonly names: ReadonlySet<string>;
  readonly functions: ReadonlySet<string>;
  readonly unknownFunctions: readonly string[];
  /** Kinds swept with all('kind') — quadratic inside a per-subject rule. */
  readonly sweeps: readonly string[];
  /** Edge kinds walked with out()/in(). */
  readonly edges: readonly string[];
}

/**
 * The argument of a function that is read once PER MEMBER of the set before
 * it, with that member as its subject: every(S, cond), some(S, cond),
 * sum/min/max(S, expr) and sort(S, key, …). Its bare names are the
 * members', not the subject's.
 */
export function perMember(e: Extract<Expr, { t: "call" }>, i: number): boolean {
  return i === 1 && ["every", "some", "sum", "min", "max", "sort"].includes(e.fn);
}

/** What an expression touches, without running it — for `graview check`-style findings. */
export function analyzeExpr(expr: Expr): ExprShape {
  const names = new Set<string>();
  const functions = new Set<string>();
  const sweeps: string[] = [];
  const edges: string[] = [];
  const known = new Set<string>(FUNCTIONS);
  const visit = (e: Expr, inWhere: boolean): void => {
    switch (e.t) {
      case "lit":
        return;
      case "ident":
        if (!inWhere) names.add(e.name);
        return;
      case "list":
        e.items.forEach((x) => visit(x, inWhere));
        return;
      case "member":
        visit(e.object, inWhere);
        return;
      case "unary":
        visit(e.operand, inWhere);
        return;
      case "binary":
        visit(e.left, inWhere);
        visit(e.right, inWhere);
        return;
      case "where":
        visit(e.set, inWhere);
        visit(e.filter, true);
        return;
      case "call": {
        functions.add(e.fn);
        // A walk names its relation first, or second after the set it walks from (FR-101).
        const first = (e.fn === "out" || e.fn === "in") && e.args.length === 2 ? e.args[1] : e.args[0];
        const literal = first?.t === "lit" && typeof first.value === "string" ? first.value : undefined;
        if (e.fn === "all" && literal) sweeps.push(literal);
        if ((e.fn === "out" || e.fn === "in") && literal) edges.push(literal);
        e.args.forEach((x, i) => visit(x, inWhere || perMember(e, i)));
        return;
      }
    }
  };
  visit(expr, false);
  return { names, functions, unknownFunctions: [...functions].filter((f) => !known.has(f)), sweeps, edges };
}

/**
 * HOW AN EXPRESSION'S WORK GROWS WITH THE GRAPH, as a power of its size:
 * 0 reads a record and its neighbors, 1 sweeps a kind (`all('offer')`),
 * 2 sweeps a kind once for every member of a sweep. A per-member argument
 * costs once per member, so its degree ADDS to its set's; anything else
 * costs the most of its parts. Relations are walked, not swept: a record's
 * neighbors are its own, however large the graph.
 *
 * `computedDegree(name)` is what reading a name costs when it is a computed
 * field (a bare name is the subject's; `x.name` and a per-member name may
 * be any kind's, so the caller answers with the dearest of that name).
 */
export function costDegree(expr: Expr, computedDegree: (name: string, bare: boolean) => number): number {
  const degree = (e: Expr, bare: boolean): number => {
    switch (e.t) {
      case "lit":
        return 0;
      case "ident":
        return computedDegree(e.name, bare);
      case "list":
        return Math.max(0, ...e.items.map((x) => degree(x, bare)));
      case "member":
        return degree(e.object, bare) + computedDegree(e.name, false);
      case "unary":
        return degree(e.operand, bare);
      case "binary":
        return Math.max(degree(e.left, bare), degree(e.right, bare));
      case "where":
        return degree(e.set, bare) + degree(e.filter, false);
      case "call": {
        const own = e.fn === "all" ? 1 : 0;
        const set = e.args[0] ? degree(e.args[0], bare) : 0;
        const rest = e.args.map((x, i) => (i === 0 ? 0 : perMember(e, i) ? set + degree(x, false) : degree(x, bare)));
        return Math.max(own, set, ...rest);
      }
    }
  };
  return degree(expr, true);
}
