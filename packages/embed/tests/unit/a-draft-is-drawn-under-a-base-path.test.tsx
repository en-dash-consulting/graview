// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import type { WorkerViewManifest } from "@graview/guest/host/views";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { DRAWN_ATTRIBUTE, mount, preload, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedOptions } from "../../src/pages.js";

/**
 * A DRAFT UNDER A BASE PATH (FR-187). Graview Cloud serves an app under
 * `/a/<app>`, the page the app, the address bar handed over: a draft of a
 * kind's view is drawn at its place there — `/a/<app>/places/<title>` —
 * and the root says it has drawn with the place's path within the app, as
 * `where()` says it, on the whole embed and on the pages alone.
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
const BOARD: WorkerViewManifest = { name: "task-board", title: "Task board", attach: "task", cardinality: "many", reads: { kinds: ["task"] } };
const draftView = { manifest: BOARD, source: "graview.onProps((props) => graview.render(graview.html`<p>${props.nodes.length} tasks</p>`));" };
const BASE = "/a/errands";

beforeAll(() => preload("pages"), 60_000);

let unmount: (() => void) | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => unmount?.());
  host?.remove();
  unmount = undefined;
  host = undefined;
  window.history.replaceState(null, "", "/");
});

const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));
async function until(check: () => boolean, ms = 4000): Promise<boolean> {
  for (let spent = 0; spent < ms; spent += 25) {
    if (check()) return true;
    await wait(25);
  }
  return check();
}

const faces: [string, (element: HTMLElement) => { unmount(): void }][] = [
  ["the whole embed", (element) => mount(element, { app, seed, fonts: false, studio: false, face: "pages", routing: "address", basePath: BASE, draftView } as EmbedOptions)],
  ["the pages alone", (element) => mountPages(element, { app, seed, fonts: false, routing: "address", basePath: BASE, draftView } as PagesEmbedOptions)],
];

describe.each(faces)("a draft under a base path, on %s", (_name, mountOne) => {
  it("is drawn at its place under the base, and the root says the place's path within the app", async () => {
    window.history.replaceState(null, "", `${BASE}/places/task-board`);
    host = document.createElement("div");
    document.body.appendChild(host);
    let handle!: { unmount(): void };
    await act(async () => {
      handle = mountOne(host!);
    });
    unmount = () => handle.unmount();
    const root = () => host!.querySelector<HTMLElement>("[data-graview-embed]");
    const region = () => host!.querySelector("[data-graview-draft-view=task-board] [data-worker-view=task-board]");
    expect(await until(() => region() !== null), "the draft is drawn at its place").toBe(true);
    expect(host.querySelector("[data-testid=draft-view-line]")?.textContent).toBe("Draft — Task board·Not kept");
    expect(
      await until(() => {
        const now = region();
        if (now && !now.hasAttribute("data-worker-view-drawn")) now.setAttribute("data-worker-view-drawn", "");
        return root()?.getAttribute(DRAWN_ATTRIBUTE) === "/places/task-board";
      }),
    ).toBe(true);
    expect(window.location.pathname).toBe(`${BASE}/places/task-board`);
  });
});
