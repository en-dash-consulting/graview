// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews, type MenuSectionSource } from "@graview/react";
import type { FastProvider, HostAi, PickOutcome } from "@graview/tools/frame";
import { stubFast } from "@graview/tools/inline-ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * THE MENU'S FIRST FRAMES (Graview HQ feature:f-menu-first-frames-follow-ups).
 * The Suggested rows' Fast call starts at the right button's press — the
 * candidates worked out then, not as the menu renders — and the menu takes
 * that call up rather than asking again; the rows keep the room they took
 * as the Fast slot answers; and words typed in the menu, which stand the AI
 * section down, do not make its picks a second showing told to the host.
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
const TASKS = [
  { id: "book", kind: "task", label: "Book the hall", done: false },
  { id: "deposit", kind: "task", label: "Pay the deposit", done: false },
];

/** A Fast slot that counts the Suggested rows' questions apart from the rest. */
function counted() {
  const calls = { suggested: 0, all: 0 };
  const stub = stubFast();
  const fast: FastProvider = {
    ...stub,
    decide: (state, questions) => {
      calls.all += 1;
      if ("pick" in questions && String((questions as Record<string, { instructions?: string }>)["pick"]!.instructions).startsWith("Somebody right-clicked")) calls.suggested += 1;
      return stub.decide(state, questions);
    },
  };
  return { calls, fast };
}

/** A part of the page that lends Better UI and four nudges: more than the three rows show, so the Fast slot is asked to order them. */
const looks: MenuSectionSource = () => ({
  id: "looks",
  mode: { id: "better", label: "Better UI", mark: "✨", claims: async () => false, open: () => undefined, nudges: () => ["Show the dates", "Group by week", "Make the cards smaller", "Sort by when it is due"] },
});

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function rendered(ai: HostAi, menuSections: readonly MenuSectionSource[] = []) {
  const store = new Store({ schema, mutations: [finish], snapshot: { nodes: TASKS.map((one) => ({ ...one })) as never, edges: [] } });
  const context: PageContext<typeof schema> = { store, views: createViews(schema), ai, menuSections };
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
async function until(ready: () => boolean, turns = 80) {
  for (let turn = 0; turn < turns && !ready(); turn += 1) await wait(50);
}
const pointer = (type: string, init: MouseEventInit = {}) => Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }), { pointerType: "mouse", isPrimary: true });
const row = (host: HTMLElement, id: string) => host.querySelector<HTMLElement>(`[data-graview-record="${id}"]`)!;
const menu = () => document.querySelector<HTMLElement>('[data-testid="context-menu"]');
const suggestedRows = () => [...(menu()?.querySelectorAll<HTMLElement>('[data-menu-section="suggested"] [data-menu-item^="suggested-"]') ?? [])];
const field = () => document.querySelector<HTMLInputElement>('[data-testid="menu-type"]');
async function rightClick(element: Element) {
  await act(async () => void element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 60 })));
}
const close = async () => {
  await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  await wait(30);
};
async function typeInMenu(words: string) {
  const box = field()!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(box, words);
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(30);
}

describe("the Suggested rows' Fast call", () => {
  it("starts at the right button's press, before the menu draws, and the menu takes it up without asking again", async () => {
    const { calls, fast } = counted();
    const { host } = await rendered({ fast }, [looks]);
    await act(async () => void row(host, "book").dispatchEvent(pointer("pointerdown", { button: 2, clientX: 40, clientY: 60 })));
    await until(() => calls.suggested > 0, 40);
    expect(menu()).toBeNull();
    expect(calls.suggested).toBe(1);
    await rightClick(row(host, "book"));
    await until(() => suggestedRows().length > 0);
    await wait(200);
    expect(suggestedRows().length).toBeGreaterThan(0);
    expect(calls.suggested).toBe(1);
  });

  it("is asked once on a list's own ground too, where the menu is headed with the list's name and the press knows none", async () => {
    const { calls, fast } = counted();
    const { host } = await rendered({ fast }, [looks]);
    const ground = host.querySelector<HTMLElement>("main h1") ?? host.querySelector<HTMLElement>("main")!;
    await act(async () => void ground.dispatchEvent(pointer("pointerdown", { button: 2, clientX: 40, clientY: 20 })));
    await until(() => calls.suggested > 0, 40);
    await rightClick(ground);
    await until(() => suggestedRows().length > 0);
    await wait(200);
    expect(suggestedRows().length).toBeGreaterThan(0);
    expect(calls.suggested).toBe(1);
  });

  it("holds the rows' height as the Fast slot answers sure of fewer than were first drawn", async () => {
    // Sure of the first alone: the answer shows one row where three were drawn first.
    let answered = false;
    // The answer waits for the test to let it go: the first frame is read before it, however slow the runner.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((done) => (release = done));
    const fast: FastProvider = {
      model: "fake-fast",
      decide: async (_state, questions) => {
        await gate;
        answered = true;
        return {
          answers: Object.fromEntries(
            Object.entries(questions).map(([key, question]) => {
              const names = Object.keys((question as { criteria: Record<string, string> }).criteria);
              return [key, { type: "choice", choice: names[0]!, confidence: 0.9, probabilities: Object.fromEntries(names.map((name, at) => [name, at === 0 ? 0.9 : 0.01])) }];
            }),
          ) as never,
          usage: { inputTokens: 10, outputTokens: 0 },
        };
      },
    };
    const { host } = await rendered({ fast }, [looks]);
    await rightClick(row(host, "book"));
    await until(() => suggestedRows().length > 0);
    const section = () => menu()!.querySelector<HTMLElement>('[data-menu-section="suggested"]')!;
    const first = { rows: suggestedRows().length, height: section().style.minHeight };
    expect(first.rows).toBe(3);
    release();
    await until(() => answered && suggestedRows().length === 1);
    expect(suggestedRows()).toHaveLength(1);
    // The room the first three took is kept: nothing under them moves up.
    expect(section().style.minHeight).toBe(first.height);
  });
});

describe("the hover chip tells the host how it ended", () => {
  const sure: FastProvider = {
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
  const over = (element: Element) => act(async () => void element.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" } as PointerEventInit)));
  const out = (element: Element) => act(async () => void element.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: document.body } as PointerEventInit)));
  const chip = () => document.querySelector<HTMLButtonElement>('[data-testid="hover-chip"]');

  it("left when the pointer goes, taken when it is pressed, each once, with the model and how sure it was", async () => {
    localStorage.clear();
    const heard: PickOutcome[] = [];
    const { host } = await rendered({ fast: sure, hoverChips: true, onPickOutcome: (outcome) => void heard.push(outcome) });
    await over(row(host, "book"));
    await until(() => chip() !== null);
    const offered = chip()!.getAttribute("data-ai-offer");
    await out(row(host, "book"));
    await until(() => chip() === null);
    await wait(30);
    const left = heard.filter((one) => one.where === "chip");
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ outcome: "dismissed", pick: offered, record: "book", model: "fake-fast", confidence: expect.any(Number) });

    heard.length = 0;
    await over(row(host, "deposit"));
    await until(() => chip() !== null);
    await act(async () => chip()!.click());
    await until(() => chip() === null);
    await wait(30);
    const taken = heard.filter((one) => one.where === "chip");
    expect(taken).toHaveLength(1);
    expect(taken[0]).toMatchObject({ outcome: "accepted", record: "deposit" });
  });
});

describe("each showing is told to the host once", () => {
  it("words typed in the menu, and cleared, do not tell the AI section's picks again as a new showing", async () => {
    const heard: PickOutcome[] = [];
    const { fast } = counted();
    const { host } = await rendered({ fast, onPickOutcome: (outcome) => void heard.push(outcome) });
    await rightClick(row(host, "book"));
    const more = menu()?.querySelector<HTMLButtonElement>('[data-menu-item="more"]');
    if (more) await act(async () => more.click());
    await until(() => (menu()?.querySelectorAll("[data-ai-offer]").length ?? 0) > 0);
    const shown = menu()!.querySelectorAll("[data-ai-offer]").length;
    expect(shown).toBeGreaterThan(0);
    // Words stand the section down, and clearing them draws it again: the same showing.
    await typeInMenu("x");
    expect(menu()!.querySelectorAll("[data-ai-offer]").length).toBe(0);
    expect(heard.filter((one) => one.where === "menu")).toHaveLength(0);
    await typeInMenu("");
    await until(() => (menu()?.querySelectorAll("[data-ai-offer]").length ?? 0) > 0);
    await close();
    await wait(30);
    const told = heard.filter((one) => one.where === "menu");
    expect(told).toHaveLength(shown);
    expect(new Set(told.map((one) => one.pick)).size).toBe(shown);
  });

  it("a section hidden by words when the menu closes is told once, as the menu goes", async () => {
    const heard: PickOutcome[] = [];
    const { fast } = counted();
    const { host } = await rendered({ fast, onPickOutcome: (outcome) => void heard.push(outcome) });
    await rightClick(row(host, "deposit"));
    const more = menu()?.querySelector<HTMLButtonElement>('[data-menu-item="more"]');
    if (more) await act(async () => more.click());
    await until(() => (menu()?.querySelectorAll("[data-ai-offer]").length ?? 0) > 0);
    const shown = menu()!.querySelectorAll("[data-ai-offer]").length;
    await typeInMenu("x");
    await close();
    await until(() => heard.some((one) => one.where === "menu"), 20);
    expect(heard.filter((one) => one.where === "menu")).toHaveLength(shown);
  });
});
