import type { GraviewApp } from "../app.js";
import { deriveMutations } from "../mutations/derive-edits.js";
import { withArticle } from "../schema/define-node.js";
import { CONNECTION_TAG, GOOGLE_COLORS } from "../sync/connection-filter.js";
import { NOTION_FITS, NOTION_INFERABLE, NOTION_READ_ONLY, NOTION_SECRET, notionFits } from "../sync/notion-types.js";
import { error, warning, type Finding } from "./findings.js";
import { ConnectionSpec, type GoogleCalendarConnectionSpec, type NotionConnectionSpec } from "./connection-spec.js";
import type { GraviewDocument } from "./schema.js";

/*
 * A DECLARED CONNECTION, JUDGED (`connections.<name>`): what its shape
 * cannot say — that the kind and its fields are this document's and of the
 * types a calendar event's parts or a Notion database's properties are,
 * that a filter is one color Google names or one tag, that no secret is
 * written in it, and, given the compiled app, that the acts an inbound
 * change lands through are there. Each is a sentence `graview check` says
 * at the place it is wrong.
 */

const TEXT = new Set(["string", "text"]);
const WHEN = new Set(["date", "datetime"]);

/** What a document says of its connections that no host could run. */
export function connectionFindings(document: GraviewDocument, app?: GraviewApp): Finding[] {
  const findings: Finding[] = [];
  for (const [name, raw] of Object.entries(document.connections ?? {})) {
    const at = `connections.${name}`;
    // A secret written into the declaration is refused before anything else is said of it, and never repeated.
    const secret = secretIn(raw, at);
    if (secret) {
      findings.push(error("connection-secret", secret, "this is an integration's secret, and a secret is never written in the app: it would travel with every copy and export of it", 'keep it in the host\'s environment (NOTION_TOKEN, or the variable "auth": { "env" } names) and take it out of here'));
      continue;
    }
    // The shape first, said as the compiler says a document's: a connection that is not one is judged no further.
    const parsed = ConnectionSpec.safeParse(raw);
    if (!parsed.success) {
      findings.push(...parsed.error.issues.map((issue) => shapeFinding(at, raw, issue)));
      continue;
    }
    const connection = parsed.data;
    findings.push(...(connection.system === "notion" ? notionConnection(at, connection, document, app) : googleConnection(at, connection, document, app)));
  }
  return findings;
}

/** Where in a connection a string reads as a Notion integration's secret, if anywhere. */
function secretIn(value: unknown, at: string): string | undefined {
  if (typeof value === "string") return NOTION_SECRET.test(value) ? at : undefined;
  if (!value || typeof value !== "object") return undefined;
  for (const [key, inner] of Object.entries(value)) {
    if (NOTION_SECRET.test(key)) return at;
    const found = secretIn(inner, `${at}.${key}`);
    if (found) return found;
  }
  return undefined;
}

const KEYS: Readonly<Record<string, string>> = {
  "google-calendar": "system, calendar, auth, kind, fields, filter, direction, conflicts, every, paused and description",
  notion: "system, database, auth, kind, properties, direction, conflicts, every, paused and description",
};

/** A shape the connection does not have, at its place: an unknown key, or a value of the wrong kind. */
function shapeFinding(at: string, raw: unknown, issue: { readonly code: string; readonly path: readonly PropertyKey[]; readonly message: string; readonly keys?: readonly string[] }): Finding {
  const path = [at, ...issue.path.map(String)].join(".");
  if (issue.code === "unrecognized_keys" && issue.keys) {
    const system = String((raw as { system?: unknown } | undefined)?.system ?? "");
    return error("unknown-key", path, `${issue.keys.map((key) => `"${key}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of a${system === "notion" ? " Notion" : system === "google-calendar" ? " Google calendar" : ""} connection`, `a connection says ${KEYS[system] ?? KEYS["google-calendar"]}`);
  }
  // A system that is none of them is said at `system`, as every other wrong value is said at its key.
  if (issue.code === "invalid_union" && issue.path.length === 0 && (issue as { note?: string }).note === "No matching discriminator") {
    return error("shape", `${at}.system`, issue.message);
  }
  return error("shape", path, issue.message);
}

/** No such kind, said once for the connection. */
function noKind(at: string, document: GraviewDocument, kind: string, what: string): Finding {
  return error("connection-kind", `${at}.kind`, `there is no kind called ${kind} for ${what} to be`, `name one of ${Object.keys(document.kinds).join(", ")}`);
}

function googleConnection(at: string, connection: GoogleCalendarConnectionSpec, document: GraviewDocument, app?: GraviewApp): Finding[] {
  const findings: Finding[] = [];
  const kind = document.kinds[connection.kind];
  if (!kind) return [noKind(at, document, connection.kind, "the calendar's events")];
  const typeOf = (field: string) => kind.fields[field]?.type;
  const mapped = Object.entries(connection.fields).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  const seen = new Map<string, string>();
  for (const [theirs, ours] of mapped) {
    const path = `${at}.fields.${theirs}`;
    if (!kind.fields[ours]) {
      findings.push(error("connection-field", path, `${connection.kind} has no field called ${ours} to hold the event's ${theirs}`, `name one of ${Object.keys(kind.fields).join(", ")}`));
      continue;
    }
    const twice = seen.get(ours);
    if (twice) findings.push(error("connection-field", path, `${ours} already holds the event's ${twice}, and one field holds one part of an event`, "give each part a field of its own"));
    seen.set(ours, theirs);
    const type = typeOf(ours)!;
    if ((theirs === "summary" || theirs === "description") && !TEXT.has(type)) {
      findings.push(error("connection-field-type", path, `the event's ${theirs} is words, and ${ours} is a ${type} field`, "name a string or text field"));
    }
    if (theirs === "location" && !TEXT.has(type) && type !== "place") {
      findings.push(error("connection-field-type", path, `the event's location is a place in words, and ${ours} is a ${type} field`, "name a string, text or place field"));
    }
    if ((theirs === "start" || theirs === "end") && !WHEN.has(type)) {
      findings.push(error("connection-field-type", path, `the event's ${theirs} is a moment or a day, and ${ours} is a ${type} field`, "name a datetime field for a timed event, or a date field for an all-day one"));
    }
  }
  const start = typeOf(connection.fields.start);
  const end = typeOf(connection.fields.end);
  if (start && end && WHEN.has(start) && WHEN.has(end) && start !== end) {
    findings.push(error("connection-when", `${at}.fields.end`, `${connection.fields.start} is a ${start} and ${connection.fields.end} a ${end}, and an event is all-day or timed at both ends`, "make both dates (all-day events) or both datetimes (timed events)"));
  }

  const filter = connection.filter;
  if (filter) {
    if (filter.color && filter.tag) findings.push(error("connection-filter", `${at}.filter`, "the filter names a color and a tag, and keeps the events of one or the other", "keep one"));
    else if (!filter.color && !filter.tag) findings.push(error("connection-filter", `${at}.filter`, "the filter names neither a color nor a tag", "say a color or a tag, or drop filter to keep the whole calendar"));
    if (filter.color && !GOOGLE_COLORS[filter.color]) {
      findings.push(error("connection-color", `${at}.filter.color`, `Google Calendar has no color called "${filter.color}"`, `name one of ${Object.keys(GOOGLE_COLORS).join(", ")}`));
    }
    if (filter.tag && !CONNECTION_TAG.test(filter.tag)) {
      findings.push(error("connection-tag", `${at}.filter.tag`, `"${filter.tag}" is not a tag: a tag is one word that starts with #`, 'write it like "#graview"'));
    }
    if (filter.keep !== undefined && !filter.tag) findings.push(error("connection-filter", `${at}.filter.keep`, "keep says whether a title keeps its tag, and the filter has no tag", "drop keep, or add a tag"));
  }

  if (app) findings.push(...landing(at, connection.kind, mapped.map(([, ours]) => ours).filter((ours) => kind.fields[ours]), { made: "an event made in the calendar", change: "a change in the calendar", deleted: "an event deleted in the calendar" }, app));
  return findings;
}

function notionConnection(at: string, connection: NotionConnectionSpec, document: GraviewDocument, app?: GraviewApp): Finding[] {
  const findings: Finding[] = [];
  const kind = document.kinds[connection.kind];
  if (!kind) return [noKind(at, document, connection.kind, "the database's pages")];
  let mapped: string[];
  if (connection.properties) {
    mapped = [];
    const seen = new Map<string, string>();
    for (const [field, property] of Object.entries(connection.properties)) {
      const path = `${at}.properties.${field}`;
      const name = typeof property === "string" ? property : property.name;
      if (!kind.fields[field]) {
        findings.push(error("connection-field", path, `${connection.kind} has no field called ${field} to hold the property ${name}`, `name one of ${Object.keys(kind.fields).join(", ")}`));
        continue;
      }
      const twice = seen.get(name);
      if (twice) findings.push(error("connection-field", path, `the property ${name} is already held by ${twice}, and one property is held by one field`, "give each property a field of its own"));
      seen.set(name, field);
      mapped.push(field);
      const type = kind.fields[field]!.type;
      if (typeof property === "string") {
        if (!NOTION_INFERABLE.has(type)) findings.push(error("connection-field-type", path, `${field} is a ${type} field, and no Notion property a connection keeps in step is held in one`, `name a field of another type, or leave ${field} out`));
        continue;
      }
      if (!notionFits(property.type, type)) {
        findings.push(error("connection-field-type", path, `the property ${name} is a ${property.type}, and ${field} is a ${type} field`, `name a ${NOTION_FITS[property.type]!.join(", ")} field`));
      } else if (NOTION_READ_ONLY.has(property.type) && connection.direction === "both") {
        findings.push(warning("connection-read-only", path, `${name} is a people property, which is read from Notion and never written: a change to ${field} here stays here`));
      }
    }
    if (mapped.length === 0 && Object.keys(connection.properties).length === 0) {
      findings.push(error("connection-properties", `${at}.properties`, "the connection maps no property, so nothing would be kept in step", "map a field to a property, or drop properties to match them by name"));
    }
  } else {
    mapped = Object.entries(kind.fields).filter(([, spec]) => NOTION_INFERABLE.has(spec.type)).map(([field]) => field);
    if (mapped.length === 0) findings.push(error("connection-properties", `${at}.kind`, `${connection.kind} has no field a Notion property could be held in`, "give it a string, number, date, enum, list or boolean field"));
  }
  if (app && mapped.length > 0) findings.push(...landing(at, connection.kind, mapped, { made: "a page made in the database", change: "a change in Notion", deleted: "a page archived in Notion" }, app));
  return findings;
}

/** That the acts an inbound change lands through are there: one that makes the kind, `edit-<kind>` writing every mapped field, `remove-<kind>`. */
function landing(at: string, kindName: string, fields: readonly string[], said: { readonly made: string; readonly change: string; readonly deleted: string }, app: GraviewApp): Finding[] {
  const findings: Finding[] = [];
  // The acts the store will hold: the declared ones and those derived from them (`edit-<kind>`, `remove-<kind>`).
  const declared = app.mutations ?? [];
  const acts = new Map([...declared, ...deriveMutations(app.schema, declared)].map((mutation) => [mutation.name, mutation]));
  const creates = declared.some((mutation) => (mutation.creates ?? []).includes(kindName));
  if (!creates) {
    findings.push(error("connection-creates", `${at}.kind`, `no act makes ${withArticle(kindName)}, so ${said.made} has nothing to become here`, `declare an act with "creates": "${kindName}"`));
  }
  const edit = acts.get(`edit-${kindName}`);
  const writes = new Set(edit?.writes ?? []);
  const unwritten = fields.filter((field) => !writes.has(field));
  if (unwritten.length > 0) {
    const them = unwritten.length === 1 ? "it" : "them";
    findings.push(
      error(
        "connection-edit",
        `${at}.${said.change.includes("calendar") ? "fields" : "properties"}`,
        `${said.change} lands through edit-${kindName}, which does not write ${unwritten.join(", ")}: another act declares ${them}`,
        `let edit-${kindName} write ${them} (drop "writes" of ${them} from the other act), or leave ${them} out of the connection`,
      ),
    );
  }
  if (!acts.has(`remove-${kindName}`)) {
    findings.push(warning("connection-remove", `${at}.kind`, `no act removes ${withArticle(kindName)}, so ${said.deleted} stays here, no longer kept in step`));
  }
  return findings;
}
