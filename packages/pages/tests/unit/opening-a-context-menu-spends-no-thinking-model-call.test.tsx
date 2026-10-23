// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews } from "@graview/react";
import type { FastProvider, HostAi, ThinkingProvider } from "@graview/tools/frame";
import { stubFast, stubThinking } from "@graview/tools/inline-ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * OPENING A CONTEXT MENU SPENDS NO THINKING-MODEL CALL (FR-185). The menu
 * asked for suggestions every time it opened, and without a Fast slot the
 * ask went to the Thinking slot: a host with only `thinking` paid one
 * language-model call per right-click. Now a menu asks on opening only
 * with a Fast slot, and only when the host did not say `suggestOnOpen:
 * false`; otherwise it offers "Suggest…", which asks when pressed.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), done: z.boolean().default(false) }),
  plural: "Tasks",
  label: (node) => node.label,
});
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.taskId, { done: true }),
});

/** Each slot, counting the calls made of it. */
function counted() {
  const calls = { fast: 0, thinking: 0 };
  const fastStub = stubFast();
  const thinkingStub = stubThinking();
  const fast: FastProvider = { ...fastStub, decide: (state, questions) => ((calls.fast += 1), fastStub.decide(state, questions)) };
  const thinking: ThinkingProvider = { ...thinkingStub, think: (request) => ((calls.thinking += 1), thinkingStub.think(request)) };
  return { calls, fast, thinking };
}

const MENU = '[data-testid="context-menu"]';
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function rendered(ai: HostAi) {
  const store = new Store({
    schema,
    mutations: [finish],
    snapshot: { nodes: [{ id: "book", kind: "task", label: "Book the hall", done: false }] as never, edges: [] },
  });
  const context: PageContext<typeof schema> = { store, views: createViews(schema), ai };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath="/tasks" />));
  await settle();
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, store };
}

async function settle(turns = 6, ms = 30) {
  for (let turn = 0; turn < turns; turn += 1) await act(async () => new Promise((done) => setTimeout(done, ms)));
}

/**
 * Waits for what a test is about to read, polling until it holds (bounded),
 * never a count of turns: the menu and its sections are lazily loaded, and a
 * loaded machine takes longer than a few short turns to fetch them.
 */
async function until(holds: () => boolean, what: string, within = 5000) {
  for (const end = Date.now() + within; ; ) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((done) => setTimeout(done, 10));
    });
    if (holds()) return;
    if (Date.now() > end) throw new Error(`waited ${within} ms for ${what}`);
  }
}

/** The menu open with its rows, and still: its sections have arrived. */
async function opened() {
  let last: string | undefined;
  await until(() => {
    const now = menu()?.querySelector("[data-menu-item], [data-affordance]") ? menu()!.innerHTML : undefined;
    const same = now !== undefined && now === last;
    last = now;
    return same;
  }, "the menu to open");
}

async function openOn(host: HTMLElement) {
  const row = host.querySelector('[data-graview-record="book"]')!;
  await act(async () => void row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
  await opened();
}
const close = async () => {
  await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await until(() => menu() === null, "the menu to close");
};
const menu = () => document.querySelector<HTMLElement>(MENU);
const item = (id: string) => menu()?.querySelector<HTMLButtonElement>(`[data-menu-item="${id}"]`) ?? null;
const offers = () => menu()?.querySelectorAll("[data-ai-offer]").length ?? 0;

describe("opening a context menu spends no thinking-model call", () => {
  it("with only a thinking slot, opening and closing the menu makes no AI call, and Suggest… asks with one press", async () => {
    const { calls, thinking } = counted();
    const { host } = await rendered({ thinking });
    await openOn(host);
    expect(menu()).not.toBeNull();
    expect(menu()!.querySelector('[data-testid="inline-ai"]')).not.toBeNull();
    expect(menu()!.querySelector('[data-testid="inline-ai-thinking"]')).toBeNull();
    expect(offers()).toBe(0);
    await close();
    expect(menu()).toBeNull();
    expect(calls).toEqual({ fast: 0, thinking: 0 });

    await openOn(host);
    const suggest = item("ai-suggest");
    expect(suggest?.textContent).toBe("Suggest…");
    await act(async () => suggest!.click());
    await settle();
    expect(calls).toEqual({ fast: 0, thinking: 1 });
    // The menu stays open, with what was suggested in it.
    expect(menu()).not.toBeNull();
    expect(offers()).toBeGreaterThan(0);
    expect(item("ai-suggest")).toBeNull();
  });

  it("with a Fast slot, the menu still suggests as it opens, from the Fast slot only", async () => {
    const { calls, fast, thinking } = counted();
    const { host } = await rendered({ fast, thinking });
    await openOn(host);
    expect(calls).toEqual({ fast: 1, thinking: 0 });
    expect(offers()).toBeGreaterThan(0);
    expect(item("ai-suggest")).toBeNull();
  });

  it("a host that says suggestOnOpen: false is asked only when Suggest… is pressed, even with a Fast slot", async () => {
    const { calls, fast } = counted();
    const { host } = await rendered({ fast, suggestOnOpen: false });
    await openOn(host);
    expect(calls).toEqual({ fast: 0, thinking: 0 });
    await act(async () => item("ai-suggest")!.click());
    await settle();
    expect(calls).toEqual({ fast: 1, thinking: 0 });
  });
});
