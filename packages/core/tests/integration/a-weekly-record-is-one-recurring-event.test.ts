import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { instantIn, wallIn } from "../../src/days.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { connection, type Fetcher } from "../../src/sync/index.js";

/**
 * A WEEKLY RECORD IS ONE RECURRING EVENT (Roadmap
 * f-connection-weekly-records-recur, FR-230): a duty that says its weekdays
 * and its times of day, or a practice whose date repeats, is one Google
 * event with a weekly rule in the app's time zone — ten of them ten
 * events, a change to one moving only it, a day set apart an EXDATE — and
 * a recurring event made in the calendar is one record here.
 */

const ZONE = "America/New_York";
const MONDAY = "2026-11-02";

const rota = (connections: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Rota",
  brand: { timeZone: ZONE },
  kinds: {
    duty: {
      fields: {
        name: { type: "string", required: true },
        days: { type: "list" },
        from: { type: "string" },
        to: { type: "string" },
        driver: { type: "string" },
      },
    },
    practice: {
      fields: { name: { type: "string", required: true }, startsAt: { type: "datetime", repeats: true }, endsAt: { type: "datetime" } },
    },
  },
  acts: { "add-duty": { creates: "duty" }, "add-practice": { creates: "practice" } },
  connections,
  ...more,
});

const weekly = (extra: Record<string, unknown> = {}) => ({
  system: "google-calendar",
  calendar: "rota@example.com",
  kind: "duty",
  fields: { summary: "name", days: "days", start: "from", end: "to" },
  direction: "both",
  conflicts: "theirs",
  ...extra,
});

const practices = (extra: Record<string, unknown> = {}) => ({
  system: "google-calendar",
  calendar: "team@example.com",
  kind: "practice",
  fields: { summary: "name", start: "startsAt", end: "endsAt" },
  direction: "both",
  conflicts: "theirs",
  ...extra,
});

const errors = (raw: unknown) => compileDocument(raw).findings.filter((finding) => finding.severity === "error");
const codes = (raw: unknown) => errors(raw).map((finding) => `${finding.code} ${finding.path}`);

/* -------------------------------------------------- a scripted Google */

type Event = Record<string, unknown> & { id: string; etag: string; seq: number };

/** A Google calendar in memory: list with sync tokens, insert, patch, delete; a recurring event's rule kept as given. */
function google() {
  const events = new Map<string, Event>();
  let seq = 0;
  let next = 0;
  const touch = (event: Record<string, unknown>) => {
    seq += 1;
    const stamped = { ...event, etag: `"e${seq}"`, seq } as Event;
    events.set(stamped.id, stamped);
    return stamped;
  };
  const merge = (into: Record<string, unknown>, patch: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(patch)) {
      into[key] = value && typeof value === "object" && !Array.isArray(value) && into[key] && typeof into[key] === "object" ? { ...(into[key] as object), ...(value as object) } : value;
    }
    return into;
  };
  const answer = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body });
  const fetch: Fetcher = async (url, init) => {
    const at = new URL(url);
    const id = decodeURIComponent(at.pathname.split("/events")[1]?.slice(1) ?? "");
    const method = init?.method ?? "GET";
    if (method === "GET") {
      const since = Number(at.searchParams.get("syncToken") ?? "0");
      const items = [...events.values()].filter((event) => event.seq > since).map(({ seq: _seq, ...event }) => event);
      return answer(200, { items, nextSyncToken: String(seq) });
    }
    if (method === "POST") {
      next += 1;
      const { seq: _seq, ...made } = touch({ id: `evt${next}`, ...(JSON.parse(init!.body!) as object) });
      return answer(200, made);
    }
    const was = events.get(id);
    if (!was) return answer(404, {});
    if (method === "DELETE") {
      touch({ ...was, status: "cancelled" });
      return answer(204);
    }
    const { seq: _seq, ...patched } = touch(merge({ ...was }, JSON.parse(init!.body!) as Record<string, unknown>));
    return answer(200, patched);
  };
  return {
    fetch,
    events,
    add: (event: Record<string, unknown>) => touch({ id: `g${(next += 1)}`, ...event }),
    live: () => [...events.values()].filter((event) => event.status !== "cancelled"),
  };
}

function opened(name: string, declared: Record<string, unknown>) {
  const compiled = compileDocument(rota({ [name]: declared }));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] }, timeZone: ZONE });
  const remote = google();
  // The clock the first week of a weekly series is read from: the Monday the test's days are counted from, at noon there.
  const now = () => new Date(instantIn(MONDAY, 12 * 60, ZONE));
  const made = connection({ name, declaration: app.connections![name]!, app, store, calendarId: String(declared["calendar"]), token: () => "t", fetch: remote.fetch, now });
  const nodes = () => store.graph.allNodes().filter((node) => node.kind === declared["kind"]) as unknown as Record<string, unknown>[];
  const as = (who: string) => ({ author: { kind: "human" as const, id: who }, intent: "by hand" });
  return { app, store, remote, engine: made.engine, nodes, as };
}

/** An instant's wall time in the app's zone, as "YYYY-MM-DD HH:MM". */
const wall = (value: unknown) => {
  const at = wallIn(Date.parse(String(value)), ZONE);
  return `${at.day} ${String(Math.floor(at.minutes / 60)).padStart(2, "0")}:${String(at.minutes % 60).padStart(2, "0")}`;
};
const iso = (day: string, minutes: number) => new Date(instantIn(day, minutes, ZONE)).toISOString().replace(/\.000Z$/, "Z");

describe("graview check judges a weekly connection", () => {
  it("passes weekdays and times of day, and a date that repeats", () => {
    expect(codes(rota({ rota: weekly() }))).toEqual([]);
    expect(codes(rota({ team: practices() }))).toEqual([]);
    // An enum of weekdays, one a record, is a weekday set of one.
    expect(codes(rota({ rota: weekly({ fields: { summary: "name", days: "day", start: "from", end: "to" } }) }, { kinds: { ...rota({}).kinds, duty: { fields: { ...rota({}).kinds.duty.fields, day: { type: "enum", options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] } } } } }))).toEqual([]);
  });

  it("refuses weekdays that are not a choice of weekday, and times that are not words", () => {
    const where = rota({ rota: weekly({ fields: { summary: "name", days: "driver", start: "from", end: "to" } }) }, { kinds: { ...rota({}).kinds, duty: { fields: { ...rota({}).kinds.duty.fields, driver: { type: "enum", options: ["Ana", "Ben"] } } } } });
    expect(codes(where)).toEqual(["connection-field-type connections.rota.fields.days"]);
    expect(errors(where)[0]!.message).toBe("the weekdays a duty falls on are a choice of weekday, or a list of them, and driver's choices (Ana, Ben) are not weekdays");
    const timed = rota({ rota: weekly({ fields: { summary: "name", days: "days", start: "from", end: "to" } }) }, { kinds: { ...rota({}).kinds, duty: { fields: { ...rota({}).kinds.duty.fields, from: { type: "datetime" } } } } });
    expect(codes(timed)).toEqual(["connection-field-type connections.rota.fields.start"]);
    expect(errors(timed)[0]!.message).toBe('with days mapped, the event\'s start is a time of day like "09:00", and from is a datetime field');
  });
});

describe("weekdays and times of day", () => {
  it("makes ten weekly duties ten recurring events in the app's time zone, and a change to one moves only it", async () => {
    const { remote, engine, store, as } = opened("rota", weekly());
    const sets = [["mon", "wed"], ["tue"], ["thu", "fri"], ["sat"], ["sun"], ["mon"], ["wed", "fri"], ["tue", "thu"], ["mon", "tue", "wed"], ["fri"]];
    sets.forEach((days, n) => store.apply({ name: "add-duty", args: { id: `duty:${n}`, name: `Duty ${n}`, days, from: "09:00", to: "10:30", driver: "Ana" } }, as("nick")));
    const first = await engine.run();
    expect(first.pushed).toHaveLength(10);
    expect(remote.live()).toHaveLength(10);
    for (const [n, days] of sets.entries()) {
      const event = remote.live().find((one) => one["summary"] === `Duty ${n}`)!;
      expect(event["recurrence"]).toEqual([`RRULE:FREQ=WEEKLY;BYDAY=${days.map((day) => day.slice(0, 2).toUpperCase()).join(",")}`]);
      // The first occurrence is the first of its weekdays from the week the series was first sent, at the time of day on the app's wall.
      const start = wall((event["start"] as { dateTime: string }).dateTime);
      expect(start.endsWith(" 09:00")).toBe(true);
      expect(days).toContain(["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${start.slice(0, 10)}T12:00:00Z`).getUTCDay()]);
      expect(wall((event["end"] as { dateTime: string }).dateTime)).toBe(`${start.slice(0, 10)} 10:30`);
      expect(event["start"]).toMatchObject({ timeZone: ZONE });
    }
    // The echo of its own writes is no news.
    const quiet = await engine.run();
    expect(quiet.pushed).toEqual([]);
    expect(quiet.applied).toEqual([]);

    const before = new Map(remote.live().map((one) => [one["summary"], one["etag"]]));
    store.apply({ name: "edit-duty", args: { id: "duty:3", to: "12:00" } }, as("nick"));
    const moved = await engine.run();
    expect(moved.pushed).toEqual(["duty:3"]);
    for (const event of remote.live()) expect(event["etag"] === before.get(event["summary"]), String(event["summary"])).toBe(event["summary"] !== "Duty 3");
    const third = remote.live().find((one) => one["summary"] === "Duty 3")!;
    expect(wall((third["end"] as { dateTime: string }).dateTime).endsWith(" 12:00")).toBe(true);

    // A driver is the app's own: changing one sends nothing.
    store.apply({ name: "edit-duty", args: { id: "duty:4", driver: "Ben" } }, as("nick"));
    expect((await engine.run()).pushed).toEqual([]);
  });

  it("takes a recurring event made in the calendar as one duty, and leaves one week's exception and a one-off alone", async () => {
    const { remote, engine, nodes } = opened("rota", weekly());
    remote.add({ summary: "Wash", start: { dateTime: iso("2026-11-06", 7 * 60), timeZone: ZONE }, end: { dateTime: iso("2026-11-06", 8 * 60), timeZone: ZONE }, recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=FR"] });
    remote.add({ summary: "Wash", recurringEventId: "g1", originalStartTime: { dateTime: iso("2026-11-13", 7 * 60) }, start: { dateTime: iso("2026-11-13", 9 * 60) }, end: { dateTime: iso("2026-11-13", 10 * 60) } });
    remote.add({ summary: "Dentist", start: { dateTime: iso("2026-11-04", 11 * 60) }, end: { dateTime: iso("2026-11-04", 12 * 60) } });
    await engine.run();
    expect(nodes().map((node) => [node["name"], node["days"], node["from"], node["to"]])).toEqual([["Wash", ["fri"], "07:00", "08:00"]]);
  });
});

describe("a date that repeats", () => {
  it("sends the series as one event with its rule and its exceptions, and a day changed apart as an EXDATE and an event of its own", async () => {
    const { remote, engine, store, as } = opened("team", practices());
    // Made, then given its repeat through its edit, as the form does: the act that makes one does not take it.
    store.apply({ name: "add-practice", args: { id: "practice:tue", name: "Practice", startsAt: "2026-10-20T18:00", endsAt: "2026-10-20T19:30" } }, as("nick"));
    store.apply({ name: "edit-practice", args: { id: "practice:tue", startsAtRepeat: { every: "week", on: ["tue", "thu"], except: ["2026-10-22"] } } }, as("nick"));
    await engine.run();
    const [series] = remote.live();
    expect(series!["start"]).toEqual({ dateTime: iso("2026-10-20", 18 * 60), timeZone: ZONE });
    expect(series!["end"]).toEqual({ dateTime: iso("2026-10-20", 19 * 60 + 30), timeZone: ZONE });
    expect(series!["recurrence"]).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=TU,TH", `EXDATE;TZID=${ZONE}:20261022T180000`]);
    expect((await engine.run()).pushed).toEqual([]);

    store.apply({ name: "detach-practice", args: { id: "practice:tue", on: "2026-10-27", name: "Practice (away)" } }, as("nick"));
    const sent = await engine.run();
    expect(sent.pushed).toHaveLength(2);
    const again = remote.live().find((one) => one["summary"] === "Practice")!;
    expect(again["recurrence"]).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=TU,TH", `EXDATE;TZID=${ZONE}:20261022T180000`, `EXDATE;TZID=${ZONE}:20261027T180000`]);
    const away = remote.live().find((one) => one["summary"] === "Practice (away)")!;
    expect(away["recurrence"]).toBeUndefined();
    expect(away["start"]).toEqual({ dateTime: iso("2026-10-27", 18 * 60), timeZone: ZONE });
  });

  it("takes a recurring event made in the calendar as a date that repeats", async () => {
    const { remote, engine, nodes } = opened("team", practices());
    remote.add({ summary: "Scrimmage", start: { dateTime: iso("2026-11-07", 10 * 60), timeZone: ZONE }, end: { dateTime: iso("2026-11-07", 12 * 60), timeZone: ZONE }, recurrence: ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SA;UNTIL=20261231T045959Z", `EXDATE;TZID=${ZONE}:20261121T100000`] });
    await engine.run();
    expect(nodes().map((node) => [node["name"], node["startsAt"], node["endsAt"], node["startsAtRepeat"]])).toEqual([["Scrimmage", "2026-11-07T10:00", "2026-11-07T12:00", { every: "week", interval: 2, on: ["sat"], until: "2026-12-30", except: ["2026-11-21"] }]]);
  });
});
