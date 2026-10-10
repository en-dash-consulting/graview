// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * WHAT HAS HAPPENED IS ON THE PAGES BAR (FR-152). The scene keeps every
 * change in its Activity, each with its way back; the routed face offered
 * the last one for ten seconds and then nothing a mouse could reach, so a
 * person on Pages could not take back a change once its notice had gone.
 * The bar draws the same Activity on Pages, fetched once there is a change.
 */
const item = defineNode("item", { fields: z.object({ label: z.string() }), plural: "Items" });
const schema = createSchema([item]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename-item", {
  title: "Rename",
  subject: { kinds: ["item"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["item"]), label: z.string().min(1) }),
  describe: (args) => `Rename to "${args.label}"`,
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});
const nina: Principal = { kind: "human", id: "nina" };

(Element.prototype as { scrollTo?: unknown }).scrollTo = () => {};

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

describe("what has happened, on the routed face's bar", () => {
  it("is not drawn before anything has happened, and lists a change with its way back once one has", async () => {
    const store = new Store({ schema, mutations: [rename], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }] as never, edges: [] } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store, principal: nina, views: createViews(schema) }} initialPath="/items" />));
    unmount = () => act(async () => root.unmount());
    expect(host.querySelector('[data-testid="activity-button"]')).toBeNull();

    await act(async () => void store.apply({ name: "rename-item", args: { id: "i1", label: "Pay the venue" } }, { author: nina }));

    await settled(() => expect(host.querySelector('[data-graview-app-bar] [data-testid="activity-button"]')).not.toBeNull());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    await settled(() => expect(document.querySelector('[data-testid="activity"]')?.textContent ?? "").toContain("Pay the venue"));
  });
});
