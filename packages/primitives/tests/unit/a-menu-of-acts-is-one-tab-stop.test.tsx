// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, Scene } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchInspector, Inspector, registerDefaultViews, SceneSkips } from "../../src/index.js";

beforeAll(() => fetchInspector());

/**
 * A MENU OF ACTS IS ONE TAB STOP, AND THE SCENE SKIPS TO WHAT IS CHOSEN.
 *
 * From the keyboard a chosen card was nineteen Tabs from the top of the
 * scene, and the eleventh act in its menu twenty-one Tabs from the key that
 * opened it — each act and each act's pin a stop of its own (walks XI and
 * XII). The bar's first stop is the way to what is chosen; the acts are one
 * stop, walked with the arrows, a letter typed narrowing them, and
 * each act's pin is the arrow to its right.
 */
const task = defineNode("task", { fields: z.object({ label: z.string(), done: z.boolean().default(false) }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const acts = ["Mark it done", "Put it off", "Hand it on", "Keep it"].map((title, at) =>
  defineMutation(`act-${at}`, {
    title,
    subject: { kinds: ["task"], arg: "taskId" },
    writes: ["label"],
    input: z.object({ taskId: nodeRef(["task"]) }),
    apply: (ctx, args) => ctx.patchNode(args.taskId, { label: `${title} once` }),
  }),
);

async function scene() {
  const store = new Store({
    schema,
    mutations: acts,
    invariants: [],
    snapshot: { nodes: [{ id: "t1", kind: "task", label: "Pay the deposit", done: false }] as never, edges: [] },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, focusId: "t1" }} initialSelection={["t1"]}>
        <header>
          <SceneSkips />
        </header>
        <main>
          <Scene renderer="dom" />
          <Inspector placement="menu" />
        </main>
      </GraviewProvider>,
    ),
  );
  const frames = () => act(async () => new Promise<void>((done) => setTimeout(done, 120)));
  await frames();
  return { host, frames, unmount: async () => { await act(async () => root.unmount()); host.remove(); } };
}

const press = (on: Element, key: string) =>
  act(async () => {
    on.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
const menu = () => document.querySelector('[data-testid="context-menu"]');
const focused = () => document.activeElement as HTMLElement;

async function openMenu() {
  const opened = await scene();
  const card = opened.host.querySelector<HTMLElement>('[data-graview-view="t1"]') ?? opened.host.querySelector<HTMLElement>("[data-graview-view][tabindex]")!;
  await act(async () => card.focus());
  await press(card, "a");
  await opened.frames();
  return opened;
}

describe("the scene's first stop", () => {
  it("is the way to what is chosen, named for it, and Enter puts the keyboard on its card", async () => {
    const { host, frames, unmount } = await scene();
    const skip = host.querySelector<HTMLButtonElement>('[data-graview-skip="chosen"]');
    expect(skip?.textContent).toBe("Skip to Pay the deposit");
    // Nothing comes before it.
    expect(host.querySelector("button, a[href], input, [tabindex]")).toBe(skip);
    await act(async () => skip!.click());
    await frames();
    expect(focused().getAttribute("data-graview-view")).toBe("t1");
    await unmount();
  });
});

describe("a menu of acts", () => {
  it("is one Tab stop: one act takes Tab, and no pin does", async () => {
    const { unmount } = await openMenu();
    const items = [...menu()!.querySelectorAll<HTMLElement>("[data-affordance]")];
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(items.filter((item) => item.tabIndex === 0)).toHaveLength(1);
    for (const pin of menu()!.querySelectorAll<HTMLElement>("[data-pin-for]")) expect(pin.tabIndex).toBe(-1);
    await unmount();
  });

  it("is walked with the arrows, and End and Home go to its ends", async () => {
    const { unmount } = await openMenu();
    const items = () => [...menu()!.querySelectorAll<HTMLElement>("[data-affordance]")];
    await act(async () => items()[0]!.focus());
    await press(focused(), "ArrowDown");
    expect(focused()).toBe(items()[1]);
    expect(items()[1]!.tabIndex).toBe(0);
    expect(items()[0]!.tabIndex).toBe(-1);
    await press(focused(), "End");
    expect(focused()).toBe(items().at(-1));
    await press(focused(), "Home");
    expect(focused()).toBe(items()[0]);
    await unmount();
  });

  /*
   * A letter typed in the menu goes into the menu's field and narrows the acts
   * to those it begins (Roadmap f-menu-type-anything) — where it used to
   * jump to the next act that began with it — and the arrow down walks on.
   */
  it("narrows to the acts a letter typed begins, and goes to an act's pin and back with the arrows across", async () => {
    const { unmount } = await openMenu();
    const items = () => [...menu()!.querySelectorAll<HTMLElement>("[data-affordance]")];
    await act(async () => items()[0]!.focus());
    await press(focused(), "h");
    expect(focused().getAttribute("data-testid")).toBe("menu-type");
    expect(items().map((item) => item.textContent)).toEqual([expect.stringContaining("Hand it on")]);
    await press(focused(), "ArrowDown");
    expect(focused().textContent).toContain("Hand it on");
    await press(focused(), "ArrowRight");
    expect(focused().getAttribute("data-pin-for")).toBe("act-2");
    await press(focused(), "ArrowLeft");
    expect(focused().textContent).toContain("Hand it on");
    await unmount();
  });
});
