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
 *
 * What they say is what the derived defaults say: a row's date as a glance
 * says it (`| glance`: the zone only to a reader elsewhere, a repeating
 * date by its rule), nothing where the record holds no date, and a home
 * that keeps, for each seat, to the kinds that seat sees.
 */
import { defaultLabelField } from "./document/compiled.js";
import type { DocumentEdit } from "./document/edit.js";
import type { GraviewDocument, KindSpec } from "./document/schema.js";
import { nounWords, pluralWords } from "./document/policy-words.js";
import { humanizeField } from "./schema/humanize.js";
import { BOOKKEEPING_DATE, kindDateField } from "./kind-date.js";

/** The most kinds a first home lists: past six it is a directory, not a home. */
export const MOST_HOME_LISTS = 6;

/** What one proposal says: its edit, and why, a sentence a person reads before accepting. */
export interface ComposedPart {
  readonly edit: DocumentEdit;
  readonly said: string;
}

type FieldSpec = KindSpec["fields"][string];

/*
 * VALUES THAT END A RECORD'S WAY. Done-like ones are what people work
 * toward; the ones that end it otherwise are never named as its goal.
 */
export const DONE = new Set(["done", "complete", "completed", "closed", "shipped", "booked", "paid", "finished", "resolved", "published", "delivered", "approved", "merged", "released", "signed", "won", "returned", "fixed", "filed"]);
export const ENDED = new Set(["canceled", "cancelled", "declined", "rejected", "withdrawn", "abandoned", "lost", "dropped", "archived", "wontfix", "won't do", "duplicate"]);
const STATUS_NAME = /^(status|stage|state|phase)$/i;
const said = (value: string) => value.trim().toLowerCase();

const quoted = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const capital = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
/** A field a person reads at a glance: not prose, a list or a file. */
const glanceable = (field: FieldSpec) => !/^(text|list|image|video|file)$/.test(field.type);
const rolesOf = (spec: KindSpec) => (spec as { readonly fieldRoles?: Readonly<Record<string, string>> }).fieldRoles ?? {};

/** A choice field that ends: some values a record is done at, some it is still on the way — a status by its choices, whatever it is called. */
export function endingChoice(spec: KindSpec): { field: string; options: readonly string[]; done: readonly string[]; ended: readonly string[] } | undefined {
  // A choice that takes several (FR-233) is no status: a record is not in two stages at once.
  const choices = Object.entries(spec.fields).filter(([, field]) => field.type === "enum" && !field.multiple && Array.isArray(field.options) && field.options.length >= 2);
  // A field called a status, stage or state first; then any choice whose values end.
  const ranked = [...choices].sort(([a], [b]) => Number(STATUS_NAME.test(b)) - Number(STATUS_NAME.test(a)));
  for (const [field, choice] of ranked) {
    const options = choice.options!;
    const done = options.filter((value) => DONE.has(said(value)));
    const ended = options.filter((value) => ENDED.has(said(value)));
    if (done.length > 0 && done.length + ended.length < options.length) return { field, options, done, ended };
  }
  return undefined;
}

/** The kind's date, as every reader picks it (`kindDateField`): its `when` role's, else its first that is not bookkeeping. */
export function dateOfKind(spec: KindSpec): { readonly field: string; readonly moment: boolean } | undefined {
  const field = kindDateField(Object.entries(spec.fields).map(([name, one]) => ({ name, type: one.type })), rolesOf(spec)["when"]);
  return field ? { field: field.name, moment: field.type === "datetime" } : undefined;
}

/**
 * The kind's status: the single choice its roles name (`status`, a board's
 * `column`); else one whose choices end (done, booked, shipped…); else a
 * single choice named exactly status, stage, state or phase.
 */
export function statusOfKind(spec: KindSpec): string | undefined {
  const single = (name: string | undefined) => (name !== undefined && spec.fields[name]?.type === "enum" && !spec.fields[name]!.multiple ? name : undefined);
  const roles = rolesOf(spec);
  return single(roles["status"]) ?? single(roles["column"]) ?? endingChoice(spec)?.field ?? Object.keys(spec.fields).find((name) => STATUS_NAME.test(name) && single(name) !== undefined);
}

/** A field in the declaration's words: its label, else its name spoken. */
const fieldWords = (spec: KindSpec, field: string) => (spec.fields[field] as { readonly label?: string } | undefined)?.label?.toLowerCase() ?? humanizeField(field).toLowerCase();
const listed = (words: readonly string[]) => (words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`);

/** What a record of the kind is called, as a template: its label, else its naming field. */
function nameTemplate(spec: KindSpec): string | undefined {
  if (spec.label) return spec.label;
  const field = defaultLabelField(spec);
  return field ? `{${field}}` : undefined;
}

/*
 * WHO SEES WHAT (the declaration's `policy.sees`). A home is drawn for every
 * seat, so it keeps to what each seat sees, as the derived home does: the
 * headline counts only kinds every role sees whole, and each list stands
 * only where its seat has some of the kind to see.
 */
function seenWholeByEveryone(document: GraviewDocument, kind: string): boolean {
  const sees = (document.policy as { readonly sees?: readonly { readonly roles: readonly string[] | "*"; readonly kinds: readonly string[]; readonly own?: boolean; readonly via?: string }[] } | undefined)?.sees;
  if (!sees) return true;
  // Every seat: one that holds no role (a visitor, an agent acting for nobody) as well, which only a sight for everyone (`"*"`) reaches.
  return sees.some((sight) => sight.roles === "*" && sight.kinds.includes(kind) && !sight.own && sight.via === undefined);
}

/** A count said in words with its noun: the declared plural where it is a plural, else English's of the noun ("schedule items", never "two schedule"). */
function counted(document: GraviewDocument, kind: string, first: boolean): string {
  const count = `count(all(${quoted(kind)}))`;
  const noun = nounWords(document.kinds, kind).toLowerCase();
  const plural = pluralWords(document.kinds, kind).toLowerCase();
  const isPlural = plural !== noun && (/s$/.test(plural) || /^(people|children|men|women|staff|data|media|feet|teeth|geese|mice)$/.test(plural.split(" ").pop() ?? ""));
  return `{${count} | words${first ? " | capital" : ""}} {${count} | plural: ${isPlural ? `${quoted(noun)}, ${quoted(plural)}` : quoted(noun)}}`;
}

/** The kinds a first home lists, in the order the declaration arranges them, dated kinds first, less those it hides and those `skip` names. */
function homeKinds(document: GraviewDocument, skip: ReadonlySet<string>): string[] {
  const hidden = new Set([...((document.pages as { readonly hide?: readonly string[] } | undefined)?.hide ?? []), ...skip]);
  const order = ((document.pages as { readonly order?: readonly string[] } | undefined)?.order ?? []).filter((kind) => kind in document.kinds);
  const kinds = [...new Set([...order, ...Object.keys(document.kinds)])].filter((kind) => !hidden.has(kind));
  const dated = kinds.filter((kind) => dateOfKind(document.kinds[kind]!) !== undefined);
  return [...dated, ...kinds.filter((kind) => !dated.includes(kind))].slice(0, MOST_HOME_LISTS);
}

/** What the proposals may leave alone: kinds the framework keeps for an installation (its people and invitations), never a product's to design. */
export interface FromDeclarationOptions {
  readonly skip?: ReadonlySet<string>;
}

/**
 * THE HOME A PLAIN DOCUMENT IS GIVEN: one headline counting what it holds
 * ("{…| words | capital} dishes and {…| words} events.") of the kinds every
 * seat sees, then each kind's records under its plural, as rows — the dated
 * kinds first, each sorted by its date — a list standing only where its seat
 * has some to see. Undefined where the document declares a home.
 */
export function homeFromDeclaration(document: GraviewDocument, options: FromDeclarationOptions = {}): ComposedPart | undefined {
  if ((document.views as { readonly home?: unknown } | undefined)?.home !== undefined) return undefined;
  const kinds = homeKinds(document, options.skip ?? new Set());
  if (kinds.length === 0) return undefined;
  const everyone = kinds.filter((kind) => seenWholeByEveryone(document, kind)).slice(0, 3);
  const parts = everyone.map((kind, at) => counted(document, kind, at === 0));
  const headline = parts.length === 0 ? document.name : `${parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`}.`;
  const blocks: unknown[] = [{ headline }];
  for (const kind of kinds) {
    const date = dateOfKind(document.kinds[kind]!);
    blocks.push({ when: `count(all(${quoted(kind)})) > 0`, show: [{ title: capital(pluralWords(document.kinds, kind)) }, { list: `all(${quoted(kind)})`, as: "row", ...(date ? { sort: date.field } : {}) }] });
  }
  const plurals = (list: readonly string[]) => listed(list.map((kind) => pluralWords(document.kinds, kind).toLowerCase()));
  const dated = kinds.filter((kind) => dateOfKind(document.kinds[kind]!) !== undefined);
  return {
    edit: { op: "set-home", blocks } as DocumentEdit,
    said: `The app has no home of its own, so it opens on ${everyone.length > 0 ? `how many ${plurals(everyone)} it holds` : "its name"}, then a list of its ${plurals(kinds)}${dated.length > 0 ? `, the ${plurals(dated)} first, by date` : ""}.`,
  };
}

/** A row for a kind that has none: its name, then its date as a glance says it, then its status — nothing where a record holds none. */
export function rowFromDeclaration(document: GraviewDocument, kind: string, options: FromDeclarationOptions = {}): ComposedPart | undefined {
  const spec = document.kinds[kind];
  const views = (document.views as Readonly<Record<string, { readonly row?: unknown }>> | undefined)?.[kind];
  if (!spec || options.skip?.has(kind) || views?.row !== undefined) return undefined;
  const name = nameTemplate(spec);
  const date = dateOfKind(spec);
  const status = statusOfKind(spec);
  // A row that would say only the name is the derived one already.
  if (!name || (!date && !status)) return undefined;
  // The name first: a row is named by it, and a model is told it once (`describePlace` reads a row's first title as its name).
  const blocks = [
    { title: name },
    ...(date ? [{ when: `present(${date.field})`, show: [{ text: `{${date.field} | glance}` }] }] : []),
    ...(status ? [{ when: `present(${status})`, show: [{ text: `{${status}}` }] }] : []),
  ];
  const noun = nounWords(document.kinds, kind).toLowerCase();
  return {
    edit: { op: "set-view", kind, slot: "row", blocks } as DocumentEdit,
    said: `Each ${noun} is listed by its name, then ${listed([date ? `its ${fieldWords(spec, date.field)}` : undefined, status ? `its ${fieldWords(spec, status)}` : undefined].filter((one): one is string => one !== undefined))}, so a list of them reads at a glance.`,
  };
}

/** A glance for a kind that has none: its date and its status first, then what else is read at a glance, three at most. */
export function glanceFromDeclaration(document: GraviewDocument, kind: string, options: FromDeclarationOptions = {}): ComposedPart | undefined {
  const spec = document.kinds[kind];
  if (!spec || options.skip?.has(kind) || spec.glance !== undefined) return undefined;
  // Every field the record's name already says — its naming field, or each its label reads ("{first} {last}") — is left out: a glance says what the name does not.
  const naming = new Set([defaultLabelField(spec) ?? "", ...[...(spec.label ?? "").matchAll(/\{\s*([A-Za-z][A-Za-z0-9_]*)/g)].map((match) => match[1]!)]);
  const date = dateOfKind(spec)?.field;
  const status = statusOfKind(spec);
  if (!date && !status) return undefined;
  const led = [date, status].filter((field): field is string => field !== undefined && !naming.has(field));
  const rest = Object.entries(spec.fields)
    // Not a day a record was written or touched: that is bookkeeping, not a fact a glance compares by.
    .filter(([field, one]) => !led.includes(field) && !naming.has(field) && glanceable(one) && !((one.type === "date" || one.type === "datetime") && BOOKKEEPING_DATE.test(field)))
    .map(([field]) => field);
  const fields = [...led, ...rest].slice(0, 3);
  if (fields.length === 0) return undefined;
  const noun = nounWords(document.kinds, kind).toLowerCase();
  return {
    edit: { op: "set-glance", kind, fields } as DocumentEdit,
    said: `A glance at ${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun} says its ${listed(fields.map((field) => fieldWords(spec, field)))}.`,
  };
}

/** Everything a plain document is missing, in the order it is proposed: the home, then each kind's glance and row. */
export function fromDeclaration(document: GraviewDocument, options: FromDeclarationOptions = {}): ComposedPart[] {
  const parts: (ComposedPart | undefined)[] = [homeFromDeclaration(document, options)];
  for (const kind of Object.keys(document.kinds)) parts.push(glanceFromDeclaration(document, kind, options), rowFromDeclaration(document, kind, options));
  return parts.filter((part): part is ComposedPart => part !== undefined);
}
