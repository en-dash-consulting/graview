import { parseExpr, type Expr } from "./expr/parse.js";
import { typeProblemsOf } from "./expr/typing.js";
import { farEnd } from "./far-end.js";
import { error, type Finding } from "./findings.js";
import { refName } from "./compiled.js";
import type { ActSpec, GraviewDocument, ValueSpec } from "./schema.js";

/*
 * WHAT THE DECLARATION ALONE SHOWS OF AN EXPRESSION'S TYPES (Roadmap
 * f-formula-text-datetime), judged with the checker (`compileDocument`) and
 * not by a page that compiles a document its host has already judged: a
 * `format(…)` of a number field, a pattern piece the language does not
 * know, a time of day not written `HH:MM` — each at the expression's path,
 * in the person's voice, with the fix. The evaluator says the same mistake
 * in a sentence when a record is judged; this says it before the document
 * is kept.
 */

type FieldTypeOf = (name: string) => string | undefined;
const asArray = <T>(v: T | readonly T[] | undefined): readonly T[] => [v ?? []].flat() as readonly T[];
const NONE: FieldTypeOf = () => undefined;

/** The declared type of a bare name read from a record of these kinds, when every kind that has the field agrees on it. */
function fieldTypesOf(document: GraviewDocument, kinds: readonly string[] | "*"): FieldTypeOf {
  if (kinds === "*") return NONE;
  return (name) => {
    const types = new Set(kinds.flatMap((kind) => document.kinds[kind]?.fields[name]?.type ?? []));
    return types.size === 1 ? [...types][0] : undefined;
  };
}

/** The expression a value sets, when it is one. */
const exprOf = (value: ValueSpec | unknown): string | undefined => (value && typeof value === "object" && !Array.isArray(value) && "expr" in value && typeof (value as { expr: unknown }).expr === "string" ? (value as { expr: string }).expr : undefined);

/** Every expression a document's acts work a value out with, its path, and whose fields its bare names read. */
function actExpressions(name: string, act: ActSpec, document: GraviewDocument): { readonly source: string; readonly path: string; readonly kinds: readonly string[] | "*" }[] {
  const at = `acts.${name}`;
  const subject = asArray(act.on);
  const out: { source: string; path: string; kinds: readonly string[] | "*" }[] = [];
  const values = (set: Readonly<Record<string, ValueSpec>> | undefined, path: string, kinds: readonly string[] | "*") => {
    for (const value of Object.values(set ?? {})) {
      const source = exprOf(value);
      if (source !== undefined) out.push({ source, path, kinds });
    }
  };
  // The paths the compile says a value's expression at: a shorthand's at the act, a listed effect's at the effect.
  values(act.sets, `${at}.set`, subject);
  const relation = act.connects ?? act.severs;
  if (act.setsOther && relation) values(act.setsOther, `${at}.set`, farEnd(document.kinds, relation, subject)?.kinds ?? "*");
  for (const [through, set] of Object.entries(act.setsLinked ?? {})) values(set, `${at}.setsLinked.${through}`, subject);
  const made = new Map<string, string>();
  if (act.creates) made.set("new", act.creates);
  (act.effects ?? []).forEach((effect, i) => {
    const where = `${at}.effects.${i}.set`;
    if ("create" in effect) {
      if (effect.as) made.set(effect.as, effect.create);
      values(effect.set, where, [effect.create]);
    } else if ("set" in effect) {
      const target = refName(effect.target ?? "$subject");
      values(effect.set, where, target === "subject" ? subject : made.has(target ?? "") ? [made.get(target!)!] : "*");
    }
  });
  if (act.allowedWhen) out.push({ source: act.allowedWhen, path: `${at}.allowedWhen`, kinds: subject });
  return out;
}

/** The type mistakes the declaration alone shows in every expression it holds: computed fields, facts, acts' values and conditions, rules. */
export function exprTypeFindings(document: GraviewDocument): Finding[] {
  const findings: Finding[] = [];
  const judge = (source: string, path: string, fieldTypeOf: FieldTypeOf) => {
    let expr: Expr;
    try {
      expr = parseExpr(source);
    } catch {
      return; // The compile's to refuse.
    }
    for (const problem of typeProblemsOf(expr, fieldTypeOf)) findings.push(error(problem.code, path, problem.sentence, problem.fix));
  };
  for (const [kind, spec] of Object.entries(document.kinds)) {
    const types = fieldTypesOf(document, [kind]);
    for (const [name, computed] of Object.entries(spec.computed ?? {})) judge(typeof computed === "string" ? computed : computed.expr, `kinds.${kind}.computed.${name}`, types);
  }
  for (const [name, fact] of Object.entries(document.computed ?? {})) judge(typeof fact === "string" ? fact : fact.expr, `computed.${name}`, NONE);
  for (const [name, act] of Object.entries(document.acts ?? {})) {
    for (const one of actExpressions(name, act, document)) judge(one.source, one.path, fieldTypesOf(document, one.kinds));
  }
  for (const [name, rule] of Object.entries(document.rules ?? {})) {
    const types = fieldTypesOf(document, rule.over === "graph" ? [] : [rule.over]);
    for (const key of ["when", "require"] as const) if (rule[key]) judge(rule[key]!, `rules.${name}.${key}`, types);
  }
  return findings;
}
