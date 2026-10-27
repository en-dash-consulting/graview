import type { AnySchema } from "@graview/core";

/*
 * A FILTER ASKED FOR IN CODE, WRITTEN IN THE ADDRESS'S WORDS.
 *
 * A view that is not React — a worker view's `graview.navigate`, a frame
 * guest's — goes to a kind's list or a lens narrowed: `{ place: "features",
 * where: { stage: "building" } }`. What it asks for is held to what the
 * destination can be filtered by — the keys a list's arranging line offers
 * (`arrangeable`, and through each relation for a list: a test holds the
 * two to each other) — and comes back as the `filter` word a page carries
 * in its search (`?filter=`) and a stop in its fragment (`in.filter`):
 * `stage:building`. A field the kind does not have, or a choice it does not
 * offer, is refused in a sentence the view is told, rather than a list
 * drawn unnarrowed with no word why.
 *
 * Read off the declaration here rather than through `@graview/core/arrange`:
 * the host of every view carries this, and what it needs is the keys and a
 * choice's values, not the arranging.
 */

/** One value a filter keeps: a word (`"building"`, `"before:2026-11-01"`, an id), a number, or true or false. */
export type WhereValue = string | number | boolean;

/** What `where` asks for, judged: the address's `filter` word, or why it cannot be. */
export type WhereJudged = { readonly ok: true; readonly filter?: string } | { readonly ok: false; readonly says: string };

/** A key a kind filters by, and the values it takes when it takes only some. */
interface FilterKey {
  readonly key: string;
  readonly label: string;
  readonly options?: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
type Def = { readonly type?: string; readonly innerType?: unknown; readonly entries?: Record<string, unknown>; readonly values?: readonly unknown[] };
const defOf = (schema: unknown): Def | undefined => (schema as { _zod?: { def?: Def } } | undefined)?._zod?.def;

/** A field's zod definition under optional, default and nullable. */
function bare(schema: unknown): Def | undefined {
  let def = defOf(schema);
  while (def && (def.type === "optional" || def.type === "default" || def.type === "nullable" || def.type === "prefault")) def = defOf(def.innerType);
  return def;
}

/** The values a choice or a yes-or-no takes; undefined for a field that takes any. */
function optionsOf(def: Def | undefined): readonly string[] | undefined {
  if (def?.type === "boolean") return ["true", "false"];
  // A choice that takes several of its options (FR-233) is filtered by one of them.
  if (def?.type === "array") def = bare((def as { element?: unknown }).element);
  if (def?.type !== "enum") return undefined;
  return (def.entries ? Object.values(def.entries) : (def.values ?? [])).filter((value): value is string => typeof value === "string");
}

const words = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/^./, (first) => first.toUpperCase());

/** What a kind filters by: its own fields, its relations either way, through each relation a far choice (a list's), and `is`. */
export function filterKeysOf(schema: AnySchema, kind: string, through: boolean): readonly FilterKey[] {
  const definition = schema.tryDefinition(kind);
  if (!definition) return [];
  const hidden = new Set<string>(definition.display?.hide ?? []);
  const out: FilterKey[] = [];
  for (const [field, fieldSchema] of Object.entries((definition.fields.shape ?? {}) as Record<string, unknown>)) {
    if (field === "id" || field === "kind" || field === "label" || hidden.has(field)) continue;
    const def = bare(fieldSchema);
    // A list, a record of fields or a file is no value to keep.
    if (def?.type === "array" || def?.type === "object" || def?.type === "record") continue;
    const options = optionsOf(def);
    out.push({ key: field, label: words(field), ...(options ? { options } : {}) });
  }
  const relations = new Map<string, readonly string[]>();
  for (const [edge, declared] of Object.entries(definition.edges ?? {})) relations.set(edge, declared.to === "*" ? [] : [...declared.to]);
  for (const other of schema.definitions) {
    if (other.kind === kind) continue;
    for (const [edge, declared] of Object.entries(other.edges ?? {})) {
      if (!relations.has(edge) && (declared.to === "*" || (declared.to as readonly string[]).includes(kind))) relations.set(edge, [other.kind]);
    }
  }
  const via: FilterKey[] = [];
  for (const [edge, far] of relations) {
    out.push({ key: edge, label: words(edge) });
    const end = through && far.length === 1 && far[0] !== kind ? schema.tryDefinition(far[0]!) : undefined;
    for (const [field, fieldSchema] of Object.entries((end?.fields.shape ?? {}) as Record<string, unknown>)) {
      const def = bare(fieldSchema);
      if (def?.type === "enum" && !end?.display?.hide?.includes(field)) via.push({ key: `${edge}.${field}`, label: `${words(edge)} · ${words(field)}`, options: optionsOf(def)! });
    }
  }
  out.push(...via);
  out.push({ key: "is", label: "Is", options: definition.lifecycle ? ["current", "past", "any", "flagged", "clear"] : ["flagged", "clear"] });
  return out;
}

const listed = (said: readonly string[]) => (said.length <= 1 ? (said[0] ?? "") : `${said.slice(0, -1).join(", ")} and ${said.at(-1)}`);

/**
 * `where` — `{ stage: "building", owner: "user:ada" }` — as the `filter`
 * word of an address (`stage:building,owner:user:ada`), held to what the
 * kinds offer: `through` for a kind's list, which also filters by a choice
 * at a relation's far end (`became.stage`). Nothing asked is no filter.
 */
export function filterOfWhere(schema: AnySchema, kinds: readonly string[], where: unknown, options: { readonly through?: boolean } = {}): WhereJudged {
  if (where === undefined || where === null) return { ok: true };
  if (!isRecord(where)) return { ok: false, says: `A filter is an object of a field and the value it keeps, like { where: { stage: "building" } }.` };
  const entries = Object.entries(where);
  if (entries.length === 0) return { ok: true };
  const offers: FilterKey[] = [];
  for (const kind of kinds) for (const offer of filterKeysOf(schema, kind, options.through === true)) if (!offers.some((held) => held.key === offer.key)) offers.push(offer);
  const first = kinds[0] ? schema.tryDefinition(kinds[0]) : undefined;
  const plural = first ? (first.plural ?? `${words(first.kind)}s`) : "These";
  const said: string[] = [];
  for (const [key, raw] of entries) {
    const offer = offers.find((one) => one.key === key);
    if (!offer) return { ok: false, says: `${plural.replace(/^./, (one) => one.toUpperCase())} have no field "${key}" to filter by${offers.length > 0 ? `; they filter by ${listed(offers.map((one) => one.key))}` : ""}.` };
    if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
      return { ok: false, says: `The filter on "${key}" is ${Array.isArray(raw) ? "a list" : raw === null ? "null" : `a ${typeof raw}`}; it keeps one value: a word, a number, or true or false.` };
    }
    const value = String(raw);
    if (value.trim().length === 0) return { ok: false, says: `The filter on "${key}" keeps nothing; give it a value, or leave "${key}" out.` };
    if (value.includes(",")) return { ok: false, says: `The filter on "${key}" holds a comma, which an address reads as a second filter; keep one value.` };
    if (offer.options && offer.options.length > 0 && !offer.options.includes(value)) {
      return { ok: false, says: `${offer.label} has no choice "${value}"; its choices are ${listed(offer.options.map((one) => `"${one}"`))}.` };
    }
    said.push(`${key}:${value}`);
  }
  return { ok: true, filter: said.join(",") };
}
