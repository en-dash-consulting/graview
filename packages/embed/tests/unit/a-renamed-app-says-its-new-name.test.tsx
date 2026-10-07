// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, SCHEMES, Store, z, type AnySchema, type GraviewApp } from "@graview/core";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedHandle } from "../../src/pages.js";

/**
 * A RENAMED APP SAYS ITS NEW NAME WITHOUT A RELOAD (FR-128).
 *
 * Graview Cloud mounts the embed with `label: app.name`, and when a chat
 * renames the app (`set-name`) it hands the new app to `setApp` (FR-116).
 * The swap kept the first mount's label, so the open page's heading and the
 * embed's accessible name said the old name until a reload. A label that
 * was the app's own name now follows the app; a label the host chose stays
 * until the host says otherwise, by `setApp(app, store, { label })` or
 * `handle.setLabel(label)`. The host's own actions can be changed the same
 * way, `handle.setHostActions(actions)`.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
function appNamed(name: string): GraviewApp<AnySchema> {
  return defineApp({ name, schema, mutations: [], brand: { name, schemes: SCHEMES } } as never) as unknown as GraviewApp<AnySchema>;
}
const storeOf = (app: GraviewApp<AnySchema>) => new Store<AnySchema>({ schema: app.schema, mutations: [], snapshot: { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }], edges: [] } as never });

beforeAll(() => preload());
const mounted: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of mounted.splice(0)) await done();
});
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

async function open(options: Partial<EmbedOptions>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = options.app ?? appNamed("Errands");
  let handle: EmbedHandle | undefined;
  await act(async () => {
    handle = mount(host, { app, store: storeOf(app), fonts: false, studio: false, ...options } as EmbedOptions);
  });
  let drawn = false;
  void handle!.drawn().then(() => (drawn = true));
  for (let tick = 0; tick < 50 && !drawn; tick++) await settle();
  await settle();
  mounted.push(async () => {
    await act(async () => handle!.unmount());
    host.remove();
  });
  return { host, handle: handle! };
}

async function rename(handle: EmbedHandle, name: string, options?: { readonly label?: string }) {
  const app = appNamed(name);
  await act(async () => handle.setApp(app, storeOf(app), options));
  await act(async () => handle.drawn());
  await settle();
}

const region = (host: HTMLElement) => host.querySelector("section[data-graview-embed]")!.getAttribute("aria-label");
const workbenchHeading = (host: HTMLElement) => host.querySelector("section[data-graview-embed] > h1")?.textContent;
const wordmarks = (host: HTMLElement, name: string) => [...host.querySelectorAll("a, span")].filter((one) => one.textContent?.trim() === name && one.children.length <= 1).length;
/** The landmarks inside, each named after the embed. */
const inside = (host: HTMLElement) => [...host.querySelectorAll("section[data-graview-embed] nav[aria-label], section[data-graview-embed] main[aria-label], section[data-graview-embed] [role=region][aria-label]")].map((one) => one.getAttribute("aria-label")!);

describe("an app renamed under the reader", () => {
  it.each([["graview"], ["pages"]] as const)("says its new name on the %s face: the embed's accessible name, its heading and its wordmark", async (face) => {
    const { host, handle } = await open({ face, label: "Errands", heading: 1 });
    expect(region(host)).toBe("Errands");
    await rename(handle, "Chores");
    expect(region(host)).toBe("Chores");
    if (face === "graview") expect(workbenchHeading(host)).toBe("Chores");
    expect(wordmarks(host, "Chores")).toBeGreaterThan(0);
    expect(wordmarks(host, "Errands")).toBe(0);
    for (const name of inside(host)) expect(name.startsWith("Errands")).toBe(false);
  });

  it("keeps a label the host chose, which is not the app's name", async () => {
    const { host, handle } = await open({ face: "pages", label: "Chapter 13" });
    await rename(handle, "Chores");
    expect(region(host)).toBe("Chapter 13");
  });

  it("takes the label setApp is handed", async () => {
    const { host, handle } = await open({ face: "graview", label: "Chapter 13", heading: 2 });
    await rename(handle, "Chores", { label: "Chapter 14" });
    expect(region(host)).toBe("Chapter 14");
    expect(host.querySelector("section[data-graview-embed] > h2")?.textContent).toBe("Chapter 14");
  });
});

describe("handle.setLabel", () => {
  it("renames the embed in place, each landmark inside named after it once", async () => {
    const { host, handle } = await open({ face: "pages", label: "Errands" });
    const before = inside(host);
    expect(before.length).toBeGreaterThan(0);
    const kept = host.querySelector("section[data-graview-embed] main");
    await act(async () => handle.setLabel("The chores"));
    await settle();
    expect(region(host)).toBe("The chores");
    expect(inside(host)).toEqual(before.map((name) => name.replace(/^Errands/, "The chores")));
    expect(host.querySelector("section[data-graview-embed] main")).toBe(kept);
  });

  it("renames the pages alone too", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = appNamed("Errands");
    let handle: PagesEmbedHandle | undefined;
    await act(async () => {
      handle = mountPages(host, { app, store: storeOf(app), fonts: false, label: "Errands" } as never);
    });
    await act(async () => handle!.setLabel("Chores"));
    expect(region(host)).toBe("Chores");
    await act(async () => handle!.unmount());
    host.remove();
  });
});

describe("handle.setHostActions", () => {
  it("changes the host's own actions in the profile menu", async () => {
    const { host, handle } = await open({ face: "pages", hostActions: [{ label: "Your apps", href: "https://cloud.example/apps" }] });
    await act(async () => handle.setHostActions([{ label: "Change Chores", href: "https://cloud.example/apps/chores" }]));
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="profile-button"]')!.click());
    const links = [...host.querySelectorAll('[data-testid="profile"] [data-testid="host-action"]')].map((link) => link.textContent);
    expect(links).toEqual(["Change Chores"]);
  });
});
