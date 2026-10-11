import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, PermissionDeniedError, Store } from "../../src/index.js";
import {
  allowTools,
  doorClient,
  mcpClient,
  mcpDoor,
  mcpRemote,
  sameOrigin,
  SyncEngine,
  type ConflictPolicy,
  type DoorRequest,
  type RemoteAck,
  type RemoteChange,
  type RemoteSystem,
  type RemoteWrite,
  type SyncMapping,
  type SyncState,
} from "../../src/sync/index.js";

/**
 * What a product built on the engine from outside had to work around (n-dx's
 * face pre-empted every conflict to the remote's value, kept its own table of
 * read-only kinds, seeded its own links, hand-built an MCP door and was
 * refused the same delete on every pass). Each is the engine's now.
 */

const task = defineNode("task", {
  fields: z.object({ title: z.string(), status: z.string(), lastModified: z.string().optional() }),
  plural: "Tasks",
});
const zone = defineNode("zone", {
  fields: z.object({ title: z.string(), lastModified: z.string().optional() }),
  plural: "Zones",
});
const schema = createSchema([task, zone]);
const bound = bindSchema(schema);
const retitle = bound.defineMutation("retitle", {
  title: "Change it",
  description: "Change a task's title or status.",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]), title: z.string().optional(), status: z.string().optional() }),
  apply(ctx, args) {
    const patch: Record<string, unknown> = {};
    if (args.title !== undefined) patch["title"] = args.title;
    if (args.status !== undefined) patch["status"] = args.status;
    ctx.patchNode(args.id, patch);
  },
});
const rezone = bound.defineMutation("rezone", {
  title: "Rename a zone",
  description: "Rename a zone.",
  subject: { kinds: ["zone"], arg: "id" },
  input: z.object({ id: nodeRef(["zone"]), title: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { title: args.title });
  },
});
const dropTask = bound.defineMutation("drop-task", {
  title: "Drop a task",
  description: "Remove a task.",
  subject: { kinds: ["task"], arg: "id" },
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});
const dropZone = bound.defineMutation("drop-zone", {
  title: "Drop a zone",
  description: "Remove a zone.",
  subject: { kinds: ["zone"], arg: "id" },
  input: z.object({ id: nodeRef(["zone"]) }),
  apply(ctx, args) {
    ctx.removeNode(args.id);
  },
});

const OWNED = "sourcevision owns the zones: re-run the analysis to change them.";
const mapping: SyncMapping = {
  system: "n-dx",
  resources: [
    { kind: "task", resource: "task", fields: { title: "title", status: "status" }, version: "lastModified" },
    { kind: "zone", resource: "zone", fields: { title: "title" }, version: "lastModified", readonly: true, because: OWNED },
  ],
};

const projected = () =>
  new Store({
    schema,
    mutations: [retitle, rezone, dropTask, dropZone],
    snapshot: {
      nodes: [
        { id: "t1", kind: "task", title: "Write it", status: "pending", lastModified: "v1" },
        { id: "z1", kind: "zone", title: "Core", lastModified: "v1" },
      ],
      edges: [],
    },
  });

function remote(pulls: { changes: RemoteChange[] }[] = [], refuse?: (write: RemoteWrite) => string | undefined) {
  const sent: RemoteWrite[][] = [];
  const queue = [...pulls];
  const system: RemoteSystem & { sent: RemoteWrite[][] } = {
    name: "n-dx",
    sent,
    async pull() {
      return { changes: queue.shift()?.changes ?? [], cursor: "c" };
    },
    async push(writes): Promise<RemoteAck[]> {
      sent.push([...writes]);
      return writes.map((write) => {
        const error = refuse?.(write);
        return { localId: write.localId, id: write.id ?? write.localId, version: `ours-${sent.length}`, ...(error ? { error } : {}) };
      });
    },
  };
  return system;
}

const engine = (store: Store<typeof schema>, from: RemoteSystem, conflicts?: ConflictPolicy, state?: SyncState) =>
  new SyncEngine(
    {
      store,
      mapping,
      remote: from,
      ...(conflicts ? { conflicts } : {}),
      applyInbound: ({ localId, kind, fields }) => ({ name: kind === "zone" ? "rezone" : "retitle", args: { id: localId, ...fields } }),
    },
    state,
  );

const theirTitle = (version: string, title: string): RemoteChange => ({ resource: "task", id: "t1", version, fields: { title, status: "pending" } });
const titleOf = (store: Store<typeof schema>, id = "t1") => (store.graph.getNode(id) as { title: string }).title;

describe("the engine links a projected graph at the version it was made from", () => {
  it("pushes nothing on the first run over a graph that carries its versions", async () => {
    const store = projected();
    const from = remote([{ changes: [{ resource: "task", id: "t1", version: "v1", fields: { title: "Write it", status: "pending" } }] }]);
    const sync = engine(store, from);
    expect(Object.keys(sync.snapshot.links).sort()).toEqual(["t1", "z1"]);
    expect(sync.snapshot.links["t1"]).toMatchObject({ id: "t1", version: "v1", fields: { title: "Write it", status: "pending" } });

    const report = await sync.run();
    expect(report.pushed).toEqual([]);
    expect(from.sent).toEqual([]);
    // The pull at the version it was made from is not news.
    expect(report.echoes).toEqual(["t1"]);
  });
});

describe("a field both sides changed goes where the policy says", () => {
  it("report (the default): holds it, never pushes it, and keeps reporting it until somebody chooses", async () => {
    const store = projected();
    const from = remote([{ changes: [theirTitle("v2", "Theirs")] }]);
    const sync = engine(store, from);
    store.apply({ name: "retitle", args: { id: "t1", title: "Ours" } });

    const report = await sync.run();
    expect(report.conflicts).toEqual([{ localId: "t1", field: "title", ours: "Ours", theirs: "Theirs", base: "Write it" }]);
    expect(report.resolved).toEqual([]);
    expect(from.sent.flat().some((write) => write.fields && "title" in write.fields)).toBe(false);
    expect(titleOf(store)).toBe("Ours");

    // A later pass that hears nothing new still holds it, and still sends nothing.
    const again = await sync.run();
    expect(again.conflicts).toHaveLength(1);
    expect(from.sent.flat().some((write) => write.fields && "title" in write.fields)).toBe(false);

    // Choosing releases it: ours is sent on the next pass.
    sync.resolve(again.conflicts[0]!, "ours");
    expect(sync.snapshot.conflicts).toBeUndefined();
    const chosen = await sync.run();
    expect(chosen.pushed).toEqual(["t1"]);
    expect(from.sent.at(-1)![0]!.fields).toMatchObject({ title: "Ours" });
  });

  it("theirs: lands the remote's value through the ordinary inbound act, authored by the system, and sends nothing back", async () => {
    const store = projected();
    const from = remote([{ changes: [theirTitle("v2", "Theirs")] }]);
    const sync = engine(store, from, "theirs");
    store.apply({ name: "retitle", args: { id: "t1", title: "Ours" } });
    const report = await sync.run();

    expect(report.conflicts).toEqual([]);
    expect(report.resolved).toEqual([{ localId: "t1", field: "title", ours: "Ours", theirs: "Theirs", base: "Write it", took: "theirs" }]);
    expect(titleOf(store)).toBe("Theirs");
    expect(store.log.all().at(-1)!.author).toEqual({ kind: "system", id: "n-dx" });
    expect(from.sent).toEqual([]);
  });

  it("ours: keeps ours and sends it in the same pass, and says so", async () => {
    const store = projected();
    const from = remote([{ changes: [theirTitle("v2", "Theirs")] }]);
    const sync = engine(store, from, "ours");
    store.apply({ name: "retitle", args: { id: "t1", title: "Ours" } });
    const report = await sync.run();

    expect(report.resolved).toEqual([expect.objectContaining({ field: "title", took: "ours" })]);
    expect(titleOf(store)).toBe("Ours");
    expect(report.pushed).toEqual(["t1"]);
    expect(from.sent[0]![0]!.fields).toMatchObject({ title: "Ours" });
  });
});

describe("a resource the remote owns", () => {
  it("is refused here, with the sentence it declared, once the engine guards the store", async () => {
    const store = projected();
    const sync = engine(store, remote());
    expect(sync.refuses("zone")).toBe(OWNED);
    expect(sync.refuses("task")).toBeUndefined();

    const unguard = sync.guard();
    let refused: unknown;
    try {
      store.apply({ name: "rezone", args: { id: "z1", title: "Mine now" } });
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(PermissionDeniedError);
    expect((refused as Error).message).toBe(OWNED);
    expect(titleOf(store, "z1")).toBe("Core");
    // A record that is ours is not touched by the guard.
    store.apply({ name: "retitle", args: { id: "t1", title: "Still ours" } });
    expect(titleOf(store)).toBe("Still ours");

    unguard();
    store.apply({ name: "rezone", args: { id: "z1", title: "Unguarded" } });
    expect(titleOf(store, "z1")).toBe("Unguarded");
  });

  it("still takes what the remote says, and never sends a thing", async () => {
    const store = projected();
    const from = remote([{ changes: [{ resource: "zone", id: "z1", version: "v2", fields: { title: "Core, renamed" } }] }]);
    const sync = engine(store, from);
    sync.guard();
    const report = await sync.run();
    expect(report.applied).toEqual(["z1"]);
    expect(titleOf(store, "z1")).toBe("Core, renamed");
    expect(from.sent).toEqual([]);
  });

  it("refuses a delete made here once, with its sentence, and does not refuse it again", async () => {
    const store = projected();
    const from = remote();
    const sync = engine(store, from);
    store.apply({ name: "drop-zone", args: { id: "z1" } });
    const first = await sync.run();
    expect(first.refused).toEqual([{ localId: "z1", error: OWNED }]);
    expect(from.sent).toEqual([]);
    const second = await sync.run();
    expect(second.refused).toEqual([]);
  });
});

describe("a delete of a synced record", () => {
  it("is pushed when the remote takes it", async () => {
    const store = projected();
    const from = remote();
    const sync = engine(store, from);
    store.apply({ name: "drop-task", args: { id: "t1" } });
    const report = await sync.run();
    expect(report.pushed).toEqual(["t1"]);
    expect(from.sent[0]).toEqual([{ resource: "task", id: "t1", localId: "t1", deleted: true }]);
    expect(report.state.links["t1"]).toBeUndefined();
  });

  it("is refused once with the remote's reason, not on every pass", async () => {
    const store = projected();
    const from = remote([], (write) => (write.deleted ? "The projection never deletes: remove it in n-dx." : undefined));
    const sync = engine(store, from);
    store.apply({ name: "drop-task", args: { id: "t1" } });
    const first = await sync.run();
    expect(first.refused).toEqual([{ localId: "t1", error: "The projection never deletes: remove it in n-dx." }]);
    const second = await sync.run();
    expect(second.refused).toEqual([]);
    expect(from.sent).toHaveLength(1);
  });
});

describe("a field the mapping only sends", () => {
  it("is agreed once it is pushed, and not sent again on the next pass", async () => {
    const store = new Store({ schema, mutations: [retitle], snapshot: { nodes: [{ id: "t1", kind: "task", title: "Write it", status: "pending" }], edges: [] } });
    const from = remote();
    const sync = new SyncEngine({
      store,
      remote: from,
      mapping: { system: "n-dx", resources: [{ kind: "task", resource: "task", fields: { title: "title", status: "status" }, ours: ["status"] }] },
      applyInbound: ({ localId, fields }) => ({ name: "retitle", args: { id: localId, ...fields } }),
    });
    expect((await sync.run()).pushed).toEqual(["t1"]);
    expect((await sync.run()).pushed).toEqual([]);
    expect(from.sent).toHaveLength(1);
  });
});

describe("a store attributes what its reader does", () => {
  it("to the principal it was opened with, when a change names nobody", () => {
    const store = new Store({ schema, mutations: [retitle], principal: { kind: "human", id: "ada" }, snapshot: projected().snapshot() });
    store.apply({ name: "retitle", args: { id: "t1", title: "By Ada" } });
    expect(store.log.all().at(-1)!.author).toEqual({ kind: "human", id: "ada" });
    store.apply({ name: "retitle", args: { id: "t1", title: "By a seat" } }, { author: { kind: "agent", id: "seat" } });
    expect(store.log.all().at(-1)!.author).toEqual({ kind: "agent", id: "seat" });
  });
});

/** A fake streamable-HTTP MCP server: a session, tools answered as an event stream, a session it forgets once. */
function fakeServer() {
  const calls: { name: string; arguments: unknown }[] = [];
  let sessions = 0;
  let forget = false;
  const fetch = async (_url: string, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as { method: string; params?: { name: string; arguments: unknown } };
    const session = (init?.headers as Record<string, string>)["mcp-session-id"];
    if (body.method === "initialize") return new Response("{}", { headers: { "mcp-session-id": `s${++sessions}` } });
    if (body.method === "notifications/initialized") return new Response("", { status: 202 });
    if (forget && session === "s1") {
      forget = false;
      return new Response("gone", { status: 404 });
    }
    calls.push(body.params!);
    const text = JSON.stringify({ id: "t1", lastModified: "v9", session });
    return new Response(`event: message\ndata: ${JSON.stringify({ result: { content: [{ type: "text", text }] } })}\n\n`, {
      headers: { "content-type": "text/event-stream" },
    });
  };
  return { fetch, calls, forgetNext: () => (forget = true) };
}

describe("a remote that speaks MCP", () => {
  it("calls only the tools it was allowed, over a session, and opens another once when the server forgot it", async () => {
    const server = fakeServer();
    const call = mcpClient({ url: "http://hub/mcp/rex", allow: ["get_item", "edit_item"], fetch: server.fetch, headers: () => ({ "x-token": "secret" }) });
    expect(await call("get_item", { id: "t1" })).toEqual({ id: "t1", lastModified: "v9", session: "s1" });
    await expect(call("remove_item", { id: "t1" })).rejects.toThrow("remove_item is not a tool this sync uses (it uses get_item, edit_item).");
    expect(server.calls.map((c) => c.name)).toEqual(["get_item"]);

    server.forgetNext();
    expect(await call("edit_item", { id: "t1", title: "x" })).toMatchObject({ session: "s2" });
  });

  it("is a RemoteSystem: each write made with the tools, each refusal its own", async () => {
    const server = fakeServer();
    const call = mcpClient({ url: "http://hub/mcp/rex", allow: ["edit_item"], fetch: server.fetch });
    const from = mcpRemote({
      name: "n-dx",
      call,
      pull: async () => ({ changes: [], cursor: "c" }),
      async push(tools, write) {
        if (write.deleted) throw new Error("The projection never deletes.");
        const done = (await tools("edit_item", { id: write.id, ...write.fields })) as { id: string; lastModified: string };
        return { id: done.id, version: done.lastModified };
      },
    });
    const acks = await from.push([
      { resource: "task", id: "t1", localId: "t1", fields: { title: "x" } },
      { resource: "task", id: "t2", localId: "t2", deleted: true },
    ]);
    expect(acks).toEqual([
      { localId: "t1", id: "t1", version: "v9" },
      { localId: "t2", id: "t2", version: "", error: "The projection never deletes." },
    ]);
  });

  it("is reached from a page through a door that takes only its own origin's JSON and the allowed tools", async () => {
    const reached: string[] = [];
    const door = mcpDoor({ allow: ["get_item"], call: async (name) => (reached.push(name), { ok: name }) });
    const knock = (headers: Record<string, string>, body: unknown, method = "POST") =>
      new Promise<{ status: number; body: { ok: boolean; result?: unknown; error?: string } }>((done) => {
        const listeners: Record<string, (chunk?: unknown) => void> = {};
        const request: DoorRequest = {
          method,
          url: "/graview/mcp?x=1",
          headers: { host: "localhost:5173", ...headers },
          on: ((event: string, listener: (chunk?: unknown) => void) => (listeners[event] = listener)) as DoorRequest["on"],
        };
        const response = {
          statusCode: 200,
          setHeader: () => undefined,
          end: (text: string) => done({ status: response.statusCode, body: JSON.parse(text) }),
        };
        door(request, response, () => done({ status: 0, body: { ok: false, error: "next" } }));
        listeners["data"]?.(JSON.stringify(body));
        listeners["end"]?.();
      });
    const json = { "content-type": "application/json" };

    expect(await knock(json, { name: "get_item", arguments: { id: "t1" } })).toEqual({ status: 200, body: { ok: true, result: { ok: "get_item" } } });
    expect((await knock({ ...json, origin: "https://elsewhere.example" }, { name: "get_item" })).status).toBe(403);
    expect((await knock({ ...json, "sec-fetch-site": "cross-site" }, { name: "get_item" })).status).toBe(403);
    expect((await knock({ "content-type": "text/plain" }, { name: "get_item" })).status).toBe(415);
    const refused = await knock(json, { name: "remove_item" });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toContain("remove_item is not a tool this sync uses");
    expect(reached).toEqual(["get_item"]);

    expect(sameOrigin({ host: "localhost:5173", origin: "http://localhost:5173" })).toBe(true);
    expect(allowTools(["a"])("b")).toBe("b is not a tool this sync uses (it uses a).");
  });

  it("the page's side posts to the door and says the door's refusal", async () => {
    const call = doorClient({
      fetch: async (url, init) => {
        expect(url).toBe("/graview/mcp");
        const { name } = JSON.parse(String(init?.body)) as { name: string };
        return new Response(JSON.stringify(name === "get_item" ? { ok: true, result: 1 } : { ok: false, error: "Refused: no." }));
      },
    });
    expect(await call("get_item", {})).toBe(1);
    await expect(call("remove_item", {})).rejects.toThrow("Refused: no.");
  });
});
