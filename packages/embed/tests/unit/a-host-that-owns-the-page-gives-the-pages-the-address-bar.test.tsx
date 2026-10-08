// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { faceAtAddress, faceOf, mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle, type PagesEmbedOptions } from "../../src/pages.js";

/**
 * A HOST THAT OWNS THE PAGE GIVES THE ROUTED FACE THE ADDRESS BAR (FR-106).
 *
 * Graview Cloud's page IS the app, and the embed's routed face ran on a
 * memory router: a place could not be linked, reloaded or shared. With
 * `routing: "address"` the pages read their route from `location` under the
 * host's `basePath` and push history; the scene keeps its stop in the
 * fragment, as the whole-page Shell does. Memory routing stays the default,
 * for an embed inside somebody else's article, and writes no history at all.
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

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

async function at(path: string, options: Partial<EmbedOptions> = {}) {
  window.history.replaceState(null, "", path);
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, seed, fonts: false, studio: false, ...options } as EmbedOptions);
  });
  await act(async () => handle!.drawn());
  await settle();
  const done = async () => {
    await act(async () => handle!.unmount());
    host.remove();
  };
  mounted.push(done);
  return { host, handle: handle!, done };
}

async function pagesAt(path: string, options: Partial<PagesEmbedOptions> = {}) {
  window.history.replaceState(null, "", path);
  const host = document.createElement("div");
  document.body.appendChild(host);
  let handle: PagesEmbedHandle | undefined;
  await act(async () => {
    handle = mountPages(host, { app, seed, fonts: false, ...options } as PagesEmbedOptions);
  });
  await settle();
  mounted.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return { host, handle: handle! };
}

const heading = (host: HTMLElement) => host.querySelector("[data-graview-page-title]")?.textContent?.trim();
const face = (host: HTMLElement) => host.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed");
const click = (element: Element | null) => act(async () => (element as HTMLElement).click());
async function back() {
  await act(async () => {
    const popped = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
    window.history.back();
    await popped;
  });
  await settle();
}

describe("the face an address opens", () => {
  it("is the host's under memory routing, whatever the address says", () => {
    window.history.replaceState(null, "", "/apps/a1/tasks/t1#overview=1");
    expect(faceAtAddress({ face: "scene" })).toBe("scene");
    expect(faceAtAddress({ routing: "memory", face: "graview", basePath: "/apps/a1" })).toBe("graview");
  });

  it("is the pages for a page past the home, the scene's for a fragment, the host's at a bare home", () => {
    window.history.replaceState(null, "", "/apps/a1/tasks/t1");
    expect(faceAtAddress({ routing: "address", basePath: "/apps/a1/", face: "graview" })).toBe("pages");
    window.history.replaceState(null, "", "/apps/a1/#overview=1");
    expect(faceAtAddress({ routing: "address", basePath: "/apps/a1", face: "pages" })).toBe("graview");
    window.history.replaceState(null, "", "/apps/a1#focus=t1");
    expect(faceAtAddress({ routing: "address", basePath: "/apps/a1", face: "pages" })).toBe("scene");
    window.history.replaceState(null, "", "/apps/a1/");
    expect(faceAtAddress({ routing: "address", basePath: "/apps/a1", face: "graview" })).toBe("graview");
    // The home the routed face itself wrote — the router marks its entries — is the pages again on a reload.
    window.history.replaceState({ idx: 0 }, "", "/apps/a1");
    expect(faceAtAddress({ routing: "address", basePath: "/apps/a1", face: "graview" })).toBe("pages");
    // An address outside the base is no page of the app's: the host's face.
    window.history.replaceState(null, "", "/elsewhere/tasks");
    expect(faceAtAddress({ routing: "address", basePath: "/apps/a1", face: "scene" })).toBe("scene");
  });

  it("is the scene's at the overview's own address, its stop riding on it (FR-132)", () => {
    window.history.replaceState(null, "", "/apps/a1/places/overview#focus=t1");
    expect(faceAtAddress({ routing: "address", basePath: "/apps/a1", face: "pages" })).toBe("scene");
    window.history.replaceState(null, "", "/apps/a1/places/overview#overview=1");
    expect(faceAtAddress({ routing: "address", basePath: "/apps/a1", face: "pages" })).toBe("graview");
    window.history.replaceState({ idx: 3 }, "", "/apps/a1/places/overview");
    expect(faceAtAddress({ routing: "address", basePath: "/apps/a1", face: "pages" })).toBe("scene");
    // Under memory routing the face is the host's, the stop's when it names none.
    expect(faceAtAddress({ face: faceOf(undefined) })).toBe("scene");
    expect(faceOf("#overview=1")).toBe("graview");
  });
});

describe("memory routing, the default", () => {
  it("moves the pages without touching the address or the history, and tells a host that asks", async () => {
    window.history.replaceState(null, "", "/an-article");
    const length = window.history.length;
    const told: string[] = [];
    const { host, handle } = await at("/an-article", { face: "pages", path: "/tasks", onNavigate: (path) => told.push(path) });
    expect(heading(host)).toBe("Tasks");
    await click(host.querySelector('a[href="/tasks/t1"]'));
    expect(heading(host)).toBe("Buy stamps");
    handle.setPath("/tasks/t2");
    await settle();
    expect(heading(host)).toBe("Post the letter");
    expect(told).toEqual(["/tasks/t1", "/tasks/t2"]);
    expect(window.location.pathname).toBe("/an-article");
    expect(window.location.hash).toBe("");
    expect(window.history.length).toBe(length);
  });
});

describe("the way to the overview from a page", () => {
  it("lands once on the stop it names, and then leaves the scene to the reader and the host (FR-132)", async () => {
    const { host, handle } = await at("/an-article", { face: "pages", path: "/tasks/t1" });
    expect(heading(host)).toBe("Buy stamps");
    await click(host.querySelector('[data-testid="spatial-link"]'));
    await act(async () => handle.drawn());
    expect(face(host)).toBe("scene");
    expect(new URLSearchParams(handle.where().stop?.slice(1)).get("focus")).toBe("t1");
    // The host moves the scene: it moves, though the reader came by the link.
    handle.setStop("#focus=t2");
    await settle();
    expect(new URLSearchParams(handle.where().stop?.slice(1)).get("focus")).toBe("t2");
    // To a list and back: the scene is where it was left, not snapped back to the link's stop.
    handle.setPath("/tasks");
    await settle();
    expect(face(host)).toBe("pages");
    handle.setPath("/places/overview");
    await settle();
    expect(face(host)).toBe("scene");
    expect(new URLSearchParams(handle.where().stop?.slice(1)).get("focus")).not.toBe("t1");
  });
});

describe("address routing under a base path", () => {
  it("opens the page the address names, whatever face the host asked for", async () => {
    const { host } = await at("/apps/a1/tasks/t1", { routing: "address", basePath: "/apps/a1/", face: "graview" });
    expect(face(host)).toBe("pages");
    expect(heading(host)).toBe("Buy stamps");
  });

  it("draws links under the base, pushes each page, and Back returns", async () => {
    const told: string[] = [];
    const { host } = await at("/apps/a1/tasks", { routing: "address", basePath: "/apps/a1/", face: "pages", onNavigate: (path) => told.push(path) });
    const length = window.history.length;
    expect(heading(host)).toBe("Tasks");
    await click(host.querySelector('a[href="/apps/a1/tasks/t1"]'));
    expect(window.location.pathname).toBe("/apps/a1/tasks/t1");
    expect(window.history.length).toBe(length + 1);
    expect(heading(host)).toBe("Buy stamps");
    expect(told).toEqual(["/tasks/t1"]);
    await back();
    expect(window.location.pathname).toBe("/apps/a1/tasks");
    expect(heading(host)).toBe("Tasks");
  });

  it("stays put when the page is loaded again", async () => {
    const first = await at("/apps/a1/tasks", { routing: "address", basePath: "/apps/a1", face: "graview" });
    await click(first.host.querySelector('a[href="/apps/a1/tasks/t2"]'));
    await first.done();
    mounted.splice(0);
    const again = await at(window.location.pathname, { routing: "address", basePath: "/apps/a1", face: "graview" });
    expect(face(again.host)).toBe("pages");
    expect(heading(again.host)).toBe("Post the letter");
  });

  it("keeps the scene at the overview's address with its stop in the fragment, and a tab is an entry Back undoes (FR-132)", async () => {
    const { host } = await at("/apps/a1/", { routing: "address", basePath: "/apps/a1", face: "graview" });
    expect(face(host)).toBe("graview");
    // Arriving is not traveling: the scene tidies its own address in place — to its place's.
    expect(window.location.pathname).toBe("/apps/a1/places/overview");
    expect(window.location.hash).toBe("#overview=1");
    expect(host.querySelector('[data-testid="app-place-overview"]')?.getAttribute("aria-current")).toBe("page");
    const length = window.history.length;
    await click(host.querySelector('[data-testid="app-place-kind:task"]'));
    await settle();
    expect(face(host)).toBe("pages");
    expect(window.location.pathname).toBe("/apps/a1/tasks");
    expect(window.location.href.includes("#")).toBe(false);
    expect(window.history.length).toBe(length + 1);
    expect(heading(host)).toBe("Tasks");
    expect(host.querySelector('[data-testid="app-place-kind:task"]')?.getAttribute("aria-current")).toBe("page");
    await back();
    expect(face(host)).not.toBe("pages");
    expect(window.location.pathname).toBe("/apps/a1/places/overview");
    expect(window.location.hash).toBe("#overview=1");
    expect(window.history.length).toBe(length + 1);
  });

  it("goes from a page to the overview with one press, at its address, and Back returns to the page", async () => {
    const { host } = await at("/apps/a1/tasks", { routing: "address", basePath: "/apps/a1", face: "pages" });
    expect(heading(host)).toBe("Tasks");
    await click(host.querySelector('[data-testid="app-place-overview"]'));
    await settle();
    expect(face(host)).toBe("scene");
    expect(window.location.pathname).toBe("/apps/a1/places/overview");
    expect(window.location.href.includes("#")).toBe(true);
    await back();
    expect(face(host)).toBe("pages");
    expect(window.location.pathname).toBe("/apps/a1/tasks");
    expect(heading(host)).toBe("Tasks");
  });

  it("opens the scene at a stop a fragment names", async () => {
    const { host } = await at("/apps/a1#overview=1", { routing: "address", basePath: "/apps/a1", face: "pages" });
    expect(face(host)).toBe("graview");
  });

  it("opens a stop linked before the scene was a place, and tidies the address to the overview's", async () => {
    const { host } = await at("/apps/a1#focus=t1", { routing: "address", basePath: "/apps/a1", face: "pages" });
    expect(face(host)).toBe("scene");
    expect(window.location.pathname).toBe("/apps/a1/places/overview");
    expect(window.location.hash).toContain("focus=t1");
  });
});

describe("the pages alone, by address", () => {
  it("open at the address and push what is opened from there", async () => {
    const { host } = await pagesAt("/tasks/t1", { routing: "address" });
    expect(heading(host)).toBe("Buy stamps");
    await pagesAt("/", {});
  });

  it("stay in memory by default", async () => {
    const length = window.history.length;
    const { host } = await pagesAt("/an-article", { path: "/tasks" });
    await click(host.querySelector('a[href="/tasks/t1"]'));
    expect(heading(host)).toBe("Buy stamps");
    expect(window.location.pathname).toBe("/an-article");
    expect(window.history.length).toBe(length);
  });
});
