// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, memoryViews, Store, z, type AnySchema } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews, Shell } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewProps } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { preload } from "../../src/index.js";

beforeAll(() => preload());
(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

/**
 * THE WHOLE-PAGE APP TIDIES A VIEW FROM THE PLACE MENU, AS AN EMBED DOES
 * (Roadmap f-place-menu-views). The Shell takes `keptViews` like `mount`:
 * a place in the bar's drop-down opens the scene's menu with Hide and
 * Delete, a hidden view leaves the scene's places for the drop-down's
 * Hidden, and a deleted one is listed under Recently deleted.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const snapshot = { nodes: [{ id: "n1", kind: "note", label: "First" }], edges: [] } as never;

function Board(props: ViewProps<AnySchema>) {
  return <p data-testid="board">{props.nodes?.length ?? 0} notes on the board</p>;
}
const views = () => {
  const registry = registerDefaultViews(schema, createViews(schema));
  registry.register("note", { cardinality: "many", fidelity: "full" }, Board, { title: "Board", name: "board" });
  return registry;
};

async function settle(ms = 30) {
  await act(async () => {
    await vi.dynamicImportSettled();
    await new Promise((done) => setTimeout(done, ms));
  });
}

const menu = () => document.querySelector<HTMLElement>('[data-testid="context-menu"]');
const rows = () => [...(menu()?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])].map((row) => row.getAttribute("data-menu-item"));
async function openPlaces(host: HTMLElement) {
  if (host.querySelector('[data-testid="app-places"]')?.hasAttribute("hidden") !== false) {
    await act(async () => host.querySelector<HTMLElement>('[data-testid="app-places-open"]')!.click());
    await settle();
  }
  return host.querySelector<HTMLElement>('[data-testid="app-places"]')!;
}

describe("the whole-page app's place menu", () => {
  it("hides and deletes a view the host keeps, from the scene's places, as an embed does", async () => {
    const kept = memoryViews();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={new Store({ schema, snapshot })} views={views()} initialView={{ ...EMPTY_VIEW, overview: true }} brand={{ name: "Field notes" } as never}>
          <Shell<typeof schema> scheme="light" onScheme={() => {}} keptViews={kept} />
        </GraviewProvider>,
      ),
    );
    await settle();
    try {
      const entry = (await openPlaces(host)).querySelector('[data-testid="app-place-scene:note:board"]');
      expect(entry).not.toBeNull();
      await act(async () => void entry!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 20 })));
      await settle();
      // The scene's menu is fetched when it is first wanted.
      for (let turn = 0; turn < 40 && rows().length === 0; turn++) await settle();
      expect(rows()).toEqual(expect.arrayContaining(["hide-view", "delete-view"]));
      await act(async () => menu()!.querySelector<HTMLElement>('[data-menu-item="hide-view"]')!.click());
      await settle();
      expect(kept.current().hidden).toEqual(["board"]);
      const list = await openPlaces(host);
      expect(list.querySelector('[data-testid="app-place-scene:note:board"]')).toBeNull();
      expect(list.querySelector('[data-place-group="hidden"]')?.textContent).toContain("Board");
      await act(async () => kept.remove("board", { title: "Board", kind: "note" }));
      await settle();
      expect((await openPlaces(host)).querySelector('[data-place-group="removed"]')?.textContent).toContain("Board");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });
});
