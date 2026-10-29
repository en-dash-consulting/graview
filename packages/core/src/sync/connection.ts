import type { GraviewApp } from "../app.js";
import type { AnySchema } from "../schema/schema.js";
import type { Store } from "../store.js";
import { fieldSpecOf } from "../document/field-spec.js";
import type { FieldSpec } from "../document/schema.js";
import { notionSourcesOf, type ConnectionSpec, type GoogleCalendarConnectionSpec, type NotionConnectionSpec, type NotionSourceSpec } from "../document/connection-spec.js";
import { humanizeField } from "../schema/humanize.js";
import { GOOGLE_COLORS, MADE_BY_GRAVIEW, inConnectionFilter, tagPattern } from "./connection-filter.js";
import type { EdgeDeclaration } from "../schema/types.js";
import { relationActName } from "../mutations/derived-names.js";
import type { AnyMutationDefinition } from "../mutations/types.js";
import { creatingActFor } from "./creating-act.js";
import { SyncEngine, type GuestLeftOut, type SharedLinks, type SyncGuests, type SyncOptions } from "./engine.js";
import { googleCalendar, type Fetcher, type GoogleTokenRequest } from "./google-calendar.js";
import { addressesOf, addressesOfAttendees, attendeesOf, guestBook, type GuestGraph } from "./guests.js";
import { instantIn, timeZoneFor, wallIn } from "../days.js";
import { isRepeat, isRepeatField, repeatKey, type Weekday } from "../repeat.js";
import { addDays } from "../wall-time.js";
import { firstWeekday, hhmm, instantOfMoment, isoInstant, minutesOf, momentOfInstant, recurrenceOf, repeatOf, wallOfMoment, weekdayOf, weekdaysOf, weeklyRule } from "./recurrence.js";
import { notion, notionKey, type NotionMade, type NotionSourceOptions } from "./notion.js";
import { NOTION_EDGE, NOTION_INFERABLE, notionFieldType } from "./notion-types.js";
import type { LinkResolver, RemoteSystem, ResourceMapping, SyncMapping, SyncState } from "./types.js";

/**
 * A DECLARED CONNECTION, RUN.
 *
 * `connections.<name>` in a declaration says which calendar or database,
 * which kind, which fields and which way; this turns that into the engine,
 * the mapping and the transport, so a host (`graview serve`, the preview,
 * Graview Cloud) supplies only a token and a place to keep the engine's
 * state. Everything it decides is said here once:
 *
 * - A GOOGLE CALENDAR's field types say what kind of event it is: a `date`
 *   field is an all-day event's day (`start.date`; the end day is inclusive
 *   here and exclusive at Google, so it is moved by one each way), a
 *   `datetime` field a timed event's instant (`start.dateTime`, read back as
 *   one UTC instant however Google says it). A FILTER is applied as events
 *   arrive, because Google refuses a sync token beside a search: an event
 *   outside it is not news, and one that leaves it is gone here. An event
 *   made here is given what the filter needs (the color; the tag in its
 *   title) so it stays in it, and a private extended property naming the app.
 * - AN EVENT'S GUESTS (Roadmap f-calendar-guests-mapping) are `guests`: a
 *   field of addresses kept as the attendees, or `{ via }`, a relation to
 *   the people the event is about, kept as an EDGE the engine compares,
 *   holds and links as it does a Notion relation — a person's remote id
 *   being their guest key (`guests.ts`), given to the engine as its `links`.
 *   A person without an address or with Invite me off is no guest either
 *   way; an attendee matching nobody is held and sent back unchanged. Quiet
 *   by default: Google mails the guests only with `notify: true`.
 * - A NOTION DATABASE's properties are the fields the declaration maps, or,
 *   when it maps none, every field whose name a property has, the kind's name
 *   field being the database's title. A `date` field holds a date property's
 *   day, a `datetime` field its instant; an `enum` field a select or status,
 *   matched to its options ignoring case and punctuation.
 * - A NOTION RELATION is one of the kind's relations, when `properties`
 *   maps it (or, matched by name, when a relation property has its name and
 *   every kind it reaches is kept by a Notion connection of the app): a link
 *   in Notion is a link here, made and taken away through
 *   `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>`. The page
 *   it reaches is found through `links`, shared by every connection of the
 *   app (`sharedLinks()`), so it may be another connection's record; one
 *   not linked yet is held until it is. A relation of one takes the first
 *   page Notion lists, and says the rest once.
 * - SEVERAL DATA SOURCES of one database (`sources`) are one engine of
 *   several resources (`pages:<kind>`), each kept with its kind; a relation
 *   between two of them is found through the same links.
 * - THE PROPERTIES IT NEEDS ARE MADE (`make`): each mapped field the data
 *   source lacks is given a property of the type it is held in — words a
 *   text, a choice a select with the choice's options, a relation one to
 *   the source keeping the kind it reaches — named as the declaration
 *   names it, or, matched by name, as the field reads ("Due date"). The
 *   name field is the title Notion always has. None is made for a
 *   connection that only reads, or that says `create: false`.
 * - READ means the other system owns the kind: an act here that would change
 *   a record of it is refused with a sentence saying so (`SyncEngine.guard`),
 *   rather than accepted and never sent.
 * - Inbound changes land through the app's own acts — one that creates the
 *   kind from the fields mapped alone (`creatingAct`), `edit-<kind>` and
 *   `remove-<kind>` — authored by the system
 *   (`google-calendar`, `notion`), so Activity credits it and undo works.
 */

export { CONNECTION_TAG, GOOGLE_COLORS, MADE_BY_GRAVIEW, inConnectionFilter } from "./connection-filter.js";
export type ConnectionDeclaration = ConnectionSpec;

export interface ConnectionRun<S extends AnySchema> {
  /** The connection's name in the declaration (`connections.<name>`). */
  readonly name: string;
  readonly declaration: ConnectionDeclaration;
  readonly app: GraviewApp<S>;
  readonly store: Store<S>;
  /** A Google connection's calendar id, resolved from the declaration (its `env`, when it names one). */
  readonly calendarId?: string;
  /** A Notion connection's database id, resolved likewise. */
  readonly databaseId?: string;
  /**
   * An access token for Google, asked again with `{ refresh: true }` when
   * Google refuses the last one; for Notion, the internal integration's
   * secret.
   */
  token(request?: GoogleTokenRequest): Promise<string> | string;
  /** What the secret is called where the host keeps it (`NOTION_TOKEN`), for the sentence a refusal says. Never its value. */
  readonly secretName?: string;
  readonly fetch?: Fetcher;
  /** What the engine kept from the last run: its cursor, its links. */
  readonly state?: SyncState;
  /** A note the transport says once: a property it found no field for, one it leaves alone. */
  say?(line: string): void;
  /**
   * THE APP'S LINKS, shared by every connection it runs (`sharedLinks()`):
   * where a relation finds the record a Notion page is, whichever
   * connection linked it. This connection's engine is added to it. Absent:
   * the connection's own links alone.
   */
  readonly links?: SharedLinks;
  /** The clock a weekly series' first week is read from (FR-230); the runtime's when absent. A test passes one. */
  now?(): Date;
}

export interface Connection<S extends AnySchema> {
  readonly engine: SyncEngine<S>;
  readonly mapping: SyncMapping;
  readonly remote: RemoteSystem;
  /** For a read connection, the guard that refuses acts on the kind here; call it to lift. Absent for "both". */
  readonly unguard?: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const instant = (value: unknown): unknown => {
  if (typeof value !== "string" || !value) return value;
  const time = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(time) ? value : new Date(time).toISOString().replace(/\.000Z$/, "Z");
};
const shiftDay = (value: unknown, days: number): unknown => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
};

/** A kind's fields as a document says them, by name. */
function fieldSpecs(app: GraviewApp, kind: string): Record<string, FieldSpec> {
  const shape = (app.schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape ?? {};
  const out: Record<string, FieldSpec> = {};
  for (const [field, schema] of Object.entries(shape)) {
    const spec = fieldSpecOf(schema);
    if (spec) out[field] = spec;
  }
  return out;
}

/**
 * A kind's computed fields among `mapped` (Roadmap f-keep-linked): worked
 * out here, so sent and never read back — the resource's `ours` and
 * `computed`.
 */
function computedMapped(app: GraviewApp, kind: string, mapped: readonly string[]): Pick<ResourceMapping, "ours" | "computed"> {
  const definition = app.schema.tryDefinition(kind) as { computed?: Readonly<Record<string, unknown>>; fields?: { shape?: Record<string, unknown> } } | undefined;
  const worked = mapped.filter((field) => definition?.computed !== undefined && Object.hasOwn(definition.computed, field) && !Object.hasOwn(definition.fields?.shape ?? {}, field));
  return worked.length > 0 ? { ours: worked, computed: worked } : {};
}

/** Whether a field of the kind is a `date` (an all-day event's day) rather than a `datetime`. */
export function isDayField(app: GraviewApp, kind: string, field: string): boolean {
  return fieldSpecs(app, kind)[field]?.type === "date";
}

/** What a Google mapping is read against: the app's time zone, the clock a weekly series' first week is read from, and the graph the people a `guests: { via }` relation reaches are read from (absent, every attendee keeps its address). */
export interface GoogleMappingOptions {
  readonly zone?: string;
  now?(): Date;
  readonly graph?: GuestGraph;
}

/** The mapping a declaration says. */
export function connectionMapping(app: GraviewApp, declaration: ConnectionDeclaration, options: GoogleMappingOptions = {}): SyncMapping {
  return declaration.system === "notion" ? notionConnectionMapping(app, declaration).mapping : googleMapping(app, declaration, options).mapping;
}

/** The zone a Google mapping says its times in: the app's (`brand.timeZone`), else the runtime's. */
export const connectionZone = (app: GraviewApp, zone?: string): string => zone ?? app.brand?.timeZone ?? timeZoneFor(app.name);

/**
 * A Google connection's mapping: field types decide the paths, the filter's
 * tag is kept or stripped. A record that recurs (FR-230) is one event with
 * a rule: with `days` mapped, the weekdays and the two times of day are the
 * rule and the first week's instants in the app's zone; a start that
 * repeats carries its repeat as the rule and its exceptions. The guests
 * (Roadmap f-calendar-guests-mapping) are a field of addresses, or the
 * relation `via` kept as an edge whose remote ids are guest keys, with the
 * guest book the engine resolves that edge through.
 */
function googleMapping(app: GraviewApp, declaration: GoogleCalendarConnectionSpec, options: GoogleMappingOptions = {}): { readonly mapping: SyncMapping; readonly guests?: LinkResolver } {
  const { kind, fields } = declaration;
  const zone = connectionZone(app, options.zone);
  const now = options.now ?? (() => new Date());
  const specs = fieldSpecs(app, kind);
  const shape = ((app.schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape ?? {}) as Record<string, unknown>;
  const day = isDayField(app, kind, fields.start);
  const when = day ? "date" : "dateTime";
  const tag = declaration.filter?.tag;
  const keep = declaration.filter?.keep === true;
  const encode: Record<string, (value: unknown, node: Record<string, unknown>) => unknown> = {};
  const decode: Record<string, (value: unknown) => unknown> = {};
  const recurring: Record<string, string> = {};
  const repeated = repeatKey(fields.start);
  if (fields.days) {
    /*
     * WEEKDAYS AND TIMES OF DAY. The first occurrence is the first of the
     * record's weekdays from the week the event is sent in, at its time on
     * the app's wall; the end the same day (the next, past midnight). Both
     * are encoded from the record whole, so they always agree. Read back,
     * the rule is the weekdays — an enum's option, a list's codes — and the
     * instants are times of day there.
     */
    const days = fields.days;
    const options = specs[days]?.type === "enum" ? (specs[days]?.options ?? []) : undefined;
    const anchor = (node: Record<string, unknown>) => firstWeekday(wallIn(now().getTime(), zone).day, weekdaysOf(node[days]));
    const at = (node: Record<string, unknown>, value: unknown, after?: number) => {
      const first = anchor(node);
      const minutes = minutesOf(value);
      if (!first || minutes === undefined) return undefined;
      return isoInstant(instantIn(after !== undefined && minutes <= after ? addDays(first, 1) : first, minutes, zone));
    };
    recurring[days] = "recurrence";
    encode[days] = (value) => {
      const named = weekdaysOf(value);
      return named.length > 0 ? [weeklyRule(named)] : undefined;
    };
    encode[fields.start] = (value, node) => at(node, value);
    encode[fields.end] = (value, node) => at(node, value, minutesOf(node[fields.start]));
    decode[days] = (value) => {
      const rule = repeatOf(value, zone);
      const named = rule?.every === "week" && rule.on ? (rule.on as Weekday[]) : [];
      if (named.length === 0) return null;
      return options ? (options.find((option) => weekdayOf(option) === named[0]) ?? null) : named;
    };
    const timeOfDay = (value: unknown) => (typeof value === "string" ? hhmm(wallIn(Date.parse(value), zone).minutes) : value);
    decode[fields.start] = timeOfDay;
    decode[fields.end] = timeOfDay;
  } else if (isRepeatField(shape[repeated])) {
    /*
     * A DATE THAT REPEATS. The first occurrence is the event's start — a
     * wall time in the app's zone, as a repeating moment is kept — and the
     * repeat beside it is the rule, each day set apart an EXDATE at the
     * series' time; a series that no longer repeats sends no rule.
     */
    recurring[repeated] = "recurrence";
    encode[repeated] = (value, node) => {
      const start = wallOfMoment(node[fields.start], zone);
      return isRepeat(value) && start ? recurrenceOf(value, start, zone) : undefined;
    };
    decode[repeated] = (value) => repeatOf(value, zone) ?? null;
    if (day) {
      encode[fields.start] = (value) => value;
      encode[fields.end] = (value) => shiftDay(value, 1);
      decode[fields.end] = (value) => shiftDay(value, -1);
    } else {
      encode[fields.start] = (value) => instantOfMoment(value, zone);
      encode[fields.end] = (value) => instantOfMoment(value, zone);
      decode[fields.start] = (value) => momentOfInstant(value, zone);
      decode[fields.end] = (value) => momentOfInstant(value, zone);
    }
  } else if (day) {
    encode[fields.start] = (value) => value;
    encode[fields.end] = (value) => shiftDay(value, 1);
    decode[fields.end] = (value) => shiftDay(value, -1);
  } else {
    encode[fields.start] = instant;
    encode[fields.end] = instant;
    decode[fields.start] = instant;
    decode[fields.end] = instant;
  }
  if (tag) {
    const pattern = tagPattern(tag);
    // On the way out, the title carries the tag, so the event stays in the filter.
    encode[fields.summary] = (value) => (typeof value === "string" && !pattern.test(value) ? `${value} ${tag}`.trim() : value);
    // On the way in, the tag is the connection's, not the record's name, unless it is kept.
    if (!keep) decode[fields.summary] = (value) => (typeof value === "string" ? value.replace(pattern, "$1").replace(/\s{2,}/g, " ").trim() : value);
  }
  const guestsField: Record<string, string> = {};
  const normalize: Record<string, (value: unknown) => unknown> = {};
  let edges: Record<string, string> | undefined;
  let guests: LinkResolver | undefined;
  if (typeof fields.guests === "string") {
    /*
     * THE GUESTS IN A FIELD: a list of addresses, or one email, kept as the
     * attendees. Read back as the sorted addresses (the first alone for an
     * email field), so an address added in the calendar lands in the field
     * and nothing is dropped.
     */
    const field = fields.guests;
    const single = specs[field]?.type === "email";
    guestsField[field] = "attendees";
    encode[field] = (value) => attendeesOf(value);
    decode[field] = (value) => {
      const found = addressesOfAttendees(value);
      return single ? (found[0] ?? null) : found;
    };
    // What people type ("Ben@Example.com ") is compared as the calendar keeps it, or the record would be sent on every pass.
    normalize[field] = (value) => {
      const found = addressesOf(value);
      return single ? (found[0] ?? null) : found;
    };
  } else if (fields.guests) {
    /*
     * THE GUESTS THROUGH A RELATION: the edge's remote ids are guest keys.
     * Read back, each attendee is the key of the person with Invite me who
     * holds its address, else the address itself, which the engine holds
     * as part of the relation's value until a person matches it. Sent, the
     * keys are split back into addresses, once each.
     */
    const { via, emails = "emails", invite = "inviteMe" } = fields.guests;
    const reaches = edgeSpecs(app, kind)[via]?.to;
    const book = guestBook({ ...(options.graph ? { graph: options.graph } : {}), kinds: reaches === undefined || reaches === "*" ? [] : reaches, emails, invite });
    guests = book;
    edges = { [via]: "attendees" };
    decode[via] = (value) =>
      addressesOfAttendees(value).map((one) => {
        const person = book.localId(one);
        return (person === undefined ? undefined : book.remoteId(person)) ?? one;
      });
    encode[via] = (value) => attendeesOf(value);
  }
  const resource: ResourceMapping = {
    kind,
    resource: "events",
    fields: {
      [fields.summary]: "summary",
      [fields.start]: `start.${fields.days ? "dateTime" : when}`,
      [fields.end]: `end.${fields.days ? "dateTime" : when}`,
      ...recurring,
      ...(fields.location ? { [fields.location]: "location" } : {}),
      ...(fields.description ? { [fields.description]: "description" } : {}),
      ...guestsField,
    },
    ...(edges ? { edges } : {}),
    encode,
    decode,
    ...(Object.keys(normalize).length > 0 ? { normalize } : {}),
    ...computedMapped(app, kind, Object.values(fields).filter((field): field is string => typeof field === "string")),
    ...(declaration.direction === "read"
      ? { readonly: true, because: `Each ${kind} comes from a Google calendar this app only reads: change it there.` }
      : {}),
  };
  return { mapping: { system: "google-calendar", name: "Google Calendar", resources: [resource] }, ...(guests ? { guests } : {}) };
}

/** Words compared loosely: "In progress", "in-progress" and "inProgress" are one. */
const loose = (word: string) => word.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The field a kind is named by: one called name or title, else its first required words, else its first words. */
function nameField(specs: Record<string, FieldSpec>): string | undefined {
  const words = Object.entries(specs).filter(([, spec]) => spec.type === "string" || spec.type === "text");
  return (words.find(([field]) => field === "name" || field === "title") ?? words.find(([, spec]) => spec.required) ?? words[0])?.[0];
}

/** A kind's relations as its definition declares them, by name. */
function edgeSpecs(app: GraviewApp, kind: string): Readonly<Record<string, EdgeDeclaration>> {
  return ((app.schema.tryDefinition(kind) as { edges?: Record<string, EdgeDeclaration> } | undefined)?.edges ?? {}) as Readonly<Record<string, EdgeDeclaration>>;
}

/** The kinds a Notion connection of the app keeps. */
function notionKinds(app: GraviewApp): Set<string> {
  return new Set(Object.values(app.connections ?? {}).flatMap((declared) => (declared.system === "notion" ? notionSourcesOf(declared).map((one) => one.kind) : [])));
}

/** The property type a field of each type is made as, when a data source lacks it. */
const MADE_AS: Readonly<Record<string, string>> = {
  string: "rich_text",
  text: "rich_text",
  number: "number",
  integer: "number",
  enum: "select",
  "several choices": "multi_select",
  list: "multi_select",
  date: "date",
  datetime: "date",
  boolean: "checkbox",
  url: "url",
  email: "email",
  phone: "phone_number",
};
/** The property types a connection may make: Notion makes neither a status nor people from here. */
const MAKEABLE = new Set(["rich_text", "number", "select", "multi_select", "date", "checkbox", "url", "email", "phone_number", "relation"]);

/** A choice's option as a property's option is made: "in-progress" is "In progress". */
const optionWords = (option: string) => {
  const spaced = option.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** What one data source of a Notion connection maps: its resource's mapping, the names the transport resolves, the title, the relations that need not be there, and what to make. */
export interface NotionSourceMapping {
  readonly resource: ResourceMapping;
  readonly refs: Readonly<Record<string, string | undefined>>;
  readonly titleRef?: string;
  readonly quiet: readonly string[];
  readonly make: Readonly<Record<string, NotionMade>>;
}

/** What a Notion connection maps: the engine's mapping, and each data source's part of it. */
export function notionConnectionMapping(app: GraviewApp, declaration: NotionConnectionSpec, say?: (line: string) => void): { readonly mapping: SyncMapping; readonly sources: readonly (NotionSourceMapping & { readonly spec: NotionSourceSpec })[] } {
  const specs = notionSourcesOf(declaration);
  const resourceOfKind = new Map(specs.map((one) => [one.kind, one.resource]));
  const making = declaration.create !== false && declaration.direction !== "read";
  const sources = specs.map((spec) => ({ spec, ...notionSourceMapping(app, declaration, spec, making ? resourceOfKind : undefined, say) }));
  return { mapping: { system: "notion", resources: sources.map((one) => one.resource) }, sources };
}

function notionSourceMapping(app: GraviewApp, declaration: NotionConnectionSpec, source: NotionSourceSpec, making: ReadonlyMap<string, string> | undefined, say?: (line: string) => void): NotionSourceMapping {
  const { kind } = source;
  const specs = fieldSpecs(app, kind);
  const relations = edgeSpecs(app, kind);
  const named = nameField(specs);
  const fields: Record<string, string> = {};
  const edges: Record<string, string> = {};
  const refs: Record<string, string | undefined> = {};
  const make: Record<string, NotionMade> = {};
  const quiet: string[] = [];
  let titleRef: string | undefined;
  /** What a field is made as, when its data source lacks the property: the type it is held in, with a choice's options. */
  const makeField = (field: string, ref: string, name: string | undefined, declared?: string) => {
    if (!making || field === named) return;
    const spec = specs[field];
    const type = declared ?? (spec ? MADE_AS[notionFieldType(spec)] : undefined);
    if (!type || !MAKEABLE.has(type) || type === "relation") return;
    const options = (type === "select" || type === "multi_select") && spec?.options ? spec.options.map(optionWords) : undefined;
    make[ref] = { type, ...(name && name !== ref ? { name } : {}), ...(options ? { options } : {}) };
  };
  /** A relation's property is made only when it links a kind another source of this connection keeps. */
  const makeEdge = (edge: string, ref: string) => {
    const to = relations[edge]?.to;
    const target = making && to !== "*" && to?.length === 1 ? making.get(to[0]!) : undefined;
    if (target) make[ref] = { type: "relation", to: target };
  };
  if (source.properties) {
    for (const [field, property] of Object.entries(source.properties)) {
      const ref = typeof property === "string" ? property : property.name;
      if (!specs[field] && relations[field]) {
        edges[field] = ref;
        refs[ref] = NOTION_EDGE;
        makeEdge(field, ref);
        continue;
      }
      fields[field] = ref;
      refs[ref] = specs[field] ? notionFieldType(specs[field]) : undefined;
      // The name field is the title every data source has, if no property is called what it names.
      if (field === named) titleRef = ref;
      makeField(field, ref, undefined, typeof property === "string" ? undefined : property.type);
    }
  } else {
    for (const [field, spec] of Object.entries(specs)) {
      if (!NOTION_INFERABLE.has(notionFieldType(spec))) continue;
      fields[field] = field;
      refs[field] = notionFieldType(spec);
      makeField(field, field, humanizeField(field));
    }
    titleRef = named;
    // A relation is kept by name only when every kind it reaches is another Notion connection's: a relation property of its name may not be there.
    const kept = notionKinds(app);
    for (const [edge, spec] of Object.entries(relations)) {
      if (spec.to === "*" || spec.to.length === 0 || !spec.to.every((target) => kept.has(target))) continue;
      edges[edge] = edge;
      refs[edge] = NOTION_EDGE;
      quiet.push(edge);
    }
  }
  const encode: Record<string, (value: unknown) => unknown> = {};
  const decode: Record<string, (value: unknown) => unknown> = {};
  for (const field of Object.keys(fields)) {
    const spec = specs[field];
    switch (spec?.type) {
      case "date":
        encode[field] = (value) => (typeof value === "string" ? value.slice(0, 10) : value);
        decode[field] = (value) => (typeof value === "string" ? value.slice(0, 10) : value);
        break;
      case "datetime":
        encode[field] = instant;
        decode[field] = instant;
        break;
      case "enum": {
        const options = spec.options ?? [];
        const option = (value: unknown) => (typeof value === "string" ? (options.find((one) => one === value) ?? options.find((one) => loose(one) === loose(value)) ?? value) : value);
        // A choice that takes several (FR-233) arrives as a multi-select's names, each read as the option it is.
        decode[field] = spec.multiple ? (value) => (Array.isArray(value) ? value.map(option) : value === undefined || value === null ? value : [option(value)]) : option;
        break;
      }
      case "list":
        decode[field] = (value) => (typeof value === "string" ? [value] : value);
        break;
      case "string":
      case "text":
      case "url":
      case "email":
      case "phone":
        // People arrive as a list of names.
        decode[field] = (value) => (Array.isArray(value) ? value.join(", ") : value);
        break;
    }
  }
  for (const edge of Object.keys(edges)) {
    if (relations[edge]?.cardinality !== "one") continue;
    // A relation of one holds the first page Notion lists; the rest are said once and left there.
    decode[edge] = (value) => {
      if (!Array.isArray(value) || value.length <= 1) return value;
      say?.(`${edge}: each ${kind} links one page, and a page in Notion links ${value.length}, so the first is kept here and the rest are left in Notion`);
      return [value[0]];
    };
  }
  const resource: ResourceMapping = {
    kind,
    resource: source.resource,
    fields,
    ...(Object.keys(edges).length > 0 ? { edges } : {}),
    encode,
    decode,
    ...computedMapped(app, kind, Object.keys(fields)),
    ...(declaration.direction === "read" ? { readonly: true, because: `Each ${kind} comes from a Notion database this app only reads: change it there.` } : {}),
  };
  return { resource, refs, ...(titleRef ? { titleRef } : {}), quiet, make };
}

/**
 * The act a record of the kind from another system is made through: one
 * that creates it, takes no subject and asks for nothing the connection
 * does not map (`mapped`, our field names) — `add-<kind>` when it fits, else
 * the first declared act that does (`creatingActFor`). Undefined when none
 * fits, which `graview check` says at `connections.<name>`.
 */
export function creatingAct(app: GraviewApp, kind: string, mapped: readonly string[]): string | undefined {
  return creatingActFor((app.mutations ?? []) as readonly AnyMutationDefinition[], kind, mapped).act;
}

/**
 * THE ACTS A RELATION'S LINK LANDS THROUGH, for a link the other system
 * made or took away: its derived pair, `connect-<kind>-<relation>` and
 * `disconnect-<kind>-<relation>`, when the app has them (the checker says
 * when it has not); absent, the link is left as it is.
 */
function relationActs<S extends AnySchema>(store: Store<S>, kind: string): Pick<SyncOptions<S>, "connectInbound" | "disconnectInbound"> {
  const has = (name: string) => {
    try {
      store.mutation(name);
      return true;
    } catch {
      return false;
    }
  };
  const act = (which: "connect" | "disconnect") => ({ localId, edge, to }: { readonly localId: string; readonly edge: string; readonly to: string }) => {
    const name = relationActName(which, kind, edge);
    return has(name) ? { name, args: { id: localId, to } } : null;
  };
  return { connectInbound: act("connect"), disconnectInbound: act("disconnect") };
}

/** Our fields from a remote record's, decoded: what a record made from it holds. */
function decodedBy(resource: ResourceMapping) {
  return (fields: Readonly<Record<string, unknown>>) => {
    const out: Record<string, unknown> = {};
    for (const [ours, theirs] of Object.entries(resource.fields)) {
      if (!(theirs in fields)) continue;
      const decode = resource.decode?.[ours];
      out[ours] = decode ? decode(fields[theirs]) : fields[theirs];
    }
    return out;
  };
}

/** The engine, the mapping and the transport for one declared connection. */
export function connection<S extends AnySchema>(run: ConnectionRun<S>): Connection<S> {
  const { declaration } = run;
  return declaration.system === "notion" ? notionConnection(run, declaration) : googleConnection(run, declaration);
}

function googleConnection<S extends AnySchema>(run: ConnectionRun<S>, declaration: GoogleCalendarConnectionSpec): Connection<S> {
  const { app, store } = run;
  if (!run.calendarId) throw new Error(`connection ${run.name}: a Google connection needs its calendar's id`);
  const zone = connectionZone(app as GraviewApp, store.timeZone);
  const { mapping, guests } = googleMapping(app as GraviewApp, declaration, { zone, graph: store.graph, ...(run.now ? { now: run.now } : {}) });
  const resource = mapping.resources[0]!;
  // A record that recurs is one event with a rule (FR-230): the series alone is kept, never one week's exception, and Google expands a timed rule in a named zone.
  const recurring = Object.values(resource.fields).includes("recurrence");
  const repeated = repeatKey(declaration.fields.start);
  const timed = resource.fields[declaration.fields.start] === "start.dateTime";
  const color = declaration.filter?.color ? GOOGLE_COLORS[declaration.filter.color] : undefined;
  const remote = googleCalendar({
    calendarId: run.calendarId,
    token: run.token,
    ...(run.fetch ? { fetch: run.fetch } : {}),
    keep: (item) => inConnectionFilter(declaration, item) && !(recurring && item["recurringEventId"] !== undefined),
    madeHere: {
      ...(color ? { colorId: color } : {}),
      ...(recurring && timed ? { start: { timeZone: zone }, end: { timeZone: zone } } : {}),
      extendedProperties: { private: { [MADE_BY_GRAVIEW]: app.name } },
    },
    // Google mails the guests only when the declaration asks (`guests.notify`); every write says so either way.
    notify: typeof declaration.fields.guests === "object" && declaration.fields.guests.notify === true,
  });
  const creates = creatingAct(app as GraviewApp, declaration.kind, Object.keys(resource.fields).filter((field) => !resource.computed?.includes(field)));
  const decoded = decodedBy(resource);
  const kept = keptGuests(app as GraviewApp, declaration, store, guests);
  let made = 0;
  const engine = new SyncEngine<S>(
    {
      store,
      mapping,
      remote,
      // The guests' relation resolves through the guest book: a person's remote id is their guest key.
      ...(guests ? { links: guests, ...relationActs(store, declaration.kind) } : {}),
      // What each pass invites and takes off is said in the history and the report, and a record over `max` is held (Roadmap f-sync-guest-changes-in-history).
      ...(kept ? { guests: kept } : {}),
      ...(run.now ? { now: run.now } : {}),
      conflicts: declaration.conflicts ?? "report",
      applyInbound: ({ localId, fields }) => ({ name: `edit-${declaration.kind}`, args: { id: localId, ...fields } }),
      removeInbound: ({ localId }) => ({ name: `remove-${declaration.kind}`, args: { id: localId } }),
      createInbound: ({ id, fields }) => {
        const values = decoded(fields);
        // An event of the other sort (all-day for a timed kind, or timed for a day) has no value here to keep; nor has a one-off in a weekly kind, which keeps no date.
        if (!creates || values[declaration.fields.start] === undefined || (declaration.fields.days && !values[declaration.fields.days])) return null;
        made += 1;
        const madeAs = `${declaration.kind}:${run.name}-${id.slice(0, 16)}-${made}`;
        // A date's repeat is given to the record once it is there, through its edit: the act that makes one does not take it.
        const { [repeated]: repeat, ...rest } = values;
        // An empty part (no guest in an email field) is no value for a record being made.
        const given = Object.fromEntries(Object.entries(repeated in values ? rest : values).filter(([, value]) => value !== null && value !== undefined));
        return { name: creates, args: { id: madeAs, ...given }, ...(repeat ? { then: [{ name: `edit-${declaration.kind}`, args: { id: madeAs, [repeated]: repeat } }] } : {}) };
      },
    },
    run.state,
  );
  const unguard = declaration.direction === "read" ? engine.guard() : undefined;
  return { engine, mapping, remote, ...(unguard ? { unguard } : {}) };
}

/**
 * THE GUESTS A GOOGLE CONNECTION KEEPS, as the engine counts them (Roadmap
 * f-sync-guest-changes-in-history): the field of addresses, or the relation
 * whose remote ids are guest keys — each said by the person holding it, the
 * people it reaches and does not invite said with why, and the declared
 * `max` held to.
 */
function keptGuests<S extends AnySchema>(app: GraviewApp, declaration: GoogleCalendarConnectionSpec, store: Store<S>, book: LinkResolver | undefined): SyncGuests | undefined {
  const spec = declaration.fields.guests;
  if (spec === undefined) return undefined;
  if (typeof spec === "string") return { field: spec, addresses: (value) => addressesOf(value) };
  const reaches = edgeSpecs(app, declaration.kind)[spec.via]?.to;
  const kinds = new Set(reaches === undefined || reaches === "*" ? [] : reaches);
  const emails = spec.emails ?? "emails";
  const invite = spec.invite ?? "inviteMe";
  return {
    field: spec.via,
    // A guest key holds every address of one person, joined with ","; a bare address is one held as it is.
    addresses: (value) => attendeesOf(value).map((one) => one.email!),
    ...(book ? { whose: (address: string) => book.localId(address) } : {}),
    emails,
    leftOut(localId) {
      const out: GuestLeftOut[] = [];
      for (const target of store.graph.out(localId, spec.via, { archived: "all" }) as unknown as Record<string, unknown>[]) {
        const person = String(target["id"]);
        if (!kinds.has(String(target["kind"]))) out.push({ person, why: "not-a-person" });
        else if (invite !== false && target[invite] !== true) out.push({ person, why: "invite-off" });
        else if (addressesOf(target[emails]).length === 0) out.push({ person, why: "no-address" });
      }
      return out;
    },
    ...(spec.max !== undefined ? { max: spec.max } : {}),
    notify: spec.notify === true,
  };
}

function notionConnection<S extends AnySchema>(run: ConnectionRun<S>, declaration: NotionConnectionSpec): Connection<S> {
  const { app, store } = run;
  if (!run.databaseId) throw new Error(`connection ${run.name}: a Notion connection needs its database's id`);
  const { mapping, sources } = notionConnectionMapping(app as GraviewApp, declaration, run.say);
  let engine: SyncEngine<S> | undefined;
  const remote = notion({
    databaseId: run.databaseId,
    sources: sources.map(
      (one): NotionSourceOptions => ({
        resource: one.resource.resource,
        ...(one.spec.source ? { source: one.spec.source } : {}),
        refs: one.refs,
        ...(one.titleRef ? { titleRef: one.titleRef } : {}),
        ...(one.quiet.length > 0 ? { quiet: one.quiet } : {}),
        ...(Object.keys(one.make).length > 0 ? { make: one.make } : {}),
      }),
    ),
    token: () => run.token(),
    ...(run.secretName ? { secretName: run.secretName } : {}),
    ...(run.fetch ? { fetch: run.fetch } : {}),
    // The pages linked when the pass began, of one source: a whole read that no longer lists one finds out whether it is gone.
    known: (resource) => Object.values(engine?.snapshot.links ?? {}).flatMap((link) => (link.resource === resource ? [link.id] : [])),
    ...(run.say ? { say: run.say } : {}),
  });
  // Each source's kind is made through its own act, from its own fields.
  const made = new Map(
    sources.map((one) => {
      const resource = one.resource;
      return [resource.resource, { kind: resource.kind, creates: creatingAct(app as GraviewApp, resource.kind, Object.keys(resource.fields).filter((field) => !resource.computed?.includes(field))), decoded: decodedBy(resource) }] as const;
    }),
  );
  const relationsOf = new Map(sources.map((one) => [one.resource.kind, relationActs(store, one.resource.kind)]));
  engine = new SyncEngine<S>(
    {
      store,
      mapping,
      remote,
      ...(run.links ? { links: run.links } : {}),
      connectInbound: (call) => relationsOf.get(call.kind)?.connectInbound?.(call) ?? null,
      disconnectInbound: (call) => relationsOf.get(call.kind)?.disconnectInbound?.(call) ?? null,
      conflicts: declaration.conflicts ?? "report",
      applyInbound: ({ localId, kind, fields }) => ({ name: `edit-${kind}`, args: { id: localId, ...fields } }),
      removeInbound: ({ localId, kind }) => ({ name: `remove-${kind}`, args: { id: localId } }),
      createInbound: ({ resource, id, fields }) => {
        const source = made.get(resource);
        if (!source?.creates) return null;
        // An empty property is no value for a record being made; the page's own id names it, so a full read makes it once.
        const values = Object.fromEntries(Object.entries(source.decoded(fields)).filter(([, value]) => value !== null && value !== undefined));
        return { name: source.creates, args: { id: `${source.kind}:${run.name}-${notionKey(id)}`, ...values } };
      },
    },
    run.state,
  );
  run.links?.add(engine);
  const unguard = declaration.direction === "read" ? engine.guard() : undefined;
  return { engine, mapping, remote, ...(unguard ? { unguard } : {}) };
}
