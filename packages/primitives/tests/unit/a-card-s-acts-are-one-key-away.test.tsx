// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, Scene } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Companion, registerDefaultViews } from "../../src/index.js";

/**
 * A CARD'S ACTS ARE ONE KEY AWAY.
 *
 * On a phone the seat is a folded sheet, and every act lives inside it. From
 * the keyboard, its toggle was a walk of a dozen Tabs past every other card
 * from the card you stood on — 22 presses to make a location in the rota
 * where a pointer took 8. A card with the keyboard on it answers A the way
 * it answers a right-click: chosen, the seat opened, the keyboard on its
 * first act; put away from the keyboard, the keyboard goes back to the card.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const addTask = defineMutation("add-task", {
  title: "Add a task",
  creates: ["task"],
  input: z.object({ label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "task"), kind: "task", label: args.label });
  },
});

/* jsdom measures every box as 0 wide: with something to watch it, the seat is the phone's folded sheet. */
const hadObserver = globalThis.ResizeObserver;
beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  globalThis.ResizeObserver = hadObserver;
});

async function phone() {
  const store = new Store({
    schema,
    mutations: [addTask],
    invariants: [],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit" }] as never, edges: [] },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }}>
        <main>
          <Scene renderer="dom" />
          <Companion<typeof schema> chat={false} />
        </main>
      </GraviewProvider>,
    ),
  );
  const frames = () => act(async () => new Promise<void>((done) => setTimeout(done, 120)));
  return { host, frames, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
}

const press = (on: Element, key: string) =>
  act(async () => {
    on.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });

describe("a card's acts are one key away", () => {
  it("names the key on the card, and the sheet starts folded on a phone", async () => {
    const { host, unmount } = await phone();
    const card = host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
    expect(card).not.toBeNull();
    expect(card.getAttribute("aria-keyshortcuts")).toBe("A");
    expect(host.querySelector("[data-graview-companion]")!.getAttribute("data-graview-companion")).toBe("shut");
    await unmount();
  });

  it("opens the folded seat on the card's acts with the keyboard on the first, and says the key while on the card", async () => {
    const { host, frames, unmount } = await phone();
    const card = host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
    await act(async () => card.focus());
    expect(host.querySelector('[data-testid="companion-acts-key"]')?.textContent).toContain("its acts");
    await press(card, "a");
    await frames();
    expect(host.querySelector("[data-graview-companion]")!.getAttribute("data-graview-companion")).toBe("open");
    const active = document.activeElement as HTMLElement;
    expect(host.querySelector('[data-testid="companion"]')!.contains(active)).toBe(true);
    expect(active.getAttribute("data-affordance")).toContain("add-task");
    await unmount();
  });

  it("puts the keyboard back on the card when the sheet is put away from the keyboard", async () => {
    const { host, frames, unmount } = await phone();
    const card = host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
    const id = card.getAttribute("data-graview-view");
    await act(async () => card.focus());
    await press(card, "a");
    await frames();
    const dock = host.querySelector<HTMLButtonElement>('[data-testid="companion-dock"]')!;
    // A click no pointer made: Enter or Space on the toggle.
    await act(async () => dock.click());
    expect(host.querySelector("[data-graview-companion]")!.getAttribute("data-graview-companion")).toBe("shut");
    expect((document.activeElement as HTMLElement).getAttribute("data-graview-view")).toBe(id);
    await unmount();
  });

  it("takes the keyboard into the seat from a mark inside a card, about the thing the mark is", async () => {
    const { host, frames, unmount } = await phone();
    const card = host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
    const mark = document.createElement("span");
    mark.setAttribute("data-graview-pick", "t1");
    mark.tabIndex = 0;
    card.append(mark);
    await act(async () => mark.focus());
    await press(mark, "a");
    await frames();
    expect(host.querySelector("[data-graview-companion]")!.getAttribute("data-graview-companion")).toBe("open");
    expect(host.querySelector('[data-testid="companion"]')!.getAttribute("data-graview-subject")).toBe("t1");
    expect(host.querySelector('[data-testid="companion"]')!.contains(document.activeElement)).toBe(true);
    await act(async () => mark.remove());
    await unmount();
  });

  it("leaves a letter typed into a field inside a card alone", async () => {
    const { host, frames, unmount } = await phone();
    const card = host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
    const field = document.createElement("input");
    card.append(field);
    await act(async () => field.focus());
    await press(field, "a");
    await frames();
    expect(host.querySelector("[data-graview-companion]")!.getAttribute("data-graview-companion")).toBe("shut");
    await act(async () => field.remove());
    await unmount();
  });
});
