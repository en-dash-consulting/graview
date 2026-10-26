import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { connection, type Fetcher } from "../../src/sync/index.js";

/**
 * A CONNECTION DECLARED IN THE APP (`connections.<name>`): judged by the
 * checker, and run against a scripted Google calendar — each filter (the
 * whole calendar, one color, a title tag) and both directions (read only,
 * and both ways).
 */

const meetings = (connections: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Meetings",
  kinds: {
    meeting: {
      fields: {
        name: { type: "string", required: true },
        starts: { type: "datetime" },
        ends: { type: "datetime" },
        where: { type: "string" },
      },
    },
    offsite: {
      fields: { name: { type: "string", required: true }, from: { type: "date" }, to: { type: "date" } },
    },
  },
  acts: {
    "add-meeting": { creates: "meeting" },
    "add-offsite": { creates: "offsite" },
  },
  connections,
  ...more,
});

const calendar = (extra: Record<string, unknown> = {}) => ({
  system: "google-calendar",
  calendar: { env: "TEAM_CALENDAR" },
  kind: "meeting",
  fields: { summary: "name", start: "starts", end: "ends", location: "where" },
  direction: "both",
  conflicts: "theirs",
  ...extra,
});

const codes = (raw: unknown) => {
  const compiled = compileDocument(raw);
  return compiled.findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.code} ${finding.path}`);
};

describe("graview check judges a declared connection", () => {
  it("passes a calendar of meetings, both ways, with the whole calendar", () => {
    expect(codes(meetings({ team: calendar() }))).toEqual([]);
  });

  it("says each wrong shape at its place", () => {
    expect(codes(meetings({ team: calendar({ system: "outlook" }) }))).toContain("shape connections.team.system");
    expect(codes(meetings({ team: calendar({ direction: "sideways" }) }))).toContain("shape connections.team.direction");
    expect(codes(meetings({ team: calendar({ conflicts: "loudest" }) }))).toContain("shape connections.team.conflicts");
    expect(codes(meetings({ team: calendar({ secret: "x" }) }))).toContain("unknown-key connections.team");
    expect(codes(meetings({ team: calendar({ auth: { env: "google" } }) }))).toContain("shape connections.team.auth.env");
    expect(codes(meetings({ Team: calendar() }))[0]).toMatch(/^shape connections/);
  });

  it("says a kind, a field or a type the calendar cannot use", () => {
    expect(codes(meetings({ team: calendar({ kind: "lunch" }) }))).toEqual(["connection-kind connections.team.kind"]);
    expect(codes(meetings({ team: calendar({ fields: { summary: "name", start: "starts", end: "finish" } }) }))).toEqual(["connection-field connections.team.fields.end"]);
    expect(codes(meetings({ team: calendar({ fields: { summary: "starts", start: "starts", end: "ends" } }) }))).toEqual([
      "connection-field-type connections.team.fields.summary",
      "connection-field connections.team.fields.start",
      // No field holds the event's title, and a meeting is made with its name.
      "connection-creates connections.team.kind",
    ]);
    expect(codes(meetings({ team: calendar({ fields: { summary: "name", start: "name", end: "ends" } }) }))).toContain("connection-field-type connections.team.fields.start");
  });

  it("says a filter that is not one color Google names or one tag", () => {
    expect(codes(meetings({ team: calendar({ filter: { color: "Basil" } }) }))).toEqual([]);
    expect(codes(meetings({ team: calendar({ filter: { tag: "#graview" } }) }))).toEqual([]);
    expect(codes(meetings({ team: calendar({ filter: { color: "Mauve" } }) }))).toEqual(["connection-color connections.team.filter.color"]);
    expect(codes(meetings({ team: calendar({ filter: { tag: "graview" } }) }))).toEqual(["connection-tag connections.team.filter.tag"]);
    expect(codes(meetings({ team: calendar({ filter: { color: "Basil", tag: "#graview" } }) }))).toEqual(["connection-filter connections.team.filter"]);
    expect(codes(meetings({ team: calendar({ filter: {} }) }))).toEqual(["connection-filter connections.team.filter"]);
    expect(codes(meetings({ team: calendar({ filter: { color: "Basil", keep: true } }) }))).toEqual(["connection-filter connections.team.filter.keep"]);
  });

  it("says when the acts an inbound change lands through are missing", () => {
    const raw = meetings({ team: calendar() });
    delete (raw.acts as Record<string, unknown>)["add-meeting"];
    expect(codes(raw)).toContain("connection-creates connections.team.kind");
    // A field another act writes is still written by the derived edit, which keeps every field a connection maps.
    const written = meetings({ team: calendar() }, { acts: { "add-meeting": { creates: "meeting" }, "add-offsite": { creates: "offsite" }, reschedule: { on: "meeting", writes: ["starts"] } } });
    expect(codes(written)).toEqual([]);
    // The app's own edit-meeting is held to every field the calendar maps.
    const own = meetings({ team: calendar() }, { acts: { "add-meeting": { creates: "meeting" }, "add-offsite": { creates: "offsite" }, "edit-meeting": { on: "meeting", writes: ["name"] } } });
    expect(codes(own)).toEqual(["connection-edit connections.team.fields"]);
  });

  it("carries the connection on the compiled app, for a host to run", () => {
    const compiled = compileDocument(meetings({ team: calendar({ filter: { tag: "#graview" } }) }));
    const team = compiled.ok ? compiled.app.connections?.["team"] : undefined;
    expect(team?.system === "google-calendar" && team.filter).toEqual({ tag: "#graview" });
  });
});

/* -------------------------------------------------- a scripted Google */

type Event = Record<string, unknown> & { id: string; etag: string; seq: number };

/** A Google calendar in memory: list with sync tokens and pages, insert, patch, delete. */
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
    /** Somebody in Google Calendar adds or changes an event. */
    add: (event: Record<string, unknown>) => touch({ id: `g${(next += 1)}`, ...event }),
    change: (id: string, patch: Record<string, unknown>) => touch(merge({ ...events.get(id)! }, patch)),
    live: () => [...events.values()].filter((event) => event.status !== "cancelled"),
  };
}

function opened(declared: Record<string, unknown>, more: Record<string, unknown> = {}) {
  const compiled = compileDocument(meetings({ team: declared }, more));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } });
  const remote = google();
  const made = connection({ name: "team", declaration: app.connections!["team"]!, app, store, calendarId: "team@example.com", token: () => "t", fetch: remote.fetch });
  const nodes = () => store.graph.allNodes().filter((node) => node.kind === declared["kind"]) as unknown as Record<string, unknown>[];
  const as = (who: string) => ({ author: { kind: "human" as const, id: who }, intent: "by hand" });
  return { app, store, remote, engine: made.engine, nodes, as };
}

const at = (hour: number) => `2026-11-02T${String(hour).padStart(2, "0")}:00:00Z`;

describe("the whole calendar, both ways", () => {
  it("takes every event, sends a meeting made here, and credits the calendar's changes to it", async () => {
    const { remote, engine, nodes, store, as } = opened(calendar());
    remote.add({ summary: "Standup", start: { dateTime: "2026-11-02T10:00:00-05:00" }, end: { dateTime: "2026-11-02T10:30:00-05:00" } });
    remote.add({ summary: "Retro", colorId: "10", start: { dateTime: at(18) }, end: { dateTime: at(19) } });
    await engine.run();
    expect(nodes().map((node) => [node["name"], node["starts"]])).toEqual([["Standup", at(15)], ["Retro", at(18)]]);
    expect(store.log.all().at(-1)!.author).toEqual({ kind: "system", id: "google-calendar" });

    store.apply({ name: "add-meeting", args: { id: "meeting:plan", name: "Planning", starts: at(20), ends: at(21) } }, as("nick"));
    const sent = await engine.run();
    expect(sent.pushed).toEqual(["meeting:plan"]);
    const there = remote.live().find((event) => event["summary"] === "Planning")!;
    expect(there["start"]).toEqual({ dateTime: at(20) });
    // Made here, and said so in Google: a private property naming the app.
    expect(there["extendedProperties"]).toEqual({ private: { graview: "Meetings" } });
  });
});

describe("one color", () => {
  it("keeps the events of that color, gives one made here the color, and lets one that changes color go", async () => {
    const { remote, engine, nodes, store, as } = opened(calendar({ filter: { color: "Basil" } }));
    const basil = remote.add({ summary: "Garden", colorId: "10", start: { dateTime: at(9) }, end: { dateTime: at(10) } });
    remote.add({ summary: "Dentist", colorId: "11", start: { dateTime: at(11) }, end: { dateTime: at(12) } });
    remote.add({ summary: "Default color", start: { dateTime: at(13) }, end: { dateTime: at(14) } });
    await engine.run();
    expect(nodes().map((node) => node["name"])).toEqual(["Garden"]);

    store.apply({ name: "add-meeting", args: { id: "meeting:seeds", name: "Seeds", starts: at(15), ends: at(16) } }, as("nick"));
    await engine.run();
    expect(remote.live().find((event) => event["summary"] === "Seeds")!["colorId"]).toBe("10");
    // Its own write comes back in the filter, as an echo, not as a second Seeds.
    await engine.run();
    expect(nodes().map((node) => node["name"]).sort()).toEqual(["Garden", "Seeds"]);

    // Recolored in Google: out of the filter, so gone here.
    remote.change(basil.id, { colorId: "4" });
    const report = await engine.run();
    expect(report.gone).toHaveLength(1);
    expect(nodes().map((node) => node["name"])).toEqual(["Seeds"]);
  });
});

describe("a title tag", () => {
  it("keeps the tagged events, strips the tag here, and puts it back on the way out", async () => {
    const { remote, engine, nodes, store, as } = opened(calendar({ filter: { tag: "#graview" } }));
    remote.add({ summary: "Review #graview", start: { dateTime: at(9) }, end: { dateTime: at(10) } });
    remote.add({ summary: "Lunch", start: { dateTime: at(12) }, end: { dateTime: at(13) } });
    remote.add({ summary: "#Graview kickoff", start: { dateTime: at(14) }, end: { dateTime: at(15) } });
    await engine.run();
    expect(nodes().map((node) => node["name"]).sort()).toEqual(["Review", "kickoff"]);

    store.apply({ name: "add-meeting", args: { id: "meeting:demo", name: "Demo", starts: at(16), ends: at(17) } }, as("nick"));
    await engine.run();
    expect(remote.live().map((event) => event["summary"])).toContain("Demo #graview");
    const quiet = await engine.run();
    expect(quiet.applied).toEqual([]);
    expect(nodes().find((node) => node["id"] === "meeting:demo")!["name"]).toBe("Demo");
  });

  it("keeps the tag in the name when the declaration says keep", async () => {
    const { remote, engine, nodes } = opened(calendar({ filter: { tag: "#graview", keep: true } }));
    remote.add({ summary: "Review #graview", start: { dateTime: at(9) }, end: { dateTime: at(10) } });
    await engine.run();
    expect(nodes().map((node) => node["name"])).toEqual(["Review #graview"]);
  });
});

describe("read only", () => {
  it("takes the calendar's events and refuses an act here that would change one, saying where to change it", async () => {
    const { remote, engine, nodes, store, as } = opened(calendar({ direction: "read" }));
    remote.add({ summary: "Board", start: { dateTime: at(9) }, end: { dateTime: at(10) } });
    await engine.run();
    const [board] = nodes();
    expect(board!["name"]).toBe("Board");
    expect(() => store.apply({ name: "edit-meeting", args: { id: board!["id"], name: "Bored" } }, as("nick"))).toThrow(/comes from a Google calendar this app only reads/);
    expect(() => store.apply({ name: "add-meeting", args: { id: "meeting:x", name: "Mine" } }, as("nick"))).toThrow(/only reads/);
    const report = await engine.run();
    expect(report.pushed).toEqual([]);
    expect(remote.live().map((event) => event["summary"])).toEqual(["Board"]);
  });
});

describe("read only, under a declared policy (FR-181)", () => {
  const policed = { roles: ["member"], policy: { grants: [{ roles: ["member"], mutations: "*" }] } };

  it("lands the calendar's new event and its edit, authored by the calendar, while a person's act on one is still refused", async () => {
    const { remote, engine, nodes, store, as } = opened(calendar({ direction: "read" }), policed);
    const board = remote.add({ summary: "Board", start: { dateTime: at(9) }, end: { dateTime: at(10) } });
    const first = await engine.run();
    expect([first.offline, first.refused]).toEqual([false, []]);
    expect(nodes().map((node) => node["name"])).toEqual(["Board"]);
    expect(store.log.all().at(-1)!.author).toEqual({ kind: "system", id: "google-calendar" });

    remote.change(board.id, { summary: "Board meeting" });
    const second = await engine.run();
    expect([second.offline, second.refused, second.applied]).toEqual([false, [], [nodes()[0]!["id"]]]);
    expect(nodes().map((node) => node["name"])).toEqual(["Board meeting"]);

    const member = { author: { kind: "human" as const, id: "nick", roles: ["member"] }, intent: "by hand" };
    expect(() => store.apply({ name: "edit-meeting", args: { id: nodes()[0]!["id"], name: "Bored" } }, member)).toThrow(/only reads/);
    expect(store.permits({ name: "add-meeting", args: { id: "meeting:x", name: "Mine" } }, member.author).ok).toBe(false);
    expect(store.permits({ name: "add-meeting", args: { id: "meeting:x", name: "Mine" } }, { kind: "system", id: "google-calendar" }).ok).toBe(true);
    void as;
  });

  it("says an inbound change the store refused as refused, not as a calendar it could not reach", async () => {
    const { remote, engine, nodes, store } = opened(calendar({ direction: "read" }), policed);
    remote.add({ summary: "Board", start: { dateTime: at(9) }, end: { dateTime: at(10) } });
    // Something other than the connection's own guard says no: here, a host's own admit on every change.
    const applyAll = store.applyAll.bind(store);
    store.applyAll = (calls, options = {}) =>
      applyAll(calls, { ...options, admit: () => { throw new Error("Nothing lands while the host is read only."); } });
    const report = await engine.run();
    expect(report.offline).toBe(false);
    expect(report.refused).toEqual([{ localId: expect.stringMatching(/^meeting:team-/), resource: "events", id: expect.any(String), error: "Nothing lands while the host is read only." }]);
    expect(nodes()).toEqual([]);
  });
});

describe("an all-day kind", () => {
  it("reads a date field as the event's day, its end day inclusive here and exclusive at Google", async () => {
    const declared = { ...calendar(), kind: "offsite", fields: { summary: "name", start: "from", end: "to" } };
    const { remote, engine, nodes, store, as } = opened(declared);
    remote.add({ summary: "Retreat", start: { date: "2026-11-05" }, end: { date: "2026-11-07" } });
    remote.add({ summary: "A timed one", start: { dateTime: at(9) }, end: { dateTime: at(10) } });
    await engine.run();
    expect(nodes().map((node) => [node["name"], node["from"], node["to"]])).toEqual([["Retreat", "2026-11-05", "2026-11-06"]]);

    store.apply({ name: "add-offsite", args: { id: "offsite:fair", name: "Fair", from: "2026-11-09", to: "2026-11-09" } }, as("nick"));
    await engine.run();
    const fair = remote.live().find((event) => event["summary"] === "Fair")!;
    expect([fair["start"], fair["end"]]).toEqual([{ date: "2026-11-09" }, { date: "2026-11-10" }]);
  });
});
