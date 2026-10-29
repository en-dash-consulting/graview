import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { scriptedNotion, type Fetcher } from "@graview/core/sync";
import { fileConnectionState, readEnvFile, runConnections, sayReport } from "../../src/index.js";

/**
 * THE DECLARED CONNECTIONS, RUN BESIDE A SERVED STORE: credentials from the
 * environment (or the file the declaration names), the engine's cursor and
 * links kept in a file beside the data so a restart sends nothing twice,
 * changes from the calendar credited to it in the log, and a sentence for a
 * connection that cannot start.
 */

const document = (connection: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Meetings",
  kinds: { meeting: { fields: { name: { type: "string", required: true }, starts: { type: "datetime" }, ends: { type: "datetime" } } } },
  acts: { "add-meeting": { creates: "meeting" } },
  connections: {
    team: {
      system: "google-calendar",
      calendar: { env: "TEAM_CALENDAR" },
      kind: "meeting",
      fields: { summary: "name", start: "starts", end: "ends" },
      direction: "both",
      ...connection,
    },
  },
});

/** A Google calendar in memory, with sync tokens: what the runner reaches instead of Google. */
function google() {
  const events = new Map<string, Record<string, unknown> & { seq: number }>();
  let seq = 0;
  const asked: string[] = [];
  const put = (event: Record<string, unknown>) => {
    seq += 1;
    const stamped = { ...event, etag: `"e${seq}"`, seq };
    events.set(String(event["id"]), stamped);
    const { seq: _seq, ...plain } = stamped;
    return plain;
  };
  const fetch: Fetcher = async (url, init) => {
    if (url.startsWith("https://oauth2.googleapis.com/")) {
      asked.push(`TOKEN ${init?.body ?? ""}`);
      return { ok: true, status: 200, json: async () => ({ access_token: "minted", expires_in: 3600 }) };
    }
    asked.push(`${init?.method ?? "GET"} ${init?.headers?.["authorization"] ?? ""}`);
    const at = new URL(url);
    if ((init?.method ?? "GET") === "GET") {
      const since = Number(at.searchParams.get("syncToken") ?? "0");
      const items = [...events.values()].filter((event) => event.seq > since).map(({ seq: _seq, ...event }) => event);
      return { ok: true, status: 200, json: async () => ({ items, nextSyncToken: String(seq) }) };
    }
    const made = put({ id: `evt${seq + 1}`, ...(JSON.parse(init!.body!) as object) });
    return { ok: true, status: 200, json: async () => made };
  };
  return { fetch, asked, add: (event: Record<string, unknown>) => put({ id: `g${seq + 1}`, ...event }), events };
}

function open(raw: unknown, snapshot: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }) {
  const compiled = compileDocument(raw);
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
  const app = compiled.app as GraviewApp<AnySchema>;
  return { app, store: new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], snapshot: snapshot as never }) };
}

const env = { TEAM_CALENDAR: "team@example.com", GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret", GOOGLE_REFRESH_TOKEN: "refresh" };

describe("a served store's declared connections", () => {
  it("run with the host's token, credit the calendar, and keep their cursor beside the data across a restart", async () => {
    const remote = google();
    remote.add({ summary: "Standup", start: { dateTime: "2026-11-02T15:00:00Z" }, end: { dateTime: "2026-11-02T15:30:00Z" } });
    const stateFile = join(mkdtempSync(join(tmpdir(), "graview-connections-")), "Meetings", "connections.json");
    const tokens: unknown[] = [];

    const first = open(document());
    const said: string[] = [];
    const running = runConnections({
      ...first,
      state: fileConnectionState(stateFile),
      env,
      fetch: remote.fetch,
      token: (request) => {
        tokens.push({ connection: request.connection, refresh: request.refresh ?? false });
        return "host-token";
      },
      say: (line) => said.push(line),
    });
    expect(running.running).toEqual(["team"]);
    await running.runNow();
    const meetings = () => first.store.graph.allNodes().filter((node) => node.kind === "meeting");
    expect(meetings()).toHaveLength(1);
    expect(first.store.log.all().at(-1)!.author).toEqual({ kind: "system", id: "google-calendar" });
    expect(tokens[0]).toEqual({ connection: "team", refresh: false });
    expect(remote.asked.every((line) => line.endsWith("Bearer host-token"))).toBe(true);
    expect(said.some((line) => line.includes("took 1 from the calendar"))).toBe(true);
    await running.stop();

    const kept = JSON.parse(readFileSync(stateFile, "utf8")) as { connections: Record<string, { cursor?: string; links: Record<string, unknown> }> };
    expect(kept.connections["team"]!.cursor).toBe("1");
    expect(Object.keys(kept.connections["team"]!.links)).toHaveLength(1);

    // A restart over the same data: the kept links mean the meeting is not made a second time, nor sent back.
    const again = open(document(), first.store.graph.snapshot() as never);
    const second = runConnections({ ...again, state: fileConnectionState(stateFile), env, fetch: remote.fetch, token: () => "host-token" });
    const reports = await second.runNow();
    await second.stop();
    expect(reports["team"]!.pushed).toEqual([]);
    expect(again.store.graph.allNodes().filter((node) => node.kind === "meeting")).toHaveLength(1);
  });

  it("read the credentials the declaration's auth names, from its file when the environment lacks them, and say what is missing", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "graview-creds-")), "google.env");
    writeFileSync(file, "WORK_CLIENT_ID=a\nWORK_CLIENT_SECRET=b\nWORK_REFRESH_TOKEN=c\nTEAM_CALENDAR=cal\n");
    const remote = google();
    const withFile = runConnections({ ...open(document({ auth: { env: "WORK", file } })), env: {}, readFile: readEnvFile, fetch: remote.fetch });
    expect(withFile.running).toEqual(["team"]);
    await withFile.runNow();
    await withFile.stop();
    // The refresh token from the file was traded for an access token, and that token reached the calendar.
    expect(remote.asked[0]).toBe("TOKEN client_id=a&client_secret=b&refresh_token=c&grant_type=refresh_token");
    expect(remote.asked[1]).toBe("GET Bearer minted");

    const said: string[] = [];
    const without = runConnections({ ...open(document()), env: { TEAM_CALENDAR: "cal", GOOGLE_CLIENT_ID: "id" }, say: (line) => said.push(line) });
    expect(without.running).toEqual([]);
    expect(said).toEqual(["team: not started: GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN are not set in the environment"]);
  });

  it("run nothing when paused, by the declaration or by --no-sync", () => {
    const said: string[] = [];
    expect(runConnections({ ...open(document({ paused: true })), env, say: (line) => said.push(line) }).running).toEqual([]);
    expect(runConnections({ ...open(document()), env, paused: true, say: (line) => said.push(line) }).running).toEqual([]);
    expect(said).toEqual(["team: paused (declared); nothing is synced", "team: paused (--no-sync); nothing is synced"]);
  });

  it("start a pass soon after a change made here", async () => {
    const remote = google();
    const opened = open(document());
    const running = runConnections({ ...opened, env, fetch: remote.fetch, token: () => "t", settle: 10 });
    await running.runNow();
    opened.store.apply({ name: "add-meeting", args: { id: "meeting:plan", name: "Planning", starts: "2026-11-03T15:00:00Z", ends: "2026-11-03T16:00:00Z" } }, { author: { kind: "human", id: "nick" } });
    await new Promise((settled) => setTimeout(settled, 80));
    await running.stop();
    expect([...remote.events.values()].map((event) => event["summary"])).toEqual(["Planning"]);
  });
});

describe("a pass's line (FR-181)", () => {
  it("says a change from the calendar this store refused by the calendar's event, and not as a calendar it could not reach", () => {
    const report = {
      system: "google-calendar", applied: [], echoes: [], conflicts: [], resolved: [], pushed: [], queued: [], gone: [], offline: false,
      refused: [{ localId: "", resource: "events", id: "g1", error: "Nothing lands while the host is read only." }],
      state: { links: {}, outbox: [] },
    };
    expect(sayReport(report)).toBe("refused: the calendar's g1 (Nothing lands while the host is read only.)");
  });
});

/* ------------------------------------------- a Notion database (f-notion-connection) */

const tasks = (connection: Record<string, unknown> = {}) => ({
  format: "graview-document",
  formatVersion: 1,
  name: "Tasks",
  kinds: { task: { fields: { name: { type: "string", required: true }, done: { type: "boolean" } } } },
  acts: { "add-task": { creates: "task" } },
  connections: { board: { system: "notion", database: { env: "TASKS_DATABASE" }, kind: "task", properties: { name: "Name", done: "Done" }, direction: "both", ...connection } },
});

describe("a served store's declared Notion database", () => {
  it("runs with the integration's secret from the environment, credits Notion, and sends a record made here", async () => {
    const notion = scriptedNotion();
    const database = notion.database({ properties: { Name: "title", Done: "checkbox" } });
    notion.add(database, { Name: "Water the plants" });
    const opened = open(tasks());
    const said: string[] = [];
    const running = runConnections({ ...opened, env: { TASKS_DATABASE: database, NOTION_TOKEN: notion.secret }, fetch: notion.fetch, say: (line) => said.push(line) });
    expect(running.running).toEqual(["board"]);
    await running.runNow();
    const records = () => opened.store.graph.allNodes().filter((node) => node.kind === "task") as unknown as Record<string, unknown>[];
    expect(records().map((record) => record["name"])).toEqual(["Water the plants"]);
    expect(opened.store.log.all().at(-1)!.author).toEqual({ kind: "system", id: "notion" });
    expect(said).toContain("board: took 1 from Notion");

    opened.store.apply({ name: "add-task", args: { id: "task:feed", name: "Feed the cat" } }, { author: { kind: "human", id: "nick" } });
    await running.runNow();
    await running.stop();
    expect(notion.pages(database)).toHaveLength(2);
    expect(said).toContain("board: sent 1 to Notion");
    expect(said.join("\n")).not.toContain(notion.secret);
  });

  it("asks the host for the secret when it keeps it, and reads the database's id the host keeps", async () => {
    const notion = scriptedNotion();
    const database = notion.database({ properties: { Name: "title", Done: "checkbox" } });
    const asked: unknown[] = [];
    const running = runConnections({
      ...open(tasks()),
      env: {},
      fetch: notion.fetch,
      database: ({ connection }) => (connection === "board" ? database : undefined),
      token: (request) => {
        asked.push([request.connection, request.declaration.system]);
        return notion.secret;
      },
    });
    const reports = await running.runNow();
    await running.stop();
    expect(reports["board"]!.offline).toBe(false);
    expect(asked[0]).toEqual(["board", "notion"]);
  });

  it("says a missing secret by its name, and a refused one as the reason it could not reach Notion", async () => {
    const said: string[] = [];
    const missing = runConnections({ ...open(tasks()), env: { TASKS_DATABASE: "1f2e3d4c5b6a79881f2e3d4c5b6a7988" }, say: (line) => said.push(line) });
    expect(missing.running).toEqual([]);
    expect(said).toEqual(["board: not started: NOTION_TOKEN is not set in the environment"]);

    const notion = scriptedNotion();
    const database = notion.database({ properties: { Name: "title", Done: "checkbox" } });
    said.length = 0;
    const refused = runConnections({ ...open(tasks({ auth: { env: "WORK_NOTION" } })), env: { TASKS_DATABASE: database, WORK_NOTION_TOKEN: "secret_NotTheOneNotionTakes000000000000" }, fetch: notion.fetch, say: (line) => said.push(line) });
    await refused.runNow();
    await refused.stop();
    expect(said.at(-1)).toMatch(/^board: could not reach Notion \(notion: Notion refused WORK_NOTION_TOKEN \(HTTP 401\).*\); will try again$/);
    expect(said.join("\n")).not.toContain("secret_NotTheOne");
  });
});

/* ------------------------------ several Notion tables joined by a relation (f-notion-several-tables) */

describe("a served store's Notion tables joined by a relation", () => {
  it("links a page of one connection to a record another connection reads, in one pass whichever runs first, and sends nothing", async () => {
    const notion = scriptedNotion();
    const fleet = notion.database({ title: "Reindeer Fleet", properties: { Name: "title" } });
    const checks = notion.database({ title: "Reindeer Health Checks", properties: { Name: "title", "Reindeer Fleet": "relation" }, relations: { "Reindeer Fleet": { to: fleet, dual: true } } });
    const comet = notion.add(fleet, { Name: "Comet" });
    notion.add(checks, { Name: "Hooves", "Reindeer Fleet": [String(comet["id"])] });
    // The checks are declared first, so they run before the fleet they reach is read.
    const opened = open({
      format: "graview-document",
      formatVersion: 1,
      name: "North Pole",
      kinds: {
        reindeer: { fields: { name: { type: "string", required: true } } },
        check: { fields: { name: { type: "string", required: true } }, edges: { reindeer: { to: ["reindeer"], cardinality: "one" } } },
      },
      acts: { "add-reindeer": { creates: "reindeer" }, "add-check": { creates: "check" } },
      connections: {
        checks: { system: "notion", database: checks, kind: "check", properties: { name: "Name", reindeer: "Reindeer Fleet" }, direction: "both" },
        fleet: { system: "notion", database: fleet, kind: "reindeer", properties: { name: "Name" }, direction: "both" },
      },
    });
    const said: string[] = [];
    const running = runConnections({ ...opened, env: { NOTION_TOKEN: notion.secret }, fetch: notion.fetch, say: (line) => said.push(line) });
    await running.runNow();
    const named = (kind: string, name: string) => opened.store.graph.allNodes().find((node) => node.kind === kind && (node as unknown as Record<string, unknown>)["name"] === name)!.id;
    expect(opened.store.graph.out(named("check", "Hooves"), "reindeer").map((node) => node.id)).toEqual([named("reindeer", "Comet")]);
    expect(said).toContain("checks: linked 1 to records another connection read");
    const again = await running.runNow();
    await running.stop();
    expect(Object.values(again).every((report) => report.pushed.length === 0 && report.applied.length === 0)).toBe(true);
  });
});

describe("sayReport counts the guests a pass invited and took off", () => {
  it("says invited 2 to 3 events · 1 taken off, from the writes that reached the calendar", () => {
    const report = {
      system: "google-calendar", applied: [], echoes: [], conflicts: [], resolved: [], pushed: ["a", "b", "c"], queued: [], refused: [], gone: [], offline: false, state: { links: {}, outbox: [] },
      guests: [
        { localId: "a", invited: ["ada@example.com"], removed: [] },
        { localId: "b", invited: ["ada@example.com"], removed: ["bo@example.com"] },
        { localId: "c", invited: [], removed: [], leftOut: [{ person: "kid", why: "invite-off" as const }] },
      ],
    };
    expect(sayReport(report)).toBe("sent 3 to it · invited 2 to 2 events · 1 taken off");
  });
});

/* ------------------------------ one database of several kinds, its properties made (request: Notion autocreates) */

describe("a served store's Notion database of several data sources", () => {
  it("keeps each source with its kind, makes the properties a source lacks, and says what it made in the pass's line", async () => {
    const notion = scriptedNotion();
    const database = notion.database({ title: "Chores", properties: { Name: "title" } });
    notion.source(database, { title: "Rooms", properties: { Name: "title" } });
    const [, rooms] = notion.sources(database);
    notion.add(rooms!, { Name: "Kitchen" });
    const opened = open({
      format: "graview-document",
      formatVersion: 1,
      name: "Chores",
      kinds: { task: { fields: { name: { type: "string", required: true }, done: { type: "boolean" } } }, room: { fields: { name: { type: "string", required: true } } } },
      acts: { "add-task": { creates: "task" }, "add-room": { creates: "room" } },
      connections: {
        house: {
          system: "notion",
          database: { env: "CHORES_DATABASE" },
          direction: "both",
          sources: [
            { source: "Chores", kind: "task", properties: { name: "Name", done: "Done" } },
            { source: "Rooms", kind: "room" },
          ],
        },
      },
    });
    const said: string[] = [];
    const running = runConnections({ ...opened, env: { CHORES_DATABASE: database, NOTION_TOKEN: notion.secret }, fetch: notion.fetch, say: (line) => said.push(line) });
    await running.runNow();
    await running.stop();
    expect(said).toContain("house: keeping in step with a Notion database into task, room, every 30 s");
    expect(said).toContain("house: took 1 from Notion · Made 1 property in Notion for task: Done");
    expect(opened.store.graph.allNodes().map((node) => `${node.kind} ${String((node as unknown as Record<string, unknown>)["name"])}`)).toEqual(["room Kitchen"]);
  });
});

/* ------------------------------ each pass's report handed to the host (request:notion-said-names-its-source) */

describe("runConnections hands a host each pass's reports", () => {
  it("hands back the first pass's reports and each pass's through onReport, with every sentence and the kind it is of", async () => {
    const notion = scriptedNotion();
    const database = notion.database({ title: "Chores", properties: { Name: "title" } });
    notion.source(database, { title: "Rooms", properties: { Name: "title" } });
    const opened = open({
      format: "graview-document",
      formatVersion: 1,
      name: "Chores",
      kinds: { task: { fields: { name: { type: "string", required: true }, done: { type: "boolean" } } }, room: { fields: { name: { type: "string", required: true } } } },
      acts: { "add-task": { creates: "task" }, "add-room": { creates: "room" } },
      connections: {
        house: { system: "notion", database: { env: "CHORES_DATABASE" }, direction: "both", sources: [{ source: "Chores", kind: "task", properties: { name: "Name", done: "Done" } }, { source: "Rooms", kind: "room" }] },
      },
    });
    const handed: string[] = [];
    const running = runConnections({
      ...opened,
      env: { CHORES_DATABASE: database, NOTION_TOKEN: notion.secret },
      fetch: notion.fetch,
      onReport: (name, report) => handed.push(`${name} ${report.system} pushed ${report.pushed.length}`),
    });
    const first = await running.firstPass;
    expect(Object.keys(first)).toEqual(["house"]);
    expect(first["house"]!.saidBy).toEqual([{ kind: "task", sentence: "Made 1 property in Notion for task: Done" }]);
    expect(handed).toEqual(["house notion pushed 0"]);
    await running.runNow();
    await running.stop();
    expect(handed).toEqual(["house notion pushed 0", "house notion pushed 0"]);
  });

  it("settles the first pass empty when nothing runs, and says a host's onReport that throws without stopping the pass", async () => {
    expect(await runConnections({ ...open(document({ paused: true })), env: {} }).firstPass).toEqual({});
    const remote = google();
    const said: string[] = [];
    const running = runConnections({
      ...open(document()),
      env: { TEAM_CALENDAR: "cal" },
      fetch: remote.fetch,
      token: () => "t",
      say: (line) => said.push(line),
      onReport: () => {
        throw new Error("the host fell over");
      },
    });
    expect(Object.keys(await running.firstPass)).toEqual(["team"]);
    await running.stop();
    expect(said).toContain("team: onReport failed: the host fell over");
  });
});
