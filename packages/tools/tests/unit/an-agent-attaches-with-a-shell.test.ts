import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { createFileAdapter, openStore, serveStore, type ServedStore } from "@graview/ship";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createMcpAdapter, createToolRuntime } from "../../src/index.js";
import { instructionsFor, openHost, seatFrom } from "../../src/cli.js";
import { MCP_PROTOCOL_VERSION, serveMcpStdio } from "../../src/mcp-stdio.js";

/**
 * An external agent with only a shell evolves a live graph the way a person
 * does: MCP over stdio around the same runtime the in-app seat has, against
 * the store where the data actually is — a folder, or a running server —
 * judged under its own seat, and persisted before the answer is sent.
 */

const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const addTask = defineMutation("add-task", {
  title: "Add a task",
  description: "Put something on a list.",
  subject: { kinds: ["list"], arg: "listId" },
  creates: ["task"],
  input: z.object({ listId: nodeRef(["list"]), label: z.string().min(1) }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "task");
    ctx.addNode({ id, kind: "task", label: args.label, done: false });
    ctx.addEdge({ kind: "holds", from: args.listId, to: id });
  },
});
const finish = defineMutation("finish", {
  title: "Mark it done",
  description: "Say a task is finished.",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.taskId, { done: true });
  },
});
const app = defineApp({
  name: "lists",
  schema,
  mutations: [addTask, finish],
  invariants: [],
  policy: { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: ["add-task", "finish"], describe: "The keeper keeps the lists." }] },
  version: 1,
});
const seed = { nodes: [{ id: "today", kind: "list", label: "Today" }], edges: [] };

/** A client at the other end of stdio: writes requests, collects replies. */
function client() {
  const input = new PassThrough();
  const output = new PassThrough();
  const lines: string[] = [];
  output.on("data", (chunk: Buffer) => lines.push(...chunk.toString("utf8").split("\n").filter(Boolean)));
  let n = 0;
  const ask = (method: string, params?: unknown) => input.write(`${JSON.stringify({ jsonrpc: "2.0", id: ++n, method, ...(params ? { params } : {}) })}\n`);
  const tell = (method: string) => input.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
  const replies = () => lines.map((line) => JSON.parse(line) as { id: number | null; result?: Record<string, unknown>; error?: { code: number; message: string } });
  return { input, output, ask, tell, replies, end: () => input.end() };
}

let root: string;
let served: ServedStore<typeof schema> | undefined;
afterEach(async () => {
  await served?.close();
  served = undefined;
  rmSync(root, { recursive: true, force: true });
});

describe("MCP over stdio, against a folder", () => {
  it("initialises, lists the seat's tools, lands a mutation in the store on disk, and says no in the policy's words", async () => {
    root = mkdtempSync(join(tmpdir(), "graview-mcp-"));
    const keeper = seatFrom(["--as", "cursor", "--roles", "keeper"], "graview-mcp");
    expect(keeper).toEqual({ kind: "agent", id: "cursor", roles: ["keeper"] });
    // The seed is a first-install snapshot, read once: the same flags `graview serve` takes.
    writeFileSync(join(root, "seed.json"), JSON.stringify(seed));
    const again = await openHost(app, ["--data", root, "--seed", join(root, "seed.json")], keeper);
    const adapter = createMcpAdapter(createToolRuntime(again.store, { author: keeper }));

    const c = client();
    const serving = serveMcpStdio({ adapter, name: app.name, version: "1", instructions: instructionsFor(app, keeper, root), input: c.input, output: c.output });
    c.ask("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } });
    c.tell("notifications/initialized");
    c.ask("tools/list");
    c.ask("tools/call", { name: "add-task", arguments: { listId: "today", label: "Book the van", id: "t-van" } });
    c.ask("tools/call", { name: "get_node", arguments: { id: "t-van" } });
    c.ask("tools/call", { name: "add-task", arguments: { listId: "today", label: "Twice", id: "t-van" } });
    c.ask("nothing/here");
    c.end();
    await serving;
    await again.close();

    const [init, tools, added, read, taken, unknown] = c.replies();
    expect(init!.result).toMatchObject({ protocolVersion: "2025-03-26", serverInfo: { name: "lists", version: "1" } });
    expect(String(init!.result!["instructions"])).toMatch(/cursor, roles keeper/);
    const names = (tools!.result!["tools"] as { name: string }[]).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["get_graph", "preview_mutation", "undo_batch", "add-task", "finish", "remove-task"]));
    expect(added!.result).not.toHaveProperty("isError");
    expect(JSON.parse((read!.result!["content"] as { text: string }[])[0]!.text).data.node).toMatchObject({ id: "t-van", label: "Book the van" });
    expect(taken!.result).toMatchObject({ isError: true });
    expect((taken!.result!["content"] as { text: string }[])[0]!.text).toMatch(/already taken/);
    expect(unknown!.error).toMatchObject({ code: -32601 });

    // On disk, in the folder a person can open — and undoable from a later session.
    const log = readFileSync(join(root, "lists", "log.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as { author: { id: string }; batch: string });
    expect(log.at(-1)?.author.id).toBe("cursor");
    const later = await openStore({ app, adapter: createFileAdapter(root), scope: app.name });
    expect(later.store.graph.getNode("t-van")).toBeDefined();
    expect(later.store.canUndo(log.at(-1)!.batch).ok).toBe(true);
    later.close();
  });

  it("gives a reader the reads and refuses the writes by name, and a read-only seat nothing that changes", async () => {
    root = mkdtempSync(join(tmpdir(), "graview-mcp-"));
    const reader = seatFrom(["--roles", "reader"], "graview-mcp");
    const host = await openHost(app, ["--data", root], reader);
    const adapter = createMcpAdapter(createToolRuntime(host.store, { author: reader }));
    expect(adapter.listTools().map((t) => t.name)).not.toContain("add-task");
    const refused = await adapter.callTool("add-task", { listId: "today", label: "x" });
    expect(refused.isError).toBe(true);
    expect(refused.content[0]!.text).toMatch(/keeper can/);
    const quiet = createMcpAdapter(createToolRuntime(host.store, { author: seatFrom(["--roles", "keeper"], "x"), readOnly: true }));
    expect(quiet.listTools().every((t) => !["add-task", "finish", "undo_batch"].includes(t.name))).toBe(true);
    await host.close();
  });

  it("speaks the newest protocol it knows when asked for a newer one, and answers a batch in order", async () => {
    root = mkdtempSync(join(tmpdir(), "graview-mcp-"));
    const c = client();
    const adapter = { listTools: () => [], callTool: async () => ({ content: [] }) };
    const serving = serveMcpStdio({ adapter, name: "x", version: "1", input: c.input, output: c.output });
    c.input.write(`${JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2099-01-01" } }, { jsonrpc: "2.0", id: 2, method: "ping" }])}\n`);
    c.input.write("not json\n");
    c.end();
    await serving;
    const [init, ping, bad] = c.replies();
    expect(init!.result).toMatchObject({ protocolVersion: MCP_PROTOCOL_VERSION });
    expect(ping).toMatchObject({ id: 2, result: {} });
    expect(bad).toMatchObject({ id: null, error: { code: -32700 } });
  });
});

describe("the same host, against a served store", () => {
  it("waits for the server's verdict: a refusal is the tool's error, and an accepted act is the server's op", async () => {
    root = mkdtempSync(join(tmpdir(), "graview-mcp-"));
    served = await serveStore({ app, adapter: createFileAdapter(root), seed: seed as never, trustSeatHeaders: true });
    const keeper = seatFrom(["--roles", "keeper"], "graview-mcp");
    const host = await openHost(app, ["--remote-url", served.url], keeper);
    const runtime = createToolRuntime(host.store, { author: keeper });
    const result = await runtime.call("add-task", { listId: "today", label: "Van", id: "t-van" });
    expect(result.ok).toBe(true);
    await host.settled();
    expect(host.refusals()).toEqual([]);
    // The server has it once, and this client's log carries the server's op beside its provisional one.
    expect(served.store.graph.getNode("t-van")).toBeDefined();
    expect(host.store.graph.allNodes().filter((node) => node.id === "t-van")).toHaveLength(1);
    expect(host.store.log.all().some((op) => !op.id.startsWith("local-") && op.author.id === "graview-mcp")).toBe(true);
    await host.close();

    // A seat the server does not trust: the local optimism is taken back and the refusal is heard.
    const nobody = await openHost(app, ["--remote-url", served.url, "--header", "authorization: Bearer nothing"], { kind: "agent", id: "n", roles: ["keeper"] });
    const hostile = await serveStore({
      app,
      adapter: createFileAdapter(mkdtempSync(join(tmpdir(), "graview-mcp-b-"))),
      seed: seed as never,
      seatOf: () => ({ kind: "human" }),
    });
    const stranger = await openHost(app, ["--remote-url", hostile.url], { kind: "agent", id: "s", roles: ["keeper"] });
    const attempt = await createToolRuntime(stranger.store, { author: { kind: "agent", id: "s", roles: ["keeper"] } }).call("finish", { taskId: "t-van" }).catch(() => ({ ok: false as const, error: "" }));
    await stranger.settled();
    expect(attempt.ok === false || stranger.refusals().length > 0).toBe(true);
    await stranger.close();
    await nobody.close();
    await hostile.close();
  });
});
