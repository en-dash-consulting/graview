import { dayAsRead, ISO_DAY } from "../days.js";
import { fieldWords, labelOf, nounOf, valueWords, type ReadableField } from "./define-node.js";
import { filesOf } from "./files.js";
import { isAppLinkField } from "./app-link.js";
import type { AnyNodeDefinition, PageFields } from "./types.js";

/*
 * A RECORD READ AS A PERSON READS IT: its fields in words, in the order and
 * the sections its page declares, prose told from a line, and two records
 * of one name told apart. A file of its own (FR-179) — a face reads a
 * record as it draws one, and the seat as it answers, each fetched as it is
 * first drawn or asked; a page's first chunk, which draws the bar and the
 * frame, carries none of it (`@graview/core/words`).
 */

/**
 * WHAT TELLS TWO SAME-NAMED THINGS APART, among the nodes a person is
 * choosing from. A single and its album are both "Blue Hour", and every
 * picker, every ask and the Find strip listed "Blue Hour, Blue Hour": a
 * choice nobody could make. For each node whose name another in the list
 * shares, the first fact that differs between them — "single" and "album",
 * or the dates — else its kind, else its id. Nodes with a name of their
 * own get nothing.
 */
export function tellApart(
  nodes: readonly ({ id: string; kind: string } & Record<string, unknown>)[],
  definitionOf: (kind: string) => AnyNodeDefinition | undefined,
): Map<string, string> {
  const apart = new Map<string, string>();
  const byName = new Map<string, typeof nodes[number][]>();
  for (const node of nodes) {
    const name = labelOf(definitionOf(node.kind), node).trim().toLowerCase();
    byName.set(name, [...(byName.get(name) ?? []), node]);
  }
  for (const same of byName.values()) {
    if (same.length < 2) continue;
    const byKind = new Map<string, typeof same>();
    for (const node of same) byKind.set(node.kind, [...(byKind.get(node.kind) ?? []), node]);
    for (const [kind, alike] of byKind) {
      // One of its kind among namesakes of other kinds: the kind is what differs.
      if (alike.length === 1) {
        apart.set(alike[0]!.id, nounOf(definitionOf(kind), kind));
        continue;
      }
      const facts = alike.map((node) => new Map(readableFields(node, definitionOf(node.kind)).map((field) => [field.key, field.alone])));
      const keys = [...new Set(facts.flatMap((fact) => [...fact.keys()]))];
      // A word before a number: "single" and "album" say more than two dates.
      const wordy = (key: string) => facts.every((fact) => !/\d/.test(fact.get(key) ?? ""));
      const ordered = [...keys.filter(wordy), ...keys.filter((key) => !wordy(key))];
      const telling = ordered.find((key) => new Set(facts.map((fact) => fact.get(key) ?? "")).size === alike.length);
      alike.forEach((node, at) => {
        const fact = telling ? facts[at]!.get(telling) : undefined;
        apart.set(node.id, fact ?? node.id);
      });
    }
  }
  return apart;
}


/** Resolves a node's prose description, used for a11y and tool text. */
export function describeNode(
  definition: AnyNodeDefinition | undefined,
  node: { id: string; kind: string } & Record<string, unknown>,
): string {
  if (definition?.describe) {
    return definition.describe(node);
  }
  return `${node.kind} ${labelOf(definition, node)}`;
}


/** Never shown: identity and the name, which the heading already is. */
const NOT_A_FIELD = new Set(["id", "kind", "label"]);


/** Whether `line` carries `value` as whole words: "2027 Subaru Forester" says "Subaru" and "2027", not "Sub". */
function saysAsWords(line: string, value: string): boolean {
  if (value.length === 0) return false;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s·,(/])${escaped}($|[\\s·,)/])`).test(line);
}

/**
 * WHICH of a node's fields a person sees, and HOW each one reads.
 *
 * One implementation, because there were two: the record on a page and the
 * summary on a card each decided this for themselves, and every rule — hide an
 * ordering key, format minutes as a time, render a boolean as a word, drop a
 * value the heading already said — had to be written into both and kept in
 * step by hand. They diverged the day the second one was written, which is how
 * a summary card ended up showing a list's ordering key as a chip reading "0"
 * while the page beside it did not.
 *
 * `said` is what the surrounding view has already put on screen. A value the
 * heading already carries is not information twice, it is the same sentence
 * twice — and where the heading is a SHORTENED form of a field, an exact
 * comparison never catches it, so the summary's stem is compared too.
 */
export function readableFields(
  node: Record<string, unknown>,
  definition: AnyNodeDefinition | undefined,
  options: {
    /** How many a GLANCE shows. Unset, every field: a record is read whole (W-156). */
    readonly limit?: number;
    readonly said?: readonly (string | undefined)[];
    /**
     * A GLANCE drops a value the heading already says as a WORD, not only as
     * the whole heading: a vehicle's summary is headed "2027 Subaru Forester
     * Sport", and "Year 2027 · Subaru" under it spent two of its three facts
     * saying the heading again while the price never appeared. A record's
     * full facts keep every field — that is where each is changed.
     */
    readonly glance?: boolean;
  } = {},
): readonly ReadableField[] {
  const display = definition?.display;
  const skip = new Set([...NOT_A_FIELD, ...(display?.hide ?? [])]);
  const said = (options.said ?? []).filter((text): text is string => Boolean(text));
  const stems = said
    .filter((text) => text.endsWith("…"))
    .map((text) => text.replace(/…$/, "").trim())
    .filter((stem) => stem.length > 12);

  const fields: ReadableField[] = [];
  /*
   * IN THE ORDER THE DECLARATION SAYS, NOT THE ORDER THE RECORD WAS WRITTEN
   * IN (FR-148). This read `Object.entries(node)`, so a record created with
   * three of its fields and given two more later read Status, Summary, Due,
   * Draft, Subject line — the order of its writes, which nobody chose.
   * A glance says what the declaration chose for it first (`display.glance`);
   * a record's page, what its page chose (`display.page`); then the fields
   * as the kind declares them, its computed ones after.
   */
  // Unchosen, a glance leads with who made the record and when, where the kind's roles say (`fieldRoles.who`, `.when`).
  const roles = definition?.fieldRoles;
  const chosen = options.glance ? (display?.glance ?? [roles?.["who"], roles?.["when"]].filter((key): key is string => !!key)) : pageOrder(display?.page);
  const keys = [...new Set([...chosen, ...declaredOrder(definition), ...Object.keys(node)])].filter((key) => Object.hasOwn(node, key));
  const entries = keys.map((key) => [key, node[key]] as const);
  for (const [key, value] of entries) {
    if (skip.has(key) || value === undefined || value === null) continue;
    const format = display?.format?.[key];
    // A picture or a document (FR-162) is drawn, not said on a glance; its words are its names.
    const files = format ? [] : filesOf(value);
    if (files[0] && options.glance) continue;
    // Another app's address (FR-171) is drawn as the app, not said on a glance.
    const app = !format && typeof value === "string" && isAppLinkField((definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape?.[key]) ? value : undefined;
    if (app && options.glance) continue;
    /*
     * A NESTED OBJECT HAS NO ONE-LINE RENDERING, and inventing one is worse
     * than leaving it to a view that knows what it is.
     *
     * That was true of an object and was not checked of an ARRAY of them,
     * which fell through to `join(", ")` — so a piece of ground with a
     * five-corner outline had a field on its record reading "[object
     * Object], [object Object], [object Object], [object Object]". Nobody
     * wrote that; nobody could have read it. The shape is drawn on the map
     * and belongs there, not in a list of words.
     *
     * A declaration that HAS a one-line rendering says so with `format`,
     * and then it is the declaration's sentence rather than this one's
     * guess — "5 corners" is a useful thing to say and only the app knows
     * that the numbers are corners.
     */
    const nested =
      !files[0] &&
      typeof value === "object" &&
      (!Array.isArray(value) || value.some((one) => typeof one === "object" && one !== null));
    if (nested && format === undefined) continue;
    const stored = files[0] ? files.map((file) => (file.caption ? `${file.name} — ${file.caption}` : file.name)).join(", ") : Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
    const text = format
      ? format(value)
      : Array.isArray(value) || typeof value === "boolean"
        ? // Nobody says "false". A boolean is a state, and the words for a
          // state are words.
          stored
        : /*
           * A DAY AS A PERSON READS IT ("28 Aug 2026"), on a glance and in a
           * record's facts alike; the edit control holds it as it is written
           * (`stored`). And a CHOICE as it is declared — its `display.format`,
           * else the value spoken — never the code it is kept as ("tue").
           */
          typeof value === "string" && ISO_DAY.test(value)
          ? dayAsRead(value)
          : typeof value === "string" && isChoice(definition, key)
            ? valueWords(definition, key, value)
            : stored;

    if (said.includes(text) || stems.some((stem) => text.startsWith(stem))) continue;
    if (options.glance && (typeof value === "string" || typeof value === "number") && said.some((line) => saysAsWords(line, text))) continue;
    const label = fieldWords(definition, key);
    const alone =
      // A yes or no the kind words itself ("Not yet inducted") is said whole; "Inducted: not yet inducted" said it twice (W-187).
      typeof value === "number" ? `${label} ${text}` : typeof value === "boolean" && !format ? `${label}: ${text.toLowerCase()}` : text;
    fields.push({ key, label, value: text, stored, alone, long: typeof value === "string" && isLongText(definition, key, text), ...(files[0] ? { files } : {}), ...(app ? { app } : {}) });
    if (options.limit !== undefined && fields.length >= options.limit) break;
  }
  return fields;
}

/** Whether a field is one of a declared set of values (`z.enum`), under optional, default and nullable. */
function isChoice(definition: AnyNodeDefinition | undefined, key: string): boolean {
  let at = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape?.[key] as { _zod?: { def?: { type?: string; innerType?: unknown } } } | undefined;
  for (let depth = 0; depth < 6 && at?._zod?.def?.innerType !== undefined; depth++) at = at._zod.def.innerType as typeof at;
  return at?._zod?.def?.type === "enum";
}

/** The kind's fields as it declares them, then its computed fields. */
function declaredOrder(definition: AnyNodeDefinition | undefined): readonly string[] {
  const shape = (definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape;
  return [...Object.keys(shape ?? {}), ...Object.keys((definition as { computed?: object } | undefined)?.computed ?? {})];
}

/** Every field a page names, in the order it names them: its first fields, then each group's. */
function pageOrder(page: PageFields | undefined): readonly string[] {
  return [...(page?.fields ?? []), ...(page?.groups ?? []).flatMap((group) => group.fields)];
}

/** What a string field may hold beyond which it is prose: a document's `string` holds 500, its `text` 20,000. */
const PROSE_ALLOWED = 500;
/** A value this long, or with a line break in it, is read as prose whatever its field allows. */
const PROSE_LENGTH = 160;

/** The string schema under optional, default and nullable. */
function stringSchema(schema: unknown): { readonly checks?: readonly { readonly _zod?: { readonly def?: { readonly check?: string; readonly maximum?: number } } }[] } | undefined {
  let at = schema as { _zod?: { def?: { type?: string; innerType?: unknown; checks?: never } } } | undefined;
  for (let depth = 0; depth < 6 && at?._zod?.def?.innerType !== undefined; depth++) at = at._zod.def.innerType as typeof at;
  return at?._zod?.def?.type === "string" ? (at._zod.def as never) : undefined;
}

/**
 * WHETHER A FIELD'S VALUE IS PROSE (FR-147): a string field declared to hold
 * more than 500 characters — a document's `text`, or `z.string().max(5000)`
 * in TypeScript — whatever it holds now, so an empty draft is still edited
 * in a text area; or a value with a line break in it, or longer than 160
 * characters.
 */
export function isLongText(definition: AnyNodeDefinition | undefined, key: string, value: unknown): boolean {
  const field = stringSchema((definition?.fields as { shape?: Record<string, unknown> } | undefined)?.shape?.[key]);
  if (field?.checks?.some((check) => check._zod?.def?.check === "max_length" && (check._zod.def.maximum ?? 0) > PROSE_ALLOWED)) return true;
  return typeof value === "string" && (value.includes("\n") || value.length > PROSE_LENGTH);
}

/** One run of a record's facts: under a group's title, or (the first) under none. */
export interface FieldSection<F extends { readonly key: string } = ReadableField> {
  readonly title?: string;
  readonly fields: readonly F[];
}

/**
 * A RECORD'S FACTS, IN THE SECTIONS ITS PAGE DECLARES (FR-148).
 *
 * `fields` are read as `readableFields` ordered them. Unsaid, one untitled
 * section of all of them. With `display.page`, its `fields` first, untitled;
 * each of its `groups` under its title; and what neither names under
 * "Details" when there are groups, else after the first fields. A section
 * with nothing to show is left out.
 */
export function pageSections<F extends { readonly key: string }>(definition: AnyNodeDefinition | undefined, fields: readonly F[]): readonly FieldSection<F>[] {
  const page = definition?.display?.page;
  const groups = page?.groups ?? [];
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const named = new Set(pageOrder(page));
  const pick = (keys: readonly string[]) => keys.flatMap((key) => (byKey.has(key) ? [byKey.get(key)!] : []));
  const rest = fields.filter((field) => !named.has(field.key));
  const sections: FieldSection<F>[] = [
    { fields: [...pick(page?.fields ?? []), ...(groups.length > 0 ? [] : rest)] },
    ...groups.map((group) => ({ title: group.title, fields: pick(group.fields) })),
    ...(groups.length > 0 ? [{ title: "Details", fields: rest }] : []),
  ];
  return sections.filter((section) => section.fields.length > 0);
}
