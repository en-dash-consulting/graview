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
 *
 * And what that host's first design said that these did not (Roadmap
 * f-composer-covers-cloud-first-design): a row and a glance for every named
 * kind, the record a row's record belongs to (`belongsTo`), an undated list
 * in its choice's order, a dated one from today on, soonest first, five and
 * ten to a list, and a headline of up to five kinds, the most linked first.
 * The people kind is the members, the framework's to draw, never designed.
 */
import { defaultLabelField } from "./document/compiled.js";
import type { DocumentEdit } from "./document/edit.js";
import type { GraviewDocument, KindSpec } from "./document/schema.js";
import { nounWords, pluralWords } from "./document/policy-words.js";
import { humanizeField } from "./schema/humanize.js";
import { BOOKKEEPING_DATE, kindDateField } from "./kind-date.js";

/** The most kinds a first home lists: past six it is a directory, not a home. */
export const MOST_HOME_LISTS = 6;
/** The most records a first home's dated list shows: what is next, not the whole calendar. */
export const MOST_DATED_LISTED = 5;
/** The most records a first home's other lists show; the kind's own page has the rest. */
export const MOST_LISTED = 10;
/** The most kinds a first home's headline counts. */
export const MOST_COUNTED = 5;
/** The longest a headline's template may be: the document's limit on a template. */
const MOST_HEADLINE = 300;

/** What one proposal says: its edit, and why, a sentence a person reads before accepting. */
export interface ComposedPart {
  readonly edit: DocumentEdit;
  readonly said: string;
}

type FieldSpec = KindSpec["fields"][string];
type EdgeSpec = NonNullable<KindSpec["edges"]>[string];

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
/** The kind is the people (`people: true`): its records are the members, the framework's to draw, never a product's to design. */
const isPeople = (spec: KindSpec | undefined) => (spec as { readonly people?: boolean } | undefined)?.people === true;

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

/** The choice a kind's records are told apart by: its status, else its first single choice of two or more (a guest's RSVP, a dish's course). */
export function choiceOfKind(spec: KindSpec): string | undefined {
  return (
    statusOfKind(spec) ??
    Object.keys(spec.fields).find((name) => {
      const field = spec.fields[name]!;
      return field.type === "enum" && !field.multiple && (field.options?.length ?? 0) >= 2;
    })
  );
}

const edgesOf = (spec: KindSpec | undefined) => Object.entries((spec?.edges ?? {}) as Readonly<Record<string, EdgeSpec>>);

/**
 * THE RECORD A RECORD BELONGS TO (a dish's household, a schedule item's
 * host): the relation a row names it by. A document cannot mark a relation
 * required — a relation has no `required` — so what a declaration says of
 * belonging is read from two things it does say:
 *
 *   - the relation is to ONE record of ONE other kind of this app
 *     (`cardinality: "one"`, a single `to`). Each record has one, and many
 *     records may share it, so that kind groups this one: the shape a
 *     foreign key has. Not one to the kind itself (a parent is a
 *     hierarchy, not an owner), not to another app's kind or to a choice of
 *     kinds, not to the people kind (a record assigned to a member is not
 *     grouped by them), and not a pair: where the other kind holds one of
 *     this kind back, neither groups the other;
 *   - of several such, the one a rule over the kind requires (its `require`
 *     names the relation: "every guest comes with a household") first, else
 *     the first declared.
 */
export function belongsTo(document: GraviewDocument, kind: string): { readonly edge: string; readonly kind: string } | undefined {
  const candidates = edgesOf(document.kinds[kind]).flatMap(([edge, one]): { edge: string; kind: string }[] => {
    if (one.cardinality !== "one" || !Array.isArray(one.to) || one.to.length !== 1) return [];
    const target = one.to[0]!;
    // Not the people: a record assigned to a member is not grouped by them, and the members are the framework's.
    if (target === kind || !Object.hasOwn(document.kinds, target) || isPeople(document.kinds[target])) return [];
    const paired = edgesOf(document.kinds[target]).some(([, back]) => back.cardinality === "one" && Array.isArray(back.to) && back.to.includes(kind));
    return paired ? [] : [{ edge, kind: target }];
  });
  const required = Object.values((document.rules ?? {}) as Readonly<Record<string, { readonly over?: string; readonly require?: string }>>).flatMap((rule) => (rule.over === kind && typeof rule.require === "string" ? [rule.require] : []));
  return candidates.find((one) => required.some((rule) => requires(rule, one.edge))) ?? candidates[0];
}

/** A rule's `require` that says the relation is there: `present(household)`, `present(out('household'))`, `exists(out('household'))`, or a count of it above nothing — said whole, never a part of a larger condition (which may as well forbid it). */
function requires(rule: string, edge: string): boolean {
  const escaped = edge.replace(/[-]/g, "\\-");
  const reach = `(?:${escaped}|out\\(\\s*['"]${escaped}['"]\\s*\\))`;
  const said = rule.replace(/\s+/g, " ").trim();
  return new RegExp(`^(?:(?:present|exists)\\( ?${reach} ?\\)|count\\( ?${reach} ?\\) ?(?:> ?0|>= ?1))$`).test(said);
}

/** How many links a kind has to other kinds of this app, the people aside — each relation from it to each kind it reaches, and each relation to it: what most of the app hangs on is linked most. */
function linksOf(document: GraviewDocument, kind: string): number {
  let links = 0;
  for (const [from, spec] of Object.entries(document.kinds)) {
    if (isPeople(spec)) continue;
    for (const [, edge] of edgesOf(spec)) {
      const targets = Array.isArray(edge.to) ? edge.to.filter((target) => Object.hasOwn(document.kinds, target) && target !== from && !isPeople(document.kinds[target])) : [];
      links += from === kind ? targets.length : targets.includes(kind) ? 1 : 0;
    }
  }
  return links;
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

/** The plural English makes of a noun, as the `plural` formatter makes it: offers, parties, boxes. */
const englishPlural = (noun: string) => (/[^aeiou]y$/i.test(noun) ? `${noun.slice(0, -1)}ies` : /(s|x|z|ch|sh)$/i.test(noun) ? `${noun}es` : `${noun}s`);

/**
 * A count said with its noun: the declared plural where it is a plural
 * English would not make, else English's of the noun ("schedule items",
 * never "two schedule"). In words ("Three dishes"), or in `figures`
 * ("3 dishes"), which is shorter, for a headline that must fit.
 */
function counted(document: GraviewDocument, kind: string, first: boolean, figures = false): string {
  const count = `count(all(${quoted(kind)}))`;
  const noun = nounWords(document.kinds, kind).toLowerCase();
  const plural = pluralWords(document.kinds, kind).toLowerCase();
  // A plural declared the same as its noun ("sheep") is one English would not make, and is said as declared.
  const same = plural === noun && (document.kinds[kind] as { readonly plural?: string }).plural?.toLowerCase() === noun;
  const isPlural = same || (plural !== noun && plural !== englishPlural(noun) && (/s$/.test(plural) || /^(people|children|men|women|staff|data|media|feet|teeth|geese|mice)$/.test(plural.split(" ").pop() ?? "")));
  // The noun counts the set itself (`plural` takes a set as it takes a number): a part a few characters shorter, so a fifth kind fits sooner.
  return `{${count}${figures ? "" : ` | words${first ? " | capital" : ""}`}} {all(${quoted(kind)}) | plural: ${isPlural ? `${quoted(noun)}, ${quoted(plural)}` : quoted(noun)}}`;
}

/**
 * THE HEADLINE: up to five kinds every seat sees, the most linked first
 * (declaration order among equals), as many as fit the 300 characters a
 * template may be — in words where as many fit, in figures where more do.
 */
function headlineOf(document: GraviewDocument, kinds: readonly string[]): { readonly headline: string; readonly counts: readonly string[] } {
  const ranked = kinds
    .filter((kind) => seenWholeByEveryone(document, kind))
    .map((kind, at) => ({ kind, at, links: linksOf(document, kind) }))
    .sort((a, b) => b.links - a.links || a.at - b.at)
    .slice(0, MOST_COUNTED)
    .map((one) => one.kind);
  const fitting = (figures: boolean) => {
    for (let n = ranked.length; n > 0; n -= 1) {
      const counts = ranked.slice(0, n);
      const headline = `${listed(counts.map((kind, at) => counted(document, kind, at === 0, figures)))}.`;
      if (headline.length <= MOST_HEADLINE) return { headline, counts };
    }
    return undefined;
  };
  const inWords = fitting(false);
  const inFigures = fitting(true);
  return (inFigures && inFigures.counts.length > (inWords?.counts.length ?? 0) ? inFigures : inWords) ?? { headline: document.name, counts: [] };
}

/** The kinds a home may show, in the order the declaration arranges them, less those it hides, the people and those `skip` names. */
function shownKinds(document: GraviewDocument, skip: ReadonlySet<string>): string[] {
  const hidden = new Set([...((document.pages as { readonly hide?: readonly string[] } | undefined)?.hide ?? []), ...skip]);
  const order = ((document.pages as { readonly order?: readonly string[] } | undefined)?.order ?? []).filter((kind) => kind in document.kinds);
  return [...new Set([...order, ...Object.keys(document.kinds)])].filter((kind) => !hidden.has(kind) && !isPeople(document.kinds[kind]));
}

/** What the proposals may leave alone: kinds the framework keeps for an installation (its people and invitations), never a product's to design. */
export interface FromDeclarationOptions {
  readonly skip?: ReadonlySet<string>;
}

/**
 * THE HOME A PLAIN DOCUMENT IS GIVEN: one headline counting what it holds
 * ("{…| words | capital} households, {…| words} guests and …") — up to five
 * kinds every seat sees, the most linked first — then each kind's records
 * under its plural, as rows, a list standing only where its seat has some
 * to see, six lists at most. The dated kinds first, each from today on: its
 * records not before today and those with no date, soonest first, five, and
 * "No <plural> ahead." when none is. Every other kind in its choice's
 * declared order (`choiceOfKind`), ten. Undefined where the document
 * declares a home.
 */
export function homeFromDeclaration(document: GraviewDocument, options: FromDeclarationOptions = {}): ComposedPart | undefined {
  if ((document.views as { readonly home?: unknown } | undefined)?.home !== undefined) return undefined;
  const shown = shownKinds(document, options.skip ?? new Set());
  const dated = shown.filter((kind) => dateOfKind(document.kinds[kind]!) !== undefined);
  const kinds = [...dated, ...shown.filter((kind) => !dated.includes(kind))].slice(0, MOST_HOME_LISTS);
  if (kinds.length === 0) return undefined;
  const { headline, counts } = headlineOf(document, shown);
  const blocks: unknown[] = [{ headline }];
  for (const kind of kinds) {
    const spec = document.kinds[kind]!;
    const date = dateOfKind(spec);
    const choice = date ? undefined : choiceOfKind(spec);
    const all = `all(${quoted(kind)})`;
    // A record with no date is kept (`<` of nothing is false): it is not past, and nothing else lists it.
    const list = date
      ? { list: `${all} where not (${date.field} < today())`, as: "row", sort: date.field, limit: MOST_DATED_LISTED, empty: `No ${pluralWords(document.kinds, kind).toLowerCase()} ahead.` }
      : { list: all, as: "row", ...(choice ? { sort: { by: choice, direction: "choices" } } : {}), limit: MOST_LISTED };
    blocks.push({ when: `count(${all}) > 0`, show: [{ title: capital(pluralWords(document.kinds, kind)) }, list] });
  }
  const plurals = (list: readonly string[]) => listed(list.map((kind) => pluralWords(document.kinds, kind).toLowerCase()));
  const listedDated = kinds.filter((kind) => dated.includes(kind));
  return {
    edit: { op: "set-home", blocks } as DocumentEdit,
    said: `The app has no home of its own, so it opens on ${counts.length > 0 ? `how many ${plurals(counts)} it holds` : "its name"}, then a list of its ${plurals(kinds)}${listedDated.length > 0 ? `, the ${plurals(listedDated)} first, from today on` : ""}.`,
  };
}

/** A relation as an expression reaches it: bare where its name is one word (`household`), else `out('made-by')`, which a bare `made-by` would read as a subtraction. */
const reached = (edge: string) => (/^[a-z][A-Za-z0-9]*$/.test(edge) ? edge : `out(${quoted(edge)})`);

/** Every field the record's name already says — its naming field, or each its label reads ("{first} {last}"): a row or a glance says what the name does not. */
const namingFields = (spec: KindSpec) => new Set([defaultLabelField(spec) ?? "", ...[...(spec.label ?? "").matchAll(/\{\s*([A-Za-z][A-Za-z0-9_]*)/g)].map((match) => match[1]!)]);

/** The facts a glance compares records by, past those it leads with: read at a glance, not in the name, and not a day a record was written or touched (bookkeeping). */
function restOf(spec: KindSpec, led: readonly string[]): string[] {
  const naming = namingFields(spec);
  return Object.entries(spec.fields)
    .filter(([field, one]) => !led.includes(field) && !naming.has(field) && glanceable(one) && !((one.type === "date" || one.type === "datetime") && BOOKKEEPING_DATE.test(field)))
    .map(([field]) => field);
}

/**
 * A row for a kind that has none: its name, then its date as a glance says
 * it, its choice (`choiceOfKind`: a status, a course, an RSVP) and the
 * record it belongs to (`belongsTo`) — each only where a record holds it.
 * A kind with none of these says the first other fact a glance would.
 * Nothing for a kind with no name, or with nothing past its name.
 */
export function rowFromDeclaration(document: GraviewDocument, kind: string, options: FromDeclarationOptions = {}): ComposedPart | undefined {
  const spec = document.kinds[kind];
  const views = (document.views as Readonly<Record<string, { readonly row?: unknown }>> | undefined)?.[kind];
  if (!spec || options.skip?.has(kind) || isPeople(spec) || views?.row !== undefined) return undefined;
  const name = nameTemplate(spec);
  if (!name) return undefined;
  const naming = namingFields(spec);
  const date = dateOfKind(spec);
  const choice = choiceOfKind(spec);
  const owner = belongsTo(document, kind);
  const shown = (field: string, template: string) => ({ when: `present(${field})`, show: [{ text: template }] });
  const parts: { readonly block: unknown; readonly words: string }[] = [
    ...(date && !naming.has(date.field) ? [{ block: shown(date.field, `{${date.field} | glance}`), words: `its ${fieldWords(spec, date.field)}` }] : []),
    ...(choice && !naming.has(choice) ? [{ block: shown(choice, `{${choice}}`), words: `its ${fieldWords(spec, choice)}` }] : []),
    ...(owner ? [{ block: shown(reached(owner.edge), `{${reached(owner.edge)}}`), words: `the ${nounWords(document.kinds, owner.kind).toLowerCase()} it belongs to` }] : []),
  ];
  if (parts.length === 0) {
    // Not a yes or no: alone on a row, "true" says nothing of what it is.
    const fact = restOf(spec, []).find((field) => spec.fields[field]!.type !== "boolean");
    if (fact === undefined) return undefined;
    const format = (spec.fields[fact] as { readonly format?: string }).format;
    parts.push({ block: shown(fact, `{${fact} | ${format === "money" || format === "percent" ? format : "glance"}}`), words: `its ${fieldWords(spec, fact)}` });
  }
  // The name first: a row is named by it, and a model is told it once (`describePlace` reads a row's first title as its name).
  const blocks = [{ title: name }, ...parts.map((part) => part.block)];
  const noun = nounWords(document.kinds, kind).toLowerCase();
  return {
    edit: { op: "set-view", kind, slot: "row", blocks } as DocumentEdit,
    said: `Each ${noun} is listed by its name, then ${listed(parts.map((part) => part.words))}, so a list of them reads at a glance.`,
  };
}

/** A glance for a kind that has none: its date and its choice first, then what else is read at a glance, three at most; nothing for a kind with no name or nothing past it. */
export function glanceFromDeclaration(document: GraviewDocument, kind: string, options: FromDeclarationOptions = {}): ComposedPart | undefined {
  const spec = document.kinds[kind];
  if (!spec || options.skip?.has(kind) || isPeople(spec) || spec.glance !== undefined || !nameTemplate(spec)) return undefined;
  // Every field the record's name already says is left out: a glance says what the name does not.
  const naming = namingFields(spec);
  const led = [dateOfKind(spec)?.field, choiceOfKind(spec)].filter((field): field is string => field !== undefined && !naming.has(field));
  const fields = [...led, ...restOf(spec, led)].slice(0, 3);
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
