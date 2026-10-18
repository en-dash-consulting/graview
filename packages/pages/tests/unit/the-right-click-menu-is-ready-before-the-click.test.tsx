// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews, type MenuSectionSource, type MenuTarget } from "@graview/react";
import type { FastProvider, HostAi, ThinkingProvider } from "@graview/tools/frame";
import { stubFast, stubThinking } from "@graview/tools/inline-ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE RIGHT-CLICK MENU IS READY BEFORE THE CLICK (FR-186). The menu derived
 * its acts and sections as it opened, fetched its AI section behind
 * Suspense, and asked for suggestions afresh every time, so it filled in
 * while the reader watched. Now the pointer resting on a record (150 ms; a
 * pass-over does nothing), the keyboard landing on one, or a finger going
 * down on one gets its menu ready — the acts derived and kept, each
 * section's `prepare`, the lazy chunks fetched — and suggestions are kept
 * per record until it changes. Hovering asks no model at all.
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
const TASKS = [
  { id: "book", kind: "task", label: "Book the hall", done: false },
  { id: "deposit", kind: "task", label: "Pay the deposit", done: false },
  { id: "cake", kind: "task", label: "Order the cake", done: false },
  { id: "music", kind: "task", label: "Find a band", done: false },
];

/** Each slot, counting the calls made of it. */
function counted() {
  const calls = { fast: 0, thinking: 0 };
  const fastStub = stubFast();
  const thinkingStub = stubThinking();
  const fast: FastProvider = { ...fastStub, decide: (state, questions) => ((calls.fast += 1), fastStub.decide(state, questions)) };
  const thinking: ThinkingProvider = { ...thinkingStub, think: (request) => ((calls.thinking += 1), thinkingStub.think(request)) };
  return { calls, fast, thinking };
}

/** A host's section that only counts when it is got ready, and for what. */
function readying() {
  const readied: (string | undefined)[] = [];
  const source: MenuSectionSource = (target: MenuTarget) => ({ id: "host", items: [{ id: "host-row", label: "The host's row", run: () => undefined }], prepare: () => void readied.push(target.on) });
  return { readied, source };
}

const MENU = '[data-testid="context-menu"]';
let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function rendered(also: { ai?: HostAi; menuSections?: readonly MenuSectionSource[] } = {}) {
  const store = new Store({ schema, mutations: [finish], snapshot: { nodes: TASKS as never, edges: [] } });
  const context: PageContext<typeof schema> = { store, views: createViews(schema), ...(also.ai ? { ai: also.ai } : {}), ...(also.menuSections ? { menuSections: also.menuSections } : {}) };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath="/tasks" />));
  await wait(60);
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, store };
}

const wait = (ms: number) => act(async () => new Promise((done) => setTimeout(done, ms)));
/** Waits, a little at a time, for something to be true: a chunk fetched cold takes what it takes. */
async function until(ready: () => boolean, turns = 60) {
  for (let turn = 0; turn < turns && !ready(); turn += 1) await wait(50);
}
const pointer = (type: string, init: MouseEventInit = {}, pointerType = "mouse") => Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }), { pointerType, isPrimary: true });
const row = (host: HTMLElement, id: string) => host.querySelector<HTMLElement>(`[data-graview-record="${id}"]`)!;
/** The pointer comes to rest on an element, for `ms`. */
async function rest(element: Element, ms: number) {
  await act(async () => void element.dispatchEvent(pointer("pointerover")));
  await wait(ms);
}
/** The pointer passes over an element, onto another, without stopping. */
async function passOver(element: Element, onto: Element) {
  await act(async () => void element.dispatchEvent(pointer("pointerover")));
  await act(async () => void element.dispatchEvent(pointer("pointerout", { relatedTarget: onto })));
}
/** A right-click, and the frame it draws — nothing after it is waited for. */
function rightClickFirstFrame(element: Element) {
  act(() => void element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
}
const close = async () => {
  await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await wait(30);
};
const menu = () => document.querySelector<HTMLElement>(MENU);
const acts = () => [...(menu()?.querySelectorAll<HTMLElement>("[data-affordance]:not([disabled])") ?? [])].map((button) => button.textContent!.replace(/ …$/, ""));
const offers = () => menu()?.querySelectorAll("[data-ai-offer]").length ?? 0;

describe("the right-click menu is ready before the click", () => {
  it("a menu opened on a row the pointer rested on draws complete in its first frame", async () => {
    const { calls, fast } = counted();
    const { host } = await rendered({ ai: { fast } });
    await rest(row(host, "book"), 400);
    expect(calls.fast).toBe(0);
    rightClickFirstFrame(row(host, "book"));
    expect(menu()).not.toBeNull();
    expect(acts()).toContain("Mark it done");
    // The AI section, fetched while the pointer rested: drawn with the menu, not after it.
    expect(menu()!.querySelector('[data-testid="inline-ai"]')).not.toBeNull();
    expect(menu()!.querySelector('[data-menu-item="ai-ask"]')).not.toBeNull();
  });

  it("a pass-over readies nothing; a rest of a moment readies the menu once", async () => {
    const { readied, source } = readying();
    const { host } = await rendered({ menuSections: [source] });
    await passOver(row(host, "book"), row(host, "deposit"));
    await wait(300);
    expect(readied).toEqual([]);
    await rest(row(host, "deposit"), 300);
    expect(readied).toEqual(["deposit"]);
    // Resting there again readies nothing more until the graph moves.
    await rest(row(host, "deposit").querySelector("a") ?? row(host, "deposit"), 300);
    expect(readied).toEqual(["deposit"]);
  });

  it("the keyboard landing on a row, or a finger going down on one, readies it at once", async () => {
    const { readied, source } = readying();
    const { host } = await rendered({ menuSections: [source] });
    const link = row(host, "cake").querySelector<HTMLElement>("a[href]")!;
    await act(async () => link.focus());
    expect(readied).toEqual(["cake"]);
    await act(async () => void row(host, "music").dispatchEvent(pointer("pointerdown", { clientX: 30, clientY: 30 }, "touch")));
    await act(async () => void row(host, "music").dispatchEvent(pointer("pointerup", { clientX: 30, clientY: 30 }, "touch")));
    expect(readied).toEqual(["cake", "music"]);
  });

  it("hovering across a list asks no model", async () => {
    const { calls, fast, thinking } = counted();
    const { host } = await rendered({ ai: { fast, thinking } });
    for (const { id } of TASKS) await rest(row(host, id), 200);
    expect(calls).toEqual({ fast: 0, thinking: 0 });
  });

  it("a reopened menu makes no new AI call until the record changes, and draws what was suggested in its first frame", async () => {
    const { calls, fast } = counted();
    const { host, store } = await rendered({ ai: { fast } });
    rightClickFirstFrame(row(host, "deposit"));
    await until(() => offers() > 0);
    expect(calls.fast).toBe(1);
    const first = offers();
    expect(first).toBeGreaterThan(0);
    await close();

    rightClickFirstFrame(row(host, "deposit"));
    expect(offers()).toBe(first);
    expect(menu()!.querySelector('[data-testid="inline-ai-thinking"]')).toBeNull();
    await wait(200);
    expect(calls.fast).toBe(1);
    await close();

    // Another record is its own ask.
    rightClickFirstFrame(row(host, "cake"));
    await until(() => calls.fast >= 2);
    await wait(100);
    expect(calls.fast).toBe(2);
    await close();

    // The record changes: the next menu on it asks again.
    await act(async () => void store.apply({ name: "finish", args: { taskId: "deposit" } }));
    rightClickFirstFrame(row(host, "deposit"));
    await until(() => calls.fast >= 3);
    await wait(100);
    expect(calls.fast).toBe(3);
  });
});
