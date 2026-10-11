import { withArticle } from "../schema/define-node.js";
import { error, type Finding } from "./findings.js";
import type { GraviewDocument } from "./schema.js";

/*
 * THE WHOLE GRAPH'S FACTS AND A KIND'S FIELD ROLES, JUDGED — by the checker
 * (`compileDocument`, `graview check`), never by a page that compiles a
 * document its host has already judged: neither is reachable from what a
 * hosted page loads up front (FR-57).
 *
 * A FACT is a name and a rule-language expression with no record as its
 * subject — `"mapProposed": "every(all('area'), proposed)"` — read as
 * `fact('mapProposed')` by a block, a rule, a template or another fact. Its
 * expression is judged as a computed field's is (`computedFindings`); here,
 * every place that reads one is held to the facts there are.
 *
 * A FIELD ROLE says which field a kind's natural time (`when`) and its
 * author (`who`) are, so a list, a timeline and a glance read them rather
 * than guess.
 */

/** Every `fact('<name>')` a document reads that names no fact it declares — in a fact, a computed field, a rule, an act, a label, a view or a lens's blocks. */
export function factFindings(document: GraviewDocument): Finding[] {
  const facts = Object.keys(document.computed ?? {});
  const out: Finding[] = [];
  const walk = (value: unknown, path: string): void => {
    if (typeof value === "string") {
      for (const [, , name] of value.matchAll(/\bfact\(\s*(['"])(.*?)\1\s*\)/g)) {
        if (!facts.includes(name!)) out.push(error("fact-unknown", path, `"${name}" is not a fact this app works out`, facts.length > 0 ? `name one of ${facts.join(", ")}` : `declare it in the document's top-level "computed"`));
      }
    } else if (Array.isArray(value)) value.forEach((one, i) => walk(one, `${path}.${i}`));
    else if (value !== null && typeof value === "object") for (const [key, one] of Object.entries(value)) walk(one, path ? `${path}.${key}` : key);
  };
  walk(document, "");
  return out;
}

/**
 * THE ROLES WITH A MEANING OF THEIR OWN, and the field types that fill
 * each, in a document's words: a record's natural time is a date (or a date
 * and time), its author a name. Any other role is a lens's, and names a field.
 */
const ROLES: Readonly<Record<string, { readonly is: string; readonly fits: readonly string[]; readonly takes: string }>> = {
  when: { is: "its natural time", fits: ["date", "datetime"], takes: "a date, or a date and time" },
  who: { is: "its author", fits: ["string", "text", "email", "enum"], takes: "a name: words, an email or a choice" },
};

/**
 * One role of one kind, judged: the field is there, and — for a role with a
 * meaning of its own — of a type that can fill it (`type` in a document's
 * words; undefined when the kind has no such field). Undefined when it holds.
 */
export function roleProblem(role: string, field: string, kind: string, type: string | undefined, fields: readonly string[]): { readonly code: string; readonly message: string; readonly fix: string } | undefined {
  if (type === undefined) return { code: "field-role-missing-field", message: `${kind}'s "${role}" role names "${field}", and ${kind} has no field called that`, fix: `point it at one of ${fields.join(", ")}` };
  const meant = ROLES[role];
  return meant && !meant.fits.includes(type) ? { code: "field-role-ill-typed", message: `${kind}'s "${role}" is ${meant.is}, which is ${meant.takes}, and "${field}" is ${withArticle(type)} field`, fix: `point "${role}" at a field that holds ${meant.takes}` } : undefined;
}

/** A document's field roles (`kinds.<kind>.fieldRoles`), each held to the kind's fields. */
export function roleFindings(document: GraviewDocument): Finding[] {
  const out: Finding[] = [];
  for (const [kind, spec] of Object.entries(document.kinds)) {
    for (const [role, field] of Object.entries(spec.fieldRoles ?? {})) {
      const f = spec.fields[field];
      // A lens's `label` role may name the record's label, which every record has.
      if (!f && role === "label" && field === "label") continue;
      const problem = roleProblem(role, field, kind, f?.type, Object.keys(spec.fields));
      if (problem) out.push(error(problem.code, `kinds.${kind}.fieldRoles.${role}`, problem.message, problem.fix));
    }
  }
  return out;
}
