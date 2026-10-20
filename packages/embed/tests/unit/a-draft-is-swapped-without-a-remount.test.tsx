// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import type { WorkerViewManifest } from "@graview/guest/host/views";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { DRAWN_ATTRIBUTE, mount, preload, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedOptions } from "../../src/pages.js";

/**
 * A DRAFT IS SWAPPED WITHOUT A REMOUNT (FR-187). A host picturing several
 * proposals in turn remounted the embed for each, losing the store and the
 * place, and waited for the whole page to draw again. `handle.setDraftView`
 * hands it another draft, or `null` for none, in place: the root's
 * `data-graview-drawn` comes off in the commit that swaps and returns once
 * the new draft has drawn and settled, and the store is the same store.
 * The same on the pages alone.
 */
URL.createObjectURL ??= () => "blob:test";
URL.revokeObjectURL ??= () => {};
(globalThis as { Worker?: unknown }).Worker ??= class {
  onmessage = null;
  onerror = null;
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
};

const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }], edges: [] };
const manifest = (name: string, title: string): WorkerViewManifest => ({ name, title, attach: "home", cardinality: "many", reads: { kinds: ["task"] } });
const source = "graview.onProps((props) => graview.render(graview.html`<p>${props.nodes.length} tasks</p>`));";
const FIRST = { manifest: manifest("front", "The front"), source };
const SECOND = { manifest: manifest("front", "The front, again"), source };
const OTHER = { manifest: manifest("lobby", "The lobby"), source };

beforeAll(() => preload("pages"), 60_000);

let unmount: (() => void) | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => unmount?.());
  host?.remove();
  unmount = undefined;
  host = undefined;
});

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
async function until(check: () => boolean, ms = 4000): Promise<boolean> {
  for (let spent = 0; spent < ms; spent += 25) {
    if (check()) return true;
    await wait(25);
  }
  return check();
}

type Handle = { setDraftView(draft: EmbedOptions["draftView"] | null): void; readonly store: { readonly log: { all(): readonly unknown[] } } };
const faces: [string, (element: HTMLElement) => Handle & { unmount(): void }][] = [
  ["the whole embed", (element) => mount(element, { app, seed, fonts: false, studio: false, face: "pages", draftView: FIRST } as EmbedOptions)],
  ["the pages alone", (element) => mountPages(element, { app, seed, fonts: false, draftView: FIRST } as PagesEmbedOptions)],
];

describe.each(faces)("a draft swapped on %s", (_name, mountOne) => {
  it("is drawn in place of the one before, the drawn attribute off until it settles, the store the same", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    let handle!: Handle & { unmount(): void };
    await act(async () => {
      handle = mountOne(host!);
    });
    unmount = () => handle.unmount();
    const root = () => host!.querySelector<HTMLElement>("[data-graview-embed]");
    const region = (name: string) => host!.querySelector(`[data-graview-draft-view=${name}] [data-worker-view=${name}]`);
    const line = () => host!.querySelector("[data-testid=draft-view-line]")?.textContent;
    // The view's region says it has drawn, as the worker's host says it: whichever region is drawn there now.
    const regionDraws = (name: string) => () => {
      const now = region(name);
      if (now && !now.hasAttribute("data-worker-view-drawn")) now.setAttribute("data-worker-view-drawn", "");
      return root()?.getAttribute(DRAWN_ATTRIBUTE) === "/";
    };
    expect(await until(() => region("front") !== null)).toBe(true);
    expect(await until(regionDraws("front"))).toBe(true);
    const store = handle.store;
    const embed = root();

    // Another proposal of the same view: off in the commit that swaps, back once it has drawn.
    await act(async () => handle.setDraftView(SECOND));
    expect(root()?.hasAttribute(DRAWN_ATTRIBUTE), "off in the commit that swaps").toBe(false);
    expect(await until(() => line() === "Draft — The front, again·Not kept")).toBe(true);
    await wait(400);
    expect(root()?.hasAttribute(DRAWN_ATTRIBUTE), "not before the new draft has drawn").toBe(false);
    expect(await until(regionDraws("front"))).toBe(true);

    // A proposal of another view, then none: the one before is drawn nowhere.
    await act(async () => handle.setDraftView(OTHER));
    expect(await until(() => region("lobby") !== null)).toBe(true);
    expect(host!.querySelector("[data-graview-draft-view=front]")).toBeNull();
    await act(async () => handle.setDraftView(null));
    expect(root()?.hasAttribute(DRAWN_ATTRIBUTE)).toBe(false);
    expect(await until(() => root()?.getAttribute(DRAWN_ATTRIBUTE) === "/")).toBe(true);
    expect(host!.querySelector("[data-graview-draft-view]")).toBeNull();

    // Never remounted: the same root, the same store.
    expect(root()).toBe(embed);
    expect(handle.store).toBe(store);
  });
});
