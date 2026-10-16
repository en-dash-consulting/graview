import type { GraviewApp } from "../app.js";
import { deriveMutations } from "../mutations/derive-edits.js";
import { withArticle } from "../schema/define-node.js";
import { CONNECTION_TAG, GOOGLE_COLORS } from "../sync/connection-filter.js";
import { error, warning, type Finding } from "./findings.js";
import { ConnectionSpec } from "./connection-spec.js";
import type { GraviewDocument } from "./schema.js";

/*
 * A DECLARED CONNECTION, JUDGED (`connections.<name>`): what its shape
 * cannot say — that the kind and its fields are this document's and of the
 * types a calendar event's parts are, that a filter is one color Google
 * names or one tag, and, given the compiled app, that the acts an inbound
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
    // The shape first, said as the compiler says a document's: a connection that is not one is judged no further.
    const parsed = ConnectionSpec.safeParse(raw);
    if (!parsed.success) {
      findings.push(...parsed.error.issues.map((issue) => shapeFinding(at, issue)));
      continue;
    }
    findings.push(...oneConnection(at, parsed.data, document, app));
  }
  return findings;
}

/** A shape the connection does not have, at its place: an unknown key, or a value of the wrong kind. */
function shapeFinding(at: string, issue: { readonly code: string; readonly path: readonly PropertyKey[]; readonly message: string; readonly keys?: readonly string[] }): Finding {
  const path = [at, ...issue.path.map(String)].join(".");
  if (issue.code === "unrecognized_keys" && issue.keys) {
    return error("unknown-key", path, `${issue.keys.map((key) => `"${key}"`).join(", ")} ${issue.keys.length === 1 ? "is" : "are"} not part of a connection`, "a connection says system, calendar, auth, kind, fields, filter, direction, conflicts, every, paused and description");
  }
  return error("shape", path, issue.message);
}

function oneConnection(at: string, connection: ConnectionSpec, document: GraviewDocument, app?: GraviewApp): Finding[] {
  const findings: Finding[] = [];
  const kind = document.kinds[connection.kind];
  if (!kind) {
    const kinds = Object.keys(document.kinds);
    return [error("connection-kind", `${at}.kind`, `there is no kind called ${connection.kind} for the calendar's events to be`, `name one of ${kinds.join(", ")}`)];
  }
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

  if (app) {
    // The acts the store will hold: the declared ones and those derived from them (`edit-<kind>`, `remove-<kind>`).
    const declared = app.mutations ?? [];
    const acts = new Map([...declared, ...deriveMutations(app.schema, declared)].map((mutation) => [mutation.name, mutation]));
    const creates = (app.mutations ?? []).some((mutation) => (mutation.creates ?? []).includes(connection.kind));
    if (!creates) {
      findings.push(error("connection-creates", `${at}.kind`, `no act makes ${withArticle(connection.kind)}, so an event made in the calendar has nothing to become here`, `declare an act with "creates": "${connection.kind}"`));
    }
    const edit = acts.get(`edit-${connection.kind}`);
    const writes = new Set(edit?.writes ?? []);
    const unwritten = mapped.map(([, ours]) => ours).filter((ours) => kind.fields[ours] && !writes.has(ours));
    if (unwritten.length > 0) {
      findings.push(
        error(
          "connection-edit",
          `${at}.fields`,
          `a change in the calendar lands through edit-${connection.kind}, which does not write ${unwritten.join(", ")}: another act declares ${unwritten.length === 1 ? "it" : "them"}`,
          `let edit-${connection.kind} write ${unwritten.length === 1 ? "it" : "them"} (drop "writes" of ${unwritten.length === 1 ? "it" : "them"} from the other act), or leave ${unwritten.length === 1 ? "it" : "them"} out of the connection`,
        ),
      );
    }
    if (!acts.has(`remove-${connection.kind}`)) {
      findings.push(warning("connection-remove", `${at}.kind`, `no act removes ${withArticle(connection.kind)}, so an event deleted in the calendar stays here, no longer kept in step`));
    }
  }
  return findings;
}
