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
        const first = e.args[0];
        const literal = first?.t === "lit" && typeof first.value === "string" ? first.value : undefined;
        if (e.fn === "all" && literal) sweeps.push(literal);
        if ((e.fn === "out" || e.fn === "in") && literal) edges.push(literal);
        const lazy = e.fn === "every" || e.fn === "some";
        const fieldOfMembers = (e.fn === "sum" || e.fn === "min" || e.fn === "max") && e.args[1]?.t === "ident";
        e.args.forEach((x, i) => (fieldOfMembers && i === 1 ? undefined : visit(x, inWhere || (lazy && i === 1))));
        return;
      }
    }
  };
  visit(expr, false);
  return { names, functions, unknownFunctions: [...functions].filter((f) => !known.has(f)), sweeps, edges };
}
