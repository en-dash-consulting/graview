import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "../../src/index.js";
import { googleCalendar, googleCalendarMapping, SyncEngine, type Fetcher } from "../../src/sync/index.js";

/**
 * What the live run against a real Google calendar found that a scripted
 * remote had never asked: an access token that ends mid-run, a calendar
 * longer than one page, a deletion answered with no body, an all-day event,
 * and the canceled events a first full pull lists. Each is scripted here the
 * way Google actually answered (`scripts/verify-google-calendar.mjs` is the
 * live proof).
 */

type Answer = { status: number; body?: unknown };
type Seen = { url: string; method: string; authorization: string };

/** A fetcher that answers from a list, and records what it was asked. */
function scripted(answers: readonly Answer[]): { fetch: Fetcher; seen: Seen[] } {
  const queue = [...answers];
  const seen: Seen[] = [];
  const fetch: Fetcher = async (url, init) => {
    seen.push({ url, method: init?.method ?? "GET", authorization: init?.headers?.["authorization"] ?? "" });
    const answer = queue.shift() ?? { status: 500 };
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => {
        if (answer.body === undefined) throw new SyntaxError("Unexpected end of JSON input");
        return answer.body;
      },
    };
  };
  return { fetch, seen };
}

/** A token source that hands out "stale" until it is told to refresh. */
function tokens() {
  const asked: { refresh?: boolean }[] = [];
  let current = "stale";
  return {
    asked,
    token(request?: { readonly refresh?: boolean }) {
      asked.push({ ...request });
      if (request?.refresh) current = `fresh-${asked.length}`;
      return current;
    },
  };
}

const event = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  etag: `"${id}-1"`,
  summary: id,
  start: { dateTime: "2026-10-20T15:00:00Z" },
  end: { dateTime: "2026-10-20T16:00:00Z" },
  ...extra,
});

describe("an access token Google refuses", () => {
  it("is asked for again once, marked as a refresh, and the request goes through", async () => {
    const source = tokens();
    const { fetch, seen } = scripted([
      { status: 401, body: { error: { message: "Invalid Credentials" } } },
      { status: 200, body: { items: [event("a")], nextSyncToken: "s1" } },
    ]);
    const remote = googleCalendar({ calendarId: "c", token: source.token, fetch });
    const { changes, cursor } = await remote.pull();

    expect(changes.map((change) => change.id)).toEqual(["a"]);
    expect(cursor).toBe("s1");
    expect(source.asked).toEqual([{}, { refresh: true }]);
    expect(seen.map((one) => one.authorization)).toEqual(["Bearer stale", "Bearer fresh-2"]);
  });

  it("refreshes on a write too, so a push is not refused for an expired token", async () => {
    const source = tokens();
    const { fetch } = scripted([{ status: 401, body: {} }, { status: 200, body: { id: "evt", etag: '"e"' } }]);
    const remote = googleCalendar({ calendarId: "c", token: source.token, fetch });
    const acks = await remote.push([{ resource: "events", localId: "x", fields: { summary: "X" } }]);
    expect(acks).toEqual([{ localId: "x", id: "evt", version: '"e"' }]);
  });

  it("refused a second time, says it was the token rather than looking offline", async () => {
    const source = tokens();
    const { fetch } = scripted([{ status: 401, body: {} }, { status: 401, body: {} }]);
    const remote = googleCalendar({ calendarId: "c", token: source.token, fetch });
    await expect(remote.pull()).rejects.toThrow(/refused the access token.*token\(\{ refresh: true \}\)/);
    expect(source.asked).toHaveLength(2);
  });
});

describe("a calendar longer than one page", () => {
  it("follows nextPageToken to the end and keeps only the last page's sync token", async () => {
    const { fetch, seen } = scripted([
      { status: 200, body: { items: [event("a"), event("b")], nextPageToken: "p2" } },
      { status: 200, body: { items: [event("c")], nextPageToken: "p3" } },
      { status: 200, body: { items: [event("d")], nextSyncToken: "s-end" } },
    ]);
    const remote = googleCalendar({ calendarId: "c", token: () => "t", fetch, pageSize: 2 });
    const { changes, cursor } = await remote.pull();

    expect(changes.map((change) => change.id)).toEqual(["a", "b", "c", "d"]);
    expect(cursor).toBe("s-end");
    expect(new URL(seen[0]!.url).searchParams.get("maxResults")).toBe("2");
    expect(new URL(seen[1]!.url).searchParams.get("pageToken")).toBe("p2");
    expect(new URL(seen[2]!.url).searchParams.get("pageToken")).toBe("p3");
    // Every page of a first pull still asks for deletions.
    expect(seen.every((one) => new URL(one.url).searchParams.get("showDeleted") === "true")).toBe(true);
  });

  it("follows pages of an incremental pull with the sync token on each", async () => {
    const { fetch, seen } = scripted([
      { status: 200, body: { items: [event("a")], nextPageToken: "p2" } },
      { status: 200, body: { items: [event("b")], nextSyncToken: "s2" } },
    ]);
    const remote = googleCalendar({ calendarId: "c", token: () => "t", fetch });
    const { changes, cursor } = await remote.pull("s1");
    expect(changes).toHaveLength(2);
    expect(cursor).toBe("s2");
    expect(seen.map((one) => new URL(one.url).searchParams.get("syncToken"))).toEqual(["s1", "s1"]);
  });

  it("starts the whole pull over when the sync token is rejected, paging the full list", async () => {
    const { fetch, seen } = scripted([
      { status: 410, body: { error: { message: "Sync token is no longer valid" } } },
      { status: 200, body: { items: [event("a")], nextPageToken: "p2" } },
      { status: 200, body: { items: [event("b")], nextSyncToken: "fresh" } },
    ]);
    const remote = googleCalendar({ calendarId: "c", token: () => "t", fetch });
    const { changes, cursor } = await remote.pull("stale");
    expect(changes.map((change) => change.id)).toEqual(["a", "b"]);
    expect(cursor).toBe("fresh");
    expect(new URL(seen[1]!.url).searchParams.get("syncToken")).toBeNull();
  });
});

describe("a deletion Google answers with no body", () => {
  it("is acknowledged, not reported as refused", async () => {
    const { fetch, seen } = scripted([{ status: 204 }]);
    const remote = googleCalendar({ calendarId: "c", token: () => "t", fetch });
    const acks = await remote.push([{ resource: "events", id: "evt", localId: "x", deleted: true }]);
    expect(acks).toEqual([{ localId: "x", id: "evt", version: "" }]);
    expect(seen[0]!.method).toBe("DELETE");
  });
});

describe("an all-day event", () => {
  it("arrives with its day as start.date and end.date, and no time is invented for it", async () => {
    const { fetch } = scripted([
      {
        status: 200,
        body: {
          items: [{ id: "day", etag: '"d"', summary: "Offsite", start: { date: "2026-10-21" }, end: { date: "2026-10-22" } }],
          nextSyncToken: "s",
        },
      },
    ]);
    const remote = googleCalendar({ calendarId: "c", token: () => "t", fetch });
    const { changes } = await remote.pull();
    expect(changes[0]!.fields).toEqual({ summary: "Offsite", "start.date": "2026-10-21", "end.date": "2026-10-22" });
  });
});

describe("the canceled events a first full pull lists", () => {
  const meeting = defineNode("meeting", {
    fields: z.object({ name: z.string(), starts: z.string().optional(), ends: z.string().optional() }),
    plural: "Meetings",
  });
  const schema = createSchema([meeting]);
  const bound = bindSchema(schema);
  const add = bound.defineMutation("add-meeting", {
    title: "Add a meeting",
    description: "Put a meeting on the calendar.",
    input: z.object({ id: z.string(), name: z.string(), starts: z.string().optional(), ends: z.string().optional() }),
    apply(ctx, args) {
      ctx.addNode({ kind: "meeting", ...args });
    },
  });
  const edit = bound.defineMutation("edit-meeting", {
    title: "Change a meeting",
    description: "Change a meeting.",
    subject: { kinds: ["meeting"], arg: "id" },
    input: z.object({ id: nodeRef(["meeting"]), name: z.string().optional() }),
    apply(ctx, args) {
      if (args.name !== undefined) ctx.patchNode(args.id, { name: args.name });
    },
  });

  it("are not offered to createInbound as records to make", async () => {
    const live = new Store({ schema, mutations: [add, edit], snapshot: { nodes: [], edges: [] } });
    const offered: string[] = [];
    const { fetch } = scripted([
      {
        status: 200,
        body: { items: [event("kept"), { id: "long-gone", etag: '"g"', status: "cancelled" }], nextSyncToken: "s" },
      },
    ]);
    const engine = new SyncEngine({
      store: live,
      mapping: googleCalendarMapping({ events: [{ kind: "meeting", summary: "name", start: "starts", end: "ends" }] }),
      remote: googleCalendar({ calendarId: "c", token: () => "t", fetch }),
      applyInbound: ({ localId, fields }) => ({ name: "edit-meeting", args: { id: localId, ...fields } }),
      createInbound: ({ id, fields }) => {
        offered.push(id);
        return { name: "add-meeting", args: { id: `m-${id}`, name: String(fields["summary"] ?? "") } };
      },
    });
    await engine.run();
    expect(offered).toEqual(["kept"]);
    expect(live.graph.allNodes().map((node) => node.id)).toEqual(["m-kept"]);
  });
});
