// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, Store, z, type AnySchema, type GraviewApp } from "@graview/core";
import { fromUrl } from "@graview/layout/view";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A NEW APP KEEPS THE READER'S PLACE (FR-116).
 *
 * When a chat changes the declaration, the host has a new compiled app and
 * a new store, and `mount` was the only way to hand them over: the reader
 * was put back at the home, whatever they had open. `setApp` swaps them
 * under the reader and keeps the face, the page open on Pages and the
 * scene's stop; what the change took away falls back to its nearest parent.
 * `where()` reads the place, for a host that must remount (`mount(…, { at })`).
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });

/** An app of tasks (and people, unless the change took them away); each title is a declared lens on tasks, and so a place. */
function appOf(kinds: "both" | "tasks", places: readonly string[] = ["The packages"]): GraviewApp<AnySchema> {
  return defineApp({
    name: "Errands",
    schema: createSchema(kinds === "both" ? [task, person] : [task]),
    mutations: [],
    lenses: places.map((title) => ({ name: "reach", title, on: "task" })),
  } as never) as unknown as GraviewApp<AnySchema>;
}
const nodes = {
  t1: { id: "t1", kind: "task", label: "Buy stamps" },
  t2: { id: "t2", kind: "task", label: "Post the letter" },
  p1: { id: "p1", kind: "person", label: "Ada" },
};
function storeOf(app: GraviewApp<AnySchema>, ids: readonly (keyof typeof nodes)[]): Store<AnySchema> {
  return new Store<AnySchema>({ schema: app.schema, mutations: [], snapshot: { nodes: ids.map((id) => nodes[id]), edges: [] } as never });
}

beforeAll(() => preload());

const mounted: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of mounted.splice(0)) await done();
  window.history.replaceState(null, "", "/");
});

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

async function open(options: Partial<EmbedOptions>, address = "/an-article") {
  window.history.replaceState(null, "", address);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = options.app ?? appOf("both");
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, store: storeOf(app, ["t1", "t2", "p1"]), fonts: false, studio: false, ...options } as EmbedOptions);
  });
  // A place handed back waits for its rules to be fetched, which act would hold until the face it waits for: so a tick at a time.
  let drawn = false;
  void handle!.drawn().then(() => (drawn = true));
  for (let tick = 0; tick < 50 && !drawn; tick++) await settle();
  expect(drawn).toBe(true);
  await settle();
  mounted.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return { host, handle: handle! };
}

async function swap(handle: EmbedHandle, app: GraviewApp<AnySchema>, ids: readonly (keyof typeof nodes)[], options: { readonly remote?: boolean } = {}) {
  const store = storeOf(app, ids);
  await act(async () => handle.setApp(app, options.remote ? { store } : store));
  await act(async () => handle.drawn());
  await settle();
  return store;
}

const heading = (host: HTMLElement) => host.querySelector("[data-graview-face=pages] h1")?.textContent?.trim();
const face = (host: HTMLElement) => host.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed");
const click = (element: Element | null) => act(async () => (element as HTMLElement).click());

describe("where the reader is, read from the handle", () => {
  it("says the face, the page open on Pages and the scene's stop", async () => {
    const { host, handle } = await open({ face: "pages", path: "/tasks" });
    await click(host.querySelector('a[href="/tasks/t1"]'));
    expect(heading(host)).toBe("Buy stamps");
    expect(handle.where()).toMatchObject({ face: "pages", path: "/tasks/t1" });
    handle.setFace("scene");
    await act(async () => handle.drawn());
    handle.setStop("#focus=t2");
    await settle();
    const where = handle.where();
    expect(where.face).toBe("scene");
    // The page Pages had is still where it was: the scene does not forget it.
    expect(where.path).toBe("/tasks/t1");
    expect(fromUrl(where.stop).focusId).toBe("t2");
    expect(where.kind).toBe("task");
    // And the pages come back on it.
    handle.setFace("pages");
    await act(async () => handle.drawn());
    await settle();
    expect(heading(host)).toBe("Buy stamps");
  });

  it("is where a remount opens, given back as `at`", async () => {
    const first = await open({ face: "pages", path: "/tasks/t2" });
    const where = first.handle.where();
    const again = await open({ face: "graview", at: where });
    expect(face(again.host)).toBe("pages");
    expect(heading(again.host)).toBe("Post the letter");
  });
});

describe("a new app under the reader", () => {
  it("keeps a place open on Pages when the views change around it", async () => {
    const { host, handle } = await open({ face: "pages", path: "/places/the-packages" });
    expect(heading(host)).toBe("The packages");
    const before = handle.store;
    await swap(handle, appOf("both", ["The packages", "The errands"]), ["t1", "t2", "p1"]);
    expect(handle.store).not.toBe(before);
    expect(handle.where().path).toBe("/places/the-packages");
    expect(face(host)).toBe("pages");
    expect(heading(host)).toBe("The packages");
  });

  it("keeps the record open on Pages, and a removed record falls back to its kind's list", async () => {
    const { host, handle } = await open({ face: "pages", path: "/tasks/t1" });
    await swap(handle, appOf("both"), ["t1", "p1"]);
    expect(heading(host)).toBe("Buy stamps");
    await swap(handle, appOf("both"), ["t2", "p1"]);
    expect(handle.where().path).toBe("/tasks");
    expect(heading(host)).toBe("Tasks");
  });

  it("sends a reader on a removed kind, or a removed place, to the home", async () => {
    const kind = await open({ face: "pages", path: "/people/p1" });
    await swap(kind.handle, appOf("tasks"), ["t1"]);
    expect(kind.handle.where().path).toBe("/");
    expect(kind.host.querySelector("[data-graview-face=pages]")).not.toBeNull();
    const list = await open({ face: "pages", path: "/people" });
    await swap(list.handle, appOf("tasks"), ["t1"]);
    expect(list.handle.where().path).toBe("/");
    const place = await open({ face: "pages", path: "/places/the-packages" });
    await swap(place.handle, appOf("both", ["The errands"]), ["t1"]);
    expect(place.handle.where().path).toBe("/");
  });

  it("keeps the scene's focus on a record, and a removed record falls back to its kind's group, a removed kind to the home", async () => {
    const { handle } = await open({ face: "scene", stop: "#focus=t1&zoom=1" });
    await swap(handle, appOf("both"), ["t1", "p1"]);
    expect(handle.where().face).toBe("scene");
    expect(fromUrl(handle.where().stop)).toMatchObject({ focusId: "t1", zoom: true });
    await swap(handle, appOf("both"), ["t2", "p1"]);
    expect(fromUrl(handle.where().stop).focusId).toBe("aggregate:task");
    expect(fromUrl(handle.where().stop).zoom).toBeFalsy();
    const people = await open({ face: "scene", stop: "#focus=p1" });
    await swap(people.handle, appOf("tasks"), ["t1"]);
    expect(fromUrl(people.handle.where().stop).focusId).toBeNull();
  });

  it("sends a scene on a removed lens to its kind's group", async () => {
    const { handle } = await open({ face: "scene", stop: "#view=the-packages" });
    expect(fromUrl(handle.where().stop).within?.["view"]).toBe("the-packages");
    await swap(handle, appOf("both", []), ["t1"]);
    const stop = fromUrl(handle.where().stop);
    expect(stop.within?.["view"]).toBeUndefined();
    expect(stop.focusId).toBe("aggregate:task");
  });

  it("keeps the face at altitude", async () => {
    const { handle } = await open({ face: "graview" });
    await swap(handle, appOf("both"), ["t1"]);
    expect(handle.where().face).toBe("graview");
    expect(fromUrl(handle.where().stop).overview).toBe(true);
  });

  it("keeps the seat, and takes a remote's store", async () => {
    const ada = { kind: "human" as const, id: "p1", name: "Ada", roles: [] };
    const bea = { kind: "human" as const, id: "p2", name: "Bea", roles: [] };
    const { host, handle } = await open({ face: "pages", path: "/tasks", seats: [{ label: "Ada", principal: ada }, { label: "Bea", principal: bea }], principal: ada });
    await act(async () => handle.setSeat(bea));
    const store = await swap(handle, appOf("both"), ["t1"], { remote: true });
    expect(handle.store).toBe(store);
    const pressed = [...host.querySelectorAll('[aria-pressed="true"]')].map((button) => button.textContent ?? "");
    expect(pressed.some((label) => label.includes("Bea"))).toBe(true);
  });

  it("under memory routing touches neither the address nor the history", async () => {
    const { handle } = await open({ face: "pages", path: "/tasks/t1" }, "/an-article?x=1#here");
    const length = window.history.length;
    await swap(handle, appOf("both"), ["t2"]);
    await swap(handle, appOf("tasks"), ["t2"]);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/an-article?x=1#here");
    expect(window.history.length).toBe(length);
  });
});

describe("a new app under address routing", () => {
  it("keeps the page the address names, and replaces a gone record's address with its list's", async () => {
    const { host, handle } = await open({ face: "graview", routing: "address", basePath: "/apps/a1/" }, "/apps/a1/tasks/t1");
    expect(heading(host)).toBe("Buy stamps");
    const length = window.history.length;
    await swap(handle, appOf("both"), ["t1"]);
    expect(window.location.pathname).toBe("/apps/a1/tasks/t1");
    expect(heading(host)).toBe("Buy stamps");
    await swap(handle, appOf("both"), ["t2"]);
    expect(window.location.pathname).toBe("/apps/a1/tasks");
    expect(heading(host)).toBe("Tasks");
    expect(window.history.length).toBe(length);
  });

  it("keeps the scene's stop in the fragment", async () => {
    const { handle } = await open({ face: "pages", routing: "address", basePath: "/apps/a1" }, "/apps/a1#focus=t1");
    expect(handle.where().face).toBe("scene");
    await swap(handle, appOf("both"), ["t2"]);
    expect(fromUrl(window.location.hash).focusId).toBe("aggregate:task");
    expect(handle.where().face).toBe("scene");
  });

  /*
   * THE ADDRESS IS THE SOURCE OF TRUTH, including for which face it names.
   * A host that remounts with the `at` it read before a reload can hand
   * back the scene while the address now names a page: the page the
   * address names is the one settled, and no scene fragment is written
   * onto a page's address.
   */
  it("settles the page the address names when the place handed back was on another face", async () => {
    const { host, handle } = await open(
      { face: "scene", routing: "address", basePath: "/apps/a1", at: { face: "scene", path: "/", stop: "#focus=t2", kind: "task" } },
      "/apps/a1/tasks/t9",
    );
    expect(handle.where().face).toBe("pages");
    expect(window.location.pathname).toBe("/apps/a1/tasks");
    expect(window.location.hash).toBe("");
    expect(heading(host)).toBe("Tasks");
  });
});
