import * as z from "../schema/zod.js";
import { NOTION_FITS, NOTION_ID } from "../sync/notion-types.js";
import { EDGE_NAME, FIELD_NAME, NAME } from "./schema.js";

/*
 * A CONNECTION'S SHAPE, apart from the document's: a page that draws an app
 * reads `connections` loosely and never runs one, so this is reached only by
 * the checker (`connection-findings.ts`), the JSON schema an editor reads
 * (`cli/document-schema.ts`), and a host that runs connections.
 */

/* Built the first time a connection is read (`ConnectionSpec` is `z.lazy` over it), not when the module loads. */
function build() {
  const str = (min: number, max: number) => z.string().check(z.minLength(min), z.maxLength(max));
  const sentence = str(1, 500);
  const kindName = z.string().check(z.regex(NAME, 'kind names are kebab-case, lower-case words joined by hyphens like "tool-note"'));
  const fieldName = z.string().check(z.regex(FIELD_NAME, 'field names are one word or camelCase, like "dueDate"'));
  const edgeName = z.string().check(z.regex(EDGE_NAME, 'a relation\'s name is one word or camelCase, like "who"'));
  const envName = z.string().check(z.regex(/^[A-Z][A-Z0-9_]*$/, 'an environment variable is upper-case words joined by underscores, like "GOOGLE"'));
  /* Where the credentials are read from: environment variables under `env`, failing that the KEY=value file `file` names. */
  const auth = z.optional(z.strictObject({ env: envName, file: z.optional(str(1, 500)) }));
  /* "read": the other system owns these records and acts here that would change them are refused. "both": changes go both ways. */
  const direction = z.enum(["read", "both"], 'a connection\'s direction is "read" (the other system owns these records) or "both"');
  const conflicts = z.optional(z.enum(["report", "theirs", "ours"], 'a conflict is held for somebody ("report"), or settled for the other system ("theirs") or for this app ("ours")'));
  /* Seconds between passes; a change made here starts one sooner. */
  const every = z.optional(z.number().check(z.int(), z.minimum(2), z.maximum(86_400)));

  /**
   * A GOOGLE CALENDAR: which calendar, which kind its events are and which
   * fields say what, which of its events (all of them, one color, or those
   * whose title carries a tag). The calendar may be named by an environment
   * variable, and `auth` says where the credentials are read from
   * (`<env>_CLIENT_ID`, `<env>_CLIENT_SECRET`, `<env>_REFRESH_TOKEN`; GOOGLE
   * by default), unless the host hands a token itself.
   */
  const GoogleCalendar = z.strictObject({
    system: z.literal("google-calendar"),
    description: z.optional(sentence),
    /* The calendar's id ("primary", or "…@group.calendar.google.com"), or the environment variable that holds it. */
    calendar: z.union([str(1, 300), z.strictObject({ env: envName })]),
    auth,
    kind: kindName,
    /*
     * Google's side → this kind's field. A date field is an all-day event's
     * day; a datetime field, a timed event's instant; one that repeats, a
     * recurring event with its rule (FR-230). With `days` — a weekday, or a
     * list of them — the record is weekly, and `start` and `end` are its
     * times of day ("09:00"), in the app's time zone.
     *
     * THE EVENT'S GUESTS (Roadmap f-calendar-guests-mapping) are `guests`:
     * a field of the kind holding their addresses (a list, or one email),
     * or `{ via }`, a relation of the kind to the people it is about —
     * each reached person's `emails` (a list of them, or one email field)
     * is invited while their `invite` toggle is on (`inviteMe`; `false`
     * says the app has no toggle and every address is invited). Google's
     * invitation emails go out only with `notify: true`; the default is
     * quiet. `max` is the most guests one event invites (Roadmap
     * f-sync-guest-changes-in-history): an event that would invite somebody
     * past it is held unsent, and said; `graview check` refuses one that
     * is not a whole number above 0. The field form takes them too, as
     * `{ field, notify?, max? }` (request:guests-field-form-takes-max):
     * `"guests": "<field>"` is `{ "field": "<field>" }` said short.
     */
    fields: z.strictObject({
      summary: fieldName,
      start: fieldName,
      end: fieldName,
      days: z.optional(fieldName),
      location: z.optional(fieldName),
      description: z.optional(fieldName),
      guests: z.optional(
        z.union(
          [
            fieldName,
            z.strictObject({ field: fieldName, notify: z.optional(z.boolean()), max: z.optional(z.number()) }),
            z.strictObject({ via: edgeName, emails: z.optional(fieldName), invite: z.optional(z.union([fieldName, z.literal(false)])), notify: z.optional(z.boolean()), max: z.optional(z.number()) }),
          ],
          'guests names a field holding the addresses (or { "field": "<field>", "notify"?, "max"? }), or { "via": "<relation>", "emails"?, "invite"?, "notify"?, "max"? } to invite the people a relation reaches',
        ),
      ),
    }),
    /* Absent: the whole calendar. `{ color }`: the events of one of Google's colors, by name. `{ tag }`: those whose title carries a word like "#graview", kept in the title here or not (`keep`). */
    filter: z.optional(z.strictObject({ color: z.optional(str(1, 40)), tag: z.optional(str(1, 40)), keep: z.optional(z.boolean()) })),
    direction,
    conflicts,
    every,
    paused: z.optional(z.boolean()),
  });

  /**
   * A NOTION DATABASE: one database, each of its pages a record of one kind.
   * The database is named by its id or by an environment variable; the
   * internal integration's secret is read from `<env>_TOKEN` (NOTION_TOKEN by
   * default) or handed by the host, never written here. `properties` maps a
   * field to a property by name, with the property's type when the checker
   * should judge it; absent, every field whose name a property has is kept
   * in step, and the kind's name field is the database's title. A database
   * that holds several data sources (Notion's tables under one name) says
   * which with `source`, its name or id; one of a single source needs none.
   *
   * A key of `properties` may name one of the kind's RELATIONS (edges) in
   * place of a field, held by a Notion relation property: its links are the
   * pages the property reaches, each a record another Notion connection of
   * the app keeps, or another source of this one (`"reindeer": "Reindeer
   * Fleet"`, or with `"type": "relation"`). Matched by name, a relation
   * whose name a relation property has is kept too.
   *
   * SEVERAL DATA SOURCES OF ONE DATABASE, EACH ITS OWN KIND (`sources`, in
   * place of `source`, `kind` and `properties`): each names its data source
   * by name or id, the kind its pages are, and its own `properties`. A
   * relation between two of them is a Notion relation property, as it is
   * between two connections.
   *
   * THE PROPERTIES IT NEEDS ARE MADE: a field mapped to a property the data
   * source lacks is given one, of the type the field is held in, on the
   * first pass and whenever one goes missing — never renamed, never
   * deleted, and one there of another type is said and left. `create:
   * false` turns that off; a connection that only reads makes none.
   */
  const notionTypes = [...Object.keys(NOTION_FITS), "relation"] as unknown as [string, ...string[]];
  const keptName = z.string().check(z.regex(EDGE_NAME, 'a key of properties is one of the kind\'s fields or relations, like "dueDate" or "reindeer"'));
  const notionType = z.enum(notionTypes, `a property's type is one a connection keeps in step: ${notionTypes.join(", ")}`);
  /* This kind's field or relation → the data source's property, by its name in Notion, or `{ name, type }` with its type. */
  const properties = z.optional(z.record(keptName, z.union([str(1, 100), z.strictObject({ name: str(1, 100), type: notionType })])));
  /* One data source of the database and the kind its pages are. */
  const NotionSource = z.strictObject({
    /* The data source, by its name in Notion or its id. */
    source: str(1, 200),
    kind: kindName,
    description: z.optional(sentence),
    properties,
  });
  const Notion = z.strictObject({
    system: z.literal("notion"),
    description: z.optional(sentence),
    /* The database's id (the 32 characters in its link, before ?v=), or the environment variable that holds it. */
    database: z.union([z.string().check(z.regex(NOTION_ID, "a Notion database's id is the 32 characters in its link, before ?v=")), z.strictObject({ env: envName })]),
    /* The data source, by its name in Notion or its id, when the database holds several. */
    source: z.optional(str(1, 200)),
    auth,
    /* The kind its pages are; absent when `sources` names a kind for each. */
    kind: z.optional(kindName),
    properties,
    /* Several data sources of the database, each kept in step with its own kind (in place of source, kind and properties). */
    sources: z.optional(z.array(NotionSource).check(z.minLength(1), z.maxLength(20))),
    /* Whether a property a mapped field lacks is made in Notion (true unless said). */
    create: z.optional(z.boolean()),
    direction,
    conflicts,
    every,
    paused: z.optional(z.boolean()),
  });

  return z.discriminatedUnion("system", [GoogleCalendar, Notion], 'a connection\'s system is "google-calendar" or "notion"');
}
let built: ReturnType<typeof build> | undefined;

/**
 * A CONNECTION: the app kept in step with another system, declared rather
 * than wired in code (`connections.<name>`) — a Google calendar or a Notion
 * database. It never holds a secret.
 */
export const ConnectionSpec = z.lazy(() => (built ??= build()));
export type ConnectionSpec = z.infer<typeof ConnectionSpec>;
export type GoogleCalendarConnectionSpec = Extract<ConnectionSpec, { system: "google-calendar" }>;
export type NotionConnectionSpec = Extract<ConnectionSpec, { system: "notion" }>;

/** A Google calendar connection's guests, in any of their forms. */
export type GuestsSpec = NonNullable<GoogleCalendarConnectionSpec["fields"]["guests"]>;
/** The guests typed in a field, said whole: `{ field, notify?, max? }`. */
export type GuestsInField = Extract<GuestsSpec, { readonly field: string }>;
/** The guests reached through a relation: `{ via, emails?, invite?, notify?, max? }`. */
export type GuestsViaRelation = Extract<GuestsSpec, { readonly via: string }>;

/**
 * THE GUESTS IN A FIELD, whichever way they are said
 * (request:guests-field-form-takes-max): `"guests": "<field>"` is
 * `{ field: "<field>" }`. Undefined for the relation form, or no guests.
 */
export function guestsInField(guests: GuestsSpec | undefined): GuestsInField | undefined {
  if (guests === undefined) return undefined;
  if (typeof guests === "string") return { field: guests };
  return "field" in guests ? guests : undefined;
}

/** The guests reached through a relation, or undefined for the field forms. */
export function guestsViaRelation(guests: GuestsSpec | undefined): GuestsViaRelation | undefined {
  return guests !== undefined && typeof guests === "object" && "via" in guests ? guests : undefined;
}

/** One data source a Notion connection keeps in step with one kind, and the resource its pages are to the engine. */
export interface NotionSourceSpec {
  /** The data source by its name or id; absent when the database holds one. */
  readonly source?: string;
  readonly kind: string;
  readonly properties?: NotionConnectionSpec["properties"];
  readonly description?: string;
  /** What the engine calls its pages, kept in its links: `pages` for a connection of one source, `pages:<kind>` for each of `sources`. */
  readonly resource: string;
}

/**
 * A NOTION CONNECTION'S DATA SOURCES, each with its kind: its `sources`, or
 * the one its top names (`source`, `kind`, `properties`). Read loosely, so
 * the checker can ask it of a connection it is still judging.
 */
export function notionSourcesOf(connection: Pick<NotionConnectionSpec, "source" | "kind" | "properties" | "sources">): readonly NotionSourceSpec[] {
  if (connection.sources && connection.sources.length > 0) {
    return connection.sources.map((one) => ({ source: one.source, kind: one.kind, ...(one.properties ? { properties: one.properties } : {}), ...(one.description ? { description: one.description } : {}), resource: `pages:${one.kind}` }));
  }
  if (connection.kind === undefined) return [];
  return [{ ...(connection.source ? { source: connection.source } : {}), kind: connection.kind, ...(connection.properties ? { properties: connection.properties } : {}), resource: "pages" }];
}

/** The kinds a connection keeps: a calendar's one, or each of a Notion connection's sources'. */
export function connectionKinds(connection: ConnectionSpec): readonly string[] {
  return connection.system === "notion" ? notionSourcesOf(connection).map((one) => one.kind) : [connection.kind];
}
