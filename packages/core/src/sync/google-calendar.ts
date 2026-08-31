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
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface GoogleCalendarOptions {
  readonly calendarId: string;
  /** Called before every request, so a refreshed token is picked up. */
  token(): Promise<string> | string;
  readonly fetch?: Fetcher;
  readonly baseUrl?: string;
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
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as Fetcher);
  const base = options.baseUrl ?? BASE;
  const events = `${base}/calendars/${encodeURIComponent(options.calendarId)}/events`;

  const call = async (url: string, init?: Parameters<Fetcher>[1]) => {
    const token = await options.token();
    const response = await doFetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    /*
     * A 410 means the sync token expired and Google wants a full resync. It
     * is the one error here that is not an error: throwing would look like
     * being offline, and being offline is handled by keeping the cursor —
     * which is exactly the wrong response to "your cursor is no good".
     */
    if (response.status === 410) return { expired: true } as const;
    if (!response.ok) throw new Error(`google-calendar: HTTP ${response.status}`);
    return { expired: false, body: (await response.json()) as Record<string, unknown> } as const;
  };

  return {
    name: "google-calendar",

    async pull(cursor) {
      const url = new URL(events);
      if (cursor) url.searchParams.set("syncToken", cursor);
      // Without this a deleted event simply stops appearing, and an event
      // that stops appearing is indistinguishable from one we never had.
      else url.searchParams.set("showDeleted", "true");

      let result = await call(url.toString());
      if (result.expired) {
        // Start again from nothing rather than silently missing a window.
        result = await call(`${events}?showDeleted=true`);
        if (result.expired) throw new Error("google-calendar: sync token rejected twice");
      }
      const body = result.body;
      const items = (body["items"] as Record<string, unknown>[] | undefined) ?? [];
      const changes: RemoteChange[] = items.map((item) => ({
        resource: "events",
        id: String(item["id"]),
        // The etag is Google's own version of the record, and the reason an
        // echo of our own write is recognisable at all.
        version: String(item["etag"] ?? ""),
        ...(item["status"] === "cancelled"
          ? { deleted: true }
          : { fields: flatten(item) }),
      }));
      return { changes, cursor: String(body["nextSyncToken"] ?? cursor ?? "") };
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
      await call(`${events}/${encodeURIComponent(write.id)}`, { method: "DELETE" });
      return { localId: write.localId, id: write.id, version: "" };
    }
    const body: Record<string, unknown> = {};
    for (const [path, value] of Object.entries(write.fields ?? {})) put(body, path, value);

    const result = await call(write.id ? `${events}/${encodeURIComponent(write.id)}` : events, {
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
  for (const path of ["summary", "location", "description", "start.dateTime", "end.dateTime"]) {
    const value = at(item, path);
    if (value !== undefined) out[path] = value;
  }
  return out;
}
