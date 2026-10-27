// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Principal } from "@graview/core";
import { suggest } from "@graview/core/tidying";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * A SUGGESTION'S CHIP OPENS THE RECORD'S PAGE (FR-225, Roadmap
 * f-suggestion-chips-open-their-record). On the routed face the Suggested
 * tray's chips did nothing when pressed; each is now a button that goes to
 * the record as Activity's do, which on Pages is the record's own page.
 */
const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items", edges: { "waits-for": { to: ["item"], description: "what has to happen first" } } });
const schema = createSchema([item]);
const { defineMutation } = bindSchema(schema);
const waitFor = defineMutation("wait-for", {
  title: "This has to happen first",
  subject: { kinds: ["item"], arg: "itemId" },
  connects: ["waits-for"],
  input: z.object({ itemId: nodeRef(["item"]), blockerId: nodeRef(["item"]) }),
  describe: (args, graph) => `“${(graph.getNode(args.itemId) as { label: string }).label}” waits for “${(graph.getNode(args.blockerId) as { label: string }).label}”`,
  apply(ctx, args) {
    ctx.addEdge({ kind: "waits-for", from: args.itemId, to: args.blockerId });
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const nina: Principal = { kind: "human", id: "nina" };

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};
window.scrollTo = () => {};

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
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

describe("a record chip in the Suggested tray, on the routed face", () => {
  it("opens the record's page and closes the tray", async () => {
    const store = new Store({ schema, mutations: [waitFor], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }, { id: "i2", kind: "item", label: "Book the band" }] as never, edges: [] } });
    suggest(store, [{ name: "wait-for", args: { itemId: "i1", blockerId: "i2" } }], { author: actor, lineage: { basis: "The band holds the date once paid", confidence: 0.5 } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store, principal: nina, views: createViews(schema) }} initialPath="/items" />));
    unmount = () => act(async () => root.unmount());
    await settled(() => expect(host.querySelector('[data-graview-app-bar] [data-testid="suggested-button"]')).not.toBeNull());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="suggested-button"]')!.click());
    await settled(() => expect(document.querySelectorAll('[data-testid="suggested"] [data-testid="suggestion-record"]').length).toBe(2));

    const tray = document.querySelector('[data-testid="suggested"]')!;
    expect(tray.querySelector("[data-graview-pick]")).toBeNull();
    const band = [...tray.querySelectorAll<HTMLButtonElement>('[data-testid="suggestion-record"]')].find((chip) => chip.getAttribute("data-record") === "i2")!;
    expect(band.textContent).toBe("Book the band");
    await act(async () => band.click());
    await settled(() => expect(document.querySelector('[data-testid="suggested"]')).toBeNull());
    // On the record's own page, whose heading is its name.
    await settled(() => expect([...document.querySelectorAll("main h1, main h2")].map((heading) => heading.textContent).join(" | ")).toMatch(/Book the band/));
  });
});
