// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, z } from "@graview/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PagesApp } from "../../src/index.js";

/**
 * THE FIND BOX'S ARROW GOES ONTO WHAT IT FOUND. Typed in the box, the words
 * open what they find; the down arrow then puts the keyboard on the first
 * thing found, the arrows walk the rest, and up from the first is the box
 * again — so Find, the down arrow and Enter go to a record, as the one face
 * asks of a Find chosen at the City.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks", label: (node: { label: string }) => node.label });
const schema = createSchema([task]);
const store = () =>
  new Store({
    schema,
    snapshot: {
      nodes: [
        { id: "t-van", kind: "task", label: "Book the van" },
        { id: "t-vans", kind: "task", label: "Return the van" },
        { id: "t-call", kind: "task", label: "Call the agent" },
      ] as never,
      edges: [],
    },
  });

const rects = HTMLElement.prototype.getClientRects;
beforeAll(() => {
  HTMLElement.prototype.getClientRects = function () {
    return [{ width: 1, height: 1 }] as unknown as DOMRectList;
  };
});
afterAll(() => {
  HTMLElement.prototype.getClientRects = rects;
});

const type = async (input: HTMLInputElement, words: string) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    set.call(input, words);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => new Promise<void>((done) => setTimeout(done, 30)));
};
const key = async (target: Element, name: string) => {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }));
  });
};

describe("the Find box", () => {
  it("puts the keyboard on the first thing found, walks the rest, and comes back up to the box", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store() }} initialPath="/tasks/t-call" />));
    await act(async () => new Promise<void>((done) => setTimeout(done, 50)));
    const box = host.querySelector<HTMLInputElement>('[data-testid="nav-find"]')!;
    expect(box).not.toBeNull();
    box.focus();
    await type(box, "van");
    const hits = () => [...host.querySelectorAll<HTMLAnchorElement>('[data-testid="search-hit"] a[href]')].map((a) => a.textContent);
    expect(hits().length).toBeGreaterThanOrEqual(2);
    const at = () => (document.activeElement as HTMLElement | null)?.textContent ?? null;
    await key(host.querySelector('[data-testid="nav-find"]')!, "ArrowDown");
    expect(at()).toBe(hits()[0]);
    await key(document.activeElement!, "ArrowDown");
    expect(at()).toBe(hits()[1]);
    await key(document.activeElement!, "ArrowUp");
    expect(at()).toBe(hits()[0]);
    await key(document.activeElement!, "ArrowUp");
    expect(document.activeElement).toBe(host.querySelector('[data-testid="nav-find"]'));
    await act(async () => root.unmount());
    host.remove();
  });
});
