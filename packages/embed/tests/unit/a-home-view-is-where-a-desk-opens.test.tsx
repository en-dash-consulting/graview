// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount, preload, type EmbedHandle, type EmbedOptions } from "../../src/index.js";

/**
 * A HOME VIEW IS THE FRONT PAGE ON A DESK TOO (FR-136), AND THE SCENE AND
 * THE PAGES ARE ONE SWITCH APART (FR-137).
 *
 * Graview Cloud, with the custom front page a chat wrote: on a phone it was
 * the home, and on a desk it was a card floating over the scene's top
 * right — a popover, where the person had asked for the page the app opens
 * on. The home view is the home now — the first of the places, at the
 * app's own address (`/`), drawn full width as the page under the bar —
 * and an embed whose host names no face opens on it; the scene is the
 * switch's other side. Without a home view nothing changes.
 */
const fixtures = resolve(import.meta.dirname, "../../../core/tests/document/fixtures");
const document_ = JSON.parse(readFileSync(resolve(fixtures, "lifelogics.gdd.json"), "utf8"));
const seed = JSON.parse(readFileSync(resolve(fixtures, "lifelogics.seed.json"), "utf8"));
const compile = (doc: unknown) => {
  const compiled = compileDocument(doc as never, { today: () => "2026-10-05" });
  if (!compiled.ok) throw new Error("lifelogics did not compile");
  return compiled.app as GraviewApp<AnySchema>;
};
const withHome = compile(document_);
const { home: _home, ...viewsWithoutHome } = document_.views;
const withoutHome = compile({ ...document_, views: viewsWithoutHome });
const owner = { kind: "human" as const, id: "u:owner", roles: ["owner"] };

beforeAll(() => Promise.all([preload(), fetchDeclaredLenses(), fetchHomeView()]));

let element: HTMLElement | undefined;
let handle: EmbedHandle | undefined;
afterEach(() => {
  act(() => handle?.unmount());
  element?.remove();
  handle = undefined;
  element = undefined;
});

async function opened(options: Partial<EmbedOptions<AnySchema>> & { app: GraviewApp<AnySchema> }) {
  element = document.createElement("div");
  document.body.append(element);
  await act(async () => {
    handle = mount(element!, { seed, principal: owner, fonts: false, studio: false, heading: 1, ...options });
  });
  await act(async () => {
    await handle!.drawn();
    await new Promise((done) => setTimeout(done, 30));
  });
  return { element: element!, handle: handle! };
}

const face = (root: HTMLElement) => root.querySelector("[data-graview-embed]")?.getAttribute("data-graview-embed");
const pressed = (root: HTMLElement, which: "scene" | "pages") => root.querySelector(`[data-testid="app-face-${which}"]`)?.getAttribute("aria-pressed");
const current = (root: HTMLElement) => root.querySelector('[data-testid="app-place-current"]')?.textContent;
const press = (root: HTMLElement, selector: string) =>
  act(async () => {
    root.querySelector<HTMLElement>(selector)!.click();
    await new Promise((done) => setTimeout(done, 30));
  });
/** A place, in two presses: the place control, then its entry. */
async function goTo(root: HTMLElement, key: string) {
  await press(root, '[data-testid="app-places-open"]');
  await press(root, `[data-testid="app-place-${key}"]`);
}

describe("an app with a home view, mounted with no face named", () => {
  it("opens on Pages at its home, drawn as the page under the bar, the home first among the places", async () => {
    const { element: root, handle: embed } = await opened({ app: withHome });
    expect(face(root)).toBe("pages");
    expect(root.querySelector('[data-testid="home-view"]')).not.toBeNull();
    expect([pressed(root, "scene"), pressed(root, "pages")]).toEqual(["false", "true"]);
    expect(current(root)).toBe("Home");
    const entries = [...root.querySelectorAll('[data-testid="app-places"] [data-testid^="app-place-"]')].map((entry) => entry.getAttribute("data-testid"));
    expect(entries[0]).toBe("app-place-home");
    expect(entries).not.toContain("app-place-overview");
    expect(embed.where()).toMatchObject({ face: "pages", path: "/" });
  });

  it("draws the scene from the switch with nothing floating over it, and Pages goes back to the page the reader was on", async () => {
    const said: string[] = [];
    const { element: root } = await opened({ app: withHome, onNavigate: (path) => said.push(path) });
    await goTo(root, "kind:offer");
    expect(current(root)).toBe("Offers");
    await press(root, '[data-testid="app-face-scene"]');
    expect(face(root)).toBe("scene");
    expect(pressed(root, "scene")).toBe("true");
    expect(root.querySelector('[data-testid="home-view"]')).toBeNull();
    expect(root.querySelector('[data-testid="home-landing"]')).toBeNull();
    // On the scene the bar's places are the scene's (FR-144): the Pages' are not offered.
    expect(root.querySelector('[data-testid="app-place-scene:whole"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="app-place-kind:offer"]')).toBeNull();
    await press(root, '[data-testid="app-face-pages"]');
    expect(face(root)).toBe("pages");
    expect(current(root)).toBe("Offers");
    expect(said).toEqual(["/offers", "/places/overview", "/offers"]);
  });

  it("follows setPath: the scene's path is the scene, the app's own address is the home", async () => {
    const { element: root, handle: embed } = await opened({ app: withHome });
    await act(async () => embed.setPath("/places/overview"));
    await act(async () => void (await embed.drawn()));
    expect(face(root)).toBe("scene");
    await act(async () => embed.setPath("/"));
    await act(async () => void (await embed.drawn()));
    expect(face(root)).toBe("pages");
    expect(root.querySelector('[data-testid="home-view"]')).not.toBeNull();
  });
});

describe("a host that names the face", () => {
  it("is drawn the face it asked for, the scene, with Pages one press away at the home", async () => {
    const { element: root, handle: embed } = await opened({ app: withHome, face: "graview" });
    expect(face(root)).toBe("graview");
    expect(root.querySelector('[data-testid="home-view"]')).toBeNull();
    expect(pressed(root, "scene")).toBe("true");
    expect(embed.where()).toMatchObject({ face: "graview", path: "/places/overview" });
    await press(root, '[data-testid="app-face-pages"]');
    expect(face(root)).toBe("pages");
    expect(root.querySelector('[data-testid="home-view"]')).not.toBeNull();
  });
});

describe("a host whose page is the app (routing: \"address\")", () => {
  it("opens on the home at the bare address even where the host names the scene, and says so in where()", async () => {
    window.history.replaceState(null, "", "/");
    const { element: root, handle: embed } = await opened({ app: withHome, face: "graview", routing: "address" });
    expect(face(root)).toBe("pages");
    expect(root.querySelector('[data-testid="home-view"]')).not.toBeNull();
    expect(embed.where()).toMatchObject({ face: "pages", path: "/" });
    await act(async () => void (await embed.drawn()));
    // The scene's own address still opens the scene.
    await act(async () => handle?.unmount());
    handle = undefined;
    window.history.replaceState(null, "", "/places/overview");
    const again = await opened({ app: withHome, face: "graview", routing: "address" });
    expect(face(again.element)).toBe("scene");
    window.history.replaceState(null, "", "/");
  });

  it("opens on the face the host names when the app has no home view", async () => {
    window.history.replaceState(null, "", "/");
    const { element: root } = await opened({ app: withoutHome, face: "graview", routing: "address" });
    expect(face(root)).toBe("graview");
  });
});

describe("an app without a home view", () => {
  it("opens on the scene as before", async () => {
    const { element: root } = await opened({ app: withoutHome });
    expect(face(root)).toBe("scene");
    expect(pressed(root, "scene")).toBe("true");
  });
});
