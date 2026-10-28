import type { GraviewApp } from "../app.js";
import { deriveMutations } from "../mutations/derive-edits.js";
import { relationActName } from "../mutations/derived-names.js";
import { withArticle } from "../schema/define-node.js";
import { CONNECTION_TAG, GOOGLE_COLORS } from "../sync/connection-filter.js";
import { creatingActFor, type UnfitCreatingAct } from "../sync/creating-act.js";
import type { AnyMutationDefinition } from "../mutations/types.js";
import { humanizeField } from "../schema/humanize.js";
import { NOTION_FITS, NOTION_INFERABLE, NOTION_READ_ONLY, NOTION_SECRET, notionFieldType, notionFits } from "../sync/notion-types.js";
import { startAndEndOf } from "../wall-time.js";
import { weekdayOf } from "../sync/recurrence.js";
import { error, warning, type Finding, type FindingFix } from "./findings.js";
import { ConnectionSpec, notionSourcesOf, type GoogleCalendarConnectionSpec, type NotionConnectionSpec, type NotionSourceSpec } from "./connection-spec.js";
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
  notion: "system, database, source, auth, kind, properties, sources, create, direction, conflicts, every, paused and description",
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
      findings.push(
        theirs === "guests"
          ? error("connection-guests-field", path, `${connection.kind} has no field called ${ours} to hold the event's guests`, `name a list field holding their addresses, or an email field, or add one`, { fixes: [addressesField(connection.kind, ours, `Add ${humanizeField(ours)} to ${connection.kind}`)] })
          : error("connection-field", path, `${connection.kind} has no field called ${ours} to hold the event's ${theirs}`, `name one of ${Object.keys(kind.fields).join(", ")}`),
      );
      continue;
    }
    const twice = seen.get(ours);
    if (twice) findings.push(error("connection-field", path, `${ours} already holds the event's ${twice}, and one field holds one part of an event`, "give each part a field of its own"));
    seen.set(ours, theirs);
    const type = typeOf(ours)!;
    // The guests in a field (Roadmap f-calendar-guests-mapping): a list of addresses, or one email.
    if (theirs === "guests") {
      if (!holdsAddresses(kind.fields[ours]!)) findings.push(error("connection-guests-field", path, `the event's guests are addresses, a list of them or one email, and ${ours} is a ${type} field`, "name a list field holding the addresses, or an email field"));
      continue;
    }
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
  if (typeof connection.fields.guests === "object") findings.push(...guestsVia(at, name, connection, connection.fields.guests, kind, document, app));

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
  if (connection.sources) {
    const findings: Finding[] = [];
    // One form or the other: several sources each say their own kind and properties.
    for (const key of ["kind", "source", "properties"] as const) {
      if (connection[key] !== undefined) findings.push(error("connection-sources", `${at}.${key}`, `this connection names its sources, each with its kind and properties, and ${key} is said for each source there`, `move ${key} into the source it belongs to, or drop sources`));
    }
    const kinds = new Map<string, number>();
    const named = new Map<string, number>();
    const sources = notionSourcesOf(connection);
    sources.forEach((source, index) => {
      const where = `${at}.sources.${index}`;
      const twice = kinds.get(source.kind);
      if (twice !== undefined) {
        findings.push(error("connection-sources", `${where}.kind`, `sources ${twice} and ${index} both keep ${source.kind}, and each kind is kept by one data source`, `name another kind here, or drop one of them`));
        return;
      }
      kinds.set(source.kind, index);
      const key = source.source!.toLowerCase().replace(/[^a-z0-9]/g, "");
      const same = named.get(key);
      if (same !== undefined) findings.push(error("connection-sources", `${where}.source`, `sources ${same} and ${index} both name the data source ${source.source}, and one data source holds the pages of one kind`, "name each data source once"));
      named.set(key, index);
      findings.push(...notionSource(where, connection, source, document, app));
    });
    return findings;
  }
  if (connection.kind === undefined) return [error("connection-kind", `${at}.kind`, "a Notion connection names the kind its pages are, or its sources, each with the kind it keeps", `say "kind", or "sources": [{ "source", "kind" }]`)];
  return notionSource(at, connection, notionSourcesOf(connection)[0]!, document, app);
}

/** One data source of a Notion connection, judged at `at` (the connection, or one of its sources): its kind, and each property it maps. */
function notionSource(at: string, connection: NotionConnectionSpec, source: NotionSourceSpec, document: GraviewDocument, app?: GraviewApp): Finding[] {
  const findings: Finding[] = [];
  const kindName = source.kind;
  const kind = document.kinds[kindName];
  if (!kind) return [noKind(at, document, kindName, "the database's pages")];
  let mapped: string[];
  const relations: string[] = [];
  if (source.properties) {
    mapped = [];
    const seen = new Map<string, string>();
    const edges = kind.edges ?? {};
    for (const [field, property] of Object.entries(source.properties)) {
      const path = `${at}.properties.${field}`;
      const name = typeof property === "string" ? property : property.name;
      const declared = typeof property === "string" ? undefined : property.type;
      if (!kind.fields[field] && !edges[field]) {
        const names = [...Object.keys(kind.fields), ...Object.keys(edges)];
        findings.push(error("connection-field", path, `${kindName} has no field or relation called ${field} to hold the property ${name}`, `name one of ${names.join(", ")}`));
        continue;
      }
      const twice = seen.get(name);
      if (twice) findings.push(error("connection-field", path, `the property ${name} is already held by ${twice}, and one property is held by one field or relation`, "give each property a field or relation of its own"));
      seen.set(name, field);
      if (!kind.fields[field]) {
        // One of the kind's relations, held by a relation property: its pages are records another Notion connection keeps.
        if (declared && declared !== "relation") {
          findings.push(error("connection-relation", path, `${field} is a relation of ${kindName}, and the property ${name} is a ${declared}: a relation is held by a relation property, the pages it links`, `name a relation property, or map a field of ${kindName} to ${name}`));
          continue;
        }
        const problem = relationTarget(kindName, field, edges[field]!.to, document);
        if (problem) {
          findings.push(error("connection-relation-target", path, problem.message, problem.fix));
          continue;
        }
        relations.push(field);
        continue;
      }
      if (declared === "relation") {
        findings.push(error("connection-relation", path, `the property ${name} is a relation, the pages it links, and ${field} is a field of ${kindName}, which holds one value`, `declare a relation of ${kindName} to the kind those pages are, and map it to ${name}`));
        continue;
      }
      mapped.push(field);
      // An enum that takes several of its options (FR-233) is `several choices`: a multi-select's, never a select's.
      const type = notionFieldType(kind.fields[field]!);
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
    if (mapped.length === 0 && Object.keys(source.properties).length === 0) {
      findings.push(error("connection-properties", `${at}.properties`, "the connection maps no property, so nothing would be kept in step", "map a field to a property, or drop properties to match them by name"));
    }
  } else {
    mapped = Object.entries(kind.fields).filter(([, spec]) => NOTION_INFERABLE.has(spec.type)).map(([field]) => field);
    if (mapped.length === 0) findings.push(error("connection-properties", `${at}.kind`, `${kindName} has no field a Notion property could be held in`, "give it a string, number, date, enum, list or boolean field"));
  }
  if (app && mapped.length > 0) {
    findings.push(...landing(at, kindName, mapped, { made: "a page made in the database", fields: "the page's fields", change: "a change in Notion", deleted: "a page archived in Notion", theirs: "Notion pages", one: "a Notion page", part: "a Notion property", things: "pages" }, app, document));
  }
  if (app) findings.push(...linking(kindName, relations, document, app, { where: (relation) => `${at}.properties.${relation}`, made: "a link made in Notion", taken: "a link taken away in Notion", leave: (relation) => `leave ${relation} out of properties` }));
  return findings;
}

/** Whether a field holds a guest's addresses: a list of them (of strings, or of nothing said), or one email. */
const holdsAddresses = (spec: FieldSpec): boolean => spec.type === "email" || (spec.type === "list" && (spec.of === undefined || spec.of === "string"));

/** The fix that adds a list of addresses to a kind, as an edit a host applies. */
const addressesField = (kind: string, field: string, label: string): FindingFix => ({ label, edits: [{ op: "add-field", kind, field, type: "list", of: "string" }] });

/**
 * THE GUESTS THROUGH A RELATION, JUDGED (Roadmap f-calendar-guests-mapping):
 * that `via` is one relation of the kind to one kind, that the kind it
 * reaches has addresses to invite (`emails`) and the toggle that says who
 * wants to be (`invite`, unless the app has none), that the people kind, if
 * another, is said once, and that the acts a guest added or taken away in
 * the calendar lands through are there. A field missing is offered as the
 * edit that adds it.
 */
function guestsVia(at: string, name: string, connection: GoogleCalendarConnectionSpec, guests: Exclude<GoogleCalendarConnectionSpec["fields"]["guests"], string | undefined>, kind: GraviewDocument["kinds"][string], document: GraviewDocument, app?: GraviewApp): Finding[] {
  const path = `${at}.fields.guests`;
  const kindName = connection.kind;
  const edges = kind.edges ?? {};
  const edge = edges[guests.via];
  if (!edge) {
    const named = Object.keys(edges);
    return [error("connection-guests-via", `${path}.via`, `${kindName} has no relation called ${guests.via} to reach the guests through`, named.length > 0 ? `name one of ${named.join(", ")}` : `declare a relation of ${kindName} to the people its events are about, and name it`)];
  }
  if (edge.to === "*" || edge.to.length !== 1) {
    return [error("connection-guests-via", `${path}.via`, edge.to === "*" ? `${guests.via} reaches any kind, and the guests are the people of one` : `${guests.via} reaches ${listed(edge.to)}, and the guests are the people of one kind`, 'say the one kind it reaches with "to"')];
  }
  const reached = edge.to[0]!;
  const people = document.kinds[reached];
  // A relation to a kind that is not there is the document's finding, said once where the relation is.
  if (!people) return [];
  const findings: Finding[] = [];
  const emails = guests.emails ?? "emails";
  const invite = guests.invite ?? "inviteMe";
  const plural = capitalize(people.plural ?? `${people.noun ?? humanizeField(reached).toLowerCase()}s`);
  const addresses = people.fields[emails];
  if (!addresses) {
    if (guests.emails === undefined) {
      findings.push(error("connection-guests-via", `${path}.via`, `${guests.via} reaches ${reached}, and ${withArticle(reached)} has no emails to invite`, `give ${reached} a list field of addresses called emails, or name the field that holds them with "emails"`, { fixes: [addressesField(reached, "emails", `Give ${plural} emails`)] }));
    } else {
      findings.push(error("connection-guests-field", `${path}.emails`, `${reached} has no field called ${emails} to hold a guest's addresses`, `name one of ${Object.keys(people.fields).join(", ")}, or add it`, { fixes: [addressesField(reached, emails, `Add ${humanizeField(emails)} to ${reached}`)] }));
    }
  } else if (!holdsAddresses(addresses)) {
    findings.push(error("connection-guests-field", `${path}.emails`, `a guest's addresses are a list of them or one email, and ${reached}'s ${emails} is a ${addresses.type} field`, "name a list field holding the addresses, or an email field"));
  }
  if (invite !== false) {
    const toggle = people.fields[invite];
    if (!toggle) {
      findings.push(
        error("connection-guests-field", `${path}.invite`, `${reached} has no field called ${invite} to say who wants to be invited`, `add a yes-or-no field, name one with "invite", or say "invite": false to invite every address`, {
          fixes: [
            { label: `Add ${humanizeField(invite)} to ${reached}`, edits: [{ op: "add-field", kind: reached, field: invite, type: "boolean" }] },
            { label: "Invite every address", edits: [{ op: "set-connection", name, connection: { ...connection, fields: { ...connection.fields, guests: { ...guests, invite: false } } } }] },
          ],
        }),
      );
    } else if (toggle.type !== "boolean") {
      findings.push(error("connection-guests-field", `${path}.invite`, `${invite} says whether ${withArticle(reached)} wants to be invited, and ${reached}'s ${invite} is a ${toggle.type} field`, 'name a boolean field, or say "invite": false to invite every address'));
    }
  }
  // The app's people are another kind: not wrong (a household's people need not be its members), but said once.
  const members = Object.entries(document.kinds).find(([, spec]) => spec.people === true)?.[0];
  if (members && members !== reached) findings.push(warning("connection-guests-via", `${path}.via`, `${guests.via} reaches ${reached}, and this app's people are ${members}: the guests are its ${plural.toLowerCase()}, never its members`));
  if (app) findings.push(...linking(kindName, [guests.via], document, app, { where: () => `${path}.via`, made: "a guest added in the calendar", taken: "a guest taken away in the calendar", leave: () => "leave guests out of the connection" }));
  return findings;
}

/** Why a relation cannot be kept in step: what it reaches is no kind a Notion connection of this app keeps. */
function relationTarget(kindName: string, relation: string, to: readonly string[] | "*", document: GraviewDocument): { readonly message: string; readonly fix: string } | undefined {
  const kept = new Set(
    Object.values(document.connections ?? {})
      .map((raw) => raw as Parameters<typeof notionSourcesOf>[0] & { system?: unknown })
      .filter((raw) => raw.system === "notion")
      .flatMap((raw) => notionSourcesOf(raw).map((one) => one.kind))
      .filter((kind) => typeof kind === "string"),
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

/** How a relation's link is said of the system that made it: where the finding points, what a link made and one taken away there are called, and how to leave the relation out. */
interface LinkWords {
  where(relation: string): string;
  readonly made: string;
  readonly taken: string;
  leave(relation: string): string;
}

/** That the acts a link made or taken away in the other system lands through are there: `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>`. */
function linking(kindName: string, relations: readonly string[], document: GraviewDocument, app: GraviewApp, said: LinkWords): Finding[] {
  if (relations.length === 0) return [];
  const findings: Finding[] = [];
  const declared = app.mutations ?? [];
  const acts = new Set([...declared, ...deriveMutations(app.schema, declared)].map((mutation) => mutation.name));
  for (const relation of relations) {
    const path = said.where(relation);
    const connect = relationActName("connect", kindName, relation);
    const disconnect = relationActName("disconnect", kindName, relation);
    if (!acts.has(connect)) {
      findings.push(error("connection-connect", path, `${said.made} lands through ${connect}, and this app has no such act: the relation declares no acts, or an act of its own replaces it`, `let ${kindName}'s ${relation} be given its derived acts, or ${said.leave(relation)}`));
    } else if (!acts.has(disconnect)) {
      const appendOnly = document.kinds[kindName]?.edges?.[relation]?.appendOnly === true;
      findings.push(warning("connection-disconnect", path, `no act takes ${kindName}'s ${relation} away${appendOnly ? " (it is append-only)" : ""}, so ${said.taken} stays here`));
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
