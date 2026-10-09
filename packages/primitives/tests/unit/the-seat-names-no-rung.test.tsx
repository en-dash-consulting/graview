// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import type { HostAi } from "@graview/tools";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as primitives from "../../src/index.js";
import { ChatPanel, registerDefaultViews } from "../../src/index.js";
import { SeatPanel } from "../../src/seat-panel.js";

/**
 * THE HOST DECIDES THE AI, AND THE SEAT NAMES NO RUNG.
 *
 * The seat had a ⚙ that opened "What answers": "this graph", "on this
 * device", "Jev, which decides", "a model, with my key" — the same pills
 * again in the person's menu, and "graph-native" under the field. A reader
 * asking what is overdue was being asked which machine should answer. Now
 * there is nothing to choose: with no model the seat says, once, that open
 * questions need AI, which isn't on here; with the host's model, its
 * answer carries one quiet "Answered with AI", and what it proposes is
 * logged through the model while the reader is shown only the act.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }), plural: "Plots" });
const schema = createSchema([plot]);
const { defineMutation } = bindSchema(schema);
const addPlot = defineMutation("add-plot", {
  title: "Stake out a plot",
  creates: ["plot"],
  input: z.object({ label: z.string().min(1) }),
  describe: (args) => `Stake out ${args.label}`,
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "plot"), kind: "plot", label: args.label });
  },
});
const gardener: Principal = { kind: "human", id: "erin", roles: ["keeper"] };
const RUNG_WORDS = /graph-native|Graph only|Onboard AI|\bJev\b|\bLLM\b|this graph|on this device|with my key|What answers|Answers come from|Answering now/;

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

async function mounted(store: Store<typeof schema>, children: ReactNode, ai?: HostAi) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} principal={gardener} {...(ai ? { ai } : {})}>
        {children}
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
  // The ask and its answer, once the answer has landed (the go resolver arrives by import).
  for (let tries = 0; tries < 100; tries++) {
    const now = [...turns()];
    if (now.length >= before + 2 && !(now.at(-1)?.textContent ?? "").startsWith("thinking")) break;
    await act(async () => new Promise((r) => setTimeout(r, 20)));
  }
  return [...turns()].at(-1)!;
}

const store = () => new Store({ schema, mutations: [addPlot], invariants: [], snapshot: { nodes: [{ id: "front", kind: "plot", label: "Front bed" }] as never, edges: [] } });

describe("nothing for a reader to choose", () => {
  it("draws no ⚙, no source line and no rung's name in the open seat", async () => {
    const { host, unmount } = await mounted(store(), <SeatPanel phone={false} side="right" name="Garden" onClose={() => {}} />);
    expect(host.querySelector('[data-testid="seat-panel"]')).not.toBeNull();
    for (const gone of ["seat-settings", "seat-source", "seat-ladder", "setting-intelligence", "seat-offer-model"]) {
      expect(host.querySelector(`[data-testid="${gone}"]`), gone).toBeNull();
    }
    expect(host.textContent ?? "").not.toMatch(RUNG_WORDS);
    expect([...host.querySelectorAll("[aria-label],[title]")].map((el) => `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`).join(" ")).not.toMatch(RUNG_WORDS);
    await unmount();
  });

  it("exports no ladder control", () => {
    for (const gone of ["LadderSetting", "SeatSettings", "describeSource"]) expect(primitives, gone).not.toHaveProperty(gone);
  });
});

describe("with no model, an open question is told so once", () => {
  it("answers what the graph knows plainly, and an open question with the sentence", async () => {
    const { host, unmount } = await mounted(store(), <ChatPanel />);
    // Asked first: a fact moves the app to its record, and "this" would then mean it.
    const open = await ask(host, "should we repaint the hallway?");
    expect(open.textContent).toContain("I can answer about what's in this app. Open questions need AI, which isn't on here.");
    const fact = await ask(host, "tell me about Front bed");
    expect(fact.textContent).toContain("Front bed");
    expect(fact.textContent).not.toContain("isn't on here");
    expect(host.querySelector('[data-testid="chat-answered-with-ai"]')).toBeNull();
    expect(host.textContent ?? "").not.toMatch(RUNG_WORDS);
    await unmount();
  });
});

describe("with the host's model", () => {
  it("says it answered with AI, quietly, and logs what it proposed through the model", async () => {
    const asked: string[] = [];
    const ai: HostAi = {
      name: "stub",
      complete: async (prompt) => {
        asked.push(prompt);
        return JSON.stringify({ say: "A back bed would help.", proposals: [{ mutation: "add-plot", args: { label: "Back bed" } }] });
      },
    };
    const kept = store();
    const { host, unmount } = await mounted(kept, <ChatPanel />, ai);
    const open = await ask(host, "what would make the garden better?");
    expect(asked).toHaveLength(1);
    expect(open.textContent).toContain("A back bed would help.");
    expect(open.querySelector('[data-testid="chat-answered-with-ai"]')?.textContent).toBe("Answered with AI");
    expect(host.textContent ?? "").not.toMatch(RUNG_WORDS);

    await act(async () => open.querySelector<HTMLButtonElement>('[data-testid="chat-apply"]')!.click());
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    const last = kept.log.all().at(-1)!;
    expect(last.intent).toBe("Stake out Back bed");
    expect(last.via).toBe("ai:stub");

    // A fact is the graph's, with nothing under it, and the model is not asked.
    const fact = await ask(host, "tell me about Front bed");
    expect(fact.textContent).toContain("Front bed");
    expect(fact.querySelector('[data-testid="chat-answered-with-ai"]')).toBeNull();
    expect(asked).toHaveLength(1);
    await unmount();
  });
});
