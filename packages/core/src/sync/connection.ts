import type { GraviewApp } from "../app.js";
import type { AnySchema } from "../schema/schema.js";
import type { Store } from "../store.js";
import { fieldOf } from "../document/field-spec.js";
import type { ConnectionSpec } from "../document/connection-spec.js";
import { GOOGLE_COLORS, MADE_BY_GRAVIEW, inConnectionFilter, tagPattern } from "./connection-filter.js";
import { SyncEngine } from "./engine.js";
import { googleCalendar, type Fetcher, type GoogleTokenRequest } from "./google-calendar.js";
import type { RemoteSystem, ResourceMapping, SyncMapping, SyncState } from "./types.js";

/**
 * A DECLARED CONNECTION, RUN.
 *
 * `connections.<name>` in a declaration says which calendar, which kind,
 * which fields, which of its events and which way; this turns that into the
 * engine, the mapping and the transport, so a host (`graview serve`, the
 * preview, Graview Cloud) supplies only a token and a place to keep the
 * engine's state. Everything it decides is said here once:
 *
 * - A field's TYPE says what kind of event it is: a `date` field is an
 *   all-day event's day (`start.date`; the end day is inclusive here and
 *   exclusive at Google, so it is moved by one each way), a `datetime`
 *   field a timed event's instant (`start.dateTime`, read back as one UTC
 *   instant however Google says it).
 * - A FILTER is applied as events arrive, because Google refuses a sync
 *   token beside a search: an event outside it is not news, and one that
 *   leaves it is gone here. An event made here is given what the filter
 *   needs (the color; the tag in its title) so it stays in it, and a
 *   private extended property naming the app.
 * - READ means the calendar owns the kind: an act here that would change a
 *   record of it is refused with a sentence saying so (`SyncEngine.guard`),
 *   rather than accepted and never sent.
 * - Inbound changes land through the app's own acts — the one that creates
 *   the kind, `edit-<kind>` and `remove-<kind>` — authored by the system
 *   `google-calendar`, so Activity credits the calendar and undo works.
 */

export { CONNECTION_TAG, GOOGLE_COLORS, MADE_BY_GRAVIEW, inConnectionFilter } from "./connection-filter.js";
export type ConnectionDeclaration = ConnectionSpec;

export interface ConnectionRun<S extends AnySchema> {
  /** The connection's name in the declaration (`connections.<name>`). */
  readonly name: string;
  readonly declaration: ConnectionDeclaration;
  readonly app: GraviewApp<S>;
  readonly store: Store<S>;
  /** The calendar's id, resolved from the declaration (its `env`, when it names one). */
  readonly calendarId: string;
  /** An access token; asked again with `{ refresh: true }` when Google refuses the last one. */
  token(request?: GoogleTokenRequest): Promise<string> | string;
  readonly fetch?: Fetcher;
  /** What the engine kept from the last run: its cursor, its links. */
  readonly state?: SyncState;
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
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : new Date(time).toISOString().replace(/\.000Z$/, "Z");
};
const shiftDay = (value: unknown, days: number): unknown => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
};

/** Whether a field of the kind is a `date` (an all-day event's day) rather than a `datetime`. */
export function isDayField(app: GraviewApp, kind: string, field: string): boolean {
  const shape = (app.schema.tryDefinition(kind) as { fields?: { shape?: Record<string, unknown> } } | undefined)?.fields?.shape;
  const read = shape?.[field] === undefined ? undefined : fieldOf(shape[field]);
  return read !== undefined && "spec" in read && read.spec.type === "date";
}

/** The mapping a declaration says: field types decide the paths, the filter's tag is kept or stripped. */
export function connectionMapping(app: GraviewApp, declaration: ConnectionDeclaration): SyncMapping {
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

/** The act that makes a record of the kind: `add-<kind>` when there is one, else the first that creates it. */
export function creatingAct(app: GraviewApp, kind: string): string | undefined {
  const creating = (app.mutations ?? []).filter((mutation) => (mutation.creates ?? []).includes(kind));
  return (creating.find((mutation) => mutation.name === `add-${kind}`) ?? creating[0])?.name;
}

/** The engine, the mapping and the transport for one declared connection. */
export function connection<S extends AnySchema>(run: ConnectionRun<S>): Connection<S> {
  const { declaration, app, store } = run;
  const mapping = connectionMapping(app as GraviewApp, declaration);
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
  const decoded = (fields: Readonly<Record<string, unknown>>) => {
    const out: Record<string, unknown> = {};
    for (const [ours, theirs] of Object.entries(resource.fields)) {
      if (!(theirs in fields)) continue;
      const decode = resource.decode?.[ours];
      out[ours] = decode ? decode(fields[theirs]) : fields[theirs];
    }
    return out;
  };
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
        return { name: creates, args: { id: `${declaration.kind}-${run.name}-${id.slice(0, 16)}-${made}`, ...values } };
      },
    },
    run.state,
  );
  const unguard = declaration.direction === "read" ? engine.guard() : undefined;
  return { engine, mapping, remote, ...(unguard ? { unguard } : {}) };
}

