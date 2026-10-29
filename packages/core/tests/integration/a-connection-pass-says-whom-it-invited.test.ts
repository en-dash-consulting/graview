import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { historyInWords, restoreBatches, ticksOf } from "../../src/history.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { connection, connectionStatus, guestsOf, type Fetcher, type SyncReport } from "../../src/sync/index.js";

/**
 * A CONNECTION PASS SAYS WHOM IT INVITED (Roadmap
 * f-sync-guest-changes-in-history, request:connection-guests-cap-in-declaration,
 * request:read-an-events-guests-back): the report counts the guests each
 * write that reached Google invited and took off, the app's history keeps a
 * line credited to the calendar, a refused write invites nobody and is said
 * once, a declared `max` holds an event unsent, and a host reads back what
 * was sent from the kept state alone.
 */

const home = (guests: Record<string, unknown>) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Home",
  kinds: {
    person: { fields: { name: { type: "string", required: true }, emails: { type: "list", of: "string" }, inviteMe: { type: "boolean" } } },
    event: { fields: { name: { type: "string", required: true }, starts: { type: "datetime" }, ends: { type: "datetime" } }, edges: { who: { to: ["person"] } } },
  },
  acts: { "add-person": { creates: "person" }, "add-event": { creates: "event" } },
  connections: {
    cal: { system: "google-calendar", calendar: "home@example.com", kind: "event", fields: { summary: "name", start: "starts", end: "ends", guests: { via: "who", ...guests } }, direction: "both", conflicts: "theirs" },
  },
});

type Event = Record<string, unknown> & { id: string; etag: string; seq: number };

/** Google in memory; `refuse` answers a write with a status and Google's own error body. */
function google() {
  const events = new Map<string, Event>();
  let seq = 0;
  let next = 0;
  let refusing: { status: number; message: string } | undefined;
  const touch = (event: Record<string, unknown>) => {
    seq += 1;
    const stamped = { ...event, etag: `"e${seq}"`, seq } as Event;
    events.set(stamped.id, stamped);
    return stamped;
  };
  const answer = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body });
  const fetch: Fetcher = async (url, init) => {
    const at = new URL(url);
    const id = decodeURIComponent(at.pathname.split("/events")[1]?.slice(1) ?? "");
    const method = init?.method ?? "GET";
    if (method === "GET") {
      const since = Number(at.searchParams.get("syncToken") ?? "0");
      return answer(200, { items: [...events.values()].filter((event) => event.seq > since).map(({ seq: _seq, ...event }) => event), nextSyncToken: String(seq) });
    }
    if (refusing) return answer(refusing.status, { error: { code: refusing.status, message: refusing.message } });
    if (method === "POST") {
      next += 1;
      const { seq: _seq, ...made } = touch({ id: `evt${next}`, ...(JSON.parse(init!.body!) as Record<string, unknown>) });
      return answer(200, made);
    }
    const was = events.get(id)!;
    if (method === "DELETE") {
      touch({ ...was, status: "cancelled" });
      return answer(204);
    }
    const { seq: _seq, ...patched } = touch({ ...was, ...(JSON.parse(init!.body!) as Record<string, unknown>) });
    return answer(200, patched);
  };
  return {
    fetch,
    refuse: (status: number, message: string) => void (refusing = { status, message }),
    accept: () => void (refusing = undefined),
    change: (id: string, fields: Record<string, unknown>) => touch({ ...events.get(id)!, ...fields }),
    invited: (id: string) => (((events.get(id)?.["attendees"] as { email: string }[] | undefined) ?? []).map((one) => one.email)).sort(),
  };
}

function opened(guests: Record<string, unknown> = {}) {
  const compiled = compileDocument(home(guests));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const remote = google();
  const now = () => new Date("2026-10-28T09:00:00Z");
  const declaration = app.connections!["cal"]!;
  const made = connection({ name: "cal", declaration, app, store, calendarId: "home@example.com", token: () => "t", fetch: remote.fetch, now });
  const act = (name: string, args: Record<string, unknown>) => store.apply({ name, args }, { author: { kind: "human", id: "nick" }, intent: "by hand" });
  const pass = async (): Promise<SyncReport> => {
    const report = await made.engine.run();
    if (report.offline) throw new Error(report.problem);
    return report;
  };
  const person = (id: string, name: string, emails: string[], inviteMe = true) => act("add-person", { id, name, emails, inviteMe });
  const event = (id: string, name: string) => act("add-event", { id, name, starts: "2026-11-02T15:00:00Z", ends: "2026-11-02T16:00:00Z" });
  const invite = (id: string, to: string) => act("connect-event-who", { id, to });
  const lines = () => store.log.all().filter((op) => op.sentOut !== undefined);
  const eventOf = (localId: string) => made.engine.snapshot.links[localId]!.id;
  return { app, store, remote, engine: made.engine, declaration, act, pass, person, event, invite, lines, eventOf };
}

describe("a pass that invites somebody says so in the report and the app's history", () => {
  it("leaves a line credited to Google Calendar, beside the person's own change, and counts it", async () => {
    const { pass, person, event, invite, store, lines, remote, eventOf } = opened();
    person("person:ada", "Ada", ["ada@example.com", "Ada.L@example.com"]);
    event("event:run", "Long run");
    invite("event:run", "person:ada");
    const report = await pass();
    expect(report.guests).toEqual([{ localId: "event:run", invited: ["ada.l@example.com", "ada@example.com"], removed: [] }]);
    expect(remote.invited(eventOf("event:run"))).toEqual(["ada.l@example.com", "ada@example.com"]);
    const [line] = lines();
    expect(line).toMatchObject({ author: { kind: "system", id: "google-calendar", name: "Google Calendar" }, intent: "Invited Ada to Long run", primitives: [], reads: [], writes: [], sentOut: { invited: 2, removed: 0 } });
    // Its sentence reads the event, the guests, and Ada's addresses: a seat that may not see one is served it withheld.
    expect(line!.described).toEqual(["event:run", "event:run#who", "person:ada", "person:ada#emails"]);
    expect(historyInWords(store)[0]!.sentence).toBe("Google Calendar: Invited Ada to Long run");
    expect(ticksOf(store).at(-1)).toMatchObject({ maker: "app", said: "Invited Ada to Long run" });
    // Nothing changed since: no write, no line.
    const again = await pass();
    expect(again.guests).toBeUndefined();
    expect(lines()).toHaveLength(1);
  });

  it("says who it took off, and an address nobody here holds by the address", async () => {
    const { pass, person, event, invite, act, lines, remote, eventOf } = opened();
    person("person:bo", "Bo", ["bo@example.com"]);
    event("event:run", "Long run");
    invite("event:run", "person:bo");
    await pass();
    remote.change(eventOf("event:run"), { attendees: [{ email: "bo@example.com" }, { email: "stranger@example.com" }] });
    await pass();
    act("disconnect-event-who", { id: "event:run", to: "person:bo" });
    const report = await pass();
    expect(report.guests).toEqual([{ localId: "event:run", invited: [], removed: ["bo@example.com"] }]);
    expect(lines().at(-1)!.intent).toBe("Took Bo off Long run");
    expect(remote.invited(eventOf("event:run"))).toEqual(["stranger@example.com"]);
  });

  it("says a pass over several events in one line: Invited 2 people to 3 events", async () => {
    const { pass, person, event, invite, store, lines } = opened();
    person("person:ada", "Ada", ["ada@example.com"]);
    person("person:ben", "Ben", ["ben@example.com"]);
    for (const [id, name] of [["event:a", "Run"], ["event:b", "Swim"], ["event:c", "Ride"]] as const) {
      event(id, name);
      invite(id, "person:ada");
    }
    invite("event:c", "person:ben");
    const report = await pass();
    expect(report.guests?.map((one) => one.localId).sort()).toEqual(["event:a", "event:b", "event:c"]);
    expect(lines().map((op) => op.intent).sort()).toEqual(["Invited Ada and Ben to Ride", "Invited Ada to Run", "Invited Ada to Swim"]);
    expect(new Set(lines().map((op) => op.batch)).size).toBe(1);
    expect(store.batches().at(-1)!.intent).toBe("Invited 2 people to 3 events");
  });

  it("says who the event reaches and left out, and why", async () => {
    const { pass, person, event, invite } = opened();
    person("person:ada", "Ada", ["ada@example.com"]);
    person("person:kid", "Kid", ["kid@example.com"], false);
    person("person:gran", "Gran", []);
    event("event:run", "Long run");
    for (const who of ["person:ada", "person:kid", "person:gran"]) invite("event:run", who);
    const report = await pass();
    const [change] = report.guests!;
    expect(change).toMatchObject({ localId: "event:run", invited: ["ada@example.com"], removed: [] });
    expect([...change!.leftOut!].sort((a, b) => a.person!.localeCompare(b.person!))).toEqual([
      { person: "person:gran", why: "no-address" },
      { person: "person:kid", why: "invite-off" },
    ]);
  });
});

describe("a write that did not go invited nobody", () => {
  it("passes Google's own message into the refusal, says it once in the history, and counts nothing", async () => {
    const { pass, person, event, invite, remote, lines, engine, declaration } = opened();
    person("person:ada", "Ada", ["ada@example.com"]);
    event("event:run", "Long run");
    await pass();
    invite("event:run", "person:ada");
    remote.refuse(400, "Too many attendees");
    const first = await pass();
    expect(first.guests).toBeUndefined();
    expect(first.refused).toEqual([{ localId: "event:run", error: "google-calendar: HTTP 400: Too many attendees" }]);
    expect(lines().map((op) => [op.intent, op.sentOut])).toEqual([["Did not invite Ada to Long run: google-calendar: HTTP 400: Too many attendees", { invited: 1, removed: 0, refused: true }]]);
    // The same write refused for the same reason again is not said again.
    await pass();
    expect(lines()).toHaveLength(1);
    expect(guestsOf(engine.snapshot, declaration, "event:run")!.refused).toEqual({ addresses: ["ada@example.com"], error: "google-calendar: HTTP 400: Too many attendees", at: "2026-10-28T09:00:00.000Z" });
    remote.accept();
    const sent = await pass();
    expect(sent.guests).toEqual([{ localId: "event:run", invited: ["ada@example.com"], removed: [] }]);
    expect(guestsOf(engine.snapshot, declaration, "event:run")!.refused).toBeUndefined();
  });
});

describe("a connection's guests are capped by its declaration", () => {
  it("holds an event that would invite past max unsent, and says it in words", async () => {
    const { pass, person, event, invite, remote, lines, eventOf, store } = opened({ max: 2 });
    for (const name of ["ada", "ben", "cat"]) person(`person:${name}`, name[0]!.toUpperCase() + name.slice(1), [`${name}@example.com`]);
    event("event:dinner", "Dinner");
    invite("event:dinner", "person:ada");
    await pass();
    store.apply({ name: "edit-event", args: { id: "event:dinner", name: "Dinner, moved" } }, { author: { kind: "human", id: "nick" }, intent: "by hand" });
    invite("event:dinner", "person:ben");
    invite("event:dinner", "person:cat");
    const held = await pass();
    expect(held.refused).toEqual([{ localId: "event:dinner", error: "Dinner, moved has 3 guests; this connection invites at most 2" }]);
    expect(held.pushed).toEqual([]);
    expect(held.queued).toEqual([]);
    expect(held.guests).toBeUndefined();
    expect(remote.invited(eventOf("event:dinner"))).toEqual(["ada@example.com"]);
    expect(lines().at(-1)!.intent).toBe("Did not invite Ben and Cat to Dinner, moved: Dinner, moved has 3 guests; this connection invites at most 2");
    await pass();
    expect(lines().filter((op) => op.sentOut?.refused)).toHaveLength(1);
    // Back under it, it goes.
    store.apply({ name: "disconnect-event-who", args: { id: "event:dinner", to: "person:cat" } }, { author: { kind: "human", id: "nick" }, intent: "by hand" });
    const sent = await pass();
    expect(sent.pushed).toEqual(["event:dinner"]);
    expect(remote.invited(eventOf("event:dinner"))).toEqual(["ada@example.com", "ben@example.com"]);
  });

  it("is refused by graview check when it is not a whole number above 0", () => {
    const max = (value: unknown) => compileDocument(home({ max: value })).findings.filter((finding) => finding.code === "connection-guests-max").map((finding) => `${finding.severity} ${finding.path}: ${finding.message}`);
    expect(max(20)).toEqual([]);
    expect(max(0)).toEqual(["error connections.cal.fields.guests.max: max is the most guests one event invites, a whole number above 0, and it is 0"]);
    expect(max(-3)).toHaveLength(1);
    expect(max(2.5)).toHaveLength(1);
    expect(compileDocument(home({ max: "twenty" })).findings.map((finding) => finding.code)).toContain("shape");
  });
});

describe("a line of what went out is history, not a change", () => {
  it("is not undone, says why, stands in no other undo's way, and is not taken back by Restore to here", async () => {
    const { pass, person, event, invite, store, lines } = opened();
    person("person:ada", "Ada", ["ada@example.com"]);
    event("event:run", "Long run");
    const before = store.log.length;
    invite("event:run", "person:ada");
    const invited = store.batches().at(-1)!.id;
    await pass();
    const line = lines()[0]!;
    expect(store.canUndo(line.batch)).toMatchObject({ ok: false, message: "Nothing to take back: an invitation already went out. Change the guests here, and the next pass sends that." });
    expect(restoreBatches(store, before)).toEqual([invited]);
    // The line reads nothing, so the invitation itself is still taken back on its own; the next pass then takes Ada off.
    expect(store.canUndo(invited).ok).toBe(true);
  });
});

describe("a host reads back what a connection sent", () => {
  it("reads each event's guests, quiet or mailed, the addresses kept on pull, and the last pass", async () => {
    const { pass, person, event, invite, engine, declaration, remote, eventOf } = opened();
    person("person:ada", "Ada", ["ada@example.com"]);
    event("event:run", "Long run");
    invite("event:run", "person:ada");
    await pass();
    expect(guestsOf(engine.snapshot, declaration, "event:run")).toEqual({
      localId: "event:run",
      remoteId: eventOf("event:run"),
      attendees: ["ada@example.com"],
      unmatched: [],
      sent: { addresses: ["ada@example.com"], notified: false, at: "2026-10-28T09:00:00.000Z" },
    });
    remote.change(eventOf("event:run"), { attendees: [{ email: "ada@example.com" }, { email: "home@example.com", organizer: true }] });
    await pass();
    const read = guestsOf(engine.snapshot, declaration, "event:run")!;
    expect(read.attendees).toEqual(["ada@example.com", "home@example.com"]);
    expect(read.unmatched).toEqual(["home@example.com"]);
    const status = connectionStatus(engine.snapshot, declaration);
    expect(status).toMatchObject({ linked: 1, waiting: 0, conflicts: 0, lastPass: { at: "2026-10-28T09:00:00.000Z", offline: false, applied: 0, pushed: 0, refused: [], invited: 0, removed: 0 } });
    expect(status.guests.map((one) => one.localId)).toEqual(["event:run"]);
  });

  it("says a mailed write as notified", async () => {
    const { pass, person, event, invite, engine, declaration } = opened({ notify: true });
    person("person:ada", "Ada", ["ada@example.com"]);
    event("event:run", "Long run");
    invite("event:run", "person:ada");
    const report = await pass();
    expect(guestsOf(engine.snapshot, declaration, "event:run")!.sent!.notified).toBe(true);
    expect(connectionStatus(report.state, declaration).lastPass).toMatchObject({ pushed: 1, invited: 1 });
  });
});
