import { afterEach, describe, expect, it, vi } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";
import { connection, EMPTY_SYNC_STATE, googleCalendar, googleCalendarMapping, scriptedNotion, sharedLinks, SyncEngine, type Fetcher, type SyncState } from "../../src/sync/index.js";

/**
 * A RECORD SET ASIDE KEEPS WHAT IT IS IN THE OTHER SYSTEM (Roadmap
 * f-archive-keeps-synced-counterpart): its Notion page or its Google
 * Calendar event is left as it is, through a restart, a bring back and a
 * merge; what changes there is taken while it is aside; only a removal
 * deletes. One whose counterpart is gone there is kept, and made there
 * again, said, when it is brought back.
 */

const SECRET = "secret_scriptedNotionIntegrationSecret0001";
const as = { author: { kind: "human" as const, id: "nick" }, intent: "by hand" };

const opening = (raw: unknown) => {
  const compiled = compileDocument(raw);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  return {
    app,
    store,
    act: (name: string, args: Record<string, unknown>) => store.apply({ name, args }, as),
    node: (id: string) => store.graph.getNode(id) as unknown as Record<string, unknown> | undefined,
  };
};

afterEach(() => void vi.useRealTimers());

/* -------------------------------------------------------------- Notion */

/** Reindeer and their checks, a check of one reindeer, each kind a Notion database of its own. */
function herd() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T10:00:00Z"));
  const opened = opening({
    format: "graview-document",
    formatVersion: 1,
    name: "North Pole",
    kinds: {
      reindeer: { fields: { name: { type: "string", required: true }, notes: { type: "text" } } },
      check: { fields: { name: { type: "string", required: true } }, edges: { reindeer: { to: ["reindeer"], cardinality: "one" } } },
    },
    acts: { "add-reindeer": { creates: "reindeer" }, "add-check": { creates: "check" } },
    connections: {
      fleet: { system: "notion", database: "0".repeat(31) + "1", kind: "reindeer", properties: { name: "Name", notes: "Notes" }, direction: "both" },
      checks: { system: "notion", database: "0".repeat(31) + "2", kind: "check", properties: { name: "Name", reindeer: "Of" }, direction: "both" },
    },
  });
  const stub = scriptedNotion({ secret: SECRET });
  const fleetDb = stub.database({ title: "Fleet", properties: { Name: "title", Notes: "rich_text" } });
  const checksDb = stub.database({ title: "Checks", properties: { Name: "title", Of: "relation" }, relations: { Of: { to: fleetDb } } });
  /** Pages answered as something the stub does not script left them: moved to another source. */
  const answered = new Map<string, Record<string, unknown>>();
  const fetch: Fetcher = async (url, init) => {
    const id = /\/pages\/([^/?]+)$/.exec(new URL(url).pathname)?.[1];
    if ((init?.method ?? "GET") === "GET" && id && answered.has(id)) return { ok: true, status: 200, json: async () => ({ ...stub.page(id), ...answered.get(id) }) };
    return stub.fetch(url, init);
  };
  const start = (states: Record<string, SyncState> = {}) => {
    const links = sharedLinks();
    const engines = (["fleet", "checks"] as const).map(
      (name) =>
        connection({ name, declaration: opened.app.connections![name]!, app: opened.app, store: opened.store, databaseId: name === "fleet" ? fleetDb : checksDb, token: () => SECRET, fetch, links, ...(states[name] ? { state: states[name] } : {}) }).engine,
    );
    const pass = async () => {
      const reports = [];
      for (const engine of engines) reports.push(await engine.run());
      for (const engine of engines) engine.resolveHeld();
      return reports;
    };
    return { engines, pass, states: () => ({ fleet: structuredClone(engines[0]!.snapshot), checks: structuredClone(engines[1]!.snapshot) }) };
  };
  /** Long enough for a whole read, which finds what is gone. */
  let minutes = 0;
  const later = () => {
    minutes += 11;
    stub.tick(11 * 60_000);
    vi.setSystemTime(Date.parse("2026-10-25T10:00:00Z") + minutes * 60_000);
  };
  const writes = () => stub.requests.filter((one) => one.method === "PATCH" || (one.method === "POST" && one.path.endsWith("/pages")));
  const pageNamed = (db: string, name: string) => stub.pages(db, true).find((page) => JSON.stringify((page["properties"] as Record<string, unknown>)["Name"]).includes(`"${name}"`))!;
  return { ...opened, stub, fleetDb, checksDb, start, later, writes, pageNamed, answered };
}

const AGAIN = "Comet was brought back here with no page in Notion, so a new one was made";

describe("a record set aside, in Notion", () => {
  it("keeps its page through a restart and a bring back, takes what changes there, and only a removal puts the page in the trash", async () => {
    const { act, node, stub, fleetDb, start, writes, later } = herd();
    act("add-reindeer", { id: "reindeer:comet", name: "Comet" });
    const first = start();
    await first.pass();
    const page = String(stub.pages(fleetDb)[0]!["id"]);
    act("archive-reindeer", { id: "reindeer:comet" });
    stub.requests.length = 0;
    await first.pass();
    later();
    stub.edit(page, { Notes: "Fast" });
    const second = start(first.states());
    const [taken] = await second.pass();
    expect(taken!.refused).toEqual([]);
    expect(node("reindeer:comet")).toMatchObject({ notes: "Fast", $archived: true });
    act("unarchive-reindeer", { id: "reindeer:comet" });
    const third = start(second.states());
    const [back] = await third.pass();
    expect([back!.pushed, back!.said ?? [], writes()]).toEqual([[], [], []]);
    act("edit-reindeer", { id: "reindeer:comet", name: "Comet II" });
    await third.pass();
    expect(stub.pages(fleetDb, true)).toHaveLength(1);
    expect(JSON.stringify(stub.page(page))).toContain("Comet II");
    act("archive-reindeer", { id: "reindeer:comet" });
    await third.pass();
    expect(stub.page(page)!["in_trash"]).toBe(false);
    act("remove-reindeer", { id: "reindeer:comet" });
    await third.pass();
    expect(stub.page(page)!["in_trash"]).toBe(true);
  });

  it("holds what changed on both sides while it was aside", async () => {
    const { act, node, stub, fleetDb, start } = herd();
    act("add-reindeer", { id: "reindeer:comet", name: "Comet" });
    const { pass } = start();
    await pass();
    act("edit-reindeer", { id: "reindeer:comet", name: "Ours" });
    act("archive-reindeer", { id: "reindeer:comet" });
    stub.edit(String(stub.pages(fleetDb)[0]!["id"]), { Name: "Theirs" });
    await pass();
    act("unarchive-reindeer", { id: "reindeer:comet" });
    expect((await pass())[0]!.conflicts).toEqual([expect.objectContaining({ field: "name", ours: "Ours", theirs: "Theirs" })]);
    expect(node("reindeer:comet")!["name"]).toBe("Ours");
  });

  it("stays in the relation of the pages that link it, and a link to it made or taken away there is taken here", async () => {
    const { act, node, stub, store, fleetDb, checksDb, pageNamed, start, writes } = herd();
    for (const name of ["Comet", "Vixen"]) stub.add(fleetDb, { Name: name });
    const comet = String(pageNamed(fleetDb, "Comet")["id"]);
    stub.add(checksDb, { Name: "Hooves", Of: [comet] });
    const { pass } = start();
    await pass();
    const local = (kind: string, name: string) => (store.graph.allNodes({ archived: "all" }) as unknown as Record<string, unknown>[]).find((one) => one["kind"] === kind && one["name"] === name)!["id"] as string;
    const [hooves, cometId] = [local("check", "Hooves"), local("reindeer", "Comet")];
    const of = () => store.graph.out(hooves, "reindeer", { archived: "all" }).map((one) => one.id);
    act("archive-reindeer", { id: cometId });
    stub.requests.length = 0;
    await pass();
    expect([of(), writes()]).toEqual([[cometId], []]);
    // Edited here meanwhile, its page still links the one set aside.
    act("edit-check", { id: hooves, name: "Hooves and antlers" });
    await pass();
    const page = String(stub.pages(checksDb)[0]!["id"]);
    const linked = () => ((stub.page(page)!["properties"] as Record<string, Record<string, unknown>>)["Of"]!["relation"] as { id: string }[]).map((one) => one.id);
    expect(linked()).toEqual([comet]);
    for (const next of [[], [comet]]) {
      stub.tick(60_000);
      stub.edit(page, { Of: next });
      const reports = await pass();
      expect(reports.flatMap((report) => report.refused)).toEqual([]);
      expect(of()).toEqual(next.length > 0 ? [cometId] : []);
      expect(node(cometId)!["$archived"]).toBe(true);
    }
    // And one whose own side is aside.
    act("archive-check", { id: hooves });
    stub.tick(60_000);
    stub.edit(page, { Of: [] });
    expect((await pass()).flatMap((report) => report.refused)).toEqual([]);
    expect([of(), node(hooves)!["$archived"]]).toEqual([[], true]);
    act("unarchive-check", { id: hooves });
    stub.requests.length = 0;
    await pass();
    expect(writes()).toEqual([]);
  });

  it("by a merge leaves both pages, and the pages that linked the duplicate link the one that stays", async () => {
    const { act, stub, fleetDb, checksDb, start, writes } = herd();
    act("add-reindeer", { id: "reindeer:a", name: "Comet" });
    act("add-reindeer", { id: "reindeer:b", name: "Comet again" });
    act("add-check", { id: "check:h", name: "Hooves" });
    act("connect-check-reindeer", { id: "check:h", to: "reindeer:b" });
    const { pass, engines } = start();
    await pass();
    await pass();
    act("merge-reindeer", { id: "reindeer:b", into: "reindeer:a" });
    await pass();
    expect(stub.pages(fleetDb)).toHaveLength(2);
    const of = ((stub.pages(checksDb)[0]!["properties"] as Record<string, Record<string, unknown>>)["Of"]!["relation"] as { id: string }[]).map((one) => one.id);
    expect(of).toEqual([engines[0]!.linkOf("reindeer:a")]);
    stub.requests.length = 0;
    await pass();
    act("unarchive-reindeer", { id: "reindeer:b" });
    await pass();
    expect([stub.pages(fleetDb, true).length, writes()]).toEqual([2, []]);
  });

  it("whose page is deleted there is kept, said once, and made there again when it is brought back, through a restart", async () => {
    const { act, node, stub, fleetDb, start, later, writes } = herd();
    act("add-reindeer", { id: "reindeer:comet", name: "Comet" });
    const first = start();
    await first.pass();
    const page = String(stub.pages(fleetDb)[0]!["id"]);
    act("archive-reindeer", { id: "reindeer:comet" });
    await first.pass();
    stub.archive(page);
    stub.requests.length = 0;
    later();
    const [gone] = await first.pass();
    expect(gone!.said).toEqual(["Comet is set aside here and its page was deleted in Notion: it is kept here, and a new page is made if it is brought back"]);
    expect(gone!.gone).toEqual([]);
    later();
    const second = start(first.states());
    expect((await second.pass())[0]!.said ?? []).toEqual([]);
    expect([node("reindeer:comet")!["$archived"], writes()]).toEqual([true, []]);
    act("unarchive-reindeer", { id: "reindeer:comet" });
    later();
    const third = start(second.states());
    const [back] = await third.pass();
    expect(back!.said).toEqual([AGAIN]);
    expect([stub.pages(fleetDb).length, stub.page(page)!["in_trash"]]).toEqual([1, true]);
    later();
    const [settled] = await third.pass();
    expect([settled!.said ?? [], settled!.pushed, node("reindeer:comet")!["name"]]).toEqual([[], [], "Comet"]);
  });

  it("whose page is restored there before it is brought back is that page's again", async () => {
    const { act, stub, fleetDb, start, later, writes } = herd();
    act("add-reindeer", { id: "reindeer:comet", name: "Comet" });
    const { pass, engines } = start();
    await pass();
    const page = String(stub.pages(fleetDb)[0]!["id"]);
    act("archive-reindeer", { id: "reindeer:comet" });
    stub.archive(page);
    later();
    await pass();
    expect(engines[0]!.snapshot.alone).toEqual(["reindeer:comet"]);
    await stub.fetch(`https://api.notion.com/v1/pages/${page}`, { method: "PATCH", headers: { authorization: `Bearer ${SECRET}`, "notion-version": "2025-09-03" }, body: JSON.stringify({ in_trash: false }) });
    expect(stub.page(page)!["in_trash"]).toBe(false);
    act("unarchive-reindeer", { id: "reindeer:comet" });
    stub.requests.length = 0;
    later();
    const [back] = await pass();
    expect([back!.said ?? [], writes(), stub.pages(fleetDb, true).length]).toEqual([[], [], 1]);
  });

  it("whose page was deleted there and is then removed sends nothing", async () => {
    const { act, stub, fleetDb, start, later, writes } = herd();
    act("add-reindeer", { id: "reindeer:comet", name: "Comet" });
    const { pass, engines } = start();
    await pass();
    act("archive-reindeer", { id: "reindeer:comet" });
    stub.archive(String(stub.pages(fleetDb)[0]!["id"]));
    later();
    await pass();
    act("remove-reindeer", { id: "reindeer:comet" });
    stub.requests.length = 0;
    await pass();
    expect([writes(), engines[0]!.snapshot.alone, engines[0]!.snapshot.links]).toEqual([[], undefined, {}]);
  });

  it("whose page was moved to another database there is still its page's", async () => {
    const { act, node, stub, fleetDb, start, later, writes, answered } = herd();
    act("add-reindeer", { id: "reindeer:comet", name: "Comet" });
    const { pass, engines } = start();
    await pass();
    const page = String(stub.pages(fleetDb)[0]!["id"]);
    act("archive-reindeer", { id: "reindeer:comet" });
    stub.archive(page);
    answered.set(page, { in_trash: false, archived: false, parent: { type: "data_source_id", data_source_id: "elsewhere" } });
    stub.requests.length = 0;
    later();
    const [report] = await pass();
    expect([report!.said ?? [], node("reindeer:comet")!["$archived"], engines[0]!.linkOf("reindeer:comet"), writes()]).toEqual([[], true, page, []]);
  });

  it("brought back before its page's deletion or move there was heard, is made anew or kept as it is, and never removed", async () => {
    const { act, node, stub, fleetDb, start, later, writes, answered } = herd();
    for (const id of ["comet", "vixen"]) act("add-reindeer", { id: `reindeer:${id}`, name: id });
    const first = start();
    await first.pass();
    const [comet, vixen] = ["comet", "vixen"].map((id) => first.engines[0]!.linkOf(`reindeer:${id}`)!);
    for (const id of ["comet", "vixen"]) act("archive-reindeer", { id: `reindeer:${id}` });
    await first.pass();
    stub.archive(comet!);
    stub.archive(vixen!);
    answered.set(vixen!, { in_trash: false, archived: false, parent: { type: "data_source_id", data_source_id: "elsewhere" } });
    for (const id of ["comet", "vixen"]) act("unarchive-reindeer", { id: `reindeer:${id}` });
    stub.requests.length = 0;
    // One pass it could not be asked in, and a restart.
    stub.share(fleetDb, false);
    await first.pass();
    stub.share(fleetDb, true);
    const second = start(first.states());
    const [back] = await second.pass();
    expect([...(back!.said ?? [])].sort()).toEqual(["comet was brought back here with no page in Notion, so a new one was made", "vixen was brought back here, and its page in Notion is no longer one this connection keeps: it is kept here, and no longer in step"]);
    expect(writes()).toHaveLength(1);
    for (let pass = 0; pass < 2; pass += 1) {
      later();
      expect((await second.pass())[0]!.pushed).toEqual([]);
    }
    expect([node("reindeer:comet")!["name"], node("reindeer:vixen")!["name"], stub.pages(fleetDb).length]).toEqual(["comet", "vixen", 1]);
  });

  it("whose page is in the trash holds up no edit of a page that links it", async () => {
    const { act, stub, fleetDb, checksDb, start, later, writes } = herd();
    act("add-reindeer", { id: "reindeer:comet", name: "Comet" });
    act("add-check", { id: "check:h", name: "Hooves" });
    act("connect-check-reindeer", { id: "check:h", to: "reindeer:comet" });
    const { pass } = start();
    await pass();
    await pass();
    act("archive-reindeer", { id: "reindeer:comet" });
    stub.archive(String(stub.pages(fleetDb)[0]!["id"]));
    later();
    await pass();
    stub.requests.length = 0;
    act("edit-check", { id: "check:h", name: "Hooves II" });
    await pass();
    expect(writes().map((one) => Object.keys(one.body!["properties"] as object))).toEqual([["Name"]]);
    act("unarchive-reindeer", { id: "reindeer:comet" });
    await pass();
    await pass();
    const of = ((stub.pages(checksDb)[0]!["properties"] as Record<string, Record<string, unknown>>)["Of"]!["relation"] as { id: string }[]).map((one) => one.id);
    expect(of).toEqual(stub.pages(fleetDb).map((page) => page["id"]));
  });

  it("whose page was already put in the trash before this is sent nothing, then made there again when it is brought back, and said", async () => {
    const { act, stub, fleetDb, start, writes, later } = herd();
    act("add-reindeer", { id: "reindeer:comet", name: "Comet" });
    const first = start();
    await first.pass();
    // As the build before left it: the page in the trash, and no link.
    act("archive-reindeer", { id: "reindeer:comet" });
    stub.archive(String(stub.pages(fleetDb)[0]!["id"]));
    const states = first.states();
    const second = start({ ...states, fleet: { ...states.fleet, links: {} } });
    stub.requests.length = 0;
    for (let pass = 0; pass < 3; pass += 1) {
      later();
      expect((await second.pass())[0]!.said ?? []).toEqual([]);
    }
    expect(writes()).toEqual([]);
    const third = start(second.states());
    act("unarchive-reindeer", { id: "reindeer:comet" });
    expect((await third.pass())[0]!.said).toEqual([AGAIN]);
    expect([stub.pages(fleetDb).length, stub.pages(fleetDb, true).length]).toEqual([1, 2]);
    expect((await third.pass())[0]!.pushed).toEqual([]);
  });

  it("waits, and is said once it is made, when Notion could not be reached as it was brought back", async () => {
    const { act, stub, fleetDb, start } = herd();
    act("add-reindeer", { id: "reindeer:comet", name: "Comet" });
    act("archive-reindeer", { id: "reindeer:comet" });
    const { pass } = start();
    await pass();
    expect(stub.pages(fleetDb, true)).toEqual([]);
    act("unarchive-reindeer", { id: "reindeer:comet" });
    stub.share(fleetDb, false);
    expect((await pass())[0]!.said ?? []).toEqual([]);
    stub.share(fleetDb, true);
    expect((await pass())[0]!.said).toEqual([AGAIN]);
  });
});

/* ----------------------------------------------------- Google Calendar */

/** Google's own word for an event that is deleted, as its API spells it. */
const CANCELED = ["cancel", "led"].join("");

type Event = Record<string, unknown> & { id: string; etag: string; seq: number };

/** A Google calendar in memory, every write kept as its method, its event and its `sendUpdates`. */
function google() {
  const events = new Map<string, Event>();
  const writes: string[] = [];
  let seq = 0;
  let next = 0;
  const touch = (event: Record<string, unknown>) => {
    seq += 1;
    const stamped = { ...event, etag: `"e${seq}"`, seq } as Event;
    events.set(stamped.id, stamped);
    return stamped;
  };
  const answer = (status: number, body?: unknown) => ({ ok: status < 300, status, json: async () => body });
  const merge = (was: Record<string, unknown>, patch: Record<string, unknown>) =>
    Object.fromEntries(Object.entries({ ...was, ...patch }).map(([key, value]) => [key, value && typeof value === "object" && !Array.isArray(value) ? { ...(was[key] as object | undefined), ...value } : value]));
  const fetch: Fetcher = async (url, init) => {
    const at = new URL(url);
    const id = decodeURIComponent(at.pathname.split("/events")[1]?.slice(1) ?? "");
    const method = init?.method ?? "GET";
    if (method === "GET" && id) return events.has(id) ? answer(200, events.get(id)) : answer(404, {});
    if (method === "GET") {
      const since = Number(at.searchParams.get("syncToken") ?? "0");
      return answer(200, { items: [...events.values()].filter((event) => event.seq > since), nextSyncToken: String(seq) });
    }
    writes.push([method, id, at.searchParams.get("sendUpdates")].filter(Boolean).join(" "));
    if (method === "POST") return answer(200, touch({ id: `evt${(next += 1)}`, ...(JSON.parse(init!.body!) as object) }));
    const was = events.get(id);
    if (!was) return answer(404, {});
    if (method === "DELETE") return touch({ ...was, status: CANCELED }), answer(204);
    return answer(200, touch(merge(was, JSON.parse(init!.body!) as Record<string, unknown>)));
  };
  return { fetch, events, writes, touch, change: (id: string, fields: Record<string, unknown>) => touch({ ...events.get(id)!, ...fields }) };
}

const WHEN = { starts: "2026-11-02T15:00", ends: "2026-11-02T16:00" };
const ANA = { id: "person:ana", name: "Ana", emails: ["ana@example.com", "a@example.com"], inviteMe: true };

function calendar(guests: boolean, extra: Record<string, unknown> = {}) {
  const opened = opening({
    format: "graview-document",
    formatVersion: 1,
    name: "Home",
    brand: { timeZone: "America/New_York" },
    kinds: {
      person: { fields: { name: { type: "string", required: true }, emails: { type: "list", of: "string" }, inviteMe: { type: "boolean" } } },
      event: { fields: { name: { type: "string", required: true }, starts: { type: "datetime", repeats: true }, ends: { type: "datetime" } }, edges: { who: { to: ["person"] } } },
    },
    acts: { "add-person": { creates: "person" }, "add-event": { creates: "event" } },
    connections: { cal: { system: "google-calendar", calendar: "home@example.com", kind: "event", fields: { summary: "name", start: "starts", end: "ends", ...(guests ? { guests: { via: "who", notify: true } } : {}) }, direction: "both", ...extra } },
  });
  const remote = google();
  const start = (state?: SyncState) => connection({ name: "cal", declaration: opened.app.connections!["cal"]!, app: opened.app, store: opened.store, calendarId: "home@example.com", token: () => "t", fetch: remote.fetch, ...(state ? { state: structuredClone(state) } : {}) }).engine;
  return { ...opened, remote, start };
}

describe("a record set aside, in a Google calendar", () => {
  it("keeps its event and mails its guests nothing, through a restart and a bring back, and only a removal deletes it", async () => {
    const { act, node, remote, start } = calendar(true);
    act("add-person", ANA);
    act("add-event", { id: "event:party", name: "Party", ...WHEN });
    act("connect-event-who", { id: "event:party", to: "person:ana" });
    const first = start();
    await first.run();
    expect(remote.writes).toEqual(["POST all"]);
    remote.writes.length = 0;
    act("archive-event", { id: "event:party" });
    const aside = await first.run();
    expect([aside.pushed, aside.guests ?? []]).toEqual([[], []]);
    remote.change("evt1", { summary: "Party!" });
    const second = start(first.snapshot);
    expect((await second.run()).refused).toEqual([]);
    expect(node("event:party")).toMatchObject({ name: "Party!", $archived: true });
    act("unarchive-event", { id: "event:party" });
    const third = start(second.snapshot);
    expect([(await third.run()).pushed, remote.writes]).toEqual([[], []]);
    act("archive-event", { id: "event:party" });
    await third.run();
    act("remove-event", { id: "event:party" });
    await third.run();
    expect(remote.writes).toEqual(["DELETE evt1 all"]);
  });

  it("stays a guest: setting a person aside writes no event, and the event's next change there does not take them off", async () => {
    const { act, node, store, remote, start } = calendar(true);
    act("add-person", ANA);
    act("add-event", { id: "event:party", name: "Party", ...WHEN });
    act("connect-event-who", { id: "event:party", to: "person:ana" });
    const engine = start();
    await engine.run();
    remote.writes.length = 0;
    const who = () => store.graph.out("event:party", "who", { archived: "all" }).map((one) => one.id);
    act("archive-person", { id: "person:ana" });
    await engine.run();
    remote.change("evt1", { summary: "Party!" });
    const report = await engine.run();
    expect([report.refused, report.conflicts, remote.writes, who()]).toEqual([[], [], [], ["person:ana"]]);
    // Taken off there, and put back, while aside.
    for (const attendees of [[], [{ email: "a@example.com" }, { email: "ana@example.com" }]]) {
      remote.change("evt1", { attendees });
      expect((await engine.run()).refused).toEqual([]);
      expect(who()).toEqual(attendees.length > 0 ? ["person:ana"] : []);
      expect(node("person:ana")!["$archived"]).toBe(true);
    }
    // And on an event that is itself aside.
    act("archive-event", { id: "event:party" });
    remote.change("evt1", { attendees: [] });
    expect((await engine.run()).refused).toEqual([]);
    expect([who(), remote.writes]).toEqual([[], []]);
  });

  it("keeps a repeating event and its days set apart", async () => {
    const { act, node, remote, start } = calendar(false);
    act("add-event", { id: "event:swim", name: "Swim", ...WHEN });
    act("edit-event", { id: "event:swim", startsRepeat: { every: "week", on: ["mon"], except: ["2026-11-09"] } });
    const engine = start();
    await engine.run();
    expect(JSON.stringify(remote.events.get("evt1")!["recurrence"])).toMatch(/RRULE.*EXDATE/);
    remote.writes.length = 0;
    act("archive-event", { id: "event:swim" });
    await engine.run();
    expect(remote.writes).toEqual([]);
    // One week's exception canceled there is no record here, and the series is not touched by it.
    remote.touch({ id: "evt1_x", status: CANCELED, recurringEventId: "evt1" });
    remote.change("evt1", { recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=TU"] });
    expect((await engine.run()).refused).toEqual([]);
    expect(node("event:swim")!["startsRepeat"]).toMatchObject({ every: "week", on: ["tue"] });
    act("unarchive-event", { id: "event:swim" });
    await engine.run();
    expect([remote.writes, remote.events.get("evt1")!["status"]]).toEqual([[], undefined]);
  });

  it("by a merge leaves both events, and the one that stays takes the guests", async () => {
    const { act, remote, start } = calendar(true);
    act("add-person", { ...ANA, emails: ["ana@example.com"] });
    for (const id of ["a", "b"]) act("add-event", { id: `event:${id}`, name: `Party ${id}`, ...WHEN });
    act("connect-event-who", { id: "event:b", to: "person:ana" });
    const engine = start();
    await engine.run();
    const [a, b] = ["event:a", "event:b"].map((id) => engine.linkOf(id)!);
    remote.writes.length = 0;
    act("merge-event", { id: "event:b", into: "event:a" });
    await engine.run();
    expect(remote.writes).toEqual([`PATCH ${a} all`]);
    expect([a!, b!].map((id) => remote.events.get(id)!["attendees"])).toEqual([[{ email: "ana@example.com" }], [{ email: "ana@example.com" }]]);
  });

  it("whose event is deleted there is kept, said once, and made there again when it is brought back", async () => {
    const { act, node, remote, start } = calendar(false);
    act("add-event", { id: "event:party", name: "Party", ...WHEN });
    const first = start();
    await first.run();
    act("archive-event", { id: "event:party" });
    remote.change("evt1", { status: CANCELED });
    expect((await first.run()).said).toEqual(["Party is set aside here and its event was deleted in Google Calendar: it is kept here, and a new event is made if it is brought back"]);
    const second = start(first.snapshot);
    expect([(await second.run()).said ?? [], node("event:party")!["$archived"]]).toEqual([[], true]);
    remote.writes.length = 0;
    act("unarchive-event", { id: "event:party" });
    expect((await second.run()).said).toEqual(["Party was brought back here with no event in Google Calendar, so a new one was made"]);
    expect([remote.writes, second.linkOf("event:party")]).toEqual([["POST none"], "evt2"]);
    expect((await second.run()).pushed).toEqual([]);
  });

  it("whose event leaves the connection's filter is still its event's, and lands again when it comes back in", async () => {
    const { act, node, remote, start } = calendar(false, { filter: { tag: "#home" } });
    act("add-event", { id: "event:party", name: "Party", ...WHEN });
    const engine = start();
    await engine.run();
    remote.writes.length = 0;
    act("archive-event", { id: "event:party" });
    remote.change("evt1", { summary: "Party" });
    expect([(await engine.run()).said ?? [], node("event:party")!["$archived"], engine.linkOf("event:party")]).toEqual([[], true, "evt1"]);
    remote.change("evt1", { summary: "Big party #home" });
    await engine.run();
    expect(node("event:party")!["name"]).toBe("Big party");
    act("unarchive-event", { id: "event:party" });
    await engine.run();
    expect(remote.writes).toEqual([]);
  });

  it("brought back with its event out of the filter, is kept, said, no longer in step, and never removed", async () => {
    const { act, node, remote, start } = calendar(false, { filter: { tag: "#home" } });
    act("add-event", { id: "event:party", name: "Party", ...WHEN });
    const engine = start();
    await engine.run();
    remote.writes.length = 0;
    act("archive-event", { id: "event:party" });
    await engine.run();
    remote.change("evt1", { summary: "Party" });
    await engine.run();
    act("unarchive-event", { id: "event:party" });
    expect((await engine.run()).said).toEqual(["Party was brought back here, and its event in Google Calendar is no longer one this connection keeps: it is kept here, and no longer in step"]);
    remote.change("evt1", { location: "Elsewhere" });
    expect((await engine.run()).said ?? []).toEqual([]);
    expect([node("event:party")!["name"], remote.writes]).toEqual(["Party", []]);
  });

  it("takes nobody off and invites nobody new for a person set aside whose other addresses the event does not hold", async () => {
    const { act, store, remote, start } = calendar(true);
    act("add-event", { id: "event:party", name: "Party", ...WHEN });
    const engine = start();
    await engine.run();
    remote.change("evt1", { attendees: [{ email: "ana@example.com" }] });
    await engine.run();
    act("add-person", ANA);
    act("add-person", { id: "person:kay", name: "Kay", emails: ["k@example.com", "ana@example.com"], inviteMe: true });
    act("merge-person", { id: "person:ana", into: "person:kay" });
    act("archive-person", { id: "person:kay" });
    remote.writes.length = 0;
    await engine.run();
    expect([remote.writes, store.graph.out("event:party", "who", { archived: "all" })]).toEqual([[], []]);
    // A live person holding one of the addresses is the guest, and the other address stays as Google has it.
    act("unarchive-person", { id: "person:kay" });
    await engine.run();
    remote.change("evt1", { attendees: ["a", "ana", "k"].map((one) => ({ email: `${one}@example.com` })) });
    remote.writes.length = 0;
    await engine.run();
    await engine.run();
    expect([remote.writes, store.graph.out("event:party", "who", { archived: "all" }).map((one) => one.id)]).toEqual([[], ["person:kay"]]);
  });

  it("whose event was already deleted before this is sent nothing, then made there again when it is brought back, and said", async () => {
    const { act, remote, start } = calendar(false);
    act("add-event", { id: "event:party", name: "Party", ...WHEN });
    const first = start();
    await first.run();
    act("archive-event", { id: "event:party" });
    remote.change("evt1", { status: CANCELED });
    remote.writes.length = 0;
    const second = start({ ...first.snapshot, links: {} });
    for (let pass = 0; pass < 2; pass += 1) expect((await second.run()).said ?? []).toEqual([]);
    expect(remote.writes).toEqual([]);
    const third = start(second.snapshot);
    act("unarchive-event", { id: "event:party" });
    expect((await third.run()).said).toEqual(["Party was brought back here with no event in Google Calendar, so a new one was made"]);
    expect(remote.writes).toEqual(["POST none"]);
  });

  it("keeps its event where a host wires the calendar's mapping itself", async () => {
    const { act, store, remote } = calendar(false);
    act("add-event", { id: "event:party", name: "Party", ...WHEN });
    const engine = new SyncEngine<AnySchema>(
      {
        store,
        mapping: googleCalendarMapping({ events: [{ kind: "event", summary: "name", start: "starts", end: "ends" }] }),
        remote: googleCalendar({ calendarId: "c", token: () => "t", fetch: remote.fetch }),
        applyInbound: ({ localId, fields }) => ({ name: "edit-event", args: { id: localId, ...fields } }),
      },
      EMPTY_SYNC_STATE,
    );
    await engine.run();
    act("archive-event", { id: "event:party" });
    await engine.run();
    expect(remote.writes).toEqual(["POST none"]);
  });
});
