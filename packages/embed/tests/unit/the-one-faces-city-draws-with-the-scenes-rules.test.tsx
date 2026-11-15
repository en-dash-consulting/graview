// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineApp, defineNode, z } from "@graview/core";
import { sceneCss } from "@graview/primitives/scene";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";
import { mount as mountPages, type PagesEmbedOptions } from "../../src/pages.js";

/**
 * THE ONE FACE'S CITY DRAWS WITH THE SCENE'S RULES, THROUGH THE EMBED.
 *
 * `PagesApp`'s page writes `themeCss` — the frame's rules and the Scene's —
 * so the city under the one face is drawn by them. The embed's frame writes
 * only the frame's (`themeBaseCss`), and the Scene face its own beside them:
 * the one face drew the Scene's city with none of its rules, and a ribbon
 * between two districts, an SVG path whose `fill: none` is the Scene's, was
 * filled black. Once the city's part is in, the Scene's rules for the
 * embed's scheme and scope are written with it, once.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const person = defineNode("person", { fields: z.object({ label: z.string() }), plural: "People" });
const app = defineApp({ name: "Errands", schema: createSchema([task, person]), mutations: [] });
const seed = { nodes: [{ id: "t1", kind: "task", label: "Buy stamps" }, { id: "p1", kind: "person", label: "Ada" }], edges: [] };

beforeAll(() => preload());

const mounted: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const done of mounted.splice(0)) await done();
  window.history.replaceState(null, "", "/");
});

async function until(ready: () => boolean) {
  for (let turn = 0; turn < 400 && !ready(); turn++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
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
  return host;
}

async function pagesAlone(options: Partial<PagesEmbedOptions> = {}) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  let unmount: (() => void) | undefined;
  await act(async () => {
    unmount = mountPages(host, { app, seed, fonts: false, path: "/tasks", ...options } as PagesEmbedOptions).unmount;
  });
  mounted.push(async () => {
    await act(async () => unmount!());
    host.remove();
  });
  return host;
}

const scopeOf = (host: Element) => [...host.querySelector("[data-graview-embed]")!.classList].find((one) => one.startsWith("graview-embed-"))!;
const cityIn = (host: Element) => host.querySelector('[data-testid="one-place-city"]') !== null;
/** The sheets in the embed that are the Scene's rules for this scheme and scope, to the character. */
const sceneSheetsIn = (host: Element, scheme: "light" | "dark") => {
  const want = sceneCss(scheme, { scope: `.${scopeOf(host)}` });
  return [...host.querySelectorAll("style")].filter((style) => style.textContent === want).length;
};

describe("the one face's city under the embed draws with the Scene's rules", () => {
  it("writes the Scene's rules, for the embed's scheme and scope, once the city's part is in", async () => {
    const host = await whole({ sceneUnderPages: true, scheme: "light" });
    await until(() => cityIn(host));
    expect(cityIn(host)).toBe(true);
    expect(sceneSheetsIn(host, "light")).toBe(1);
    // Within the embed's element only: none of the Scene's rules is written unscoped.
    expect([...document.querySelectorAll("style")].filter((style) => /(^|\n)\.graview-ribbon-band\s*\{/.test(style.textContent ?? ""))).toHaveLength(0);
  });

  it("writes them for the scheme it draws in", async () => {
    const host = await whole({ sceneUnderPages: true, scheme: "dark" });
    await until(() => cityIn(host));
    expect(sceneSheetsIn(host, "dark")).toBe(1);
    expect(sceneSheetsIn(host, "light")).toBe(0);
  });

  it("writes them again for a scheme the host changes to, and keeps none of the last one's", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let handle: EmbedHandle | undefined;
    await act(async () => {
      handle = mount(host, { app, seed, fonts: false, studio: false, face: "pages", path: "/tasks", sceneUnderPages: true, scheme: "light" } as EmbedOptions);
    });
    mounted.push(async () => {
      await act(async () => handle!.unmount());
      host.remove();
    });
    await act(async () => handle!.drawn());
    await until(() => cityIn(host));
    expect(sceneSheetsIn(host, "light")).toBe(1);
    await act(async () => handle!.setScheme("dark"));
    await until(() => sceneSheetsIn(host, "dark") === 1);
    expect(sceneSheetsIn(host, "dark")).toBe(1);
    expect(sceneSheetsIn(host, "light")).toBe(0);
  });

  it("writes them under the pages alone (`@graview/embed/pages`) too", async () => {
    const host = await pagesAlone({ sceneUnderPages: true, scheme: "light" });
    await until(() => cityIn(host));
    expect(sceneSheetsIn(host, "light")).toBe(1);
  });

  it("writes none on the routed face without the city", async () => {
    const host = await whole({ scheme: "light" });
    await until(() => host.querySelector("[data-graview-app-bar]") !== null);
    expect(cityIn(host)).toBe(false);
    expect(sceneSheetsIn(host, "light")).toBe(0);
  });
});
