import type { Expr } from "./expr/parse.js";
import type { GraviewDocument } from "./schema.js";

/*
 * A SUM OF DURATIONS IS A DURATION. A computed field works out a number, and
 * "the time a season was rehearsed" — `sum(out('rehearsals'), length)` over
 * a `duration` field — was said "135" where each rehearsal said "1 h 30
 * min". Read here from the PARSED expression, as the document is compiled —
 * never from its words on a page, and never by a parser a page would carry:
 * the compiled app names each kind's computed fields that are durations
 * (`KindPlan.durations`), and a face reads `as: "duration"` off the
 * definition. A computed field is a duration when it is a duration field
 * of its kind, or another computed field that is one; when it is a field across a relation
 * (`session.length`) or a sum, least or most of one over a relation
 * (`sum(out('sessions'), length)`) and every kind at the far end that has
 * the field holds a duration in it; or when it is two of these added or
 * taken apart, or one negated. A duration times a rate, or a count, is a
 * number. A TypeScript declaration has no compile step: it says
 * `as: "duration"`.
 */

type Kinds = GraviewDocument["kinds"];
type KindSpec = Kinds[string];

/** Whether a kind's own stored field holds a length of time. */
const storedDuration = (spec: KindSpec | undefined, name: string): boolean => {
  const field = spec?.fields[name];
  return field !== undefined && (field.type === "duration" || ((field.type === "number" || field.type === "integer") && field.format === "duration"));
};

/** The kinds a relation reaches from `kind`: out along its own edge, or in from the kinds whose edge of that name points at it. */
function reached(kinds: Kinds, kind: string, edge: string, way: "out" | "in"): readonly string[] {
  if (way === "out") {
    const to = kinds[kind]?.edges?.[edge]?.to;
    return to === undefined ? [] : to === "*" ? Object.keys(kinds) : to;
  }
  return Object.entries(kinds)
    .filter(([, spec]) => {
      const to = spec.edges?.[edge]?.to;
      return to !== undefined && (to === "*" || to.includes(kind));
    })
    .map(([name]) => name);
}

/** A relation an expression walks: `out('e')`, `in('e')`, or an edge named bare (`session`). */
function relation(kinds: Kinds, kind: string, expr: Expr): readonly string[] | undefined {
  if (expr.t === "ident") return kinds[kind]?.edges?.[expr.name] ? reached(kinds, kind, expr.name, "out") : undefined;
  if (expr.t === "where") return relation(kinds, kind, expr.set);
  if (expr.t === "call" && (expr.fn === "out" || expr.fn === "in") && expr.args[0]?.t === "lit" && typeof expr.args[0].value === "string") return reached(kinds, kind, expr.args[0].value, expr.fn);
  return undefined;
}

/** Every far kind that has the field holds a duration in it, and at least one has it. */
const farDuration = (kinds: Kinds, far: readonly string[], name: string): boolean => {
  const having = far.filter((one) => kinds[one]?.fields[name] !== undefined);
  return having.length > 0 && having.every((one) => storedDuration(kinds[one], name));
};

/**
 * The computed fields of one kind that work out a length of time, by name,
 * read from their parsed expressions (`computed`, in declaration order).
 */
export function durationsOf(document: GraviewDocument, kind: string, computed: readonly (readonly [string, Expr])[]): readonly string[] {
  const kinds = document.kinds;
  const spec = kinds[kind];
  const parsed = new Map(computed);
  const known = new Map<string, boolean>();
  const lasts = (expr: Expr, depth: number): boolean => {
    if (depth > 8) return false;
    switch (expr.t) {
      case "ident":
        return storedDuration(spec, expr.name) || isDuration(expr.name, depth + 1);
      case "member": {
        const far = relation(kinds, kind, expr.object);
        return far !== undefined && farDuration(kinds, far, expr.name);
      }
      case "call": {
        if (expr.fn !== "sum" && expr.fn !== "min" && expr.fn !== "max") return false;
        const [set, value] = expr.args;
        const far = set && relation(kinds, kind, set);
        return far !== undefined && value?.t === "ident" && farDuration(kinds, far, value.name);
      }
      case "binary":
        return (expr.op === "+" || expr.op === "-") && lasts(expr.left, depth) && lasts(expr.right, depth);
      case "unary":
        return expr.op === "-" && lasts(expr.operand, depth);
      default:
        return false;
    }
  };
  const isDuration = (name: string, depth: number): boolean => {
    if (spec?.computed?.[name] === undefined) return false;
    if (known.has(name)) return known.get(name)!;
    // Asked again while it is being worked out — a field that reads itself — it is not one.
    known.set(name, false);
    const expr = parsed.get(name);
    const says = expr !== undefined && lasts(expr, depth);
    known.set(name, says);
    return says;
  };
  return computed.map(([name]) => name).filter((name) => isDuration(name, 0));
}
