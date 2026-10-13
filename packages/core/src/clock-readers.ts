import type { Expr } from "./document/expr/parse.js";
import type { InvariantDefinition } from "./invariants/types.js";
import type { AnySchema } from "./schema/schema.js";

/*
 * WHAT READS THE CLOCK (FR-176).
 *
 * A rule is judged on every change and once on load, and that is enough for
 * a rule about the records alone. A rule that reads `today()` or `now()` —
 * "a task past its due day is overdue" — is broken by the day turning, with
 * nothing changed; a room that stays open for weeks would go on saying what
 * was true the day it last heard a change. So the declaration says, without
 * judging anything, which of its rules and computed fields read the clock:
 * the rules a host's tick (`store.tick(now)`) may break or mend, what
 * `graview check` says a host owes, and whether a host need tick at all.
 * Not the main entry's: a page never asks, and a tick judges every rule.
 *
 * Worked out from the declaration: a rule written in the rule language by
 * its shape, a computed field and a fact by their expressions, and through
 * the names each reads — a rule that reads a computed field that reads the
 * clock reads the clock. A rule over a kind whose records retire on a date
 * reads it too, since which of them it judges turns with the day. A rule
 * that is a function says so itself (`readsTheClock`): its body cannot be
 * read here. Over-counting is safe — a rule the day did not move says nothing
 * at a tick — so a name is matched wherever it appears.
 */

/** The rules and computed fields the day turning may change. */
export interface ClockReaders {
  /** The rules a tick may break or mend, by name. */
  readonly rules: readonly string[];
  /** The computed fields worked out differently as the day turns; `kind` is null for a fact of the whole graph. */
  readonly computed: readonly { readonly kind: string | null; readonly field: string }[];
}

const CALLS_THE_CLOCK = /\b(?:today|now)\s*\(/;
const withoutQuoted = (text: string) => text.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
const mentions = (text: string, names: ReadonlySet<string>) => [...names].some((name) => new RegExp(`(?<![\\w-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(text));

/** A computed field's expression, as declared. */
const exprText = (field: unknown): string | undefined => (typeof field === "string" ? field : typeof field === "object" && field && typeof (field as { expr?: unknown }).expr === "string" ? (field as { expr: string }).expr : undefined);

/** The computed fields of a schema, and its facts, that read the clock: directly, or through a name that does. */
function computedReadingTheClock(schema: AnySchema): { readonly fields: ClockReaders["computed"]; readonly names: ReadonlySet<string> } {
  const all: { kind: string | null; field: string; text: string }[] = [];
  for (const kind of schema.kinds as readonly string[]) {
    const computed = (schema.tryDefinition(kind) as { computed?: Readonly<Record<string, unknown>> } | undefined)?.computed ?? {};
    for (const [field, spec] of Object.entries(computed)) {
      const text = exprText(spec);
      if (text !== undefined) all.push({ kind, field, text });
    }
  }
  for (const [field, spec] of Object.entries(schema.computed ?? {})) {
    const text = exprText(spec);
    if (text !== undefined) all.push({ kind: null, field, text });
  }
  const reading = new Set(all.filter((one) => CALLS_THE_CLOCK.test(withoutQuoted(one.text))));
  // Through the names they read, to a fixed point: a name is any kind's computed field, or a fact (`fact('<name>')`).
  for (let grew = true; grew; ) {
    grew = false;
    const names = new Set([...reading].map((one) => one.field));
    for (const one of all) {
      if (!reading.has(one) && mentions(one.text, names)) {
        reading.add(one);
        grew = true;
      }
    }
  }
  return { fields: all.filter((one) => reading.has(one)).map(({ kind, field }) => ({ kind, field })), names: new Set([...reading].map((one) => one.field)) };
}

/** Each part of an expression, itself first. */
function parts(expr: Expr, into: Expr[] = []): Expr[] {
  into.push(expr);
  for (const value of Object.values(expr)) for (const one of [value].flat()) if (one && typeof one === "object" && "t" in one) parts(one as Expr, into);
  return into;
}

/** Whether an expression reads the clock: calls `today()` or `now()`, or reads a name in `clocked`. */
export function exprReadsTheClock(expr: Expr, clocked: ReadonlySet<string> = new Set()): boolean {
  return parts(expr).some((part) =>
    part.t === "call"
      ? part.fn === "today" || part.fn === "now"
      : part.t === "ident" || part.t === "member"
        ? clocked.has(part.name)
        : part.t === "lit" && typeof part.value === "string" && clocked.has(part.value),
  );
}

/** Whether a kind's records retire on a date (its lifecycle), so which of them is judged turns with the day. */
const retiresOnADate = (schema: AnySchema, kind: string): boolean =>
  (schema.tryDefinition(kind) as { lifecycle?: { retired?: unknown } } | undefined)?.lifecycle?.retired === "date";

/** The rules and computed fields of a declaration that read the clock. */
export function clockReaders(schema: AnySchema, rules: readonly InvariantDefinition[]): ClockReaders {
  const computed = computedReadingTheClock(schema);
  const reads = (rule: InvariantDefinition): boolean => {
    if (rule.readsTheClock) return true;
    if (rule.scope !== "graph" && rule.judgesPast !== true && retiresOnADate(schema, rule.scope.kind)) return true;
    const shape = rule.shape;
    if (!shape) return false;
    return [shape.require, shape.when, ...(shape.says ?? []).map((part) => part.expr)].some((expr) => expr !== undefined && exprReadsTheClock(expr, computed.names));
  };
  return { rules: rules.filter(reads).map((rule) => rule.name), computed: computed.fields };
}

