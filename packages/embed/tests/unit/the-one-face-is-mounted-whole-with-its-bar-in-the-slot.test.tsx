// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { capabilities, createSchema, defineApp, defineNode, z } from "@graview/core";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle, type PagesEmbedOptions } from "../../src/pages.js";
import { openAppMenu } from "../support/the-app-menu.js";
import { InBarSlot } from "../../src/frame.js";

/**
 * THE ONE FACE, MOUNTED WHOLE THROUGH THE EMBED (FR-239).
 *
 * Graview Cloud draws every app's page through `mount`, and 0.2.0's one
 * face — Pages and the Scene as one place — was reachable only through
 * `PagesApp`'s context. `mount` (and `@graview/embed/pages`) take
 * `sceneUnderPages`: the routed face stands over the city with the views
 * the embed already has, the embed's bar stands in the one face's bar slot
 * — a public attribute, `data-graview-one-face-bar` — and the page is in
 * the window's flow. Without it the embed draws as it did.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const app = defineApp({ name: "Errands", schema: createSchema([task]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }, { id: "t2", kind: "task", label: "Post the letter" }], edges: [] };

beforeAll(() => preload());

const mounted: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of mounted.splice(0)) await done();
  window.history.replaceState(null, "", "/");
});

/** Until `ready` holds, or a second has gone. */
async function until(ready: () => boolean) {
  for (let turn = 0; turn < 200 && !ready(); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
}

async function whole(options: Partial<EmbedOptions> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, seed, fonts: false, studio: false, face: "pages", path: "/tasks", ...options } as EmbedOptions);
  });
  await act(async () => handle!.drawn());
  mounted.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return { host, handle: handle! };
}

async function pagesAlone(options: Partial<PagesEmbedOptions> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: PagesEmbedHandle | undefined;
  await act(async () => {
    handle = mountPages(host, { app, seed, fonts: false, path: "/tasks", ...options } as PagesEmbedOptions);
  });
  mounted.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return { host };
}

const root = (host: Element) => host.querySelector<HTMLElement>("[data-graview-embed]")!;
const content = (host: Element) => host.querySelector<HTMLElement>("[data-embed-content]")!;
const barInSlot = (host: Element) => host.querySelector("[data-graview-one-face-bar] [data-graview-app-bar]");

describe("mount takes sceneUnderPages (FR-239)", () => {
  it("draws the one face, its bar in the face's slot, and the page in the window's flow", async () => {
    const { host } = await whole({ sceneUnderPages: true, height: "100dvh" });
    await until(() => barInSlot(host) !== null);
    expect(host.querySelectorAll("[data-graview-one-place]")).toHaveLength(1);
    expect(root(host).getAttribute("data-graview-embed")).toBe("pages");
    // One bar, and it is the one in the slot: fixed at the window's top, above every layer of the face.
    expect(host.querySelectorAll("[data-graview-app-bar]")).toHaveLength(1);
    expect(barInSlot(host)).not.toBeNull();
    // The window scrolls the page: the box scrolls nothing of its own, and the root clips nothing and holds no fixed height.
    expect(content(host).style.overflow).toBe("");
    expect(root(host).style.overflow).toBe("");
    expect(root(host).style.height).toBe("");
    // Its own stacking context still: nothing of it over the host's page.
    expect(root(host).style.isolation).toBe("isolate");
    // The page keeps its room under the bar.
    expect(host.querySelector("[data-graview-one-place] [data-graview-bar-room]")).not.toBeNull();
  });

  it("offers no switch to a scene: the city is the camera rising", async () => {
    const { host } = await whole({ sceneUnderPages: true });
    await until(() => barInSlot(host) !== null);
    await openAppMenu(host);
    expect(host.querySelector('[data-testid="app-face-scene"]')).toBeNull();
  });

  it("draws the one face where the host asked for the scene, and says the pages", async () => {
    const { host, handle } = await whole({ sceneUnderPages: true, face: "scene" });
    await until(() => barInSlot(host) !== null);
    expect(root(host).getAttribute("data-graview-embed")).toBe("pages");
    expect(handle.where().face).toBe("pages");
  });

  it("without it, draws exactly as before: no city, the bar in the frame, the page scrolled in its box", async () => {
    const { host } = await whole();
    await until(() => host.querySelector("[data-graview-app-bar]") !== null);
    expect(host.querySelector("[data-graview-one-place]")).toBeNull();
    expect(host.querySelector("[data-graview-one-face-bar]")).toBeNull();
    expect(root(host).getAttribute("style")).toBe("position: relative; isolation: isolate; height: 100%; min-height: 320px; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--graview-radius, 12px);");
    expect(content(host).style.overflow).toBe("auto");
  });

  it("is taken by the pages alone (`@graview/embed/pages`) too", async () => {
    const { host } = await pagesAlone({ sceneUnderPages: true });
    await until(() => barInSlot(host) !== null);
    expect(host.querySelectorAll("[data-graview-one-place]")).toHaveLength(1);
    expect(host.querySelectorAll("[data-graview-app-bar]")).toHaveLength(1);
    expect(barInSlot(host)).not.toBeNull();
  });
});

describe("the one face's bar slot (FR-239)", () => {
  it("keeps the one bar, the keyboard on it and what was typed, as the slot arrives and leaves", async () => {
    const page = document.createElement("div");
    const slot = document.createElement("div");
    slot.setAttribute("data-graview-one-face-bar", "");
    document.body.append(page, slot);
    let drawnAgain = 0;
    function Bar() {
      useState(() => void (drawnAgain += 1));
      return <input data-graview-app-bar="" aria-label="Find anything" />;
    }
    let put: (to: HTMLElement | null) => void = () => {};
    function Frame() {
      const [at, setAt] = useState<HTMLElement | null>(null);
      put = setAt;
      return (
        <InBarSlot oneFace slot={at}>
          <Bar />
        </InBarSlot>
      );
    }
    const root = createRoot(page);
    await act(async () => root.render(<Frame />));
    const bar = page.querySelector<HTMLInputElement>("[data-graview-app-bar]")!;
    bar.focus();
    bar.value = "the venue";
    // The slot arrives, as the one face's part draws: the same element, still focused, still holding its words.
    await act(async () => put(slot));
    expect(slot.querySelector("[data-graview-app-bar]")).toBe(bar);
    expect(page.querySelector("[data-graview-app-bar]")).toBeNull();
    expect(document.activeElement).toBe(bar);
    expect(bar.value).toBe("the venue");
    // It leaves, as the part suspends again, and comes back.
    await act(async () => put(null));
    expect(page.querySelector("[data-graview-app-bar]")).toBe(bar);
    expect(document.activeElement).toBe(bar);
    await act(async () => put(slot));
    expect(slot.querySelector("[data-graview-app-bar]")).toBe(bar);
    expect(document.activeElement).toBe(bar);
    expect(drawnAgain).toBe(1);
    await act(async () => root.unmount());
    expect(slot.childElementCount).toBe(0);
    page.remove();
    slot.remove();
  });

  it("keeps the bar where it was across a real mount: the node in the slot is the one first drawn", async () => {
    const { host } = await whole({ sceneUnderPages: true });
    // Drawn first in the frame's flow, while the one face's part is fetched; the node that ends in the slot is the same one.
    const first = host.querySelector("[data-graview-app-bar]");
    await until(() => barInSlot(host) !== null);
    expect(barInSlot(host)).toBe(first);
  });

  it("goes to the overview's path as the City over the home, under memory routing", async () => {
    const { host, handle } = await whole({ sceneUnderPages: true });
    await until(() => barInSlot(host) !== null);
    await act(async () => handle.setPath("/places/overview"));
    const sheet = () => host.querySelector<HTMLElement>("[data-graview-one-place]");
    await until(() => sheet()?.style.position === "fixed");
    // The page has left the window for the city, the one face's way of standing at the overview, over the home.
    expect(sheet()?.style.position).toBe("fixed");
    expect(root(host).getAttribute("data-graview-embed")).toBe("pages");
    expect(handle.where().face).toBe("pages");
    expect(handle.where().path).toBe("/");
    expect(host.querySelectorAll("[data-graview-one-place]")).toHaveLength(1);
  });

  it("carries a public attribute a host may lean on, beside its test id", async () => {
    const { host } = await whole({ sceneUnderPages: true });
    await until(() => barInSlot(host) !== null);
    const slot = host.querySelector<HTMLElement>("[data-graview-one-face-bar]")!;
    expect(slot.getAttribute("data-testid")).toBe("one-place-bar");
    expect(slot.style.position).toBe("fixed");
  });

  it("is said as shipped", () => {
    expect(capabilities().shipped).toContain("FR-239");
  });
});
