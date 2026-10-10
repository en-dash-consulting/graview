// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { bindSchema, createSchema, defineNode, nodeRef, Store, type Principal } from "@graview/core";
import { WAY_BACK_MS } from "@graview/primitives/pages";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PagesApp } from "../../src/index.js";

/**
 * THE WAY BACK LEAVES (FR-152). Graview Cloud, on staging: after an act on
 * the Pages face the notice with "Take back …" stood at the foot of the
 * picture for the rest of the session — it did not go, and nothing on it
 * closed it — so every page carried a stale offer. It comes with an act,
 * stands while the act can be taken back without thought, and goes: after
 * `WAY_BACK_MS` (held while a pointer or the keyboard is on it), with its ×,
 * with a move to another page. ⌘Z takes the change back after it has gone.
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
const nina: Principal = { kind: "human", id: "nina", roles: ["keeper"] };
const fresh = () =>
  new Store({ schema, mutations: [rename], invariants: [], snapshot: { nodes: [{ id: "i1", kind: "item", label: "Pay the deposit" }] as never, edges: [] } });

/* jsdom keeps no pointer and no keyboard of its own: what the browser would say — held or not — is said here. */
function heldWhen(held: () => boolean) {
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
    return selector === ":hover, :has(:focus-visible)" ? held() : matches.call(this, selector);
  });
}

let unmounts: (() => Promise<void>)[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
});
afterEach(async () => {
  for (const unmount of unmounts) await unmount();
  unmounts = [];
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function face(store: Store<typeof schema>, initialPath = "/") {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store, principal: nina }} initialPath={initialPath} />));
  unmounts.push(() => act(async () => root.unmount()));
  return host;
}

const offer = () => document.querySelector<HTMLButtonElement>('[data-testid="face-undo-dock"] [data-testid="page-undo"]');
/* An act, and the way back it brings — fetched with the first change. */
const act_ = async (store: Store<typeof schema>, label: string) => {
  await act(async () => void store.apply({ name: "rename-item", args: { id: "i1", label } }, { author: nina }));
  await act(async () => vi.dynamicImportSettled());
};
const wait = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

describe("the way back on the routed face", () => {
  it("is not offered for a change made before the face was drawn", async () => {
    const store = fresh();
    store.apply({ name: "rename-item", args: { id: "i1", label: "Earlier" } }, { author: nina });
    await face(store);
    expect(offer()).toBeNull();
  });

  it("comes with an act, goes after its time, and ⌘Z still takes the change back", async () => {
    const store = fresh();
    await face(store);
    await act_(store, "Later");
    expect(offer()?.textContent).toContain("Take back “Rename to \"Later\"”");
    await wait(WAY_BACK_MS - 100);
    expect(offer()).not.toBeNull();
    await wait(200);
    expect(offer()).toBeNull();
    await act(async () => void document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })));
    expect(store.graph.getNode("i1")?.label).toBe("Pay the deposit");
  });

  it("stands while a pointer or the keyboard is on it, and goes once neither is", async () => {
    let held = false;
    heldWhen(() => held);
    const store = fresh();
    await face(store);
    await act_(store, "Later");
    held = true;
    await wait(WAY_BACK_MS * 3);
    expect(offer()).not.toBeNull();
    held = false;
    await wait(WAY_BACK_MS + 100);
    expect(offer()).toBeNull();
  });

  it("closes with its ×, a button named for what it closes, and the change stays", async () => {
    const store = fresh();
    await face(store);
    await act_(store, "Later");
    const close = document.querySelector<HTMLButtonElement>('[data-testid="page-undo-dismiss"]')!;
    expect(close.tagName).toBe("BUTTON");
    expect(close.getAttribute("aria-label")).toBe("Dismiss: Take back “Rename to \"Later\"”");
    await act(async () => close.click());
    expect(offer()).toBeNull();
    expect(store.graph.getNode("i1")?.label).toBe("Later");
  });

  it("is replaced by the next act's own", async () => {
    const store = fresh();
    await face(store);
    await act_(store, "Later");
    await wait(WAY_BACK_MS - 1000);
    await act_(store, "Later still");
    expect(offer()?.textContent).toContain("Later still");
    // The next act's offer has its own whole time.
    await wait(WAY_BACK_MS - 100);
    expect(offer()).not.toBeNull();
  });

  it("goes with a move to another page, and not with the act's own move", async () => {
    const store = fresh();
    await face(store);
    await act_(store, "Later");
    // A move straight after the act is the act's own (a record made, and opened): the offer goes with it.
    const items = document.querySelector<HTMLAnchorElement>('a[href$="/items"]');
    expect(items).not.toBeNull();
    await act(async () => void items!.click());
    expect(offer()).not.toBeNull();
    // A move of the person's own, later, leaves the offer behind.
    await wait(2000);
    const record = document.querySelector<HTMLAnchorElement>('a[href*="/items/i1"]');
    expect(record).not.toBeNull();
    await act(async () => void record!.click());
    expect(offer()).toBeNull();
  });
});
