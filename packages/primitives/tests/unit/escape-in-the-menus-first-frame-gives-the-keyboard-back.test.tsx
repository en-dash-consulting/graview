// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, Scene, useGraview, type PointerMenu } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, registerDefaultViews } from "../../src/index.js";

beforeAll(() => fetchInspector());

/**
 * ESCAPE IN THE MENU'S FIRST FRAME GIVES THE KEYBOARD BACK (Graview HQ
 * feature:f-menu-first-frames-follow-ups). A menu opened on a pick inside a
 * card — a task on a day's clock — had nowhere to give the keyboard back
 * to: the scene names no element to return to, and the pick is no card of
 * its own. Escape pressed as it opened, with the keyboard on its field,
 * left the keyboard on <body>. It goes back to the pick, in its card.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);

let openMenu: ((menu: PointerMenu) => void) | undefined;
function HoldMenu() {
  openMenu = useGraview().setMenuAt;
  return null;
}

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
});

const settle = () => act(async () => new Promise<void>((done) => setTimeout(done, 30)));
const until = async (ready: () => boolean) => {
  for (let tries = 0; tries < 80 && !ready(); tries++) await settle();
};
const field = () => document.querySelector<HTMLInputElement>('[data-testid="menu-type"]');

describe("Escape in the menu's first frame", () => {
  it("gives the keyboard back to the pick it was opened on, never <body>", async () => {
    const store = new Store({
      schema,
      snapshot: {
        nodes: [
          { id: "day", kind: "task", label: "Monday" },
          { id: "deposit", kind: "task", label: "Pay the deposit" },
        ] as never,
        edges: [],
      },
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, focusId: "day" }}>
          <HoldMenu />
          <main>
            <Scene renderer="dom" />
            <Inspector placement="menu" />
          </main>
        </GraviewProvider>,
      ),
    );
    cleanup = async () => {
      await act(async () => root.unmount());
      host.remove();
    };
    await until(() => document.querySelector('[data-graview-view="day"]') !== null);
    const card = document.querySelector<HTMLElement>('[data-graview-view="day"]')!;
    // A task drawn on the day's card, as a clock draws one: a pick, not a card.
    const pick = document.createElement("span");
    pick.setAttribute("data-graview-pick", "deposit");
    pick.textContent = "Pay the deposit";
    card.append(pick);
    await act(async () => openMenu!({ x: 20, y: 20, on: "deposit" }));
    await until(() => field() !== null);
    field()!.focus();
    expect(document.activeElement).toBe(field());
    await act(async () => void field()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    await settle();
    expect(document.querySelector('[data-testid="context-menu"]')).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    // The pick takes the keyboard on the scene (a button of its own): the keyboard is back on it, inside its card.
    expect(document.activeElement).toBe(pick);
    expect(card.contains(document.activeElement)).toBe(true);
  });
});
