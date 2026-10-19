// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews } from "@graview/react";
import { stubThinking } from "@graview/tools/inline-ai";
import type { HostAi } from "@graview/tools/frame";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE MENU OFFERS A VIEW THE APP ALREADY HAS BEFORE DRAWING A NEW ONE
 * (Roadmap f-menu-suggests-existing-views). Right-clicked on a task, where
 * the menu would draw a panel, the app's own board of tasks is offered
 * first — "Open Tasks by status", above "Draw a new view" — and a view
 * that only reads tasks is offered to be opened and adjusted, which opens
 * it with the quick ask on it. No model is asked to find them; with
 * nothing that fits, the menu is as it was: no row, no heading, "Draw a
 * panel".
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), status: z.enum(["todo", "doing", "done"]).default("todo") }),
  plural: "Tasks",
  label: (node) => node.label,
});
const project = defineNode("project", { fields: z.object({ label: z.string().min(1) }), plural: "Projects", label: (node) => node.label });
const schema = createSchema([task, project]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["status"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.taskId, { status: "done" }),
});

const MENU = '[data-testid="context-menu"]';
const AI = '[data-menu-section="inline-ai"]';
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

/** A thinking slot that counts what it is asked. */
function counted() {
  const inner = stubThinking();
  const asked = { n: 0 };
  const ai: HostAi = { thinking: { ...inner, think: (request) => ((asked.n += 1), inner.think(request)) } };
  return { ai, asked };
}

async function rendered(path: string, ai: HostAi, places: "board" | "room" | "none") {
  const store = new Store({
    schema,
    mutations: [finish],
    snapshot: {
      nodes: [
        { id: "deposit", kind: "task", label: "Pay the deposit", status: "todo" },
        { id: "wedding", kind: "project", label: "The wedding" },
      ] as never,
      edges: [],
    },
  });
  const views = createViews(schema);
  const Board = () => <p data-testid="the-board">The board</p>;
  if (places === "board") views.register("task", { cardinality: "many", fidelity: "full" }, Board, { title: "Tasks by status", lens: "columns" });
  if (places === "room") views.register("project", { cardinality: "many", fidelity: "full" }, Board, { title: "Project room", lens: "view", reads: ["task"] });
  const went: string[] = [];
  const context: PageContext<typeof schema> = { store, views, ai };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath={path} onNavigate={(to) => went.push(to)} />));
  await settle();
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, went };
}

async function settle(ms = 30, until?: () => boolean) {
  for (let turn = 0; turn < (until ? 60 : 5); turn += 1) {
    await act(async () => new Promise((done) => setTimeout(done, ms)));
    if (until?.()) return;
  }
}

async function openTheMenuOnTheHeading(host: HTMLElement) {
  const heading = host.querySelector("[data-graview-page-title]") ?? host.querySelector("main h1")!;
  await act(async () => void heading.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
  await settle(30, () => document.querySelector(`${AI} [data-menu-item="ai-panel"]`) !== null);
}

const rows = () => [...document.querySelectorAll<HTMLElement>(`${AI} [data-menu-item]`)].map((row) => row.dataset["menuItem"]!);
const text = (item: string) => document.querySelector(`${AI} [data-menu-item="${item}"]`)?.textContent ?? null;

describe("the menu, where it would draw a view", () => {
  it("offers the app's own board first, above Draw a new view, and asks no model to find it", async () => {
    const { ai, asked } = counted();
    const { host, went } = await rendered("/tasks/deposit", ai, "board");
    await openTheMenuOnTheHeading(host);
    const order = rows();
    expect(order).toContain("ai-open:tasks-by-status");
    expect(order.indexOf("ai-open:tasks-by-status")).toBeLessThan(order.indexOf("ai-panel"));
    expect(text("ai-open:tasks-by-status")).toBe("Open Tasks by status");
    expect(text("ai-panel")).toBe("Draw a new view");
    expect(asked.n).toBe(0);
    await act(async () => document.querySelector<HTMLElement>(`${AI} [data-menu-item="ai-open:tasks-by-status"]`)!.click());
    await settle();
    expect(went.at(-1)).toBe("/places/tasks-by-status");
    expect(document.querySelector(MENU)).toBeNull();
    expect(asked.n).toBe(0);
  });

  it("offers a view that only reads tasks to be opened and adjusted: it opens with the quick ask on it", async () => {
    const { ai } = counted();
    const { host, went } = await rendered("/tasks/deposit", ai, "room");
    await openTheMenuOnTheHeading(host);
    expect(text("ai-open:project-room")).toBe("Open and adjust Project room");
    await act(async () => document.querySelector<HTMLElement>(`${AI} [data-menu-item="ai-open:project-room"]`)!.click());
    await settle(30, () => document.querySelector('[data-testid="quick-ask"]') !== null);
    expect(went.at(-1)).toBe("/places/project-room");
    expect(document.querySelector('[data-testid="quick-ask-about"]')?.textContent).toContain("Project room");
  });

  it("is as it was when nothing fits: no row and Draw a panel", async () => {
    const { ai } = counted();
    const { host } = await rendered("/tasks/deposit", ai, "none");
    await openTheMenuOnTheHeading(host);
    expect(rows().filter((row) => row.startsWith("ai-open:"))).toEqual([]);
    expect(text("ai-panel")).toBe("Draw a panel");
  });
});
