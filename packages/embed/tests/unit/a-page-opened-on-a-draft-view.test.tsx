// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, memoryViews, z, type AnySchema, type KeptViews } from "@graview/core";
import { registerWorkerView, type WorkerViewManifest } from "@graview/guest/host/views";
import type { ReactViewRegistry } from "@graview/react";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { DRAWN_ATTRIBUTE, mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A PAGE OPENED ON A DRAFT VIEW (FR-187). `propose_view` tries a view
 * headless and answers in words; an agent that wanted to see it at a phone's
 * width in dark had to keep it first, because the hosted page drew only the
 * app's views. `mount({ draftView: { manifest, source } })` draws one for
 * the seat, unsaved, where its manifest attaches, marked "Draft — <title> ·
 * Not kept"; a kept view of its name is the one it stands in for; and
 * nothing of it is kept — not in the store, not in `keptViews`, not on the
 * next page. Pictured in a browser at 390 px in dark, once the page says it
 * has drawn: `pnpm verify drawn`.
 */
/* jsdom starts no worker: one that never says ready keeps the view's region drawn for as long as these tests look. */
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
const FRONT: WorkerViewManifest = { name: "front", title: "The front", attach: "home", cardinality: "many", reads: { kinds: ["task"] } };
const BOARD: WorkerViewManifest = { name: "task-board", title: "Task board", attach: "task", cardinality: "many", reads: { kinds: ["task"] } };
const source = "graview.onProps((props) => graview.render(graview.html`<p>${props.nodes.length} tasks</p>`));";

beforeAll(() => preload("pages"), 60_000);

let handle: EmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  handle = undefined;
  host = undefined;
});

async function mounted(options: Partial<EmbedOptions>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host!, { app, seed, fonts: false, studio: false, face: "pages", ...options } as EmbedOptions);
  });
  for (let turn = 0; turn < 200 && !host.querySelector("[data-graview-embed]"); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
  await act(async () => {
    await handle!.drawn();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return { host: host!, handle: handle! };
}

/** A host's keeper that writes down every ask. */
function recording(): KeptViews & { readonly asked: string[] } {
  const asked: string[] = [];
  const inner = memoryViews({ may: { views: true, lenses: true } });
  return {
    asked,
    current: () => inner.current(),
    ...(inner.onChange ? { onChange: (listener: () => void) => inner.onChange!(listener) } : {}),
    hide: (name) => void asked.push(`hide ${name}`),
    show: (name) => void asked.push(`show ${name}`),
    remove: (name) => void asked.push(`remove ${name}`),
    restore: (name) => void asked.push(`restore ${name}`),
  };
}

describe("a page opened on a draft view", () => {
  it("draws a proposed home view where it attaches, marked as a draft", async () => {
    const { host } = await mounted({ draftView: { manifest: FRONT, source } });
    const draft = host.querySelector("[data-graview-draft-view=front]");
    expect(draft, "the draft is drawn on the home").not.toBeNull();
    expect(draft!.getAttribute("aria-label")).toBe("Draft: The front");
    expect(draft!.querySelector("[data-testid=draft-view-line]")?.textContent).toBe("Draft — The front·Not kept");
    expect(draft!.querySelector("[data-worker-view-place=front]")).not.toBeNull();
  });

  it("stands in for the kept view of its name, which is drawn nowhere beside it", async () => {
    const kept = { manifest: FRONT, worker: { source: "graview.onProps(() => graview.render(graview.html`<p>kept</p>`));" } };
    const views = (_schema: AnySchema, registry: ReactViewRegistry<AnySchema>) => registerWorkerView(registry, kept);
    const { host } = await mounted({ views: views as never, draftView: { manifest: FRONT, source } });
    expect(host.querySelectorAll("[data-worker-view-place=front]")).toHaveLength(1);
    expect(host.querySelector("[data-graview-draft-view=front] [data-worker-view-place=front]")).not.toBeNull();
  });

  it("draws a draft of a kind at its place, and keeps nothing of it", async () => {
    const keeper = recording();
    const { host, handle } = await mounted({ keptViews: keeper, draftView: { manifest: BOARD, source } });
    const before = { ops: handle.store.log.all().length, graph: JSON.stringify(handle.store.snapshot()) };
    await act(async () => handle.setPath("/places/task-board"));
    for (let turn = 0; turn < 100 && !host.querySelector("[data-graview-draft-view=task-board]"); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(host.querySelector("[data-graview-draft-view=task-board] [data-testid=draft-view-line]")?.textContent).toBe("Draft — Task board·Not kept");
    // Nothing written, nothing asked of the host's keeper.
    expect(handle.store.log.all()).toHaveLength(before.ops);
    expect(JSON.stringify(handle.store.snapshot())).toBe(before.graph);
    expect(keeper.asked).toEqual([]);
    expect(keeper.current().hidden).toEqual([]);
    await act(async () => handle.unmount());
    host.remove();
    // The next page, handed no draft, has no such view.
    const again = await mounted({ keptViews: keeper, path: "/places/task-board" });
    expect(again.host.querySelector("[data-graview-draft-view]")).toBeNull();
    expect(again.host.querySelector("[data-worker-view-place]")).toBeNull();
  });

  it("says when the draft's place has drawn, as any place does", async () => {
    const { host } = await mounted({ draftView: { manifest: FRONT, source } });
    const root = host.querySelector("[data-graview-embed]")!;
    // The worker never answers in jsdom; the page says it has drawn once the view's region says it has.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(root.hasAttribute(DRAWN_ATTRIBUTE)).toBe(false);
    host.querySelector("[data-worker-view=front]")!.setAttribute("data-worker-view-drawn", "");
    for (let turn = 0; turn < 100 && !root.hasAttribute(DRAWN_ATTRIBUTE); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 25)));
    expect(root.getAttribute(DRAWN_ATTRIBUTE)).toBe("/");
  });
});
