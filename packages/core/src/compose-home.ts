/**
 * A FIRST HOME, ROWS AND GLANCES, FROM THE DECLARATION ALONE (Roadmap
 * f-compose-home-from-declaration).
 *
 * `composeDesign` proposed only an accent for a plain document: its critic
 * fixes what it warns about, and plain kinds raise no warning. So a host
 * (Graview Cloud's first design) composed the rest itself — a count
 * headline, a list per kind with the dated ones first, and a row and a
 * glance for each kind — from words the framework already has. Here,
 * proposed as the edits `editDocument` takes, and only what is missing: a
 * declared home, a kind's own row and its glance are kept as they are.
 */
import { defaultLabelField } from "./document/compiled.js";
import type { DocumentEdit } from "./document/edit.js";
import type { GraviewDocument, KindSpec } from "./document/schema.js";
import { nounWords, pluralWords } from "./document/policy-words.js";

/** The most kinds a first home lists: past six it is a directory, not a home. */
export const MOST_HOME_LISTS = 6;

/** What one proposal says: its edit, and why, a sentence a person reads before accepting. */
export interface ComposedPart {
  readonly edit: DocumentEdit;
  readonly said: string;
}

type FieldSpec = KindSpec["fields"][string];

const quoted = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
const STATUS = /status|stage|state|phase/i;
/** A field a person reads at a glance: not prose, a list or a file. */
const glanceable = (field: FieldSpec) => !/^(text|list|image|video|file)$/.test(field.type);

/** The kind's date: the field its roles say it happens at, else its first date or moment. */
export function dateOfKind(spec: KindSpec): { readonly field: string; readonly moment: boolean } | undefined {
  const dated = (name: string | undefined) => {
    const field = name === undefined ? undefined : spec.fields[name];
    return field && (field.type === "date" || field.type === "datetime") ? { field: name!, moment: field.type === "datetime" } : undefined;
  };
  const when = (spec as { readonly fieldRoles?: Readonly<Record<string, string>> }).fieldRoles?.["when"];
  return dated(when) ?? dated(Object.keys(spec.fields).find((name) => dated(name) !== undefined));
}

/** The kind's status: a single choice called a status, stage, state or phase, else none. */
export function statusOfKind(spec: KindSpec): string | undefined {
  return Object.entries(spec.fields).find(([name, field]) => field.type === "enum" && !field.multiple && STATUS.test(name))?.[0];
}

/** What a record of the kind is called, as a template: its label, else its naming field. */
function nameTemplate(spec: KindSpec): string | undefined {
  if (spec.label) return spec.label;
  const field = defaultLabelField(spec);
  return field ? `{${field}}` : undefined;
}

/** A day said as people say it: "Nov 26, 2026", and a moment's time after it, "Nov 26, 2026, 9:30 AM" — never a field's label. */
const dateWords = (date: { readonly field: string; readonly moment: boolean }) => (date.moment ? `{${date.field} | date}, {${date.field} | time}` : `{${date.field} | date}`);

/** The kinds a first home lists, in the order the declaration arranges them, dated kinds first, less those it hides. */
function homeKinds(document: GraviewDocument): string[] {
  const hidden = new Set((document.pages as { readonly hide?: readonly string[] } | undefined)?.hide ?? []);
  const order = ((document.pages as { readonly order?: readonly string[] } | undefined)?.order ?? []).filter((kind) => kind in document.kinds);
  const kinds = [...new Set([...order, ...Object.keys(document.kinds)])].filter((kind) => !hidden.has(kind));
  const dated = kinds.filter((kind) => dateOfKind(document.kinds[kind]!) !== undefined);
  return [...dated, ...kinds.filter((kind) => !dated.includes(kind))].slice(0, MOST_HOME_LISTS);
}

/**
 * THE HOME A PLAIN DOCUMENT IS GIVEN: one headline counting what it holds
 * ("{…| words | capital} dishes and {…| words} events."), then each kind's
 * records under its plural, as rows — the dated kinds first, each sorted by
 * its date. Undefined where the document declares a home.
 */
export function homeFromDeclaration(document: GraviewDocument): ComposedPart | undefined {
  if ((document.views as { readonly home?: unknown } | undefined)?.home !== undefined) return undefined;
  const kinds = homeKinds(document);
  if (kinds.length === 0) return undefined;
  const counted = kinds.slice(0, 3).map((kind, at) => {
    const count = `count(all(${quoted(kind)}))`;
    const noun = nounWords(document.kinds, kind).toLowerCase();
    const plural = pluralWords(document.kinds, kind).toLowerCase();
    return `{${count} | words${at === 0 ? " | capital" : ""}} {${count} | plural: ${quoted(noun)}, ${quoted(plural)}}`;
  });
  const headline = `${counted.length < 2 ? counted.join("") : `${counted.slice(0, -1).join(", ")} and ${counted[counted.length - 1]}`}.`;
  const blocks: unknown[] = [{ headline }];
  for (const kind of kinds) {
    const date = dateOfKind(document.kinds[kind]!);
    blocks.push({ title: capital(pluralWords(document.kinds, kind)) }, { list: `all(${quoted(kind)})`, as: "row", ...(date ? { sort: date.field } : {}) });
  }
  const dated = kinds.filter((kind) => dateOfKind(document.kinds[kind]!) !== undefined).map((kind) => pluralWords(document.kinds, kind).toLowerCase());
  return {
    edit: { op: "set-home", blocks } as DocumentEdit,
    said: `The app has no home of its own, so it opens on how many of each it holds, then each list${dated.length > 0 ? `, ${dated.join(" and ")} first, by date` : ""}.`,
  };
}

/** A row for a kind that has none: its date as people say it, its name, its status — what a list of them is compared by. */
export function rowFromDeclaration(document: GraviewDocument, kind: string): ComposedPart | undefined {
  const spec = document.kinds[kind];
  const views = (document.views as Readonly<Record<string, { readonly row?: unknown }>> | undefined)?.[kind];
  if (!spec || views?.row !== undefined) return undefined;
  const name = nameTemplate(spec);
  const date = dateOfKind(spec);
  const status = statusOfKind(spec);
  // A row that would say only the name is the derived one already.
  if (!name || (!date && !status)) return undefined;
  const blocks = [...(date ? [{ text: dateWords(date) }] : []), { title: name }, ...(status ? [{ text: `{${status}}` }] : [])];
  const plural = pluralWords(document.kinds, kind).toLowerCase();
  return {
    edit: { op: "set-view", kind, slot: "row", blocks } as DocumentEdit,
    said: `A row of ${plural} leads with ${[date ? `its ${date.moment ? "day and time" : "day"}` : undefined, "its name", status ? `its ${status}` : undefined].filter(Boolean).join(", then ")}, so a list of them reads at a glance.`,
  };
}

/** A glance for a kind that has none: its date and its status first, then what else is read at a glance, three at most. */
export function glanceFromDeclaration(document: GraviewDocument, kind: string): ComposedPart | undefined {
  const spec = document.kinds[kind];
  if (!spec || spec.glance !== undefined) return undefined;
  const naming = new Set([defaultLabelField(spec) ?? ""]);
  const date = dateOfKind(spec)?.field;
  const status = statusOfKind(spec);
  if (!date && !status) return undefined;
  const led = [date, status].filter((field): field is string => field !== undefined);
  const rest = Object.entries(spec.fields)
    .filter(([field, one]) => !led.includes(field) && !naming.has(field) && glanceable(one))
    .map(([field]) => field);
  const fields = [...led, ...rest].slice(0, 3);
  const plural = pluralWords(document.kinds, kind).toLowerCase();
  return {
    edit: { op: "set-glance", kind, fields } as DocumentEdit,
    said: `A glance at one of the ${plural} says ${fields.join(", ")}, ${led.length === 2 ? "its date and its status" : date ? "its date" : "its status"} first.`,
  };
}

/** Everything a plain document is missing, in the order it is proposed: the home, then each kind's glance and row. */
export function fromDeclaration(document: GraviewDocument): ComposedPart[] {
  const parts: (ComposedPart | undefined)[] = [homeFromDeclaration(document)];
  for (const kind of Object.keys(document.kinds)) parts.push(glanceFromDeclaration(document, kind), rowFromDeclaration(document, kind));
  return parts.filter((part): part is ComposedPart => part !== undefined);
}
