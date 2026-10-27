import type { RemoteAck, RemoteChange, RemoteSystem, RemoteWrite, SyncMapping } from "./types.js";

/**
 * Google Calendar, as a transport.
 *
 * The household example's blocks and duties are literally calendar events, which is why
 * this is the honest first test of the sync layer rather than a hypothetical
 * one — a sync design that only ever ran against a fixture has not met the
 * things that actually go wrong.
 *
 * Everything Google-specific is here. The engine knows about resources,
 * versions and acks; it has never heard of `etag`, `syncToken` or RFC 3339.
 */

/** The mapping an app declares. Fields, not code. */
export function googleCalendarMapping(options: {
  /** Which of your kinds are events, and which of your fields are which. */
  readonly events: readonly {
    readonly kind: string;
    readonly summary: string;
    readonly start: string;
    readonly end: string;
    readonly location?: string;
    readonly description?: string;
    readonly match?: (node: Record<string, unknown>) => boolean;
    /**
     * Where your representation is not Google's.
     *
     * Google wants RFC 3339. If your `start` is minutes since midnight, or a
     * day index, or anything else that is not that, say how to get from one to
     * the other — a rename cannot, and a mapping that only renames ships a
     * field full of nonsense the first time it runs.
     */
    readonly encodeTime?: (value: unknown, node: Record<string, unknown>) => unknown;
    readonly decodeTime?: (value: unknown) => unknown;
  }[];
}): SyncMapping {
  return {
    system: "google-calendar",
    resources: options.events.map((event) => ({
      kind: event.kind,
      resource: "events",
      fields: {
        [event.summary]: "summary",
        [event.start]: "start.dateTime",
        [event.end]: "end.dateTime",
        ...(event.location ? { [event.location]: "location" } : {}),
        ...(event.description ? { [event.description]: "description" } : {}),
      },
      ...(event.match ? { match: event.match } : {}),
      ...(event.encodeTime
        ? { encode: { [event.start]: event.encodeTime, [event.end]: event.encodeTime } }
        : {}),
      ...(event.decodeTime
        ? { decode: { [event.start]: event.decodeTime, [event.end]: event.decodeTime } }
        : {}),
    })),
  };
}

/** The bit of `fetch` this needs, so a test can supply a recording. */
export type Fetcher = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; readonly headers?: { get(name: string): string | null } }>;

/** What the adapter asks of a token source: `refresh` when Google just refused the last one. */
export interface GoogleTokenRequest {
  /**
   * Google answered 401 to the token this returned last: whatever it holds
   * is no good, expired or revoked, so mint a new one rather than hand the
   * cached one back.
   */
  readonly refresh?: boolean;
}

export interface GoogleCalendarOptions {
  readonly calendarId: string;
  /**
   * Called before every request, so a refreshed token is picked up. When
   * Google refuses a token (401) it is called once more with
   * `{ refresh: true }` and the request is made again; a second refusal
   * throws a sentence naming the token.
   */
  token(request?: GoogleTokenRequest): Promise<string> | string;
  readonly fetch?: Fetcher;
  readonly baseUrl?: string;
  /** Events per page of a pull (Google's `maxResults`; it allows up to 2500). Every page is followed. */
  readonly pageSize?: number;
  /**
   * Which of the calendar's events are this sync's, judged as they arrive
   * (Google refuses a sync token beside a search). One that is not is
   * reported deleted: never made here, and gone here if it was linked —
   * an event that leaves the filter has left the sync.
   */
  readonly keep?: (event: Readonly<Record<string, unknown>>) => boolean;
  /** Google event fields every event made from here carries (a `colorId`, `extendedProperties`), beside the mapped ones. */
  readonly madeHere?: Readonly<Record<string, unknown>>;
  /**
   * WHETHER GOOGLE MAILS THE GUESTS (Roadmap f-calendar-guests-mapping):
   * every insert, patch and delete says `sendUpdates` outright — `all` when
   * this is true, `none` otherwise. Left unsaid, Google decides, and its
   * default differs by call: a sync that writes an event every time a
   * record changes would mail every guest every time. Quiet unless asked.
   */
  readonly notify?: boolean;
}

const BASE = "https://www.googleapis.com/calendar/v3";

/** Reads a dotted path out of a nested response — `start.dateTime`. */
function at(record: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
      record,
    );
}

/** Writes a dotted path into a nested request body. */
function put(into: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let cursor = into;
  for (const key of keys.slice(0, -1)) {
    cursor[key] ??= {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys.at(-1)!] = value;
}

export function googleCalendar(options: GoogleCalendarOptions): RemoteSystem {
  const doFetch = options.fetch ?? (globalThis.fetch as Fetcher);
  const base = options.baseUrl ?? BASE;
  const events = `${base}/calendars/${encodeURIComponent(options.calendarId)}/events`;

  const call = async (url: string, init?: Parameters<Fetcher>[1]) => {
    const send = async (token: string) =>
      doFetch(url, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
    let response = await send(await options.token());
    /*
     * A 401 is an access token Google no longer takes — an hour old, or
     * revoked. Asked again with `refresh`, the token source mints a new one
     * and the request goes once more; refused again, it is the token, not
     * the network, and saying "offline" would hide that.
     */
    if (response.status === 401) {
      response = await send(await options.token({ refresh: true }));
      if (response.status === 401) {
        throw new Error(
          "google-calendar: Google refused the access token twice (HTTP 401), the second one asked for with token({ refresh: true })",
        );
      }
    }
    /*
     * A 410 means the sync token expired and Google wants a full resync. It
     * is the one error here that is not an error: throwing would look like
     * being offline, and being offline is handled by keeping the cursor —
     * which is exactly the wrong response to "your cursor is no good".
     */
    if (response.status === 410) return { expired: true } as const;
    if (!response.ok) throw new Error(`google-calendar: HTTP ${response.status}`);
    // A deletion is answered 204, with no body to read.
    if (response.status === 204) return { expired: false, body: {} as Record<string, unknown> } as const;
    return { expired: false, body: (await response.json()) as Record<string, unknown> } as const;
  };

  /**
   * Every page of one listing, from `cursor` or (without one) from nothing.
   * The sync token Google hands back is on the LAST page only; a pull that
   * stopped at the first would miss the rest and keep no cursor.
   */
  const list = async (cursor: string | undefined) => {
    const items: Record<string, unknown>[] = [];
    let pageToken: string | undefined;
    for (;;) {
      const url = new URL(events);
      if (cursor) url.searchParams.set("syncToken", cursor);
      // Without this a deleted event simply stops appearing, and an event
      // that stops appearing is indistinguishable from one we never had.
      else url.searchParams.set("showDeleted", "true");
      if (options.pageSize) url.searchParams.set("maxResults", String(options.pageSize));
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const result = await call(url.toString());
      if (result.expired) return { expired: true } as const;
      items.push(...((result.body["items"] as Record<string, unknown>[] | undefined) ?? []));
      const next = result.body["nextPageToken"];
      if (typeof next === "string" && next) {
        pageToken = next;
        continue;
      }
      return { expired: false, items, syncToken: result.body["nextSyncToken"] } as const;
    }
  };

  // Every write says whether the guests are mailed (`notify`); Google's own default is not relied on.
  const writing = (path: string) => `${path}?sendUpdates=${options.notify ? "all" : "none"}`;

  return {
    name: "google-calendar",

    async pull(cursor) {
      let result = await list(cursor);
      if (result.expired) {
        // Start again from nothing rather than silently missing a window.
        result = await list(undefined);
        if (result.expired) throw new Error("google-calendar: sync token rejected twice");
      }
      const changes: RemoteChange[] = result.items.map((item) => ({
        resource: "events",
        id: String(item["id"]),
        // The etag is Google's own version of the record, and the reason an
        // echo of our own write is recognizable at all.
        version: String(item["etag"] ?? ""),
        ...(item["status"] === "cancelled" || (options.keep && !options.keep(item))
          ? { deleted: true }
          : { fields: flatten(item) }),
      }));
      return { changes, cursor: String(result.syncToken ?? cursor ?? "") };
    },

    async push(writes) {
      const acks: RemoteAck[] = [];
      for (const write of writes) {
        try {
          acks.push(await one(write));
        } catch (error) {
          // One refusal is not a failed run. The engine keeps the local state
          // for this write and reports it; the rest still go.
          acks.push({
            localId: write.localId,
            id: write.id ?? "",
            version: "",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return acks;
    },
  };

  async function one(write: RemoteWrite): Promise<RemoteAck> {
    if (write.deleted && write.id) {
      await call(writing(`${events}/${encodeURIComponent(write.id)}`), { method: "DELETE" });
      return { localId: write.localId, id: write.id, version: "" };
    }
    // Copied whole: `madeHere` may nest (`start.timeZone`), and a path put beneath it must not reach the next write.
    const body: Record<string, unknown> = write.id ? {} : structuredClone(options.madeHere ?? {});
    for (const [path, value] of Object.entries(write.fields ?? {})) put(body, path, value);

    const result = await call(writing(write.id ? `${events}/${encodeURIComponent(write.id)}` : events), {
      method: write.id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
    if (result.expired) throw new Error("google-calendar: unexpected 410 on write");
    return {
      localId: write.localId,
      id: String(result.body["id"]),
      version: String(result.body["etag"] ?? ""),
    };
  }
}

/**
 * Google's nesting, flattened to the dotted paths the mapping uses.
 *
 * Only the paths a mapping can name — everything else in an event is Google's
 * business, and carrying it around would mean an app could accidentally depend
 * on a field it never declared.
 */
function flatten(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // An all-day event has a `date` and no `dateTime`: it arrives as its day, and
  // no time is made up for it. A mapping that names only the timed paths sees
  // no start, and `createInbound` decides whether such a record is one of its.
  // A recurring event's rule rides along whole (`recurrence`, FR-230): a mapping that keeps a record's repeat reads it.
  for (const path of ["summary", "location", "description", "start.dateTime", "end.dateTime", "start.date", "end.date", "recurrence"]) {
    const value = at(item, path);
    if (value !== undefined) out[path] = value;
  }
  /*
   * THE GUESTS ride along as Google sends them (`attendees`: each `email`,
   * `responseStatus`, `organizer`, `self`, `resource`), and an event with
   * none says so as an empty list: Google leaves the key out of such an
   * event, and the last guest taken away there is news here only if the
   * event still says who is invited (Roadmap f-calendar-guests-mapping).
   */
  out["attendees"] = Array.isArray(item["attendees"]) ? item["attendees"] : [];
  return out;
}
