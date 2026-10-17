import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import type { Fetcher } from "@graview/core/sync";
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
    opened.store.apply({ name: "add-meeting", args: { id: "plan", name: "Planning", starts: "2026-11-03T15:00:00Z", ends: "2026-11-03T16:00:00Z" } }, { author: { kind: "human", id: "nick" } });
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
