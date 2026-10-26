import type { GraviewApp } from "../app.js";
import type { AnySchema } from "../schema/schema.js";
import type { Store } from "../store.js";
import { fieldSpecOf } from "../document/field-spec.js";
import type { FieldSpec } from "../document/schema.js";
import type { ConnectionSpec, GoogleCalendarConnectionSpec, NotionConnectionSpec } from "../document/connection-spec.js";
import { GOOGLE_COLORS, MADE_BY_GRAVIEW, inConnectionFilter, tagPattern } from "./connection-filter.js";
import { SyncEngine } from "./engine.js";
import { googleCalendar, type Fetcher, type GoogleTokenRequest } from "./google-calendar.js";
import { notion, notionKey } from "./notion.js";
import { NOTION_INFERABLE } from "./notion-types.js";
import type { RemoteSystem, ResourceMapping, SyncMapping, SyncState } from "./types.js";

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
 * - A NOTION DATABASE's properties are the fields the declaration maps, or,
 *   when it maps none, every field whose name a property has, the kind's name
 *   field being the database's title. A `date` field holds a date property's
 *   day, a `datetime` field its instant; an `enum` field a select or status,
 *   matched to its options ignoring case and punctuation.
 * - READ means the other system owns the kind: an act here that would change
 *   a record of it is refused with a sentence saying so (`SyncEngine.guard`),
 *   rather than accepted and never sent.
 * - Inbound changes land through the app's own acts — the one that creates
 *   the kind, `edit-<kind>` and `remove-<kind>` — authored by the system
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

/** Whether a field of the kind is a `date` (an all-day event's day) rather than a `datetime`. */
export function isDayField(app: GraviewApp, kind: string, field: string): boolean {
  return fieldSpecs(app, kind)[field]?.type === "date";
}

/** The mapping a declaration says. */
export function connectionMapping(app: GraviewApp, declaration: ConnectionDeclaration): SyncMapping {
  return declaration.system === "notion" ? notionConnectionMapping(app, declaration).mapping : googleConnectionMapping(app, declaration);
}

/** A Google connection's mapping: field types decide the paths, the filter's tag is kept or stripped. */
function googleConnectionMapping(app: GraviewApp, declaration: GoogleCalendarConnectionSpec): SyncMapping {
  const { kind, fields } = declaration;
  const day = isDayField(app, kind, fields.start);
  const when = day ? "date" : "dateTime";
  const tag = declaration.filter?.tag;
  const keep = declaration.filter?.keep === true;
  const encode: Record<string, (value: unknown, node: Record<string, unknown>) => unknown> = {};
  const decode: Record<string, (value: unknown) => unknown> = {};
  if (day) {
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
  const resource: ResourceMapping = {
    kind,
    resource: "events",
    fields: {
      [fields.summary]: "summary",
      [fields.start]: `start.${when}`,
      [fields.end]: `end.${when}`,
      ...(fields.location ? { [fields.location]: "location" } : {}),
      ...(fields.description ? { [fields.description]: "description" } : {}),
    },
    encode,
    decode,
    ...(declaration.direction === "read"
      ? { readonly: true, because: `Each ${kind} comes from a Google calendar this app only reads: change it there.` }
      : {}),
  };
  return { system: "google-calendar", resources: [resource] };
}

/** Words compared loosely: "In progress", "in-progress" and "inProgress" are one. */
const loose = (word: string) => word.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The field a kind is named by: one called name or title, else its first required words, else its first words. */
function nameField(specs: Record<string, FieldSpec>): string | undefined {
  const words = Object.entries(specs).filter(([, spec]) => spec.type === "string" || spec.type === "text");
  return (words.find(([field]) => field === "name" || field === "title") ?? words.find(([, spec]) => spec.required) ?? words[0])?.[0];
}

/** What a Notion connection maps: the engine's mapping, the property names the transport resolves with their field types, and the name that is the title. */
export function notionConnectionMapping(
  app: GraviewApp,
  declaration: NotionConnectionSpec,
): { readonly mapping: SyncMapping; readonly refs: Readonly<Record<string, string | undefined>>; readonly titleRef?: string } {
  const { kind } = declaration;
  const specs = fieldSpecs(app, kind);
  const fields: Record<string, string> = {};
  const refs: Record<string, string | undefined> = {};
  let titleRef: string | undefined;
  if (declaration.properties) {
    for (const [field, property] of Object.entries(declaration.properties)) {
      const ref = typeof property === "string" ? property : property.name;
      fields[field] = ref;
      refs[ref] = specs[field]?.type;
    }
  } else {
    for (const [field, spec] of Object.entries(specs)) {
      if (!NOTION_INFERABLE.has(spec.type)) continue;
      fields[field] = field;
      refs[field] = spec.type;
    }
    titleRef = nameField(specs);
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
        decode[field] = (value) => (typeof value === "string" ? (options.find((option) => option === value) ?? options.find((option) => loose(option) === loose(value)) ?? value) : value);
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
  const resource: ResourceMapping = {
    kind,
    resource: "pages",
    fields,
    encode,
    decode,
    ...(declaration.direction === "read" ? { readonly: true, because: `Each ${kind} comes from a Notion database this app only reads: change it there.` } : {}),
  };
  return { mapping: { system: "notion", resources: [resource] }, refs, ...(titleRef ? { titleRef } : {}) };
}

/** The act that makes a record of the kind: `add-<kind>` when there is one, else the first that creates it. */
export function creatingAct(app: GraviewApp, kind: string): string | undefined {
  const creating = (app.mutations ?? []).filter((mutation) => (mutation.creates ?? []).includes(kind));
  return (creating.find((mutation) => mutation.name === `add-${kind}`) ?? creating[0])?.name;
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
  const mapping = googleConnectionMapping(app as GraviewApp, declaration);
  const resource = mapping.resources[0]!;
  const color = declaration.filter?.color ? GOOGLE_COLORS[declaration.filter.color] : undefined;
  const remote = googleCalendar({
    calendarId: run.calendarId,
    token: run.token,
    ...(run.fetch ? { fetch: run.fetch } : {}),
    keep: (item) => inConnectionFilter(declaration, item),
    madeHere: {
      ...(color ? { colorId: color } : {}),
      extendedProperties: { private: { [MADE_BY_GRAVIEW]: app.name } },
    },
  });
  const creates = creatingAct(app as GraviewApp, declaration.kind);
  const decoded = decodedBy(resource);
  let made = 0;
  const engine = new SyncEngine<S>(
    {
      store,
      mapping,
      remote,
      conflicts: declaration.conflicts ?? "report",
      applyInbound: ({ localId, fields }) => ({ name: `edit-${declaration.kind}`, args: { id: localId, ...fields } }),
      removeInbound: ({ localId }) => ({ name: `remove-${declaration.kind}`, args: { id: localId } }),
      createInbound: ({ id, fields }) => {
        const values = decoded(fields);
        // An event of the other sort (all-day for a timed kind, or timed for a day) has no value here to keep.
        if (!creates || values[declaration.fields.start] === undefined) return null;
        made += 1;
        return { name: creates, args: { id: `${declaration.kind}:${run.name}-${id.slice(0, 16)}-${made}`, ...values } };
      },
    },
    run.state,
  );
  const unguard = declaration.direction === "read" ? engine.guard() : undefined;
  return { engine, mapping, remote, ...(unguard ? { unguard } : {}) };
}

function notionConnection<S extends AnySchema>(run: ConnectionRun<S>, declaration: NotionConnectionSpec): Connection<S> {
  const { app, store } = run;
  if (!run.databaseId) throw new Error(`connection ${run.name}: a Notion connection needs its database's id`);
  const { mapping, refs, titleRef } = notionConnectionMapping(app as GraviewApp, declaration);
  const resource = mapping.resources[0]!;
  let engine: SyncEngine<S> | undefined;
  const remote = notion({
    databaseId: run.databaseId,
    token: () => run.token(),
    ...(run.secretName ? { secretName: run.secretName } : {}),
    ...(run.fetch ? { fetch: run.fetch } : {}),
    refs,
    ...(titleRef ? { titleRef } : {}),
    // The pages linked when the pass began: a whole read that no longer lists one finds out whether it is gone.
    known: () => Object.values(engine?.snapshot.links ?? {}).map((link) => link.id),
    ...(run.say ? { say: run.say } : {}),
  });
  const creates = creatingAct(app as GraviewApp, declaration.kind);
  const decoded = decodedBy(resource);
  engine = new SyncEngine<S>(
    {
      store,
      mapping,
      remote,
      conflicts: declaration.conflicts ?? "report",
      applyInbound: ({ localId, fields }) => ({ name: `edit-${declaration.kind}`, args: { id: localId, ...fields } }),
      removeInbound: ({ localId }) => ({ name: `remove-${declaration.kind}`, args: { id: localId } }),
      createInbound: ({ id, fields }) => {
        if (!creates) return null;
        // An empty property is no value for a record being made; the page's own id names it, so a full read makes it once.
        const values = Object.fromEntries(Object.entries(decoded(fields)).filter(([, value]) => value !== null && value !== undefined));
        return { name: creates, args: { id: `${declaration.kind}:${run.name}-${notionKey(id)}`, ...values } };
      },
    },
    run.state,
  );
  const unguard = declaration.direction === "read" ? engine.guard() : undefined;
  return { engine, mapping, remote, ...(unguard ? { unguard } : {}) };
}
