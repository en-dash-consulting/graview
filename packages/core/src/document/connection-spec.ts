import * as z from "../schema/zod.js";
import { NOTION_FITS, NOTION_ID } from "../sync/notion-types.js";
import { FIELD_NAME, NAME } from "./schema.js";

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
    /* Google's side → this kind's field. A date field is an all-day event's day; a datetime field, a timed event's instant. */
    fields: z.strictObject({ summary: fieldName, start: fieldName, end: fieldName, location: z.optional(fieldName), description: z.optional(fieldName) }),
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
   */
  const notionTypes = Object.keys(NOTION_FITS) as [string, ...string[]];
  const notionType = z.enum(notionTypes, `a property's type is one a connection keeps in step: ${notionTypes.join(", ")}`);
  const Notion = z.strictObject({
    system: z.literal("notion"),
    description: z.optional(sentence),
    /* The database's id (the 32 characters in its link, before ?v=), or the environment variable that holds it. */
    database: z.union([z.string().check(z.regex(NOTION_ID, "a Notion database's id is the 32 characters in its link, before ?v=")), z.strictObject({ env: envName })]),
    /* The data source, by its name in Notion or its id, when the database holds several. */
    source: z.optional(str(1, 200)),
    auth,
    kind: kindName,
    /* This kind's field → the database's property, by its name in Notion, or `{ name, type }` with its type. */
    properties: z.optional(z.record(fieldName, z.union([str(1, 100), z.strictObject({ name: str(1, 100), type: notionType })]))),
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
