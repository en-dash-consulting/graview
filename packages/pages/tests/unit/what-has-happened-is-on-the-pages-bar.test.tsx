// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createPageRegistry, PagesApp } from "../../src/index.js";
import type { ReactNode } from "react";

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

  it("names a record that is still here as a button that goes to it, and one since removed as a label that does not look pressable", async () => {
    const remove = defineMutation("remove-item", {
      title: "Remove",
      subject: { kinds: ["item"], arg: "id" },
      input: z.object({ id: nodeRef(["item"]) }),
      describe: () => "Remove it",
      apply(ctx, args) {
        ctx.removeNode(args.id);
      },
    });
    const store = new Store({ schema, mutations: [rename, remove], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }, { id: "i2", kind: "item", label: "Book the band" }] as never, edges: [] } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store, principal: nina, views: createViews(schema) }} initialPath="/items" />));
    unmount = () => act(async () => root.unmount());
    await act(async () => void store.apply({ name: "rename-item", args: { id: "i1", label: "Pay the venue" } }, { author: nina }));
    await act(async () => void store.apply({ name: "remove-item", args: { id: "i2" } }, { author: nina }));
    await settled(() => expect(host.querySelector('[data-testid="activity-button"]')).not.toBeNull());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    await settled(() => expect(document.querySelectorAll('[data-testid="activity-record"]').length).toBe(1));

    const activity = document.querySelector('[data-testid="activity"]')!;
    // Nothing in it is a pick target only the scene answers: a record is a button, or a plain label.
    expect(activity.querySelector("[data-graview-pick]")).toBeNull();
    const records = [...activity.querySelectorAll<HTMLButtonElement>('[data-testid="activity-record"]')];
    expect(records.map((button) => button.textContent)).toEqual(["Pay the venue"]);
    expect(activity.textContent).toContain("Book the band");

    await act(async () => records[0]!.click());
    await settled(() => expect(document.querySelector('[data-testid="activity"]')).toBeNull());
    // On the record's own page, whose heading is its name.
    await settled(() => expect([...document.querySelectorAll("main h1, main h2")].map((heading) => heading.textContent).join(" | ")).toMatch(/Pay the venue/));
  });

  it("names a record a change added and a later change removed by its name in the adding row too, never by its id", async () => {
    /* Cloud's vendors demo: a vendor added, then taken back, left its adding row saying "vendor:scene-way-one" — the removal named it, the add did not. */
    const add = defineMutation("add-item", {
      title: "Add",
      input: z.object({ label: z.string().min(1) }),
      describe: (args) => `Add "${args.label}"`,
      apply(ctx, args) {
        ctx.addNode({ id: "item:hire-the-caterer", kind: "item", label: args.label } as never);
      },
    });
    const remove = defineMutation("remove-item", {
      title: "Remove",
      subject: { kinds: ["item"], arg: "id" },
      input: z.object({ id: nodeRef(["item"]) }),
      describe: () => "Remove it",
      apply(ctx, args) {
        ctx.removeNode(args.id);
      },
    });
    const store = new Store({ schema, mutations: [add, remove], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }] as never, edges: [] } });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store, principal: nina, views: createViews(schema) }} initialPath="/items" />));
    unmount = () => act(async () => root.unmount());
    await act(async () => void store.apply({ name: "add-item", args: { label: "Hire the caterer" } }, { author: nina }));
    await act(async () => void store.apply({ name: "remove-item", args: { id: "item:hire-the-caterer" } }, { author: nina }));
    await settled(() => expect(host.querySelector('[data-testid="activity-button"]')).not.toBeNull());
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    await settled(() => expect(document.querySelectorAll('[data-testid="diff-log"] > li').length).toBe(2));

    const log = document.querySelector('[data-testid="diff-log"]')!;
    expect(log.textContent).not.toContain("item:hire-the-caterer");
    for (const row of log.querySelectorAll(":scope > li")) expect(row.textContent).toContain("Hire the caterer");
  });

  it("is drawn once on the bar when a design under the bar replaces the shell", async () => {
    /* The derived bar drew Activity in its tools and handed its own slot to the design's face controls, which drew it there too: two "Activity" buttons on todo's routed face. */
    const store = new Store({ schema, mutations: [rename], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }] as never, edges: [] } });
    const Shell = ({ context, children }: { context: { barAbove?: boolean }; children: ReactNode }) => (context.barAbove ? <main>{children}</main> : <div>{children}</div>);
    const registry = createPageRegistry(schema).surface("shell", Shell as never);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store, principal: nina, views: createViews(schema) }} registry={registry as never} initialPath="/items" />));
    unmount = () => act(async () => root.unmount());
    await act(async () => void store.apply({ name: "rename-item", args: { id: "i1", label: "Pay the venue" } }, { author: nina }));
    await settled(() => expect(host.querySelectorAll('[data-graview-app-bar] [data-testid="activity-button"]').length).toBeGreaterThan(0));
    await settled(() => expect(host.querySelectorAll('[data-testid="activity-button"]')).toHaveLength(1));
  });
});
