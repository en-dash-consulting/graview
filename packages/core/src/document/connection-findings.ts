import type { GraviewApp } from "../app.js";
import { deriveMutations } from "../mutations/derive-edits.js";
import { relationActName } from "../mutations/derived-names.js";
import { withArticle } from "../schema/define-node.js";
import { CONNECTION_TAG, GOOGLE_COLORS } from "../sync/connection-filter.js";
import { creatingActFor, type UnfitCreatingAct } from "../sync/creating-act.js";
import type { AnyMutationDefinition } from "../mutations/types.js";
import { humanizeField } from "../schema/humanize.js";
import { NOTION_FITS, NOTION_INFERABLE, NOTION_READ_ONLY, NOTION_SECRET, notionFits } from "../sync/notion-types.js";
import { startAndEndOf } from "../wall-time.js";
import { weekdayOf } from "../sync/recurrence.js";
import { error, warning, type Finding, type FindingFix } from "./findings.js";
import { ConnectionSpec, type GoogleCalendarConnectionSpec, type NotionConnectionSpec } from "./connection-spec.js";
import type { FieldSpec, GraviewDocument } from "./schema.js";

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
    findings.push(...(connection.system === "notion" ? notionConnection(at, connection, document, app) : googleConnection(at, name, connection, document, app)));
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
  notion: "system, database, source, auth, kind, properties, direction, conflicts, every, paused and description",
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

function googleConnection(at: string, name: string, connection: GoogleCalendarConnectionSpec, document: GraviewDocument, app?: GraviewApp): Finding[] {
  const findings: Finding[] = [];
  const kind = document.kinds[connection.kind];
  if (!kind) return [noKind(at, document, connection.kind, "the calendar's events")];
  const typeOf = (field: string) => kind.fields[field]?.type;
  const weekly = connection.fields.days !== undefined;
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
    // A weekly record (FR-230): its weekdays are a choice of weekday or a list of them, and its start and end are times of day.
    if (theirs === "days") {
      const choices = kind.fields[ours]!.options ?? [];
      if (!(type === "list" || (type === "enum" && choices.length > 0 && choices.every((choice) => weekdayOf(choice) !== undefined)))) {
        findings.push(
          error(
            "connection-field-type",
            path,
            type === "enum" ? `the weekdays ${withArticle(connection.kind)} falls on are a choice of weekday, or a list of them, and ${ours}'s choices (${choices.join(", ")}) are not weekdays` : `the weekdays ${withArticle(connection.kind)} falls on are a choice of weekday, or a list of them, and ${ours} is a ${type} field`,
            'name an enum whose options are weekdays ("mon" to "sun", or their names), or a list field holding them',
          ),
        );
      }
      continue;
    }
    if ((theirs === "start" || theirs === "end") && weekly && !TEXT.has(type)) {
      findings.push(error("connection-field-type", path, `with days mapped, the event's ${theirs} is a time of day like "09:00", and ${ours} is a ${type} field`, 'name a string field holding the time as "HH:MM"'));
    }
    if ((theirs === "start" || theirs === "end") && !weekly && !WHEN.has(type)) {
      findings.push(error("connection-field-type", path, `the event's ${theirs} is a moment or a day, and ${ours} is a ${type} field`, "name a datetime field for a timed event, or a date field for an all-day one"));
    }
  }
  const start = typeOf(connection.fields.start);
  const end = typeOf(connection.fields.end);
  if (!weekly && start && end && WHEN.has(start) && WHEN.has(end) && start !== end) {
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

  if (app) {
    findings.push(
      ...landing(
        at,
        connection.kind,
        mapped.map(([, ours]) => ours).filter((ours) => kind.fields[ours]),
        { made: "an event made in the calendar", fields: "the event's fields", change: "a change in the calendar", deleted: "an event deleted in the calendar", theirs: "Google events", one: "a Google event", part: "a calendar field", things: "events" },
        app,
        document,
        { name, connection },
      ),
    );
  }
  return findings;
}

function notionConnection(at: string, connection: NotionConnectionSpec, document: GraviewDocument, app?: GraviewApp): Finding[] {
  const findings: Finding[] = [];
  const kind = document.kinds[connection.kind];
  if (!kind) return [noKind(at, document, connection.kind, "the database's pages")];
  let mapped: string[];
  const relations: string[] = [];
  if (connection.properties) {
    mapped = [];
    const seen = new Map<string, string>();
    const edges = kind.edges ?? {};
    for (const [field, property] of Object.entries(connection.properties)) {
      const path = `${at}.properties.${field}`;
      const name = typeof property === "string" ? property : property.name;
      const declared = typeof property === "string" ? undefined : property.type;
      if (!kind.fields[field] && !edges[field]) {
        const names = [...Object.keys(kind.fields), ...Object.keys(edges)];
        findings.push(error("connection-field", path, `${connection.kind} has no field or relation called ${field} to hold the property ${name}`, `name one of ${names.join(", ")}`));
        continue;
      }
      const twice = seen.get(name);
      if (twice) findings.push(error("connection-field", path, `the property ${name} is already held by ${twice}, and one property is held by one field or relation`, "give each property a field or relation of its own"));
      seen.set(name, field);
      if (!kind.fields[field]) {
        // One of the kind's relations, held by a relation property: its pages are records another Notion connection keeps.
        if (declared && declared !== "relation") {
          findings.push(error("connection-relation", path, `${field} is a relation of ${connection.kind}, and the property ${name} is a ${declared}: a relation is held by a relation property, the pages it links`, `name a relation property, or map a field of ${connection.kind} to ${name}`));
          continue;
        }
        const problem = relationTarget(connection.kind, field, edges[field]!.to, document);
        if (problem) {
          findings.push(error("connection-relation-target", path, problem.message, problem.fix));
          continue;
        }
        relations.push(field);
        continue;
      }
      if (declared === "relation") {
        findings.push(error("connection-relation", path, `the property ${name} is a relation, the pages it links, and ${field} is a field of ${connection.kind}, which holds one value`, `declare a relation of ${connection.kind} to the kind those pages are, and map it to ${name}`));
        continue;
      }
      mapped.push(field);
      const type = kind.fields[field]!.type;
      if (typeof property === "string") {
        if (!NOTION_INFERABLE.has(type)) findings.push(error("connection-field-type", path, `${field} is a ${type} field, and no Notion property a connection keeps in step is held in one`, `name a field of another type, or leave ${field} out`));
        continue;
      }
      if (!notionFits(property.type!, type)) {
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
  if (app && mapped.length > 0) {
    findings.push(...landing(at, connection.kind, mapped, { made: "a page made in the database", fields: "the page's fields", change: "a change in Notion", deleted: "a page archived in Notion", theirs: "Notion pages", one: "a Notion page", part: "a Notion property", things: "pages" }, app, document));
  }
  if (app) findings.push(...linking(at, connection.kind, relations, document, app));
  return findings;
}

/** Why a relation cannot be kept in step: what it reaches is no kind a Notion connection of this app keeps. */
function relationTarget(kindName: string, relation: string, to: readonly string[] | "*", document: GraviewDocument): { readonly message: string; readonly fix: string } | undefined {
  const kept = new Set(
    Object.values(document.connections ?? {})
      .map((raw) => raw as { system?: unknown; kind?: unknown })
      .filter((raw) => raw.system === "notion" && typeof raw.kind === "string")
      .map((raw) => String(raw.kind)),
  );
  const keptBy = kept.size > 0 ? `the Notion connections here keep ${[...kept].join(", ")}` : "no other Notion connection is declared";
  if (to === "*") return { message: `${kindName}'s ${relation} reaches any kind, and a Notion relation links the pages of one database`, fix: `say the kind it reaches with "to", and keep that kind with a Notion connection of its own` };
  const outside = to.filter((target) => !kept.has(target));
  if (outside.length === 0) return undefined;
  return {
    message: `${kindName}'s ${relation} reaches ${outside.join(" and ")}, which no Notion connection of this app keeps, so a page it links would have no record here (${keptBy})`,
    fix: `declare a Notion connection for ${outside.join(" and ")}'s database, or leave ${relation} out of properties`,
  };
}

/** That the acts a link made or taken away in Notion lands through are there: `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>`. */
function linking(at: string, kindName: string, relations: readonly string[], document: GraviewDocument, app: GraviewApp): Finding[] {
  if (relations.length === 0) return [];
  const findings: Finding[] = [];
  const declared = app.mutations ?? [];
  const acts = new Set([...declared, ...deriveMutations(app.schema, declared)].map((mutation) => mutation.name));
  for (const relation of relations) {
    const path = `${at}.properties.${relation}`;
    const connect = relationActName("connect", kindName, relation);
    const disconnect = relationActName("disconnect", kindName, relation);
    if (!acts.has(connect)) {
      findings.push(error("connection-connect", path, `a link made in Notion lands through ${connect}, and this app has no such act: the relation declares no acts, or an act of its own replaces it`, `let ${kindName}'s ${relation} be given its derived acts, or leave ${relation} out of properties`));
    } else if (!acts.has(disconnect)) {
      const appendOnly = document.kinds[kindName]?.edges?.[relation]?.appendOnly === true;
      findings.push(warning("connection-disconnect", path, `no act takes ${kindName}'s ${relation} away${appendOnly ? " (it is append-only)" : ""}, so a link taken away in Notion stays here`));
    }
  }
  return findings;
}

/** How a refusal says the other system's things: what it holds, one of them, one of its parts, and the things a kind would be made for. */
interface TheirWords {
  readonly made: string;
  readonly fields: string;
  readonly change: string;
  readonly deleted: string;
  readonly theirs: string;
  readonly one: string;
  readonly part: string;
  readonly things: string;
}

/** A Google connection's declaration, for the fix that rewrites it (`set-connection`). */
interface GoogleDeclared {
  readonly name: string;
  readonly connection: GoogleCalendarConnectionSpec;
}

const capitalize = (words: string) => words.charAt(0).toUpperCase() + words.slice(1);
/** "a Type", "a Driver and a Van", "a Type, a Driver and a Van". */
const listed = (words: readonly string[]) => (words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`);

/** That the acts an inbound change lands through are there: one that makes the kind from the mapped fields alone, `edit-<kind>` writing every mapped field, `remove-<kind>`. */
function landing(at: string, kindName: string, fields: readonly string[], said: TheirWords, app: GraviewApp, document: GraviewDocument, google?: GoogleDeclared): Finding[] {
  const findings: Finding[] = [];
  // The acts the store will hold: the declared ones and those derived from them (`edit-<kind>`, `remove-<kind>`).
  const declared = app.mutations ?? [];
  const acts = new Map([...declared, ...deriveMutations(app.schema, declared)].map((mutation) => [mutation.name, mutation]));
  // The act a record is made through takes no subject and asks only for what the connection maps (`creatingActFor`), as the connection chooses it.
  const making = creatingActFor(declared as readonly AnyMutationDefinition[], kindName, fields);
  if (!making.creates) {
    findings.push(error("connection-creates", `${at}.kind`, `no act makes ${withArticle(kindName)}, so ${said.made} has nothing to become here`, `declare an act with "creates": "${kindName}"`));
  } else if (!making.act) {
    /*
     * SAID TO THE PERSON FILLING THE FORM (FR-229): what the kind needs
     * that the other system's things do not have, and the ways out — a
     * default, the field left blank, a part of theirs mapped to it, another
     * kind, a kind made for them — each with the edits that do it where
     * they can be written. The framework's own sentence stays as `details`.
     */
    const why = making.unfit.map((act) =>
      act.on ? `${act.name} acts on ${act.on.length > 0 ? act.on.map(withArticle).join(" or ") : "a record"}` : `${act.name} asks for ${act.asks!.join(", ")}, which the connection does not map`,
    );
    const details = `${said.made} becomes ${withArticle(kindName)} through an act that makes one from ${said.fields} alone, and ${why.join("; ")} — declare an act with "creates": "${kindName}" and no "on", whose required arguments are fields the connection maps (add-${kindName} is the one looked for first)`;
    const plain = plainRefusal(kindName, making.unfit, said, app, document, google);
    findings.push(error("connection-creates", `${at}.kind`, plain.message, plain.fix, { details, ...(plain.fixes.length > 0 ? { fixes: plain.fixes } : {}) }));
  }
  const edit = acts.get(`edit-${kindName}`);
  const writes = new Set(edit?.writes ?? []);
  const unwritten = fields.filter((field) => !writes.has(field));
  if (unwritten.length > 0) {
    const them = unwritten.length === 1 ? "it" : "them";
    // The derived edit writes every field a connection maps (`keptInStep`), so what it leaves out is fixed, or the app declares its own edit.
    const own = edit !== undefined && !edit.derived;
    const fixed = unwritten.filter((field) => field in (app.schema.tryDefinition(kindName)?.fixed ?? {}));
    findings.push(
      error(
        "connection-edit",
        `${at}.${said.change.includes("calendar") ? "fields" : "properties"}`,
        own
          ? `${said.change} lands through edit-${kindName}, which does not write ${unwritten.join(", ")}: the app declares its own edit-${kindName}`
          : `${said.change} lands through edit-${kindName}, which does not write ${unwritten.join(", ")}: ${fixed.length > 0 ? `${fixed.join(", ")} ${fixed.length === 1 ? "is" : "are"} fixed` : `no edit-${kindName} is there`}`,
        own
          ? `let edit-${kindName} write ${them}, or take it out so the derived edit, which writes every field a connection maps, is given, or leave ${them} out of the connection`
          : `leave ${them} out of the connection, or let ${them} change`,
      ),
    );
  }
  if (!acts.has(`remove-${kindName}`)) {
    findings.push(warning("connection-remove", `${at}.kind`, `no act removes ${withArticle(kindName)}, so ${said.deleted} stays here, no longer kept in step`));
  }
  return findings;
}

/** What a refusal says to a person, and the ways out of it a host offers. */
interface PlainRefusal {
  readonly message: string;
  readonly fix: string;
  readonly fixes: readonly FindingFix[];
}

/** "a Type"; "Notes" — words that are many take no article. */
function fieldSaid(spec: FieldSpec | undefined, field: string): string {
  const label = spec?.label ?? humanizeField(field);
  return spec?.type === "text" || spec?.type === "list" ? label : `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`;
}

/**
 * The refusal in the person's words. The fields every fitting act would
 * ask for and the connection does not give are what the kind "needs"; a
 * kind no act makes on its own is said as such.
 */
function plainRefusal(kindName: string, unfit: readonly UnfitCreatingAct[], said: TheirWords, app: GraviewApp, document: GraviewDocument, google?: GoogleDeclared): PlainRefusal {
  const spec = document.kinds[kindName];
  const noun = spec?.noun ?? humanizeField(kindName).toLowerCase();
  const plural = capitalize(spec?.plural ?? `${noun}s`);
  const fixes: FindingFix[] = [];
  // The fields asked for, in the order the acts ask them, `add-<kind>` first.
  const asking = [...unfit].sort((a, b) => Number(b.name === `add-${kindName}`) - Number(a.name === `add-${kindName}`)).filter((act) => act.asks);
  const asks = [...new Set(asking.flatMap((act) => act.asks ?? []))];
  const elsewhere = otherKinds(kindName, said, app, document, google);
  if (asks.length === 0) {
    const on = unfit.filter((act) => act.on).map((act) => `${act.on!.length > 0 ? act.on!.map((kind) => withArticle(document.kinds[kind]?.noun ?? humanizeField(kind).toLowerCase())).join(" or ") : "a record"} (${act.name})`);
    return {
      message: `${capitalize(withArticle(noun))} is only ever made on ${listed(on)}, and ${said.one} is made on nothing.`,
      fix: `Add an act that makes ${withArticle(noun)} on its own, or sync to a kind made for ${said.things}.`,
      fixes: elsewhere,
    };
  }
  const labels = asks.map((field) => spec?.fields[field]?.label ?? humanizeField(field));
  const one = asks.length === 1;
  for (const field of asks) {
    const f = spec?.fields[field];
    const label = f?.label ?? humanizeField(field);
    const starts = f?.type === "enum" ? f.options?.[0] : f?.type === "boolean" ? false : undefined;
    fixes.push({ label: `Give ${label} a default`, ...(starts !== undefined ? { edits: [{ op: "set-default", kind: kindName, field, default: starts }] } : {}) });
    if (f?.required) fixes.push({ label: `Let ${label} be left blank`, edits: [{ op: "set-required", kind: kindName, field, required: false }] });
    fixes.push({ label: `Map ${said.part} to ${label}`, ...mappedPart(field, f, google) });
  }
  return {
    message: `${plural} need ${listed(asks.map((field) => fieldSaid(spec?.fields[field], field)))}, and ${said.theirs} don't have ${one ? "one" : "them"}.`,
    fix: `Map ${said.part} to ${listed(labels)}, give ${one ? labels[0] : "them"} ${one ? "a default" : "defaults"}, or sync to a kind made for ${said.things}.`,
    fixes: [...fixes, ...elsewhere],
  };
}

/** The event's part a words field could hold, written into the connection: its description, else its location, where the connection maps neither. */
function mappedPart(field: string, spec: FieldSpec | undefined, google?: GoogleDeclared): { readonly edits?: readonly Record<string, unknown>[] } {
  if (!google || !spec || !TEXT.has(spec.type)) return {};
  const part = (["description", "location"] as const).find((theirs) => google.connection.fields[theirs] === undefined);
  if (!part) return {};
  return { edits: [{ op: "set-connection", name: google.name, connection: { ...google.connection, fields: { ...google.connection.fields, [part]: field } } }] };
}

/**
 * The kinds the connection could keep instead: each kind already here with
 * a title and two dates of one sort that an act makes from them alone, and
 * a kind made for events, added. Said only of a Google calendar, whose
 * events say what a kind for them holds.
 */
function otherKinds(kindName: string, said: TheirWords, app: GraviewApp, document: GraviewDocument, google?: GoogleDeclared): FindingFix[] {
  if (!google) return [];
  const declared = (app.mutations ?? []) as readonly AnyMutationDefinition[];
  const fixes: FindingFix[] = [];
  const rewired = (kind: string, fields: GoogleCalendarConnectionSpec["fields"]): Record<string, unknown> => ({ op: "set-connection", name: google.name, connection: { ...google.connection, kind, fields } });
  for (const [kind, spec] of Object.entries(document.kinds)) {
    if (kind === kindName) continue;
    const words = Object.entries(spec.fields).filter(([, f]) => TEXT.has(f.type));
    const title = words.find(([field]) => field === "name" || field === "title") ?? words.find(([, f]) => f.required) ?? words[0];
    const dates = Object.keys(spec.fields).filter((field) => WHEN.has(spec.fields[field]!.type));
    const ends = startAndEndOf(dates) ?? (dates.length >= 2 ? { start: dates[0]!, end: dates[1]! } : undefined);
    if (!title || !ends || spec.fields[ends.start]!.type !== spec.fields[ends.end]!.type) continue;
    if (!creatingActFor(declared, kind, [title[0], ends.start, ends.end]).act) continue;
    fixes.push({ label: `Sync to ${kind} instead`, edits: [rewired(kind, { summary: title[0], start: ends.start, end: ends.end })] });
  }
  // A kind made for events: a title, a start and an end of the sort the connection maps now, and where it happens.
  const sort = document.kinds[kindName]?.fields[google.connection.fields.start]?.type === "date" ? "date" : "datetime";
  let fresh = "event";
  for (let n = 2; document.kinds[fresh]; n += 1) fresh = n === 2 ? "calendar-event" : `calendar-event-${n}`;
  fixes.push({
    label: `Add a kind made for ${said.things}`,
    edits: [
      { op: "add-kind", kind: fresh, fields: { title: { type: "string", required: true }, starts: { type: sort }, ends: { type: sort }, where: { type: "string" } } },
      rewired(fresh, { summary: "title", start: "starts", end: "ends", location: "where" }),
    ],
  });
  return fixes;
}
