// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, memoryViews, z, type KeptViews } from "@graview/core";
import type { WorkerViewManifest } from "@graview/guest/host/views";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DRAWN_ATTRIBUTE, mount, type EmbedWhere, type PagesEmbedHandle, type PagesEmbedOptions } from "../../src/pages.js";

/**
 * THE PAGES ALONE SAY WHEN THEY HAVE DRAWN, AND OPEN ON A DRAFT (FR-188,
 * FR-187). `@graview/embed/pages` — a chat's widget, a phone's page —
 * took neither `onDrawn` nor `draftView`, so a host picturing a proposal
 * there guessed when it had drawn and could not draw the proposal at all.
 * It takes both now, from the same code as the whole embed: its root wears
 * `data-graview-drawn` once the page settles, and a draft is drawn where
 * it attaches, marked "Draft — <title> · Not kept", nothing of it kept.
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
const FRONT: WorkerViewManifest = { name: "front", title: "The front", attach: "home", cardinality: "many", reads: { kinds: ["task"] } };
const source = "graview.onProps((props) => graview.render(graview.html`<p>${props.nodes.length} tasks</p>`));";

let handle: PagesEmbedHandle | undefined;
let host: HTMLElement | undefined;
afterEach(async () => {
  await act(async () => handle?.unmount());
  host?.remove();
  handle = undefined;
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

async function mounted(options: Partial<PagesEmbedOptions>) {
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    handle = mount(host!, { app, seed, fonts: false, ...options } as PagesEmbedOptions);
  });
  await until(() => host!.querySelector("[data-graview-embed]") !== null);
  return { root: () => host!.querySelector<HTMLElement>("[data-graview-embed]")!, handle: handle! };
}

function recording(): KeptViews & { readonly asked: string[] } {
  const asked: string[] = [];
  const inner = memoryViews({ may: { views: true, lenses: true } });
  return { asked, current: () => inner.current(), hide: (name) => void asked.push(`hide ${name}`), show: (name) => void asked.push(`show ${name}`), remove: (name) => void asked.push(`remove ${name}`), restore: (name) => void asked.push(`restore ${name}`) };
}

describe("the pages alone", () => {
  it("put data-graview-drawn on the root once the page settles, tell onDrawn the place, and take it off on a move", async () => {
    const told: EmbedWhere[] = [];
    const { root, handle } = await mounted({ onDrawn: (place) => told.push(place) });
    expect(await until(() => root().hasAttribute(DRAWN_ATTRIBUTE))).toBe(true);
    expect(root().getAttribute(DRAWN_ATTRIBUTE)).toBe("/");
    expect(root().textContent).toContain("Tasks");
    await act(async () => handle.setPath("/tasks"));
    expect(root().hasAttribute(DRAWN_ATTRIBUTE), "cleared in the commit that moves").toBe(false);
    expect(await until(() => root().getAttribute(DRAWN_ATTRIBUTE) === "/tasks")).toBe(true);
    expect(told.map(({ face, path }) => ({ face, path }))).toEqual([
      { face: "pages", path: "/" },
      { face: "pages", path: "/tasks" },
    ]);
  });

  it("draw a draft view where it attaches, marked as a draft, and keep nothing of it", async () => {
    const keeper = recording();
    const { root, handle } = await mounted({ keptViews: keeper, draftView: { manifest: FRONT, source } });
    const ops = handle.store.log.all().length;
    expect(await until(() => root().querySelector("[data-graview-draft-view=front]") !== null)).toBe(true);
    const draft = root().querySelector("[data-graview-draft-view=front]")!;
    expect(draft.getAttribute("aria-label")).toBe("Draft: The front");
    expect(draft.querySelector("[data-testid=draft-view-line]")?.textContent).toBe("Draft — The front·Not kept");
    // The page says it has drawn once the draft's region says it has.
    await wait(400);
    expect(root().hasAttribute(DRAWN_ATTRIBUTE)).toBe(false);
    draft.querySelector("[data-worker-view=front]")!.setAttribute("data-worker-view-drawn", "");
    expect(await until(() => root().getAttribute(DRAWN_ATTRIBUTE) === "/")).toBe(true);
    expect(handle.store.log.all()).toHaveLength(ops);
    expect(keeper.asked).toEqual([]);
  });
});
