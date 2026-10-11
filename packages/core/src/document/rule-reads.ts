import type { RuleShapeSource } from "../invariants/types.js";
import type { KindShape } from "./expr/evaluate.js";
import type { Expr } from "./expr/parse.js";

/*
 * WHAT A RULE READS BEYOND ITS SUBJECT, worked out from its shape without
 * judging it. A seat's own problems are judged over what it sees (FR-55),
 * but what a preview would break or a change mended was judged over the
 * whole graph: a rule that reads only its subject says there what it
 * would say to the seat; one that reads a fact, sweeps a kind or walks a
 * relation may count or name records the seat may not see. And `graview
 * check` warns of a rule whose message says a fact some role may not see
 * all of.
 */

/** Each part of an expression, itself first: every name it reads and every function it calls. */
function parts(expr: Expr, into: Expr[] = []): Expr[] {
  into.push(expr);
  for (const value of Object.values(expr)) for (const one of [value].flat()) if (one && typeof one === "object" && "t" in one) parts(one as Expr, into);
  return into;
}

/** The facts an expression reads (`fact('<name>')`), by name. */
export function factsIn(expr: Expr): string[] {
  return parts(expr).flatMap((part) => (part.t === "call" && part.fn === "fact" && part.args[0]?.t === "lit" ? [String(part.args[0].value)] : []));
}

/** The facts a rule's message says: in its sentence, or, with none, in what it requires, which its line says. */
export function factsSaid(shape: RuleShapeSource): string[] {
  const said = shape.says ? shape.says.flatMap((part) => (part.expr ? [part.expr] : [])) : [shape.require, ...(shape.when ? [shape.when] : [])];
  return [...new Set(said.flatMap(factsIn))];
}

/**
 * Whether a rule's judgment or sentence may read a record other than its
 * subject: it judges the whole graph, reads a fact, sweeps a kind, walks a
 * relation, or reads a name that is one of its kind's relations or
 * computed fields. Not told what its kind holds (`kinds`), any name may be.
 */
export function readsBeyondItsSubject(shape: RuleShapeSource, kinds: ReadonlyMap<string, KindShape> | undefined = shape.kinds): boolean {
  const kind = kinds?.get(shape.over);
  return (
    shape.over === "graph" ||
    [shape.require, shape.when, ...(shape.says ?? []).map((part) => part.expr)].some(
      (expr) =>
        expr !== undefined &&
        parts(expr).some((part) =>
          part.t === "call" ? ["fact", "all", "in", "out"].includes(part.fn) : part.t === "ident" && (!kind || kind.edges.has(part.name) || kind.computed?.has(part.name) === true),
        ),
    )
  );
}
