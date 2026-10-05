import type { ComputedField } from "../schema/types.js";
import { analyzeExpr, costDegree } from "./expr/analyze.js";
import { ExprSyntaxError, parseExpr, type Expr } from "./expr/parse.js";
import { error, warning, type Finding } from "./findings.js";

/*
 * COMPUTED FIELDS (FR-83): a value a kind works out rather than stores.
 *
 *   "computed": { "net": "sum(out('includes'), list * units) * (100 - discount) / 100" }
 *
 * A name and an expression of the rule language, declared once on the kind
 * — in a document's `kinds.<kind>.computed`, or `defineNode({ computed })` —
 * and read like a stored field everywhere the language reads one: templates,
 * view specs, rules, sums and sorts. Never stored, never written: no act or
 * edit form offers one, and an act that sets one is a finding.
 *
 * Judged here for both declarations, in one vocabulary: a name that is
 * already a field or a relation, an expression that does not parse or
 * names nothing, a cycle among a kind's computed fields, and a cost that
 * grows faster than the graph can afford.
 */

export interface ComputedEntry {
  readonly expr: string;
  readonly label?: string;
  readonly description?: string;
}

/** A kind's computed fields, each in its long form, in declaration order. */
export function computedOf(definition: { readonly computed?: Readonly<Record<string, ComputedField>> } | undefined): ReadonlyMap<string, ComputedEntry> {
  const out = new Map<string, ComputedEntry>();
  for (const [name, field] of Object.entries(definition?.computed ?? {})) out.set(name, typeof field === "string" ? { expr: field } : field);
  return out;
}

/** A kind's computed fields, parsed, for the evaluator; one that does not parse is left out (the check says why). */
export function parsedComputed(definition: { readonly computed?: Readonly<Record<string, ComputedField>> } | undefined): ReadonlyMap<string, Expr> | undefined {
  const entries = computedOf(definition);
  if (entries.size === 0) return undefined;
  const parsed = new Map<string, Expr>();
  for (const [name, entry] of entries) {
    try {
      parsed.set(name, parseExpr(entry.expr));
    } catch (e) {
      if (!(e instanceof ExprSyntaxError)) throw e;
    }
  }
  return parsed;
}

/** What the check reads of one kind. */
export interface ComputedKind {
  readonly fields: ReadonlySet<string>;
  readonly edges: ReadonlySet<string>;
  readonly computed: ReadonlyMap<string, ComputedEntry>;
}

/** Work that grows with the square of the graph per read is said; with the cube, refused. */
const WARN_AT = 2;
const REFUSE_AT = 3;

/**
 * Findings about every kind's computed fields. `at(kind, name)` is where a
 * finding points: `kinds.<kind>.computed.<name>` in a document,
 * `defineNode("<kind>").computed.<name>` in a declaration.
 */
export function validateComputed(kinds: ReadonlyMap<string, ComputedKind>, at: (kind: string, name: string) => string): Finding[] {
  const findings: Finding[] = [];
  const edges = new Set([...kinds.values()].flatMap((k) => [...k.edges]));
  const parsed = new Map<string, Map<string, Expr>>();

  for (const [kind, spec] of kinds) {
    const exprs = new Map<string, Expr>();
    parsed.set(kind, exprs);
    for (const [name, entry] of spec.computed) {
      const path = at(kind, name);
      if (!/^[a-z][A-Za-z0-9]*$/.test(name) || name === "id" || name === "kind") {
        findings.push(error("computed-name", path, `"${name}" cannot name a computed field`, 'a computed field is named like a field: one word or camelCase, like "net" or "leadPackage"'));
        continue;
      }
      if (spec.fields.has(name) || spec.edges.has(name)) {
        findings.push(error("computed-clash", path, `"${name}" is already a ${spec.fields.has(name) ? "field" : "relation"} of ${kind}, so it cannot also be worked out`, "give the computed field a name of its own"));
        continue;
      }
      let expr: Expr;
      try {
        expr = parseExpr(entry.expr);
      } catch (e) {
        if (!(e instanceof ExprSyntaxError)) throw e;
        findings.push(error("expression", path, `${e.sentence} (at character ${e.at + 1})`));
        continue;
      }
      exprs.set(name, expr);
      const shape = analyzeExpr(expr);
      for (const fn of shape.unknownFunctions) findings.push(error("unknown-function", path, `"${fn}" is not a function the rule language knows`, "see the rule language in the graview-invariant skill"));
      for (const n of shape.names) {
        if (n === "id" || spec.fields.has(n) || spec.edges.has(n) || spec.computed.has(n)) continue;
        findings.push(error("computed-name", path, `${kind} has no field, relation or computed field called "${n}"`));
      }
      for (const e of shape.edges) if (!edges.has(e)) findings.push(error("computed-edge", path, `"${e}" is not a relation any kind declares`));
      for (const k of shape.sweeps) if (!kinds.has(k)) findings.push(error("computed-kind", path, `"${k}" is not a kind this declaration has`));
    }
  }

  // ── cycles among one kind's computed fields ────────────────────────────────
  for (const [kind, exprs] of parsed) {
    const reads = new Map([...exprs].map(([name, expr]) => [name, [...analyzeExpr(expr).names].filter((n) => exprs.has(n))]));
    const said = new Set<string>();
    for (const start of exprs.keys()) {
      const cycle = cycleFrom(start, reads);
      if (!cycle) continue;
      const key = [...cycle].slice(0, -1).sort().join(" ");
      if (said.has(key)) continue;
      said.add(key);
      findings.push(error("computed-cycle", at(kind, start), `${kind}'s computed fields work each other out in a circle: ${cycle.join(" → ")}`, "work one of them out from stored fields instead"));
    }
  }

  // ── cost: how a read grows with the graph ──────────────────────────────────
  const degrees = new Map<string, number>();
  const pending = new Set<string>();
  const degreeOf = (kind: string, name: string): number => {
    const key = `${kind}.${name}`;
    if (degrees.has(key)) return degrees.get(key)!;
    const expr = parsed.get(kind)?.get(name);
    if (!expr || pending.has(key)) return 0;
    pending.add(key);
    const d = costDegree(expr, (n, bare) =>
      bare ? (parsed.get(kind)?.has(n) ? degreeOf(kind, n) : 0) : Math.max(0, ...[...parsed].filter(([, e]) => e.has(n)).map(([k]) => degreeOf(k, n))),
    );
    pending.delete(key);
    degrees.set(key, d);
    return d;
  };
  for (const [kind, exprs] of parsed) {
    for (const name of exprs.keys()) {
      const d = degreeOf(kind, name);
      if (d >= REFUSE_AT) {
        findings.push(error("computed-cost", at(kind, name), `working out ${name} sweeps a kind inside a sweep inside a sweep, so its work grows with the cube of the graph — more than a page can afford`, "walk a relation with out()/in() instead of sweeping with all(), or work part of it out on the records it sweeps"));
      } else if (d >= WARN_AT) {
        findings.push(warning("computed-cost", at(kind, name), `working out ${name} reads every record of one kind for each record of another, which grows quickly as the app grows`, "walk a relation with out()/in() instead of all() where you can"));
      }
    }
  }
  return findings;
}

/** A path from `start` back to itself through what each name reads, or nothing. */
function cycleFrom(start: string, reads: ReadonlyMap<string, readonly string[]>): string[] | undefined {
  const path: string[] = [];
  const seen = new Set<string>();
  const walk = (name: string): string[] | undefined => {
    if (name === start && path.length > 0) return [...path, start];
    if (seen.has(name)) return undefined;
    seen.add(name);
    path.push(name);
    for (const next of reads.get(name) ?? []) {
      const found = walk(next);
      if (found) return found;
    }
    path.pop();
    return undefined;
  };
  return walk(start);
}
