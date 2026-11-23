// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { holdRecordBoxes } from "@graview/core/record-boxes";
import { createViews, type MenuSectionSource, type MenuTarget } from "@graview/react";
import type { FastProvider, HostAi, PickOutcome } from "@graview/tools/frame";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A RIGHT-CLICK INSIDE A WORKER VIEW IS ABOUT THE RECORD UNDER THE POINTER
 * (Graview HQ feature:f-view-menu-suggests-under-pointer). "Right-clicking
 * on things in custom views … seems like right now they are for the entire
 * view, not what my mouse is over." A worker view draws in a shadow root,
 * so the face saw only the view's region under a press. The record is now
 * found from what the view's host judged it drew there (the record boxes
 * it holds on the region): the menu's Suggested rows, its AI section and
 * the hover chip are about that record, and only a press on the view's own
 * ground stays about the place. A card the view marks for a record its host
 * did not judge it drew is not taken on the view's word.
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
  { id: "buy", kind: "task", label: "Buy the cake", done: false },
];

/** A Fast slot that picks the first option, sure of it. */
const fast: FastProvider = {
  model: "fake-fast",
  decide: async (_state, questions) => ({
    answers: Object.fromEntries(
      Object.entries(questions).map(([key, question]) => {
        const names = Object.keys((question as { criteria: Record<string, string> }).criteria);
        return [key, { type: "choice", choice: names[0]!, confidence: 0.9, probabilities: Object.fromEntries(names.map((name, at) => [name, at === 0 ? 0.9 : 0.01])) }];
      }),
    ) as never,
    usage: { inputTokens: 10, outputTokens: 0 },
  }),
};

/** A host's section that keeps what each menu it is drawn in is about. */
function aims() {
  const seen: MenuTarget[] = [];
  const source: MenuSectionSource = (target: MenuTarget) => (seen.push(target), { id: "host", items: [{ id: "host-row", label: "The host's row", run: () => undefined }] });
  return { seen, source };
}

let cleanup: (() => Promise<void>) | undefined;
beforeEach(() => localStorage.clear());
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

/**
 * The page of tasks, with a worker view drawn in it as its host draws one:
 * a region with a shadow root, a card for "deposit" and one for "book" its
 * host measured and judged, a card the view marked "buy" that its host did
 * not (it was never handed it), and ground between them.
 */
async function rendered(also: { ai?: HostAi; menuSections?: readonly MenuSectionSource[] } = {}) {
  const store = new Store({ schema, mutations: [finish, flag], snapshot: { nodes: TASKS as never, edges: [] } });
  const context: PageContext<typeof schema> = { store, views: createViews(schema), ...(also.ai ? { ai: also.ai } : {}), ...(also.menuSections ? { menuSections: also.menuSections } : {}) };
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={context} initialPath="/tasks" />));
  await wait(60);
  const region = document.createElement("div");
  region.setAttribute("data-worker-view", "board");
  host.querySelector("main")!.appendChild(region);
  const shadow = region.attachShadow({ mode: "open" });
  shadow.innerHTML = `<div class="board"><div data-record="deposit" data-graview-link="" tabindex="0"><h3>Pay the deposit</h3><span class="badge">Due</span></div><p class="ground">Nothing due today</p><div data-record="book" data-graview-link="" tabindex="0"><h3>Book the hall</h3></div><div data-record="buy" tabindex="0"><h3>Buy the cake</h3></div></div>`;
  // In the region's own pixels; the page draws it at the window's top left (jsdom lays nothing out).
  holdRecordBoxes(region, {
    boxes: () => [
      { id: "deposit", x: 0, y: 0, width: 200, height: 50 },
      { id: "book", x: 0, y: 100, width: 200, height: 50 },
    ],
    shows: () => ["deposit", "book"],
  });
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { host, store, shadow };
}

const wait = (ms: number) => act(async () => new Promise((done) => setTimeout(done, ms)));
async function until(ready: () => boolean, turns = 80) {
  for (let turn = 0; turn < turns && !ready(); turn += 1) await wait(50);
}
const menu = () => document.querySelector<HTMLElement>('[data-testid="context-menu"]');
const heading = () => menu()?.querySelector("strong")?.textContent ?? null;
const suggestedRow = () => menu()?.querySelector<HTMLButtonElement>('[data-menu-section="suggested"] [data-menu-item="suggested-0"]') ?? null;
async function rightClick(element: Element, x: number, y: number) {
  await act(async () => void element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true, cancelable: true, button: 2, clientX: x, clientY: y })));
  await until(() => menu()?.querySelector("[data-menu-item]") !== null && menu() !== null);
}
const close = async () => {
  await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await wait(30);
};
const last = (seen: readonly MenuTarget[]) => seen[seen.length - 1]!;

describe("a right-click inside a worker view", () => {
  it("on a record's card — its heading or a badge in it — opens the menu about that record", async () => {
    const { seen, source } = aims();
    const { shadow } = await rendered({ menuSections: [source] });
    await rightClick(shadow.querySelector(".badge")!, 40, 20);
    expect(last(seen)).toMatchObject({ face: "pages", on: "deposit", about: ["deposit"] });
    expect(heading()).toBe("Pay the deposit");
    await close();
    await rightClick(shadow.querySelector('[data-record="book"] h3')!, 40, 120);
    expect(last(seen)).toMatchObject({ on: "book", about: ["book"] });
    expect(heading()).toBe("Book the hall");
  });

  it("on the view's own ground keeps the menu about the place", async () => {
    const { seen, source } = aims();
    const { shadow } = await rendered({ menuSections: [source] });
    await rightClick(shadow.querySelector(".ground")!, 40, 75);
    expect(last(seen).on).toBeUndefined();
    expect(last(seen).about).toEqual(["aggregate:task"]);
  });

  it("on a card the view marked for a record its host did not judge it drew, takes nothing on the view's word", async () => {
    const { seen, source } = aims();
    const { shadow } = await rendered({ menuSections: [source] });
    await rightClick(shadow.querySelector('[data-record="buy"] h3')!, 40, 220);
    expect(last(seen).on).toBeUndefined();
    expect(last(seen).about).toEqual(["aggregate:task"]);
  });

  it("puts the Suggested rows and the AI section on that record", async () => {
    const heard: PickOutcome[] = [];
    const { shadow } = await rendered({ ai: { fast, onPickOutcome: (outcome) => void heard.push(outcome) } });
    await rightClick(shadow.querySelector('[data-record="deposit"] h3')!, 40, 20);
    await until(() => suggestedRow() !== null);
    const more = menu()?.querySelector<HTMLButtonElement>('[data-menu-item="more"]');
    if (more) await act(async () => more.click());
    await until(() => (menu()?.querySelectorAll("[data-ai-offer]").length ?? 0) > 0);
    expect(menu()!.querySelectorAll("[data-ai-offer]").length).toBeGreaterThan(0);
    await close();
    expect(heard.some((one) => one.where === "suggested")).toBe(true);
    expect(heard.some((one) => one.where === "menu")).toBe(true);
    for (const one of heard) expect(one.record).toBe("deposit");
  });

  it("from the keyboard on a card (Shift+F10) is about the card's record", async () => {
    const { seen, source } = aims();
    const { shadow } = await rendered({ menuSections: [source] });
    const card = shadow.querySelector<HTMLElement>('[data-record="book"]')!;
    card.focus();
    await act(async () => void card.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, composed: true, cancelable: true })));
    await until(() => menu() !== null);
    expect(last(seen)).toMatchObject({ on: "book", about: ["book"] });
  });
});

describe("the hover chip over a worker view", () => {
  const over = (element: Element, x: number, y: number) => act(async () => void element.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, composed: true, pointerType: "mouse", clientX: x, clientY: y } as PointerEventInit)));
  const chips = () => document.querySelectorAll('[data-testid="hover-chip"]');
  const chipOn = (id: string) => chips().length === 1 && (chips()[0]!.getAttribute("data-ai-offer") ?? "").includes(id);

  /* Inside one shadow root a browser sends the document no over or out between two of its elements (both ends are the region there): only the moves. */
  const move = (element: Element, x: number, y: number) => act(async () => void element.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, composed: true, pointerType: "mouse", clientX: x, clientY: y } as PointerEventInit)));

  it("is about the record the pointer rests on, and moves with it from card to card by the pointer's moves alone", async () => {
    const { shadow } = await rendered({ ai: { fast, hoverChips: true } });
    // Into the view, onto the first card: the one over the document hears.
    await over(shadow.querySelector('[data-record="deposit"] h3')!, 40, 20);
    await until(() => chipOn("deposit"));
    expect(chipOn("deposit")).toBe(true);
    // To the next card inside the view, by moves only.
    await move(shadow.querySelector('[data-record="book"] h3')!, 40, 120);
    await until(() => chipOn("book"));
    expect(chipOn("book")).toBe(true);
    // To the view's own ground: the chip goes.
    await move(shadow.querySelector(".ground")!, 40, 75);
    await until(() => chips().length === 0);
    expect(chips().length).toBe(0);
  });
});
