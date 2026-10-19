// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { createViews } from "@graview/react";
import type { FastProvider, HostAi, ThinkingProvider } from "@graview/tools/frame";
import { stubThinking } from "@graview/tools/inline-ai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * SEVERAL CHOSEN, AND A POINTER AT REST, ASK ONLY THE FAST SLOT (Roadmap
 * f-inline-ai-framework-finish). Records chosen together get the AI's
 * suggestions in their selection bar beside the acts they share — asked of
 * the Fast slot once per choice, never of the Thinking slot. A record the
 * pointer rests on gets at most one quiet chip, where the host asked for
 * chips and the Fast slot was sure enough; a pointer passing over asks
 * nothing; the reader can turn chips off; AI off hides both.
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

/** A Fast slot that picks the first option as sure as it is told to be, and a Thinking slot, each counting its calls. */
function counted(sure = 0.9) {
  const calls = { fast: 0, thinking: 0 };
  const fast: FastProvider = {
    model: "fake-fast",
    decide: async (_state, questions) => {
      calls.fast += 1;
      return {
        answers: Object.fromEntries(
          Object.entries(questions).map(([key, question]) => {
            const names = Object.keys((question as { criteria: Record<string, string> }).criteria);
            return [key, { type: "choice", choice: names[0]!, confidence: sure, probabilities: Object.fromEntries(names.map((name, at) => [name, at === 0 ? sure : 0.01])) }];
          }),
        ) as never,
        usage: { inputTokens: 10, outputTokens: 0 },
      };
    },
  };
  const thinkingStub = stubThinking();
  const thinking: ThinkingProvider = { ...thinkingStub, think: (request) => ((calls.thinking += 1), thinkingStub.think(request)) };
  return { calls, fast, thinking };
}

let cleanup: (() => Promise<void>) | undefined;
beforeEach(() => localStorage.clear());
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

async function rendered(ai: HostAi) {
  const store = new Store({
    schema,
    mutations: [finish],
    snapshot: {
      nodes: [
        { id: "book", kind: "task", label: "Book the hall", done: false },
        { id: "send", kind: "task", label: "Send the invitations", done: false },
        { id: "buy", kind: "task", label: "Buy the cake", done: false },
      ] as never,
      edges: [],
    },
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

const choose = async (host: HTMLElement, id: string) => {
  const box = host.querySelector<HTMLInputElement>(`[data-graview-choose-box="${id}"]`)!;
  await act(async () => void box.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  // The bar is fetched with the first one chosen.
  for (let turn = 0; turn < 60 && !document.querySelector('[data-testid="several-bar"]'); turn += 1) await settle(1);
};
const clear = async () => {
  await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="several-clear"]')?.click());
  await settle(2);
};
const barOffers = () => [...document.querySelectorAll('[data-testid="several-ai-offer"]')].map((one) => one.textContent ?? "");

const row = (host: HTMLElement, id: string) => host.querySelector(`[data-graview-record="${id}"]`)!;
const over = async (element: Element) => act(async () => void element.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" } as PointerEventInit)));
const out = async (element: Element) => act(async () => void element.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, pointerType: "mouse", relatedTarget: document.body } as PointerEventInit)));
const chips = () => document.querySelectorAll('[data-testid="hover-chip"]');

describe("several chosen get the Fast slot's suggestions in their bar", () => {
  it("asks the Fast slot once per choice, and offers what it picked beside the acts they share", async () => {
    const { calls, fast, thinking } = counted();
    const { host, store } = await rendered({ fast, thinking });
    await choose(host, "book");
    await choose(host, "send");
    await settle();
    expect(document.querySelector('[data-testid="several-bar"]')).not.toBeNull();
    expect(calls).toEqual({ fast: 1, thinking: 0 });
    expect(barOffers()).toEqual([expect.stringContaining("Mark it done")]);
    // Put down and chosen again: the same choice is not asked again.
    await clear();
    await choose(host, "send");
    await choose(host, "book");
    await settle();
    expect(calls).toEqual({ fast: 1, thinking: 0 });
    expect(barOffers().length).toBe(1);
    // Taken, it runs over every chosen record as the bar's own act does.
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="several-ai-offer"]')!.click());
    await settle();
    expect(["book", "send"].map((id) => (store.graph.getNode(id) as { done?: boolean }).done)).toEqual([true, true]);
  });

  it("asks nothing, and offers nothing, with only a Thinking slot, or a host that asks only when asked", async () => {
    const { calls, thinking, fast } = counted();
    const { host } = await rendered({ thinking });
    await choose(host, "book");
    await choose(host, "send");
    await settle();
    expect(document.querySelector('[data-testid="several-bar"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="several-ai"], [data-testid="several-ai-thinking"]')).toBeNull();
    expect(calls).toEqual({ fast: 0, thinking: 0 });
    await cleanup?.();
    const quiet = await rendered({ fast, suggestOnOpen: false });
    await choose(quiet.host, "book");
    await choose(quiet.host, "send");
    await settle();
    expect(document.querySelector('[data-testid="several-ai"], [data-testid="several-ai-thinking"]')).toBeNull();
    expect(calls).toEqual({ fast: 0, thinking: 0 });
  });

  it("is hidden with AI off", async () => {
    const { calls, fast } = counted();
    const { host } = await rendered({ fast, off: true });
    await choose(host, "book");
    await choose(host, "send");
    await settle();
    expect(document.querySelector('[data-testid="several-bar"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="several-ai"], [data-testid="several-ai-thinking"]')).toBeNull();
    expect(calls.fast).toBe(0);
  });
});

describe("a pointer at rest gets one quiet chip, where the host asked for chips", () => {
  it("shows the Fast slot's sure suggestion after the dwell, one at a time, and asks once per record", async () => {
    const { calls, fast, thinking } = counted(0.9);
    const { host } = await rendered({ fast, thinking, hoverChips: true });
    await over(row(host, "book"));
    await settle();
    expect(calls).toEqual({ fast: 1, thinking: 0 });
    expect(chips().length).toBe(1);
    expect(chips()[0]!.getAttribute("aria-label")).toMatch(/^Suggested by AI: /);
    // Resting on another moves the one chip there.
    await out(row(host, "book"));
    await over(row(host, "send"));
    await settle();
    expect(chips().length).toBe(1);
    expect(calls.fast).toBe(2);
    // Back on the first: kept, not asked again.
    await out(row(host, "send"));
    await over(row(host, "book"));
    await settle();
    expect(chips().length).toBe(1);
    expect(calls).toEqual({ fast: 2, thinking: 0 });
    // Leaving puts it away.
    await out(row(host, "book"));
    await settle(14);
    expect(chips().length).toBe(0);
  });

  it("asks nothing for a pointer passing over", async () => {
    const { calls, fast } = counted(0.9);
    const { host } = await rendered({ fast, hoverChips: true });
    for (const id of ["book", "send", "buy"]) {
      await over(row(host, id));
      await act(async () => new Promise((done) => setTimeout(done, 40)));
      await out(row(host, id));
    }
    await settle();
    expect(calls.fast).toBe(0);
    expect(chips().length).toBe(0);
  });

  it("draws no chip when the Fast slot is unsure, and never asks a Thinking slot", async () => {
    const unsure = counted(0.3);
    const first = await rendered({ fast: unsure.fast, hoverChips: true });
    await over(row(first.host, "book"));
    await settle();
    expect(unsure.calls.fast).toBe(1);
    expect(chips().length).toBe(0);
    await cleanup?.();
    const only = counted(0.9);
    const second = await rendered({ thinking: only.thinking, hoverChips: true });
    await over(row(second.host, "book"));
    await settle();
    expect(only.calls).toEqual({ fast: 0, thinking: 0 });
    expect(chips().length).toBe(0);
  });

  it("is off unless the host asks, off for a reader who turned it off, and hidden with AI off", async () => {
    const unasked = counted(0.9);
    const first = await rendered({ fast: unasked.fast });
    await over(row(first.host, "book"));
    await settle();
    expect(unasked.calls.fast).toBe(0);
    expect(chips().length).toBe(0);
    await cleanup?.();

    const off = counted(0.9);
    const second = await rendered({ fast: off.fast, hoverChips: true, off: true });
    await over(row(second.host, "book"));
    await settle();
    expect(off.calls.fast).toBe(0);
    expect(chips().length).toBe(0);
    await cleanup?.();

    // The reader's switch, in the person menu.
    const reader = counted(0.9);
    const third = await rendered({ fast: reader.fast, hoverChips: true });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="profile-button"]')!.click());
    await settle();
    const offButton = document.querySelector<HTMLButtonElement>('[data-testid="setting-hover-chips-off"]');
    expect(offButton).not.toBeNull();
    await act(async () => offButton!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="profile-button"]')!.click());
    await over(row(third.host, "book"));
    await settle();
    expect(reader.calls.fast).toBe(0);
    expect(chips().length).toBe(0);
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="profile-button"]')!.click());
    await settle();
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="setting-hover-chips-on"]')!.click());
  });
});
