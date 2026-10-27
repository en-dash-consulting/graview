import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { editDocument } from "../../src/document/index.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { connection, connectionMapping, type Fetcher, type SyncReport } from "../../src/sync/index.js";

/**
 * CALENDAR EVENTS INVITE THE PEOPLE THEY ARE ABOUT (Roadmap
 * f-calendar-guests-mapping): a Google calendar connection's `guests` is a
 * field of addresses, or `{ via }`, the relation to the people — each
 * person's emails invited while their Invite me is on, kept as an edge the
 * engine compares, holds and links; an attendee matching nobody kept and
 * sent back as it was; nothing mailed unless `notify` says so.
 */

const home = (connections: Record<string, unknown>, more: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Home",
  kinds: {
    person: {
      fields: { name: { type: "string", required: true }, emails: { type: "list", of: "string" }, inviteMe: { type: "boolean" } },
    },
    event: {
      fields: { name: { type: "string", required: true }, starts: { type: "datetime" }, ends: { type: "datetime" }, guests: { type: "list", of: "string" }, host: { type: "email" } },
      edges: { who: { to: ["person"] } },
    },
  },
  acts: { "add-person": { creates: "person" }, "add-event": { creates: "event" } },
  connections,
  ...more,
});

const cal = (guests: unknown, extra: Record<string, unknown> = {}) => ({
  system: "google-calendar",
  calendar: "home@example.com",
  kind: "event",
  fields: { summary: "name", start: "starts", end: "ends", ...(guests === undefined ? {} : { guests }) },
  direction: "both",
  conflicts: "theirs",
  ...extra,
});

/** The kinds of `home`, with one of them changed. */
const kinds = (changes: Record<string, Record<string, unknown>>) => {
  const base = home({}).kinds as Record<string, Record<string, unknown>>;
  return Object.fromEntries(Object.entries(base).map(([kind, spec]) => [kind, { ...spec, ...(changes[kind] ?? {}) }]));
};

const findings = (raw: unknown, code: string) => compileDocument(raw).findings.filter((finding) => finding.code === code);
const said = (raw: unknown, code: string) => findings(raw, code).map((finding) => `${finding.severity} ${finding.path}: ${finding.message}`);
const errors = (raw: unknown) => compileDocument(raw).findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.code} ${finding.path}`);

/* -------------------------------------------------- a scripted Google */

type Event = Record<string, unknown> & { id: string; etag: string; seq: number };

/**
 * A Google calendar in memory: list with sync tokens, insert, patch and
 * delete, each write's `sendUpdates` kept. With `organizer`, every write
 * that says its attendees comes back with the calendar's owner among them,
 * as Google adds the organizer to an event with guests.
 */
function google(options: { organizer?: string } = {}) {
  const events = new Map<string, Event>();
  const sendUpdates: string[] = [];
  let seq = 0;
  let next = 0;
  const touch = (event: Record<string, unknown>) => {
    seq += 1;
    const stamped = { ...event, etag: `"e${seq}"`, seq } as Event;
    events.set(stamped.id, stamped);
    return stamped;
  };
  const hosted = (body: Record<string, unknown>) => {
    if (!options.organizer || !Array.isArray(body["attendees"])) return body;
    const attendees = body["attendees"] as { email: string }[];
    return attendees.some((one) => one.email === options.organizer) ? body : { ...body, attendees: [...attendees, { email: options.organizer, organizer: true, self: true, responseStatus: "accepted" }] };
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
    if (method !== "GET") sendUpdates.push(at.searchParams.get("sendUpdates") ?? "(unsaid)");
    if (method === "GET") {
      const since = Number(at.searchParams.get("syncToken") ?? "0");
      const items = [...events.values()].filter((event) => event.seq > since).map(({ seq: _seq, ...event }) => event);
      return answer(200, { items, nextSyncToken: String(seq) });
    }
    if (method === "POST") {
      next += 1;
      const { seq: _seq, ...made } = touch({ id: `evt${next}`, ...hosted(JSON.parse(init!.body!) as Record<string, unknown>) });
      return answer(200, made);
    }
    const was = events.get(id);
    if (!was) return answer(404, {});
    if (method === "DELETE") {
      touch({ ...was, status: "cancelled" });
      return answer(204);
    }
    const { seq: _seq, ...patched } = touch(merge({ ...was }, hosted(JSON.parse(init!.body!) as Record<string, unknown>)));
    return answer(200, patched);
  };
  return {
    fetch,
    events,
    sendUpdates,
    add: (event: Record<string, unknown>) => touch({ id: `g${(next += 1)}`, ...event }),
    /** Someone changes the event there: its fields, or its attendees whole. */
    change: (id: string, fields: Record<string, unknown>) => touch({ ...events.get(id)!, ...fields }),
    /** The addresses the event invites there, sorted. */
    invited: (id: string) => (((events.get(id)?.["attendees"] as { email: string }[] | undefined) ?? []).map((one) => one.email)).sort(),
  };
}

function opened(declared: Record<string, unknown>, options: { organizer?: string; more?: Record<string, unknown> } = {}) {
  const compiled = compileDocument(home({ cal: declared }, options.more));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: { nodes: [], edges: [] } });
  const remote = google(options.organizer ? { organizer: options.organizer } : {});
  const made = connection({ name: "cal", declaration: app.connections!["cal"]!, app, store, calendarId: "home@example.com", token: () => "t", fetch: remote.fetch });
  const as = { author: { kind: "human" as const, id: "nick" }, intent: "by hand" };
  const act = (name: string, args: Record<string, unknown>) => store.apply({ name, args }, as);
  const pass = async (): Promise<SyncReport> => {
    const report = await made.engine.run();
    if (report.offline) throw new Error(report.problem);
    return report;
  };
  const quiet = (report: SyncReport) => report.pushed.length === 0 && report.applied.length === 0 && report.refused.length === 0;
  const events = () => store.graph.allNodes().filter((node) => node.kind === "event") as unknown as Record<string, unknown>[];
  const who = (eventId: string) => store.graph.out(eventId, "who").map((node) => node.id).sort();
  const eventOf = (localId: string) => made.engine.snapshot.links[localId]!.id;
  const person = (id: string, name: string, emails: string[], inviteMe = true) => act("add-person", { id, name, emails, inviteMe });
  const event = (id: string, name: string) => act("add-event", { id, name, starts: "2026-11-02T15:00:00Z", ends: "2026-11-02T16:00:00Z" });
  return { app, store, remote, engine: made.engine, act, pass, quiet, events, who, eventOf, person, event };
}

/* ------------------------------------------------------- the declaration */

describe("graview check judges the guests of a calendar connection", () => {
  it("passes a field of addresses, an email field, and a relation to people with emails and Invite me", () => {
    expect(errors(home({ cal: cal("guests") }))).toEqual([]);
    expect(errors(home({ cal: cal("host") }))).toEqual([]);
    expect(errors(home({ cal: cal({ via: "who" }) }))).toEqual([]);
    expect(errors(home({ cal: cal({ via: "who", emails: "emails", invite: "inviteMe", notify: true }) }))).toEqual([]);
    // An app with no toggle says so, and every address is invited.
    expect(errors(home({ cal: cal({ via: "who", invite: false }) }, { kinds: kinds({ person: { fields: { name: { type: "string", required: true }, emails: { type: "list" } } } }) }))).toEqual([]);
  });

  it("refuses a shape that is neither, at its place", () => {
    expect(errors(home({ cal: cal(42) }))).toEqual(["shape connections.cal.fields.guests"]);
    expect(errors(home({ cal: cal({ via: "who", notify: "yes" }) }))).toEqual(["shape connections.cal.fields.guests"]);
    expect(errors(home({ cal: cal({ via: "who", bogus: 1 }) }))).toEqual(["unknown-key connections.cal.fields.guests"]);
  });

  it("says a field of addresses the kind lacks, and offers to add it", () => {
    const raw = home({ cal: cal("invitees") });
    expect(said(raw, "connection-guests-field")).toEqual(["error connections.cal.fields.guests: event has no field called invitees to hold the event's guests"]);
    const [fix] = findings(raw, "connection-guests-field")[0]!.fixes!;
    expect(fix).toEqual({ label: "Add Invitees to event", edits: [{ op: "add-field", kind: "event", field: "invitees", type: "list", of: "string" }] });
    const edited = editDocument(raw as never, fix!.edits as never);
    expect(edited.ok).toBe(true);
    expect(errors(edited.ok ? edited.document : raw)).toEqual([]);
  });

  it("refuses a field that holds no addresses, and a field already holding another part", () => {
    expect(said(home({ cal: cal("starts") }), "connection-guests-field")).toEqual(["error connections.cal.fields.guests: the event's guests are addresses, a list of them or one email, and starts is a datetime field"]);
    expect(errors(home({ cal: cal("name") }))).toEqual(["connection-field connections.cal.fields.guests", "connection-guests-field connections.cal.fields.guests"]);
  });

  it("refuses a relation the kind lacks, or one that reaches several kinds", () => {
    expect(said(home({ cal: cal({ via: "with" }) }), "connection-guests-via")).toEqual(["error connections.cal.fields.guests.via: event has no relation called with to reach the guests through"]);
    expect(findings(home({ cal: cal({ via: "with" }) }), "connection-guests-via")[0]!.fix).toBe("name one of who");
    const two = home({ cal: cal({ via: "who" }) }, { kinds: kinds({ event: { edges: { who: { to: ["person", "event"] } } } }) });
    expect(said(two, "connection-guests-via")).toEqual(["error connections.cal.fields.guests.via: who reaches person and event, and the guests are the people of one kind"]);
  });

  it("says a reached kind with nothing to invite, and offers to give it emails", () => {
    const raw = home({ cal: cal({ via: "who" }) }, { kinds: kinds({ person: { fields: { name: { type: "string", required: true }, inviteMe: { type: "boolean" } } } }) });
    expect(said(raw, "connection-guests-via")).toEqual(["error connections.cal.fields.guests.via: who reaches person, and a person has no emails to invite"]);
    const [fix] = findings(raw, "connection-guests-via")[0]!.fixes!;
    expect(fix).toEqual({ label: "Give Persons emails", edits: [{ op: "add-field", kind: "person", field: "emails", type: "list", of: "string" }] });
    const edited = editDocument(raw as never, fix!.edits as never);
    expect(edited.ok).toBe(true);
    expect(errors(edited.ok ? edited.document : raw)).toEqual([]);
    // Named, a missing field is the field's finding.
    const named = home({ cal: cal({ via: "who", emails: "mail" }) });
    expect(said(named, "connection-guests-field")).toEqual(["error connections.cal.fields.guests.emails: person has no field called mail to hold a guest's addresses"]);
    expect(findings(named, "connection-guests-field")[0]!.fixes![0]!.edits).toEqual([{ op: "add-field", kind: "person", field: "mail", type: "list", of: "string" }]);
    const wrong = home({ cal: cal({ via: "who", emails: "name" }) });
    expect(said(wrong, "connection-guests-field")).toEqual(["error connections.cal.fields.guests.emails: a guest's addresses are a list of them or one email, and person's name is a string field"]);
  });

  it("says a toggle the reached kind lacks, and offers to add it or to invite every address", () => {
    const raw = home({ cal: cal({ via: "who" }) }, { kinds: kinds({ person: { fields: { name: { type: "string", required: true }, emails: { type: "list" } } } }) });
    expect(said(raw, "connection-guests-field")).toEqual(["error connections.cal.fields.guests.invite: person has no field called inviteMe to say who wants to be invited"]);
    const fixes = findings(raw, "connection-guests-field")[0]!.fixes!;
    expect(fixes.map((fix) => fix.label)).toEqual(["Add Invite me to person", "Invite every address"]);
    expect(fixes[0]!.edits).toEqual([{ op: "add-field", kind: "person", field: "inviteMe", type: "boolean" }]);
    expect(fixes[1]!.edits).toEqual([{ op: "set-connection", name: "cal", connection: { ...cal({ via: "who", invite: false }) } }]);
    for (const fix of fixes) {
      const edited = editDocument(raw as never, fix.edits as never);
      expect(edited.ok, fix.label).toBe(true);
      expect(errors(edited.ok ? edited.document : raw), fix.label).toEqual([]);
    }
    const wrong = home({ cal: cal({ via: "who", invite: "name" }) });
    expect(said(wrong, "connection-guests-field")).toEqual(["error connections.cal.fields.guests.invite: name says whether a person wants to be invited, and person's name is a string field"]);
  });

  it("warns, and no more, when the relation reaches a kind other than the app's people", () => {
    const members = home({ cal: cal({ via: "who" }) }, { kinds: { ...kinds({}), member: { people: true, fields: { name: { type: "string", required: true } } } }, acts: { ...(home({}).acts as object), "add-member": { creates: "member" } } });
    expect(errors(members)).toEqual([]);
    expect(said(members, "connection-guests-via")).toEqual(["warning connections.cal.fields.guests.via: who reaches person, and this app's people are member: the guests are its persons, never its members"]);
    // The people kind itself, reached: nothing to say.
    const people = home({ cal: cal({ via: "who" }) }, { kinds: kinds({ person: { people: true } }) });
    expect(errors(people)).toEqual([]);
    expect(said(people, "connection-guests-via")).toEqual([]);
  });

  it("builds the mapping: the field form a mapped field, the via form an edge the making act need not take", () => {
    const field = compileDocument(home({ cal: cal("guests") }));
    const viaForm = compileDocument(home({ cal: cal({ via: "who" }) }));
    const people = compileDocument(home({ cal: cal({ via: "who" }) }, { kinds: kinds({ person: { people: true } }) }));
    if (!field.ok || !viaForm.ok || !people.ok) throw new Error("the fixtures do not compile");
    expect(connectionMapping(field.app, field.app.connections!["cal"]!).resources[0]!.fields["guests"]).toBe("attendees");
    for (const compiled of [viaForm, people]) {
      const resource = connectionMapping(compiled.app, compiled.app.connections!["cal"]!).resources[0]!;
      expect(resource.edges).toEqual({ who: "attendees" });
      expect(resource.fields["who"]).toBeUndefined();
    }
  });
});

/* ------------------------------------------------------ a field of addresses */

describe("the guests in a field of addresses", () => {
  it("sends each address once, lowercased, reads back what the calendar adds, and keeps every address", async () => {
    const { act, pass, quiet, remote, eventOf, store } = opened(cal("guests"));
    act("add-event", { id: "event:party", name: "Party", starts: "2026-11-02T15:00:00Z", ends: "2026-11-02T16:00:00Z", guests: ["Ben@Example.com ", "ana@example.com", "ben@example.com"] });
    const sent = await pass();
    expect(sent.pushed).toEqual(["event:party"]);
    expect(remote.invited(eventOf("event:party"))).toEqual(["ana@example.com", "ben@example.com"]);
    expect(quiet(await pass())).toBe(true);
    // A guest added in the calendar lands in the field; one unknown to the app is kept in it.
    remote.change(eventOf("event:party"), { attendees: [{ email: "ana@example.com" }, { email: "ben@example.com" }, { email: "cat@example.com", responseStatus: "needsAction" }] });
    const took = await pass();
    expect(took.applied).toEqual(["event:party"]);
    expect(store.graph.getNode("event:party")?.["guests"]).toEqual(["ana@example.com", "ben@example.com", "cat@example.com"]);
    expect(quiet(await pass())).toBe(true);
    // Emptied here, emptied there.
    act("edit-event", { id: "event:party", guests: [] });
    await pass();
    expect(remote.invited(eventOf("event:party"))).toEqual([]);
    expect(quiet(await pass())).toBe(true);
  });

  it("keeps one address in an email field, and an event made in the calendar without one has none", async () => {
    const { act, pass, remote, eventOf, events, store } = opened(cal("host"));
    act("add-event", { id: "event:dinner", name: "Dinner", starts: "2026-11-02T15:00:00Z", ends: "2026-11-02T16:00:00Z", host: "Ana@example.com" });
    await pass();
    expect(remote.invited(eventOf("event:dinner"))).toEqual(["ana@example.com"]);
    remote.add({ summary: "Brunch", start: { dateTime: "2026-11-03T15:00:00Z" }, end: { dateTime: "2026-11-03T16:00:00Z" } });
    const took = await pass();
    expect(took.refused).toEqual([]);
    const brunch = events().find((one) => one["name"] === "Brunch")!;
    expect(brunch["host"] ?? null).toBeNull();
    expect(store.graph.getNode(String(brunch["id"]))).toBeDefined();
  });
});

/* -------------------------------------------------- the people a relation reaches */

describe("the guests through a relation to the people", () => {
  it("invites each address of a person with Invite me, takes them off when unlinked, and sends nothing in between", async () => {
    const { act, pass, quiet, remote, eventOf, person, event } = opened(cal({ via: "who" }));
    person("person:ana", "Ana", ["Ana@Example.com", "ana.b@example.com"]);
    event("event:party", "Party");
    act("connect-event-who", { id: "event:party", to: "person:ana" });
    const sent = await pass();
    expect(sent.pushed).toEqual(["event:party"]);
    expect(remote.invited(eventOf("event:party"))).toEqual(["ana.b@example.com", "ana@example.com"]);
    expect(quiet(await pass())).toBe(true);
    act("disconnect-event-who", { id: "event:party", to: "person:ana" });
    const unlinked = await pass();
    expect(unlinked.pushed).toEqual(["event:party"]);
    expect(remote.invited(eventOf("event:party"))).toEqual([]);
    expect(quiet(await pass())).toBe(true);
  });

  it("never invites a person without Invite me, and keeps an attendee matching them as an address rather than a link", async () => {
    const { act, pass, quiet, remote, eventOf, person, event, who, engine } = opened(cal({ via: "who" }));
    person("person:kid", "Kid", ["kid@example.com"], false);
    person("person:ana", "Ana", ["ana@example.com"]);
    event("event:party", "Party");
    act("connect-event-who", { id: "event:party", to: "person:kid" });
    act("connect-event-who", { id: "event:party", to: "person:ana" });
    await pass();
    expect(remote.invited(eventOf("event:party"))).toEqual(["ana@example.com"]);
    expect(quiet(await pass())).toBe(true);
    // The kid's address added in the calendar is held as it is: the kid is not a guest, so it links nobody.
    event("event:picnic", "Picnic");
    await pass();
    remote.change(eventOf("event:picnic"), { attendees: [{ email: "kid@example.com" }] });
    await pass();
    expect(who("event:picnic")).toEqual([]);
    expect(engine.snapshot.unresolved).toEqual({ "event:picnic": { who: ["kid@example.com"] } });
    expect(quiet(await pass())).toBe(true);
    expect(remote.invited(eventOf("event:picnic"))).toEqual(["kid@example.com"]);
  });

  it("links a held address once the person's Invite me is turned on, sending nothing for it", async () => {
    const { act, pass, quiet, remote, eventOf, person, event, who, engine } = opened(cal({ via: "who" }));
    person("person:ben", "Ben", ["ben@example.com"], false);
    event("event:party", "Party");
    await pass();
    remote.change(eventOf("event:party"), { attendees: [{ email: "ben@example.com" }] });
    await pass();
    expect(who("event:party")).toEqual([]);
    act("edit-person", { id: "person:ben", inviteMe: true });
    const linked = await pass();
    expect(who("event:party")).toEqual(["person:ben"]);
    expect(linked.applied).toEqual(["event:party"]);
    expect(linked.pushed).toEqual([]);
    expect(engine.snapshot.unresolved).toBeUndefined();
    expect(quiet(await pass())).toBe(true);
    expect(remote.invited(eventOf("event:party"))).toEqual(["ben@example.com"]);
  });

  it("links the person an attendee added in the calendar is, crediting the calendar, and keeps an unknown address through a round trip", async () => {
    const { act, pass, quiet, remote, eventOf, person, event, who, store, engine } = opened(cal({ via: "who" }));
    person("person:ana", "Ana", ["ana@example.com", "ana.b@example.com"]);
    event("event:party", "Party");
    await pass();
    remote.change(eventOf("event:party"), { attendees: [{ email: "ANA.B@example.com" }, { email: "stranger@example.com" }] });
    const took = await pass();
    expect(took.applied).toEqual(["event:party"]);
    expect(who("event:party")).toEqual(["person:ana"]);
    const linking = store.log.all().find((op) => op.primitives.some((primitive) => primitive.op === "add-edge"));
    expect(linking?.author).toEqual({ kind: "system", id: "google-calendar" });
    expect(engine.snapshot.unresolved).toEqual({ "event:party": { who: ["stranger@example.com"] } });
    // Nothing is sent for what was taken in; a change made here carries the stranger back as it was.
    expect(quiet(await pass())).toBe(true);
    act("edit-event", { id: "event:party", name: "Party, moved" });
    await pass();
    expect(remote.invited(eventOf("event:party"))).toEqual(["ana.b@example.com", "ana@example.com", "stranger@example.com"]);
    expect(quiet(await pass())).toBe(true);
  });

  it("is quiet when the calendar adds its organizer to every event it is sent", async () => {
    const { act, pass, quiet, remote, eventOf, person, event } = opened(cal({ via: "who" }), { organizer: "home@example.com" });
    person("person:ana", "Ana", ["ana@example.com"]);
    event("event:party", "Party");
    act("connect-event-who", { id: "event:party", to: "person:ana" });
    await pass();
    expect(remote.invited(eventOf("event:party"))).toEqual(["ana@example.com", "home@example.com"]);
    // Our own write comes back as an echo; a later change there brings the organizer, held as an address and sent back unchanged.
    expect(quiet(await pass())).toBe(true);
    remote.change(eventOf("event:party"), { summary: "Party!" });
    const took = await pass();
    expect(took.applied).toEqual(["event:party"]);
    expect(took.pushed).toEqual([]);
    expect(quiet(await pass())).toBe(true);
    act("edit-event", { id: "event:party", name: "Party, moved" });
    await pass();
    expect(remote.invited(eventOf("event:party"))).toEqual(["ana@example.com", "home@example.com"]);
    expect(quiet(await pass())).toBe(true);
  });

  it("makes an event made in the calendar here with its links in one batch, holding whoever matches nobody", async () => {
    const { pass, quiet, remote, person, events, who, store, engine } = opened(cal({ via: "who" }));
    person("person:ana", "Ana", ["ana@example.com"]);
    remote.add({ summary: "Picnic", start: { dateTime: "2026-11-03T15:00:00Z" }, end: { dateTime: "2026-11-03T16:00:00Z" }, attendees: [{ email: "ana@example.com" }, { email: "stranger@example.com" }] });
    const took = await pass();
    expect(took.refused).toEqual([]);
    const picnic = events().find((one) => one["name"] === "Picnic")!;
    expect(who(String(picnic["id"]))).toEqual(["person:ana"]);
    const made = store.log.all().filter((op) => op.primitives.some((primitive) => primitive.op === "add-node" && primitive.node.id === picnic["id"]));
    const linked = store.log.all().filter((op) => op.primitives.some((primitive) => primitive.op === "add-edge" && primitive.edge.from === picnic["id"]));
    expect(made).toHaveLength(1);
    expect(linked).toHaveLength(1);
    expect(linked[0]!.batch).toBe(made[0]!.batch);
    expect(engine.snapshot.unresolved).toEqual({ [String(picnic["id"])]: { who: ["stranger@example.com"] } });
    expect(quiet(await pass())).toBe(true);
  });

  it("says sendUpdates on every write, none unless notify is asked for", async () => {
    const quietly = opened(cal({ via: "who" }));
    quietly.person("person:ana", "Ana", ["ana@example.com"]);
    quietly.event("event:party", "Party");
    quietly.act("connect-event-who", { id: "event:party", to: "person:ana" });
    await quietly.pass();
    quietly.act("edit-event", { id: "event:party", name: "Party!" });
    await quietly.pass();
    quietly.act("remove-event", { id: "event:party" });
    await quietly.pass();
    expect(quietly.remote.sendUpdates).toEqual(["none", "none", "none"]);
    const loudly = opened(cal({ via: "who", notify: true }));
    loudly.event("event:party", "Party");
    await loudly.pass();
    expect(loudly.remote.sendUpdates).toEqual(["all"]);
  });
});
