// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, Scene, useGraview, type PointerMenu } from "@graview/react";
import type { Answer, Decide, FastProvider, HostAi } from "@graview/tools";
import { stubFast, stubThinking } from "@graview/tools/inline-ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, QuickAskDoor, registerDefaultViews } from "../../src/index.js";
import { menuMatches } from "../../src/menu-words.js";

beforeAll(() => fetchInspector());

/**
 * TYPE IN THE RIGHT-CLICK MENU (Roadmap f-menu-type-anything): "when I
 * right-click on anything, I want to be able to type in something about it."
 *
 * A letter typed in the menu goes into its field, the keyboard with it; the
 * menu still opens with the keyboard on its first row, so the arrows walk
 * the rows. What is typed narrows every row to those whose words begin with
 * it, and Enter runs the one lit. Where the host lent the app a model the
 * last row asks the words about what the menu was opened on, answered on the
 * quick ask's card; with no model the field only filters.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const acts = [
  ["finish", "Finish it", { done: true }],
  ["hand-on", "Hand it on", { label: "Handed on" }],
  ["put-off", "Put it off", { label: "Put off" }],
] as const;
const mutations = acts.map(([name, title, patch]) =>
  defineMutation(name, {
    title,
    subject: { kinds: ["task"], arg: "taskId" },
    writes: Object.keys(patch) as never,
    input: z.object({ taskId: nodeRef(["task"]) }),
    apply: (ctx, args) => ctx.patchNode(args.taskId, patch as never),
  }),
);
const AI: HostAi = { fast: stubFast(), thinking: stubThinking() };

let openMenu: ((menu: PointerMenu) => void) | undefined;
function HoldMenu() {
  openMenu = useGraview().setMenuAt;
  return null;
}

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  sessionStorage.clear();
});

async function mount(ai: HostAi | undefined) {
  const store = new Store({ schema, mutations, invariants: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] } });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, focusId: "t1" }} initialSelection={["t1"]} {...(ai ? { ai } : {})}>
        <HoldMenu />
        <main>
          <Scene renderer="dom" />
          <Inspector placement="menu" />
        </main>
        <QuickAskDoor face="scene" />
      </GraviewProvider>,
    ),
  );
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  await settle();
  await act(async () => openMenu!({ x: 20, y: 20, on: "t1" }));
  await until(() => menu()?.querySelector("[data-affordance]") !== null);
  return store;
}

const settle = () => act(async () => new Promise<void>((done) => setTimeout(done, 30)));
const until = async (ready: () => boolean) => {
  for (let tries = 0; tries < 80 && !ready(); tries++) await settle();
};
const menu = () => document.querySelector<HTMLElement>('[data-testid="context-menu"]');
const field = () => document.querySelector<HTMLInputElement>('[data-testid="menu-type"]');
const focused = () => document.activeElement as HTMLElement;
const press = (on: Element, key: string) => act(async () => void on.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
/* A key on a row is heard by the menu; in the field it is the field's own (a page puts the letter in, which jsdom does not). */
const typeKeys = async (keys: string) => {
  for (const key of keys) {
    const box = field();
    if (focused() !== box) await press(focused(), key);
    else
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(box, box!.value + key);
        box!.dispatchEvent(new Event("input", { bubbles: true }));
      });
  }
};
const shownActs = () => [...menu()!.querySelectorAll<HTMLElement>("[data-affordance]")].map((row) => row.textContent!.replace(/[…↵]/g, "").trim());
const rows = () => [...menu()!.querySelectorAll<HTMLElement>("[data-menu-item]")].map((row) => row.getAttribute("data-menu-item"));
const lit = () => menu()!.querySelector<HTMLElement>("[data-menu-lit]")?.textContent?.replace(/[…↵]/g, "").trim() ?? null;

describe("a word typed in the menu", () => {
  it("finds the rows whose words begin with it, in any order, without case or accents", () => {
    expect(menuMatches("Copy link", "copy l")).toBe(true);
    expect(menuMatches("Finish it", "it fin")).toBe(true);
    expect(menuMatches("Open in a new tab", "new")).toBe(true);
    expect(menuMatches("Café hours", "cafe")).toBe(true);
    expect(menuMatches("Finish it", "ish")).toBe(false);
    expect(menuMatches("Anything", "")).toBe(true);
  });
});

describe("typing in the menu", () => {
  it("opens with the keyboard on its first row, and a letter typed there goes into the field", async () => {
    await mount(AI);
    expect(field()).not.toBeNull();
    expect(focused().hasAttribute("data-affordance")).toBe(true);
    await typeKeys("h");
    expect(focused()).toBe(field());
    expect(field()!.value).toBe("h");
  });

  it("filters every row to what is typed, and Enter runs the one lit", async () => {
    const store = await mount(AI);
    await typeKeys("ha");
    expect(shownActs()).toEqual(["Hand it on"]);
    expect(lit()).toBe("Hand it on");
    // The words asked about what the menu is on are the last row, whatever else fits.
    expect(rows().at(-1)).toBe("ask-typed");
    expect(menu()!.querySelector('[data-menu-item="ask-typed"]')!.textContent).toBe("Ask about Pay the deposit: ha");
    await press(field()!, "Enter");
    await settle();
    expect(store.graph.getNode("t1")?.["label"]).toBe("Handed on");
    expect(menu()).toBeNull();
  });

  it("walks from the field to the rows with the arrows, and back up to the field", async () => {
    await mount(AI);
    await typeKeys("p");
    await press(field()!, "ArrowDown");
    expect(focused().textContent).toContain("Put it off");
    await press(focused(), "ArrowUp");
    expect(focused()).toBe(field());
    // Escape takes the words back first; the menu stays.
    await press(field()!, "Escape");
    expect(field()!.value).toBe("");
    expect(menu()).not.toBeNull();
  });

  it("asks words that fit nothing about what the menu is on, answered on the card with its thinking marked and its change a ghost", async () => {
    await mount(AI);
    const marks: string[] = [];
    const watching = new MutationObserver(() => {
      if (document.querySelector('[data-testid="ai-thinking-mark"]')) marks.push(document.querySelector('[data-testid="ai-thinking-mark"]')!.textContent ?? "");
    });
    watching.observe(document.body, { childList: true, subtree: true });
    await typeKeys("what is left?");
    expect(shownActs()).toEqual([]);
    expect(lit()).toBe("Ask about Pay the deposit: what is left?");
    await press(field()!, "Enter");
    await until(() => document.querySelector('[data-testid="quick-answer-text"]')?.textContent?.startsWith("About") === true);
    watching.disconnect();
    expect(menu()).toBeNull();
    expect(document.querySelector('[data-testid="quick-answer-asked"]')!.textContent).toBe("“what is left?”");
    expect(marks.some((said) => said.includes("Thinking about Pay the deposit"))).toBe(true);
    // Answered, the mark is gone from the thing.
    expect(document.querySelector('[data-testid="ai-thinking-mark"]')).toBeNull();
    expect(document.querySelector("[data-graview-ai-thinking]")).toBeNull();
  });

  it("only filters where the host lent no model: no Ask row, and words that fit nothing say so", async () => {
    await mount(undefined);
    await typeKeys("fin");
    expect(shownActs()).toEqual(["Finish it"]);
    expect(rows()).not.toContain("ask-typed");
    expect(field()!.placeholder).toBe("Type to filter…");
    await typeKeys("zz");
    expect(shownActs()).toEqual([]);
    expect(lit()).toBeNull();
    expect(menu()!.querySelector('[data-testid="menu-no-match"]')?.textContent).toBe("Nothing here matches “finzz”.");
  });
});

describe("the Fast slot, as the words are typed", () => {
  /* What the menu asked of it, by the words: the menu's own suggestions ask other questions, not counted. */
  const asked: string[] = [];
  afterEach(() => void asked.splice(0));
  /* A Fast slot that takes the row it finds meant: "Finish it" for anything about completing. */
  const fast: FastProvider = {
    model: "fake-fast",
    decide: vi.fn<Decide>(async (state, questions) => {
      const typed = (state as { typed: string }).typed;
      const question = questions["row"];
      const answers: Record<string, Answer> = {};
      if (question?.type !== "choice") return { answers, usage: { inputTokens: 0, outputTokens: 0 } };
      asked.push(typed);
      const names = Object.keys(question.criteria);
      const choice = names.find((name) => /complete/.test(typed) && question.criteria[name] === "Finish it") ?? names[0]!;
      answers["row"] = { type: "choice", choice, confidence: 0.85, probabilities: Object.fromEntries(names.map((name) => [name, name === choice ? 0.85 : 0.01])) };
      return { answers, usage: { inputTokens: 12, outputTokens: 1 } };
    }),
  };

  it("answers on the first key with the local match, then shows and lights the row the Fast slot finds meant once the typing rests", async () => {
    await mount({ fast, thinking: stubThinking() });
    await typeKeys("complete");
    // At once: no act's words begin with it.
    expect(shownActs()).toEqual([]);
    expect(asked).toEqual([]);
    await until(() => shownActs().length > 0);
    expect(asked).toEqual(["complete"]);
    expect(shownActs()).toEqual(["Finish it"]);
    expect(lit()).toBe("Finish it");
  });

  it("asks once the typing rests, for the words as they stand, never for each key", async () => {
    await mount({ fast, thinking: stubThinking() });
    await typeKeys("complete x");
    await until(() => asked.length > 0);
    await settle();
    expect(asked).toEqual(["complete x"]);
  });
});

