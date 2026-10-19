// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, useGraview, type AiDesk } from "@graview/react";
import type { HostAi } from "@graview/tools";
import { stubFast, stubThinking } from "@graview/tools/inline-ai";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { FindBox, QuickAskDoor, registerDefaultViews } from "../../src/index.js";

/**
 * THE QUICK ASK (Roadmap f-quick-ask-framework), in place of the Ask box.
 *
 * ⌘K opens a command bar about what is selected: it completes the acts on
 * it, "Show …" for a panel the catalog can draw, its places and its
 * records, and asks words that complete nothing. The answer is a card
 * beside the record, in a few words, its proposed changes waiting as a
 * ghost; a follow-up on the card replaces the answer, and the card closes
 * on Escape with the keyboard back where it was. With AI off — or no
 * model, or the app's setting off — there is no bar, no card and no chord,
 * and Find's last row does not offer to ask.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), status: z.enum(["todo", "done"]).optional() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Finish it",
  subject: { kinds: ["task"], arg: "id" },
  writes: ["status"],
  input: z.object({ id: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { status: "done" });
  },
});
const store = () => new Store({ schema, mutations: [finish], invariants: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit" }] as never, edges: [] } });
const views = () => registerDefaultViews(schema, createViews(schema));
const AI: HostAi = { fast: stubFast(), thinking: stubThinking() };

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  sessionStorage.clear();
});

let desk: AiDesk | undefined;
function HoldDesk() {
  desk = useGraview().aiDesk;
  return null;
}

async function mount(tree: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(tree));
  cleanup = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}
const app = (ai: HostAi | undefined, extra: ReactNode = null, on = true, kept = store()) => (
  <GraviewProvider store={kept} views={views()} initialView={EMPTY_VIEW} initialSelection={["t1"]} {...(ai ? { ai } : {})}>
    <HoldDesk />
    <QuickAskDoor face="scene" on={on} />
    {extra}
  </GraviewProvider>
);
const settle = () => act(async () => new Promise<void>((done) => setTimeout(done, 30)));
const until = async (ready: () => boolean) => {
  for (let tries = 0; tries < 60 && !ready(); tries++) await settle();
};
const card = () => document.querySelector<HTMLElement>('[data-testid="quick-ask"]');
const field = () => document.querySelector<HTMLInputElement>('[data-testid="quick-ask-input"]')!;
const chord = () => act(async () => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true })));
const type = (words: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field(), words);
    field().dispatchEvent(new Event("input", { bubbles: true }));
  });
const press = (key: string) => act(async () => void field().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })));
const rows = () => [...document.querySelectorAll<HTMLElement>('[data-testid="quick-ask-option"]')].map((row) => `${row.getAttribute("data-quick-ask-kind")}: ${row.textContent}`);

describe("the quick ask", () => {
  it("opens on ⌘K about what is selected, with its acts and the panels to show", async () => {
    await mount(app(AI));
    await chord();
    await until(() => card() !== null);
    expect(card()!.getAttribute("data-quick-ask")).toBe("bar");
    expect(card()!.textContent).toContain("About Pay the deposit");
    expect(document.activeElement).toBe(field());
    expect(rows()).toContain("act: Finish it · do it");
    expect(rows().some((row) => row.startsWith("show: Show "))).toBe(true);
  });

  it("completes the words, and offers to ask what completes nothing", async () => {
    await mount(app(AI));
    await chord();
    await until(() => card() !== null);
    await type("finish");
    expect(rows()).toEqual(["act: Finish it · do it", "ask: Ask: ‘finish’"]);
    await type("what is left to do?");
    expect(rows()).toEqual(["ask: Ask: ‘what is left to do?’"]);
  });

  it("offers a view the app already has first, ahead of a panel drawn new, and to adjust it where it fits in part", async () => {
    const withBoard = views();
    withBoard.register("task", { cardinality: "many", fidelity: "full" }, () => null, { title: "Tasks by status", lens: "columns" });
    await mount(
      <GraviewProvider store={store()} views={withBoard} initialView={EMPTY_VIEW} initialSelection={["t1"]} ai={AI}>
        <QuickAskDoor face="scene" on />
      </GraviewProvider>,
    );
    await chord();
    await until(() => card() !== null);
    await type("show a board of tasks");
    expect(rows()[0]).toBe("place: Open Tasks by status · a view you have");
    await type("a searchable board");
    expect(rows()[0]).toBe("place: Open and adjust Tasks by status · adjust it");
    // Nothing it has fits: no such row.
    await type("what is left to do?");
    expect(rows()).toEqual(["ask: Ask: ‘what is left to do?’"]);
  });

  it("answers on the card beside it, its change a ghost not made, and a follow-up replaces the answer", async () => {
    const kept = store();
    await mount(app(AI, null, true, kept));
    await chord();
    await until(() => card() !== null);
    await type("what is left to do?");
    await press("Enter");
    await until(() => document.querySelector('[data-testid="quick-answer-text"]')?.textContent?.startsWith("About") === true);
    expect(card()!.getAttribute("data-quick-ask")).toBe("answer");
    expect(document.querySelector('[data-testid="quick-answer-text"]')!.textContent).toBe("About Pay the deposit: an answer to “what is left to do?”, as drafted.");
    // Its change waits as a ghost on the desk; the store has not made it.
    expect(desk!.get().ghost?.ghost.proposals.length).toBeGreaterThan(0);
    expect(kept.graph.getNode("t1")).not.toHaveProperty("status");
    expect(desk!.get().entries[0]).toMatchObject({ ask: { kind: "ask", said: "what is left to do?" }, outcome: "offered" });
    // A follow-up: the card's answer is the new one, not a thread of both.
    await type("and after that?");
    await press("Enter");
    await until(() => document.querySelector('[data-testid="quick-answer-asked"]')?.textContent === "“and after that?”" && document.querySelector('[data-testid="quick-answer-text"]')?.textContent?.startsWith("About") === true);
    expect(document.querySelectorAll('[data-testid="quick-answer-text"]')).toHaveLength(1);
    expect(desk!.get().entries).toHaveLength(2);
  });

  it("closes on Escape and gives the keyboard back to where it was", async () => {
    const host = await mount(app(AI, <button type="button">before</button>));
    const before = host.querySelector("button")!;
    before.focus();
    await chord();
    await until(() => card() !== null);
    await press("Escape");
    await until(() => card() === null);
    await settle();
    expect(card()).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  it("is not drawn with AI off, with no model, or with the app's setting off: no chord, no marker", async () => {
    for (const [ai, on] of [[{ off: true, fast: stubFast() }, true], [undefined, true], [AI, false]] as const) {
      const host = await mount(app(ai, null, on));
      expect(host.querySelector("[data-graview-quick-ask]")).toBeNull();
      await chord();
      await settle();
      expect(card()).toBeNull();
      await cleanup!();
      cleanup = undefined;
    }
  });

  it("is asked from Find's last row, with what was typed, only where it is drawn", async () => {
    const tree = (ai: HostAi | undefined) => (
      <GraviewProvider store={store()} views={views()} initialView={{ ...EMPTY_VIEW, q: "what is late" }} initialSelection={["t1"]} {...(ai ? { ai } : {})}>
        <FindBox />
        <QuickAskDoor face="scene" />
      </GraviewProvider>
    );
    const without = await mount(tree({ off: true }));
    expect(without.querySelector('[data-testid="find-ask"]')).toBeNull();
    await cleanup!();
    const host = await mount(tree(AI));
    const ask = host.querySelector<HTMLElement>('[data-testid="find-ask"]');
    expect(ask?.textContent).toBe("Ask: ‘what is late’");
    await act(async () => ask!.click());
    await until(() => document.querySelector('[data-testid="quick-answer-asked"]') !== null);
    expect(document.querySelector('[data-testid="quick-answer-asked"]')!.textContent).toBe("“what is late”");
  });
});
