// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews, type MenuReadying, type MenuSectionSource, type MenuTarget } from "@graview/react";
import type { FastProvider, HostAi, PickOutcome } from "@graview/tools/frame";
import { stubFast } from "@graview/tools/inline-ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE MENU ASKS AS THE RIGHT-CLICK STARTS, AND TELLS THE HOST HOW EACH PICK
 * ENDED (Roadmap f-jev-fast-polish). With the Thinking slot off, the Fast
 * slot is the AI people meet, in the menu: so the menu is told it is
 * opening at the right-click's press — or a finger held on its way to a
 * long press — before it draws; a resting pointer asks ahead where the host
 * let it; and every suggestion it showed is told to the host as taken or
 * left, so the host can measure how good they are.
 */
const task = defineNode("task", {
  fields: z.object({ label: z.string().min(1), done: z.boolean().default(false), flagged: z.boolean().default(false) }),
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
const flag = defineMutation("flag", {
  title: "Flag it",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["flagged"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => void ctx.patchNode(args.taskId, { flagged: true }),
});
const TASKS = [
  { id: "book", kind: "task", label: "Book the hall", done: false },
  { id: "deposit", kind: "task", label: "Pay the deposit", done: false },
];

function counted() {
  const calls = { fast: 0 };
  const stub = stubFast();
  const fast: FastProvider = { ...stub, decide: (state, questions) => ((calls.fast += 1), stub.decide(state, questions)) };
  return { calls, fast };
}

/** A host's section that keeps each time it is got ready, and why. */
function readying() {
  const readied: [string | undefined, MenuReadying | undefined][] = [];
  const source: MenuSectionSource = (target: MenuTarget) => ({ id: "host", items: [{ id: "host-row", label: "The host's row", run: () => undefined }], prepare: (why) => void readied.push([target.on, why]) });
  return { readied, source };
}

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function rendered(also: { ai?: HostAi; menuSections?: readonly MenuSectionSource[] } = {}) {
  const store = new Store({ schema, mutations: [finish, flag], snapshot: { nodes: TASKS as never, edges: [] } });
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
async function until(ready: () => boolean, turns = 60) {
  for (let turn = 0; turn < turns && !ready(); turn += 1) await wait(50);
}
const pointer = (type: string, init: MouseEventInit = {}, pointerType = "mouse") => Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }), { pointerType, isPrimary: true });
const row = (host: HTMLElement, id: string) => host.querySelector<HTMLElement>(`[data-graview-record="${id}"]`)!;
const menu = () => document.querySelector<HTMLElement>('[data-testid="context-menu"]');
const suggestedRow = () => menu()?.querySelector<HTMLButtonElement>('[data-menu-section="suggested"] [data-menu-item="suggested-0"]') ?? null;
async function rightClick(element: Element) {
  await act(async () => void element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
}
const close = async () => {
  await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await wait(30);
};

describe("the menu is told it is opening as the right-click starts", () => {
  it("at the right button's press, before the menu draws, even where the pointer had rested", async () => {
    const { readied, source } = readying();
    const { host } = await rendered({ menuSections: [source] });
    await act(async () => void row(host, "book").dispatchEvent(pointer("pointerover")));
    await wait(250);
    expect(readied).toEqual([["book", "rest"]]);
    await act(async () => void row(host, "book").dispatchEvent(pointer("pointerdown", { button: 2, clientX: 30, clientY: 30 })));
    expect(menu()).toBeNull();
    expect(readied).toEqual([["book", "rest"], ["book", "open"]]);
    // The contextmenu that follows is the same opening: told once.
    await rightClick(row(host, "book"));
    expect(readied.filter(([, why]) => why === "open")).toHaveLength(1);
    // A left press is no menu.
    await act(async () => void row(host, "deposit").dispatchEvent(pointer("pointerdown", { button: 0, clientX: 30, clientY: 30 })));
    expect(readied.some(([on, why]) => on === "deposit" && why === "open")).toBe(false);
  });

  it("for a finger held on its way to a long press, and not for a tap", async () => {
    const { readied, source } = readying();
    const { host } = await rendered({ menuSections: [source] });
    await act(async () => void row(host, "deposit").dispatchEvent(pointer("pointerdown", { clientX: 30, clientY: 30 }, "touch")));
    await act(async () => void row(host, "deposit").dispatchEvent(pointer("pointerup", { clientX: 30, clientY: 30 }, "touch")));
    await wait(300);
    expect(readied).toEqual([["deposit", "touch"]]);
    await act(async () => void row(host, "book").dispatchEvent(pointer("pointerdown", { clientX: 30, clientY: 30 }, "touch")));
    await wait(300);
    expect(readied).toEqual([["deposit", "touch"], ["book", "touch"], ["book", "open"]]);
  });
});

describe("a resting pointer asks ahead only where the host let it", () => {
  it("asks the Fast slot once for the AI section's suggestions, with prefetchOnRest", async () => {
    const { calls, fast } = counted();
    const { host } = await rendered({ ai: { fast, prefetchOnRest: true } });
    await act(async () => void row(host, "book").dispatchEvent(pointer("pointerover")));
    await until(() => calls.fast > 0, 40);
    expect(calls.fast).toBe(1);
    // Resting there again asks nothing more.
    await act(async () => void row(host, "book").dispatchEvent(pointer("pointerout", { relatedTarget: document.body })));
    await act(async () => void row(host, "book").dispatchEvent(pointer("pointerover")));
    await wait(300);
    expect(calls.fast).toBe(1);
  });

  it("asks nothing without it", async () => {
    const { calls, fast } = counted();
    const { host } = await rendered({ ai: { fast } });
    await act(async () => void row(host, "book").dispatchEvent(pointer("pointerover")));
    await wait(600);
    expect(calls.fast).toBe(0);
  });
});

describe("each pick the menu showed is told to the host as taken or left", () => {
  it("left when the menu is put away, taken when it is pressed", async () => {
    const heard: PickOutcome[] = [];
    const { fast } = counted();
    const { host } = await rendered({ ai: { fast, onPickOutcome: (outcome) => void heard.push(outcome) } });
    await rightClick(row(host, "book"));
    await until(() => suggestedRow() !== null);
    const said = suggestedRow()!.textContent ?? "";
    await close();
    expect(heard.length).toBeGreaterThan(0);
    expect(heard[0]).toMatchObject({ where: "suggested", outcome: "dismissed", record: "book" });
    expect(said).toContain(heard[0]!.label);
    // Three or fewer, shown as they are: no model ranked them.
    expect(heard[0]!.model).toBeUndefined();

    heard.length = 0;
    await rightClick(row(host, "book"));
    await until(() => suggestedRow() !== null);
    const key = heard.length;
    await act(async () => suggestedRow()!.click());
    await wait(50);
    expect(key).toBe(0);
    expect(heard[0]).toMatchObject({ where: "suggested", outcome: "accepted", record: "book" });
  });

  it("a host's ear that throws is never the menu's failure", async () => {
    const { fast } = counted();
    const { host } = await rendered({ ai: { fast, onPickOutcome: () => { throw new Error("the host's own fault"); } } });
    await rightClick(row(host, "book"));
    await until(() => suggestedRow() !== null);
    await close();
    expect(menu()).toBeNull();
    await rightClick(row(host, "deposit"));
    expect(menu()).not.toBeNull();
  });
});
