import { fieldOf } from "../document/field-spec.js";
import type { FieldSpec } from "../document/schema.js";
import { nameKey } from "../labels.js";
import { article, edgeWords, fieldWords, humanizeField, nounOf, pluralOf } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { AnyNodeDefinition, EdgeDeclaration } from "../schema/types.js";

/**
 * WHERE A COLUMN GOES (FR-177): a field of the kind, by its name; a relation,
 * by its name — one the kind declares (`out`, the default) or one another
 * kind declares toward it (`in`, found by name when the kind declares none
 * so called); `null` (or a column left out) is not imported.
 */
export type ColumnTarget = string | { readonly field: string } | { readonly relation: string; readonly direction?: "out" | "in" } | null;

/** Column header → where its cells go. */
export type ImportMapping = Readonly<Record<string, ColumnTarget>>;

/** A column, read against the declaration. */
export type ImportColumn =
  | {
      readonly column: string;
      readonly as: "field";
      readonly field: string;
      readonly spec: FieldSpec;
      /** The zod field itself, which has the last word on what fits. */
      readonly schema: unknown;
    }
  | {
      readonly column: string;
      readonly as: "relation";
      readonly relation: string;
      readonly direction: "out" | "in";
      /** The kinds a cell may name. */
      readonly kinds: readonly string[];
      /** The new record links to at most one (`out`), or the far record holds at most one such link (`in`). */
      readonly one: boolean;
    };

/** A mapping that names something the kind has not got. Thrown before any row is read: it is the caller's to fix, not the sheet's. */
export class ImportMappingError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(problems.join(" "));
    this.name = "ImportMappingError";
  }
}

type SchemaLike = AnySchema | { readonly schema: AnySchema };
const schemaOf = (from: SchemaLike): AnySchema => ("schema" in from && !("definitions" in from) ? from.schema : (from as AnySchema));

/** The relations declared toward `kind` by other kinds (and by itself), by name. */
function incoming(schema: AnySchema, kind: string): Map<string, { from: string; decl: EdgeDeclaration }[]> {
  const found = new Map<string, { from: string; decl: EdgeDeclaration }[]>();
  for (const definition of schema.definitions) {
    for (const [name, decl] of Object.entries(definition.edges as Record<string, EdgeDeclaration>)) {
      if (decl.to !== "*" && !decl.to.includes(kind)) continue;
      const list = found.get(name) ?? [];
      list.push({ from: definition.kind, decl });
      found.set(name, list);
    }
  }
  return found;
}

/** The kind's field as an import reads it: its document spec, or a word when a document has no type for it. */
export function fieldSpecFor(definition: AnyNodeDefinition, field: string): { readonly spec: FieldSpec; readonly schema: unknown } | undefined {
  const shape = (definition.fields as unknown as { shape?: Record<string, unknown> }).shape ?? {};
  if (!Object.hasOwn(shape, field)) return undefined;
  const read = fieldOf(shape[field]);
  const optional = (shape[field] as { safeParse?: (value: unknown) => { success: boolean } }).safeParse?.(undefined).success ?? false;
  const spec: FieldSpec = "spec" in read ? read.spec : { type: "string", ...(optional ? {} : { required: true }) };
  return { spec, schema: shape[field] };
}

/** Reads a mapping against the kind's declaration; a target it has not got is an `ImportMappingError`. */
export function readMapping(schema: AnySchema, kind: string, mapping: ImportMapping): readonly ImportColumn[] {
  const definition = schema.tryDefinition(kind);
  if (!definition) throw new ImportMappingError([`This app has no kind called “${kind}”.`]);
  const noun = nounOf(definition, kind);
  const edges = definition.edges as Record<string, EdgeDeclaration>;
  const toward = incoming(schema, kind);
  const columns: ImportColumn[] = [];
  const problems: string[] = [];
  for (const [column, target] of Object.entries(mapping)) {
    if (target === null || target === undefined) continue;
    const name = typeof target === "string" ? target : "field" in target ? target.field : target.relation;
    const wantsField = typeof target === "string" || "field" in target;
    const direction = typeof target === "object" && target !== null && "relation" in target ? target.direction : undefined;
    if (wantsField) {
      const field = fieldSpecFor(definition, name);
      if (field) {
        columns.push({ column, as: "field", field: name, ...field });
        continue;
      }
      if (typeof target !== "string") {
        problems.push(`The ${column} column goes to “${name}”, which ${withNoun(noun)} has no field called.`);
        continue;
      }
    }
    if (direction !== "in" && Object.hasOwn(edges, name)) {
      const decl = edges[name]!;
      columns.push({ column, as: "relation", relation: name, direction: "out", kinds: decl.to === "*" ? [...schema.kinds] : [...decl.to], one: decl.cardinality === "one" });
      continue;
    }
    const far = direction === "out" ? undefined : toward.get(name);
    if (far && far.length > 0) {
      columns.push({ column, as: "relation", relation: name, direction: "in", kinds: [...new Set(far.map((one) => one.from))], one: far.some((one) => one.decl.cardinality === "one") });
      continue;
    }
    problems.push(`The ${column} column goes to “${name}”, which is neither a field of ${withNoun(noun)} nor a relation it has.`);
  }
  if (problems.length > 0) throw new ImportMappingError(problems);
  return columns;
}

const withNoun = (noun: string) => `${article(noun)} ${noun}`;

/** A column's place in a proposal: where it goes, and the words it was matched by. */
export interface ProposedColumn {
  readonly column: string;
  readonly target: Exclude<ColumnTarget, string | null>;
  /** What the header was matched to, in the declaration's words: "the field Booked on", "the relation to an event". */
  readonly said: string;
}

/** What `proposeMapping` offers: a mapping to hand `importRows`, each column's reason, and what is left. */
export interface ProposedMapping {
  readonly mapping: ImportMapping;
  readonly columns: readonly ProposedColumn[];
  /** Headers nothing in the kind answers to: not imported unless somebody maps them. */
  readonly unmatched: readonly string[];
  /** Required fields no column fills, by their words: every row would be refused for want of them. */
  readonly missing: readonly string[];
}

/** A header's words for comparing: case, accents, punctuation and a plural "s" aside. */
function key(text: string): string {
  return nameKey(humanizeField(text))
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const singular = (text: string) => text.replace(/(ies)$/, "y").replace(/(?<=[^s])s$/, "");

/**
 * A MAPPING PROPOSED FROM THE HEADER ROW (FR-177), for the seat or a
 * builder to offer and a person to correct. A header matches a field by
 * its name, its label or its name spoken ("Booked on" for `bookedOn`), a
 * plural aside; a relation by its name, its words from either end, or the
 * noun or plural of the kind at its far end ("Event" for a link to an
 * event). A header that starts with the kind's own noun is read without it
 * ("Vendor name" is the name). Each field or relation is matched once, by
 * the first header that names it; what nothing answers to is `unmatched`.
 */
export function proposeMapping(declaration: SchemaLike, kind: string, header: readonly string[]): ProposedMapping {
  const schema = schemaOf(declaration);
  const definition = schema.tryDefinition(kind);
  if (!definition) throw new ImportMappingError([`This app has no kind called “${kind}”.`]);
  const noun = nounOf(definition, kind);
  const shape = (definition.fields as unknown as { shape?: Record<string, unknown> }).shape ?? {};
  const candidates: { target: ProposedColumn["target"]; said: string; keys: Set<string>; id: string }[] = [];
  const add = (target: ProposedColumn["target"], said: string, id: string, words: readonly (string | undefined)[]) => {
    const keys = new Set<string>();
    for (const word of words) {
      if (!word) continue;
      keys.add(key(word));
      keys.add(singular(key(word)));
    }
    candidates.push({ target, said, keys, id });
  };
  for (const field of Object.keys(shape)) {
    const words = fieldWords(definition, field);
    const extra = field === "label" || field === "name" || field === "title" ? ["name", "title", noun] : [];
    add({ field }, `the field ${words}`, `field:${field}`, [field, words, ...extra]);
  }
  for (const [name, decl] of Object.entries(definition.edges as Record<string, EdgeDeclaration>)) {
    const kinds = decl.to === "*" ? [] : decl.to;
    const far = kinds.flatMap((one) => [one, nounOf(schema.tryDefinition(one), one), pluralOf(schema, one)]);
    add({ relation: name }, `the relation “${edgeWords(schema, kind, name, "out")}”`, `out:${name}`, [name, decl.description, ...far]);
  }
  for (const [name, list] of incoming(schema, kind)) {
    if (Object.hasOwn(definition.edges, name)) continue;
    const far = list.flatMap(({ from }) => [from, nounOf(schema.tryDefinition(from), from), pluralOf(schema, from)]);
    const inverse = list.map(({ from }) => edgeWords(schema, from, name, "in"));
    add({ relation: name, direction: "in" }, `the relation “${inverse[0]}”`, `in:${name}`, [name, ...inverse, ...far]);
  }

  const used = new Set<string>();
  const mapping: Record<string, ColumnTarget> = {};
  const columns: ProposedColumn[] = [];
  const unmatched: string[] = [];
  const nounKey = key(noun);
  for (const column of header) {
    const own = key(column);
    const asked = [own, singular(own), ...(own.startsWith(`${nounKey} `) ? [own.slice(nounKey.length + 1), singular(own.slice(nounKey.length + 1))] : [])];
    const found = asked.map((one) => candidates.find((candidate) => !used.has(candidate.id) && candidate.keys.has(one))).find((one) => one !== undefined);
    if (!found) {
      unmatched.push(column);
      continue;
    }
    used.add(found.id);
    mapping[column] = found.target;
    columns.push({ column, target: found.target, said: found.said });
  }
  const missing = Object.keys(shape)
    .filter((field) => !used.has(`field:${field}`))
    .filter((field) => fieldSpecFor(definition, field)?.spec.required === true && definition.defaults?.[field] === undefined)
    .map((field) => fieldWords(definition, field));
  return { mapping, columns, unmatched, missing };
}
