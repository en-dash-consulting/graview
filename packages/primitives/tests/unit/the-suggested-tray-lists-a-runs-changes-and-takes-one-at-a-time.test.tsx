// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, isArchived, Store, type Author, type Policy, type Principal } from "@graview/core";
import { suggest, suggestions } from "@graview/core/tidying";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { registerDefaultViews, Shell } from "../../src/index.js";

/**
 * THE SUGGESTED TRAY LISTS A RUN'S CHANGES AND TAKES THEM ONE AT A TIME
 * (Roadmap f-job-approvals). A workflow that asks leaves one suggestion
 * per run: the tray says it as one ("Set aside done lists: 3 grocery lists
 * to archive", said after the run's own name once), opens to each change in its act's own sentence, each with
 * its own Accept; the row's "Accept all" takes what still waits and
 * Decline the rest. A reader votes on the whole, and is offered no change
 * of their own to accept.
 */
const list = defineNode("grocery-list", { fields: z.object({ label: z.string() }), plural: "grocery lists", label: (node) => node.label });
const schema = createSchema([list]);
const actor: Author = { kind: "system", id: "workflow:tidy", name: "Set aside done lists", automated: true };
const nora: Principal = { kind: "human", id: "nora", name: "Nora", roles: ["keeper"] };
const ria: Principal = { kind: "human", id: "ria", name: "Ria", roles: ["reader"] };
const policy: Policy = { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] };

function storeWith() {
  const store = new Store({
    schema,
    policy,
    snapshot: { nodes: ["sunday", "party", "week"].map((id) => ({ id: `grocery-list:${id}`, kind: "grocery-list", label: id[0]!.toUpperCase() + id.slice(1) })) as never, edges: [] },
  });
  suggest(store, ["sunday", "party", "week"].map((id) => ({ name: "archive-grocery-list", args: { id: `grocery-list:${id}` } })), { author: actor, lineage: { basis: "Done three days", run: "workflow:tidy:1", actor: "workflow:tidy" }, intent: "Set aside done lists: 3 grocery lists to archive" });
  return store;
}

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function settled(holds: () => void): Promise<void> {
  for (const end = Date.now() + 4000; ; ) {
    await act(async () => {
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      holds();
      return;
    } catch (error) {
      if (Date.now() > end) throw error;
    }
  }
}

async function scene(store: Store<typeof schema>, principal: Principal) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const root = createRoot(element);
  await act(async () =>
    root.render(
      <GraviewProvider store={store} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }} principal={principal}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} />
      </GraviewProvider>,
    ),
  );
  unmount = () => act(async () => root.unmount());
}
const $ = (selector: string) => document.querySelector<HTMLElement>(selector);
const $$ = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
const open = async () => {
  await settled(() => expect($('[data-graview-app-bar] [data-testid="suggested-button"]')).not.toBeNull());
  await act(async () => $('[data-testid="suggested-button"]')!.click());
  await settled(() => expect($('[data-testid="suggestion"]')).not.toBeNull());
};

describe("a run's suggestion in the tray", () => {
  it("is said as one, opens to each change, and takes one change at a time while the rest wait", async () => {
    const store = storeWith();
    await scene(store, nora);
    await open();
    // The run's title is who suggests it, said once.
    expect($("[data-graview-suggestion-words]")?.textContent).toBe("Set aside done lists suggests 3 grocery lists to archive");
    expect($('[data-testid="suggestion-accept"]')?.textContent).toBe("Accept all");
    expect($('[data-testid="suggestion-items"] summary')?.textContent).toBe("Show the 3 changes");
    expect($$('[data-testid="suggestion-item"]').map((item) => item.firstElementChild?.textContent)).toEqual(["Archive Sunday", "Archive Party", "Archive Week"]);
    expect($$('[data-testid="suggestion-item-accept"]')[1]!.getAttribute("aria-label")).toBe("Accept: Archive Party");
    await act(async () => $$('[data-testid="suggestion-item-accept"]')[1]!.click());
    await settled(() => expect($$('[data-testid="suggestion-item"]')).toHaveLength(2));
    expect(isArchived(store.graph.getNode("grocery-list:party"))).toBe(true);
    expect(isArchived(store.graph.getNode("grocery-list:sunday"))).toBe(false);
    expect($('[data-testid="suggestion-heard"]')?.textContent).toBe("Accepted that change; the rest still wait.");
    // Decline: the rest, for everyone.
    await act(async () => $('[data-testid="suggestion-decline"]')!.click());
    await settled(() => expect(suggestions(store)).toEqual([]));
    expect(isArchived(store.graph.getNode("grocery-list:party"))).toBe(true);
    expect(isArchived(store.graph.getNode("grocery-list:week"))).toBe(false);
  });

  it("offers a reader no change of their own to accept: they vote on the whole", async () => {
    const store = storeWith();
    await scene(store, ria);
    await open();
    expect($$('[data-testid="suggestion-item"]')).toHaveLength(3);
    expect($('[data-testid="suggestion-item-accept"]')).toBeNull();
    expect($('[data-testid="suggestion-accept"]')?.textContent).toBe("Accept");
  });
});
