import { createSchema, defineMutation, defineNode, nodeRef, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createMcpAdapter, createToolRuntime, type ToolCall } from "../../src/index.js";

/**
 * AN AGENT FINDS A THING BY ITS NAME, not by reading the whole graph and
 * scanning it. `search_graph` is the Find box's matcher on the runtime: the
 * same hits with the same why, the seat's own policy, and the records it
 * named counted as read — so the interface draws what the agent looked at.
 */

const list = defineNode("list", {
  fields: z.object({ label: z.string().min(1) }),
  edges: { holds: { to: ["task"], description: "the tasks on it", inverse: "the list it is on" } },
});
const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), done: z.boolean(), notes: z.string().optional() }),
  lifecycle: { field: "done", retired: [true] },
});
const schema = createSchema([list, task]);
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
const store = () =>
  new Store({
    schema,
    mutations: [finish],
    snapshot: {
      nodes: [
        { id: "today", kind: "list", label: "Today" },
        { id: "t-van", kind: "task", label: "Book the van", done: false },
        { id: "t-call", kind: "task", label: "Call the agent", done: false, notes: "about the van" },
        { id: "t-old", kind: "task", label: "Return the van", done: true },
      ],
      edges: [{ kind: "holds", from: "today", to: "t-van" }],
    } as never,
  });

describe("search_graph", () => {
  it("is the first read tool, so an agent meets it before get_graph", () => {
    const names = createToolRuntime(store()).definitions.map((tool) => tool.name);
    expect(names.indexOf("search_graph")).toBe(0);
    expect(names.indexOf("search_graph")).toBeLessThan(names.indexOf("get_graph"));
    // A read-only seat keeps it: it changes nothing.
    expect(createToolRuntime(store(), { readOnly: true }).definitions.map((tool) => tool.name)).toContain("search_graph");
  });

  it("answers with the matcher's hits and why, and counts the records it named as read", async () => {
    const runtime = createToolRuntime(store(), { author: { kind: "agent", id: "claude" } });
    const calls: ToolCall[] = [];
    runtime.onCall((call) => calls.push(call));
    const result = await runtime.call("search_graph", { query: "van" });
    if (!result.ok) throw new Error(result.error);
    const data = result.data as { hits: { about: string; id?: string; why: { field: string } }[]; searched: { past: boolean } };
    expect(data.hits.map((hit) => hit.id)).toEqual(["t-van", "t-call"]);
    expect(data.hits[1]?.why.field).toBe("notes");
    // The past is left out until asked for, and the answer says so.
    expect(data.searched.past).toBe(false);
    expect(result.reads).toEqual(["t-van", "t-call"]);
    expect(calls.at(-1)).toMatchObject({ name: "search_graph", phase: "ok", reads: ["t-van", "t-call"] });
  });

  it("takes the arrangement's words and offers acts on a subject", async () => {
    const runtime = createToolRuntime(store());
    const past = await runtime.call("search_graph", { query: "return is:any" });
    expect(past.ok && past.reads).toEqual(["t-old"]);
    const acts = await runtime.call("search_graph", { query: "van", subject: "t-van" });
    if (!acts.ok) throw new Error(acts.error);
    const hits = (acts.data as { hits: { about: string; name?: string; subject?: string }[] }).hits;
    expect(hits.filter((hit) => hit.about === "act").map((hit) => hit.name)).toContain("finish");
    // The acts are not reads: only records are.
    expect(acts.reads).toEqual(["t-van", "t-call"]);
  });

  it("names places when the runtime was handed them, and reaches an MCP client unchanged", async () => {
    const runtime = createToolRuntime(store(), { places: () => [{ kind: "task", title: "The week", as: "the-week" }] });
    const mcp = createMcpAdapter(runtime);
    expect(mcp.listTools().map((tool) => tool.name)).toContain("search_graph");
    const answer = await mcp.callTool("search_graph", { query: "week" });
    expect(answer.isError).toBeUndefined();
    expect(answer.content[0]?.text).toContain('"about": "place"');
  });
});
