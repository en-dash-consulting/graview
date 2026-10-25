import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bindSchema, createSchema, defineApp, defineNode, nodeRef } from "@graview/core";
import { toolMistakes } from "@graview/core/friction";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime } from "../../src/index.js";
import { openHost, seatFrom, settledAdapter } from "../../src/cli.js";

/*
 * A TOOL CALL GOT WRONG IS KEPT WITH THE FORM THAT WORKED (Roadmap
 * f-friction-log): `graview mcp` hears every call's verdict, and a call
 * refused as `invalid` is kept beside the store — `friction.json` in the
 * folder — with the form of the next call of that tool that worked, so a
 * judge can later say what the tool surface makes models get wrong.
 */
const list = defineNode("list", { fields: z.object({ label: z.string().min(1) }), edges: { holds: { to: ["task"] } } });
const task = defineNode("task", { fields: z.object({ label: z.string().min(1), done: z.boolean() }) });
const schema = createSchema([list, task]);
const { defineMutation } = bindSchema(schema);
const addTask = defineMutation("add-task", {
  title: "Add a task",
  subject: { kinds: ["list"], arg: "listId" },
  creates: ["task"],
  input: z.object({ listId: nodeRef(["list"]), label: z.string().min(1) }),
  apply(ctx, args) {
    const id = ctx.freshId(args.label, "task");
    ctx.addNode({ id, kind: "task", label: args.label, done: false });
    ctx.addEdge({ kind: "holds", from: args.listId, to: id });
  },
});
const app = defineApp({ name: "lists", schema, mutations: [addTask], policy: { roles: ["keeper"], grants: [{ roles: ["keeper"], mutations: "*" }] }, version: 1 });

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("graview mcp's tool calls", () => {
  it("keeps a call refused as invalid beside the store, with the form of the next call of that tool that worked", async () => {
    root = mkdtempSync(join(tmpdir(), "graview-friction-mcp-"));
    writeFileSync(join(root, "seed.json"), JSON.stringify({ nodes: [{ id: "today", kind: "list", label: "Today" }], edges: [] }));
    const seat = seatFrom(["--as", "cursor", "--roles", "keeper"], "graview-mcp");
    const host = await openHost(app, ["--data", root, "--seed", join(root, "seed.json")], seat);
    const runtime = createToolRuntime(host.store, { author: seat });
    const mistakes = toolMistakes((draft) => host.friction(draft));
    const adapter = settledAdapter(runtime, host, mistakes);
    expect((await adapter.callTool("add-task", { listId: "today", label: "" })).isError).toBe(true);
    expect((await adapter.callTool("add-task", { listId: "today", label: "Book the van" })).isError).toBeFalsy();
    mistakes.flush();
    await host.close();
    const path = join(root, "lists", "friction.json");
    expect(existsSync(path)).toBe(true);
    const { events } = JSON.parse(readFileSync(path, "utf8")) as { events: Record<string, unknown>[] };
    expect(events).toMatchObject([{ type: "tool-invalid", tool: "add-task", act: "add-task", then: "{ listId: string, label: string }", by: { kind: "agent", id: "cursor" } }]);
    // The values the agent sent are not kept in the form: names and types only.
    expect(String(events[0]!["then"])).not.toContain("Book the van");
  });
});
