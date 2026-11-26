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
import { pageOfStop } from "../../src/embed.js";

/**
 * THE ONE FACE, MOUNTED THROUGH THE EMBED (FR-239, Graview HQ
 * feature:f-one-face-by-default).
 *
 * Graview Cloud draws every app's page through `mount`, and graview.dev's
 * docs mount each chapter with it. `mount` draws the one face unless told
 * `sceneUnderPages: false` (`@graview/embed/pages` only when told `true`):
 * the routed face stands over the city with the views the embed already
 * has, and the embed's bar stands in the one face's bar slot — a public
 * attribute, `data-graview-one-face-bar`. Under address routing the host's
 * page is the app and the page is in the window's flow; anywhere else the
 * face is held to the embed's box (`data-graview-one-face-box`), the root
 * the containing block of every layer, the page scrolling inside it.
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
  it("draws the one face, its bar in the face's slot, and the page in the window's flow, where the host's page is the app", async () => {
    const { host } = await whole({ routing: "address", height: "100dvh" });
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
    expect(root(host).hasAttribute("data-graview-one-face-box")).toBe(false);
  });

  it("draws the one face with no option given, held to its box on somebody else's page", async () => {
    const { host } = await whole({ height: 560 });
    await until(() => barInSlot(host) !== null);
    expect(host.querySelectorAll("[data-graview-one-place]")).toHaveLength(1);
    expect(root(host).getAttribute("data-graview-embed")).toBe("pages");
    // The root is the box: every layer of the face is placed from it and clipped to it, none over the host's page.
    expect(root(host).hasAttribute("data-graview-one-face-box")).toBe(true);
    expect(root(host).style.contain).toBe("layout paint");
    expect(root(host).style.overflow).toBe("clip");
    expect(root(host).style.height).toBe("560px");
    expect(root(host).style.isolation).toBe("isolate");
    // One bar, in the slot at the box's top.
    expect(host.querySelectorAll("[data-graview-app-bar]")).toHaveLength(1);
    expect(host.querySelector<HTMLElement>("[data-graview-one-face-bar]")!.style.top).toBe("0px");
    // The page scrolls itself in the box, under the bar: the host's window is not what scrolls it.
    await until(() => host.querySelector<HTMLElement>("[data-graview-one-place]")?.style.overflowY === "auto");
    const sheet = host.querySelector<HTMLElement>("[data-graview-one-place]")!;
    expect(sheet.style.position).toBe("fixed");
    expect(sheet.style.overflowY).toBe("auto");
    expect(sheet.hasAttribute("data-graview-away")).toBe(false);
  });

  it("holds a box sized from its content at the scene's height", async () => {
    const { host } = await whole({ height: "auto" });
    await until(() => barInSlot(host) !== null);
    expect(root(host).hasAttribute("data-graview-one-face-box")).toBe(true);
    expect(root(host).style.height).toBe("480px");
  });

  it("moves a level for the keys only while the keyboard is in its box", async () => {
    const { host } = await whole({ height: 560 });
    await until(() => barInSlot(host) !== null);
    await until(() => host.querySelector('[data-testid="altitude"] button') !== null);
    const sheet = () => host.querySelector<HTMLElement>("[data-graview-one-place]")!;
    // A key pressed on the host's page is the host's.
    await act(async () => void document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "3", bubbles: true })));
    expect(sheet().hasAttribute("data-graview-away")).toBe(false);
    // Pressed inside the box, it is the face's.
    const inside = host.querySelector<HTMLElement>('[data-testid="altitude"] button')!;
    await act(async () => void inside.dispatchEvent(new KeyboardEvent("keydown", { key: "3", bubbles: true })));
    expect(sheet().hasAttribute("data-graview-away")).toBe(true);
  });

  it("opens at the page a stop names when no path is given", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, { app, seed, fonts: false, studio: false, stop: "#focus=t2" } as EmbedOptions);
    });
    await act(async () => handle!.drawn());
    mounted.push(async () => {
      await act(async () => handle!.unmount());
      host.remove();
    });
    expect(handle!.where().path).toBe("/tasks/t2");
    // A stop set later goes to the page it names, as the first one did.
    await act(async () => handle!.setStop("#focus=agg:task"));
    await until(() => handle!.where().path === "/tasks");
    expect(handle!.where().path).toBe("/tasks");
  });

  it("reads a stop as the page it names: the Map, a record, a kind's list, a place, or none", () => {
    const kindOf = (id: string) => (id.startsWith("t") ? "task" : undefined);
    const places = [{ as: "the-week", kind: "task" }] as never;
    expect(pageOfStop("#overview=1", app.schema, kindOf, places)).toBe("/places/overview");
    expect(pageOfStop("#focus=t1", app.schema, kindOf, places)).toBe("/tasks/t1");
    expect(pageOfStop("#focus=agg:task", app.schema, kindOf, places)).toBe("/tasks");
    expect(pageOfStop("#view=the-week", app.schema, kindOf, places)).toBe("/places/the-week");
    expect(pageOfStop("#focus=nowhere", app.schema, kindOf, places)).toBeUndefined();
    expect(pageOfStop(undefined, app.schema, kindOf, places)).toBeUndefined();
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

  it("with sceneUnderPages: false, draws the routed face as before: no city, the bar in the frame, the page scrolled in its box", async () => {
    const { host } = await whole({ sceneUnderPages: false });
    await until(() => host.querySelector("[data-graview-app-bar]") !== null);
    expect(host.querySelector("[data-graview-one-place]")).toBeNull();
    expect(host.querySelector("[data-graview-one-face-bar]")).toBeNull();
    expect(root(host).getAttribute("style")).toBe("position: relative; isolation: isolate; height: 100%; min-height: 320px; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--graview-radius, 12px);");
    expect(content(host).style.overflow).toBe("auto");
  });

  it("is drawn by the pages alone (`@graview/embed/pages`) only when told, and held to its box there", async () => {
    const plain = await pagesAlone();
    await until(() => plain.host.querySelector("[data-graview-app-bar]") !== null);
    expect(plain.host.querySelector("[data-graview-one-place]")).toBeNull();
    const { host } = await pagesAlone({ sceneUnderPages: true });
    await until(() => barInSlot(host) !== null);
    expect(host.querySelectorAll("[data-graview-one-place]")).toHaveLength(1);
    expect(host.querySelectorAll("[data-graview-app-bar]")).toHaveLength(1);
    expect(barInSlot(host)).not.toBeNull();
    expect(root(host).hasAttribute("data-graview-one-face-box")).toBe(true);
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

  it("leaves no empty holder in the slot once the one face is turned off", async () => {
    const page = document.createElement("div");
    const slot = document.createElement("div");
    document.body.append(page, slot);
    let turn: (on: boolean) => void = () => {};
    function Frame() {
      const [on, setOn] = useState(true);
      turn = setOn;
      return (
        <InBarSlot oneFace={on} slot={on ? slot : null}>
          <nav data-graview-app-bar="" />
        </InBarSlot>
      );
    }
    const root = createRoot(page);
    await act(async () => root.render(<Frame />));
    expect(slot.querySelector("[data-graview-bar-host] [data-graview-app-bar]")).not.toBeNull();
    await act(async () => turn(false));
    expect(document.querySelector("[data-graview-bar-host]")).toBeNull();
    expect(slot.childElementCount).toBe(0);
    expect(page.querySelectorAll("[data-graview-app-bar]")).toHaveLength(1);
    // On again, the holder comes back into the slot.
    await act(async () => turn(true));
    expect(slot.querySelector("[data-graview-bar-host] [data-graview-app-bar]")).not.toBeNull();
    await act(async () => root.unmount());
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
    await until(() => sheet()?.hasAttribute("data-graview-away") === true);
    // The page has left the window for the city, the one face's way of standing at the overview, over the home.
    expect(sheet()?.hasAttribute("data-graview-away")).toBe(true);
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
