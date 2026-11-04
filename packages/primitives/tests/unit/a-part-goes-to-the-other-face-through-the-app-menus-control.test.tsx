// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppBar, type BarFaces } from "../../src/index.js";
import { FACE_EVENT } from "../../src/frame.js";

/**
 * BETTER UI ASKED IN THE SCENE, OPENED ON ITS PAGE (Roadmap
 * f-make-any-page-better), WITH THE SCENE AND THE PAGES IN THE APP MENU
 * (Roadmap f-app-bar-calm). Better UI in the scene's menu switched to the
 * pages by pressing the bar's Pages button; once the two faces became rows
 * of the app menu, drawn only while it is open, there was no button to
 * press and the scene offered Chat alone. The app menu's control says the
 * bar holds both faces and goes to the one it is asked for, without opening
 * the menu. `pnpm verify scene-menu` holds the same in a real browser.
 */
let host: HTMLDivElement | undefined;
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = undefined;
  root = undefined;
});

function bar(faces?: BarFaces): void {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<AppBar brand={undefined} name="Things" home={{ href: "/", current: true }} places={[]} current={null} reach={{}} find={false} tools={null} {...(faces ? { faces } : {})} />));
}

describe("the app menu's control", () => {
  it("says the bar holds the pages, and goes there when asked, without opening the menu", () => {
    const went: string[] = [];
    bar({ scene: { label: "Scene", current: true, go: () => went.push("scene") }, pages: { label: "Pages", current: false, go: () => went.push("pages") } });
    const door = document.querySelector<HTMLElement>('[data-testid="app-menu-open"][data-pages]');
    expect(door).not.toBeNull();
    act(() => void door!.dispatchEvent(new CustomEvent(FACE_EVENT, { detail: "pages" })));
    expect(went).toEqual(["pages"]);
    expect(document.querySelector('[data-testid="app-menu"]')?.hasAttribute("hidden")).toBe(true);
  });

  it("goes nowhere when asked for the face already drawn, and says nothing of the pages where the bar holds no faces", () => {
    const went: string[] = [];
    bar({ scene: { label: "Scene", current: false, go: () => went.push("scene") }, pages: { label: "Pages", current: true, go: () => went.push("pages") } });
    act(() => void document.querySelector('[data-testid="app-menu-open"]')!.dispatchEvent(new CustomEvent(FACE_EVENT, { detail: "pages" })));
    expect(went).toEqual([]);
    act(() => root?.unmount());
    host?.remove();
    bar();
    expect(document.querySelector('[data-testid="app-menu-open"][data-pages]')).toBeNull();
  });
});
