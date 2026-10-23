/**
 * ONE ORDER EVERY FORM ASKS IN, WHATEVER DECLARED IT.
 *
 * A document's creating act asked for what names the record first (0.1.48),
 * and nothing else did: "Change the threat" asked in the kind's field order,
 * and an app declared in TypeScript asked in its `z.object`'s key order, so
 * a code app's "Add a threat" could bury the name it must be given under
 * Affected versions and Aliases. Every form, the strip's questions, a seat's
 * described form and an agent's tool now read one order:
 *
 *   1. what names the record — the fields its label reads, in the order it
 *      reads them;
 *   2. every other field it cannot be made without (required, no default);
 *   3. the rest;
 *
 * each run in the order the kind's page names them (`page.fields`, then its
 * groups'), then as declared. An edit asks in the same order as the form
 * that made the record: it is that form again, filled with what the record
 * holds, so a field is where the person found it the first time — and what
 * a record cannot be without still matters most when changing it.
 *
 * Only arguments that ARE a field of the kind move, and only among their own
 * places: a record picked to link to, the subject, an argument the act names
 * for itself stay where the act put them. Type imports only, so a page that
 * draws one form carries nothing else.
 */
import type { AnySchema } from "../schema/schema.js";
import type { AnyNodeDefinition } from "../schema/types.js";

/** The rule, over names: what names the record, then what must be answered, then the rest — each in page order, then declared order. */
export function askedRule(rule: { readonly declared: readonly string[]; readonly paged?: readonly string[]; readonly must: (field: string) => boolean; readonly naming?: readonly string[] }): readonly string[] {
  const known = new Set(rule.declared);
  const ordered = [...new Set([...(rule.paged ?? []).filter((field) => known.has(field)), ...rule.declared])];
  const naming = (rule.naming ?? []).filter((field) => known.has(field));
  return [...new Set([...naming, ...ordered.filter(rule.must), ...ordered])];
}

type Parses = { safeParse?(value: unknown): { success: boolean } };

/** A mark no label would write on its own, one per field, that says which field a label read. */
const mark = (n: number): string => `§${n}§`;

/**
 * The fields a kind's label reads, in the order it reads them: asked of the
 * label itself, handed a record whose every field says its own name. A
 * label that cannot be read that way (it counts, or joins a list) falls
 * back to the field a record is named by unsaid: `name`, `title`, `label`.
 */
function namingFields(definition: AnyNodeDefinition, declared: readonly string[]): readonly string[] {
  if (definition.label) {
    try {
      const node: Record<string, unknown> = { id: mark(declared.length), kind: definition.kind };
      declared.forEach((field, n) => (node[field] = mark(n)));
      const said = String(definition.label(node as never));
      const read = declared.map((field, n) => [field, said.indexOf(mark(n))] as const).filter(([, at]) => at >= 0);
      if (read.length > 0) return read.sort((a, b) => a[1] - b[1]).map(([field]) => field);
    } catch {
      // A label that does more than say its fields: named the way a record is named unsaid.
    }
  }
  const word = ["name", "title", "label"].find((one) => declared.includes(one));
  return word ? [word] : [];
}

const byKind = new WeakMap<AnyNodeDefinition, readonly string[]>();

/** A kind's fields in the order a form asks for them (`askedRule`). */
export function askedFieldsOf(definition: AnyNodeDefinition): readonly string[] {
  const known = byKind.get(definition);
  if (known) return known;
  const shape = ((definition.fields as { shape?: Record<string, Parses> }).shape ?? {}) as Record<string, Parses>;
  const declared = Object.keys(shape);
  const page = definition.display?.page;
  const order = askedRule({
    declared,
    paged: [...(page?.fields ?? []), ...(page?.groups ?? []).flatMap((group) => group.fields)],
    // Required with no default — in the schema, or beside it (`defaults`, a compiled document's): what a record cannot be made without.
    must: (field) => shape[field]?.safeParse?.(undefined).success === false && !Object.hasOwn(definition.defaults ?? {}, field),
    naming: namingFields(definition, declared),
  });
  byKind.set(definition, order);
  return order;
}

type Asked = {
  readonly input: unknown;
  readonly creates?: readonly string[] | undefined;
  readonly subject?: { readonly kinds: readonly string[] | "*"; readonly arg: string } | undefined;
  readonly derived?: { readonly kind: string } | undefined;
};

/** The kind whose fields an act's arguments fill: what it makes, else the one kind it changes. */
function kindAskedOf(schema: Pick<AnySchema, "tryDefinition">, mutation: Asked): AnyNodeDefinition | undefined {
  const kinds = mutation.subject?.kinds;
  const kind = mutation.creates?.[0] ?? mutation.derived?.kind ?? (kinds !== undefined && kinds !== "*" && kinds.length === 1 ? kinds[0] : undefined);
  return kind === undefined ? undefined : (schema.tryDefinition(kind) as AnyNodeDefinition | undefined);
}

/** An act's arguments in the order a form asks for them: those that are a field of its kind in that kind's asked order, among their own places. */
export function askedArguments(schema: Pick<AnySchema, "tryDefinition"> | undefined, mutation: Asked): readonly string[] {
  const names = Object.keys((mutation.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {});
  const definition = schema ? kindAskedOf(schema, mutation) : undefined;
  if (!definition) return names;
  const fields = askedFieldsOf(definition);
  const moves = (name: string) => name !== mutation.subject?.arg && fields.includes(name);
  const asked = names.filter(moves).sort((a, b) => fields.indexOf(a) - fields.indexOf(b));
  let next = 0;
  return names.map((name) => (moves(name) ? asked[next++]! : name));
}

/** Things named by argument — a form's fields, the strip's open questions, a tool's properties — in an act's asked order; anything it does not name keeps its place after. */
export function inAskedOrder<T>(items: readonly T[], order: readonly string[], nameOf: (item: T) => string = (item) => (item as { name: string }).name): T[] {
  const rank = (item: T) => {
    const at = order.indexOf(nameOf(item));
    return at < 0 ? order.length : at;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}
