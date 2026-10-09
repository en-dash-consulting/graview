// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, Scene } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Inspector, registerDefaultViews } from "../../src/index.js";

/**
 * A CARD'S ACTS ARE ONE KEY AWAY.
 *
 * A card with the keyboard on it answers A the way it answers a
 * right-click: chosen, its acts opened at the card as the context menu, the
 * keyboard in them; Escape puts the keyboard back on the card. The seat no
 * longer holds every act, so the key opens the menu, not the seat.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const finish = defineMutation("finish", {
  title: "Mark it done",
  subject: { kinds: ["task"], arg: "taskId" },
  writes: ["done"],
  input: z.object({ taskId: nodeRef(["task"]) }),
  apply: (ctx, args) => ctx.patchNode(args.taskId, { done: true }),
});

async function scene() {
  const store = new Store({
    schema,
    mutations: [finish],
    invariants: [],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, focusId: "t1" }}>
        <main>
          <Scene renderer="dom" />
          <Inspector placement="menu" />
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
const menu = () => document.querySelector('[data-testid="context-menu"]');

describe("a card's acts are one key away", () => {
  it("names the key on the card", async () => {
    const { host, unmount } = await scene();
    const card = host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
    expect(card).not.toBeNull();
    expect(card.getAttribute("aria-keyshortcuts")).toBe("A");
    expect(menu()).toBeNull();
    await unmount();
  });

  it("opens the card's acts as the context menu, with the keyboard in them, and Escape puts it back on the card", async () => {
    const { host, frames, unmount } = await scene();
    const card = host.querySelector<HTMLElement>('[data-graview-view="t1"]') ?? host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
    const id = card.getAttribute("data-graview-view");
    await act(async () => card.focus());
    await press(card, "a");
    await frames();
    expect(menu()).not.toBeNull();
    expect(menu()!.contains(document.activeElement)).toBe(true);
    await press(document.activeElement!, "Escape");
    await frames();
    expect(menu()).toBeNull();
    expect((document.activeElement as HTMLElement).getAttribute("data-graview-view")).toBe(id);
    await unmount();
  });

  it("opens the acts of the thing a mark inside a card is", async () => {
    const { host, frames, unmount } = await scene();
    const card = host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
    const mark = document.createElement("span");
    mark.setAttribute("data-graview-pick", "t1");
    mark.tabIndex = 0;
    card.append(mark);
    await act(async () => mark.focus());
    await press(mark, "a");
    await frames();
    expect(menu()).not.toBeNull();
    expect(menu()!.querySelector('[data-affordance*="finish"]')).not.toBeNull();
    await act(async () => mark.remove());
    await unmount();
  });

  it("leaves a letter typed into a field inside a card alone", async () => {
    const { host, frames, unmount } = await scene();
    const card = host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
    const field = document.createElement("input");
    card.append(field);
    await act(async () => field.focus());
    await press(field, "a");
    await frames();
    expect(menu()).toBeNull();
    await act(async () => field.remove());
    await unmount();
  });
});
