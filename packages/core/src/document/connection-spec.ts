import * as z from "../schema/zod.js";
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

  /**
   * A CONNECTION: the app kept in step with another system, declared rather
   * than wired in code (`connections.<name>`). Today the one system is a
   * Google calendar: which calendar, which kind its events are and which
   * fields say what, which of its events (all of them, one color, or those
   * whose title carries a tag), whether this app only reads them or writes
   * them back too, and what a conflict becomes. It never holds a secret: the
   * calendar may be named by an environment variable, and `auth` says where
   * the credentials are read from (`<env>_CLIENT_ID`, `<env>_CLIENT_SECRET`,
   * `<env>_REFRESH_TOKEN`), unless the host hands a token itself.
   */
  const envName = z.string().check(z.regex(/^[A-Z][A-Z0-9_]*$/, 'an environment variable is upper-case words joined by underscores, like "GOOGLE"'));
  const ConnectionSpec = z.strictObject({
    system: z.literal("google-calendar", 'the one system a connection reaches today is "google-calendar"'),
    description: z.optional(sentence),
    /* The calendar's id ("primary", or "…@group.calendar.google.com"), or the environment variable that holds it. */
    calendar: z.union([str(1, 300), z.strictObject({ env: envName })]),
    auth: z.optional(z.strictObject({ env: envName, file: z.optional(str(1, 500)) })),
    kind: kindName,
    /* Google's side → this kind's field. A date field is an all-day event's day; a datetime field, a timed event's instant. */
    fields: z.strictObject({ summary: fieldName, start: fieldName, end: fieldName, location: z.optional(fieldName), description: z.optional(fieldName) }),
    /* Absent: the whole calendar. `{ color }`: the events of one of Google's colors, by name. `{ tag }`: those whose title carries a word like "#graview", kept in the title here or not (`keep`). */
    filter: z.optional(z.strictObject({ color: z.optional(str(1, 40)), tag: z.optional(str(1, 40)), keep: z.optional(z.boolean()) })),
    /* "read": the calendar owns these records and acts here that would change them are refused. "both": changes go both ways. */
    direction: z.enum(["read", "both"], 'a connection\'s direction is "read" (the calendar owns these records) or "both"'),
    conflicts: z.optional(z.enum(["report", "theirs", "ours"], 'a conflict is held for somebody ("report"), or settled for the calendar ("theirs") or for this app ("ours")')),
    /* Seconds between passes; a change made here starts one sooner. */
    every: z.optional(z.number().check(z.int(), z.minimum(2), z.maximum(86_400))),
    paused: z.optional(z.boolean()),
  });
  return ConnectionSpec;
}
let built: ReturnType<typeof build> | undefined;

export const ConnectionSpec = z.lazy(() => (built ??= build()));
export type ConnectionSpec = z.infer<typeof ConnectionSpec>;

