// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import type { HostAi } from "@graview/tools";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ChatPanel, registerDefaultViews } from "../../src/index.js";

/**
 * THE SEAT TELLS THE MODEL WHAT THE PERSON SAW (FR-169).
 *
 * On Graview Cloud's staging the offer under an answer read "Add a revenue
 * stream: nascent". The person said that was the wrong title, and the
 * model, which had never seen the line, agreed and asked for another. What
 * the seat offered is part of what was said: the conversation the model is
 * handed carries each offer's sentence, as it was shown, and what became of
 * it. And a model's answer says so with one quiet mark in its turn, not a
 * line of its own under every answer.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string(), soil: z.string().optional() }), plural: "Plots" });
const schema = createSchema([plot]);
const { defineMutation } = bindSchema(schema);
const addPlot = defineMutation("add-plot", {
  title: "Stake out a plot",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1), soil: z.string().optional() }),
  describe: (args) => `Stake out ${args.label}${args.soil ? ` (${args.soil})` : ""}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "plot"), kind: "plot", label: args.label, ...(args.soil ? { soil: args.soil } : {}) });
  },
});
const gardener: Principal = { kind: "human", id: "erin", roles: ["keeper"] };

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

async function mounted(store: Store<typeof schema>, ai: HostAi) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} principal={gardener} ai={ai}>
        <ChatPanel />
      </GraviewProvider>,
    ),
  );
  return {
    host,
    unmount: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

async function ask(host: HTMLElement, words: string) {
  const field = host.querySelector<HTMLInputElement>('[data-testid="chat-draft"]')!;
  const turns = () => host.querySelectorAll('[data-testid="chat-panel"] ol > li');
  const before = [...turns()].filter((li) => !(li.textContent ?? "").startsWith("thinking")).length;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, words);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    field.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  for (let tries = 0; tries < 100; tries++) {
    const now = [...turns()];
    if (now.length >= before + 2 && !(now.at(-1)?.textContent ?? "").startsWith("thinking")) break;
    await act(async () => new Promise((r) => setTimeout(r, 20)));
  }
  return [...turns()].at(-1)!;
}

const store = () => new Store({ schema, mutations: [addPlot], invariants: [], snapshot: { nodes: [{ id: "front", kind: "plot", label: "Front bed" }] as never, edges: [] } });

describe("what the seat offered, in the conversation the model is handed", () => {
  it("carries each offer's sentence as the person saw it, while it is still open", async () => {
    const prompts: string[] = [];
    const ai: HostAi = {
      name: "stub",
      complete: async (prompt) => {
        prompts.push(prompt);
        return JSON.stringify({ say: "Here is a plot for it.", proposals: prompts.length === 1 ? [{ mutation: "add-plot", args: { soil: "clay", label: "Back bed" } }] : [] });
      },
    };
    const { host, unmount } = await mounted(store(), ai);
    const first = await ask(host, "stake out a plot for the clay corner");
    expect(first.textContent).toContain("Stake out Back bed (clay)");
    await ask(host, "is clay its name?");
    expect(prompts[1]).toContain("Here is a plot for it. [Offered beneath this answer: Stake out Back bed (clay)]");
    await unmount();
  });

  it("says what became of an offer the person took", async () => {
    const prompts: string[] = [];
    const ai: HostAi = {
      name: "stub",
      complete: async (prompt) => {
        prompts.push(prompt);
        return JSON.stringify({ say: "Here is a plot for it.", proposals: prompts.length === 1 ? [{ mutation: "add-plot", args: { label: "Back bed" } }] : [] });
      },
    };
    const kept = store();
    const { host, unmount } = await mounted(kept, ai);
    const first = await ask(host, "stake out a back bed");
    await act(async () => first.querySelector<HTMLButtonElement>('[data-testid="chat-apply"]')!.click());
    for (let tries = 0; tries < 100 && !first.querySelector('[data-testid="chat-applied"]'); tries++) await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(kept.log.all()).toHaveLength(1);
    await ask(host, "and another");
    expect(prompts[1]).toContain("You: Here is a plot for it. [Offered beneath this answer: Stake out Back bed — applied]");
    await unmount();
  });
});

describe("a model's answer, marked", () => {
  it("is marked once in each of its turns, quietly in the line it said, not on a line of its own", async () => {
    const ai: HostAi = { name: "stub", complete: async () => JSON.stringify({ say: "Clay holds water.", proposals: [] }) };
    const { host, unmount } = await mounted(store(), ai);
    const one = await ask(host, "what does clay do?");
    const two = await ask(host, "and sand?");
    for (const turn of [one, two]) {
      const marks = turn.querySelectorAll('[data-testid="chat-answered-with-ai"]');
      expect(marks).toHaveLength(1);
      expect(marks[0]!.textContent).toBe("Answered with AI");
      expect((marks[0] as HTMLElement).style.display).not.toBe("block");
    }
    expect(host.querySelectorAll('[data-testid="chat-answered-with-ai"]')).toHaveLength(2);
    await unmount();
  });
});
