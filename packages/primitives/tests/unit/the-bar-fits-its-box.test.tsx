// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppBar, type BarFaces, type BarPlace } from "../../src/index.js";

/**
 * THE BAR FITS ITS BOX.
 *
 * graview.dev's landing page gives the garden a box about 650 px wide on a
 * 1440 desk, and on 0.1.17 the bar laid itself out as a desk's there: the
 * app's name crushed to a letter a line down the side and over the page
 * under it, the place cut to "W… ▾", and Find holding the room. The bar
 * reads its own width, never the screen's; the name breaks only between
 * words; Find is a small box that says its shortcut and opens wide when it
 * is used; and the switch can be its marks alone, the words its names.
 *
 * What is measured — lines, widths, overlap — is measured in a browser
 * (`verify-chrome-quiet`, "the bar fits its box"); this holds what the bar
 * says and the rules it is drawn by.
 */
let host: HTMLDivElement | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
});

const places: readonly BarPlace[] = [
  { key: "home", label: "Home", path: "/", group: "home" },
  { key: "place:p", label: "What the room said about the budget and the county pilot", path: "/places/p", group: "pictures", kind: "k" },
];
const faces: BarFaces = {
  scene: { label: "Scene", current: false, go: () => undefined },
  pages: { label: "Pages", current: true, go: () => undefined },
};

function drawn(element: ReactElement) {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(element));
  return { root, at: host };
}

const sheet = (at: HTMLElement) => [...at.querySelectorAll("style")].map((style) => style.textContent ?? "").join("\n");

describe("the bar's own rules", () => {
  it("lay the bar out by its own width — container queries on the bar, never the screen's", () => {
    const { root, at } = drawn(<AppBar brand={undefined} name="Farm Bureau POM Workshop" home={{ go: () => undefined, current: false }} faces={faces} places={places} current="place:p" reach={{}} tools={null} />);
    const css = sheet(at);
    expect(css).toMatch(/\.graview-bar\{[^}]*container:graview-bar\/inline-size/);
    expect(css).toMatch(/@container graview-bar \(max-width/);
    expect(css).not.toMatch(/@media[^{]*width/);
    act(() => root.unmount());
  });

  it("break the app's name only between words, on at most two lines, never letter by letter", () => {
    const { root, at } = drawn(<AppBar brand={undefined} name="Farm Bureau POM Workshop" home={{ go: () => undefined, current: false }} faces={faces} places={places} current="place:p" reach={{}} tools={null} />);
    const css = sheet(at);
    // The rules that drew "S e e d b e d" down the bar's side: a word broken anywhere, in a column held to a third of the bar.
    expect(css).not.toMatch(/anywhere[^}]*}[^{]*\.graview-bar-(name|home|app)/);
    expect(css).not.toMatch(/\.graview-bar-(home|app|app-name|name)\{[^}]*overflow-wrap:anywhere/);
    expect(css).not.toMatch(/\.graview-bar-app\{[^}]*max-width:3\d%/);
    expect(css).toMatch(/\.graview-bar-app-name\{[^}]*-webkit-line-clamp:2/);
    // The whole name is the way home's title, and its text.
    const home = at.querySelector('[data-testid="app-home"]')!;
    expect(home.getAttribute("title")).toMatch(/^Farm Bureau POM Workshop/);
    expect(at.querySelector('[data-testid="app-name"]')?.textContent).toBe("Farm Bureau POM Workshop");
    act(() => root.unmount());
  });

  it("give Find first, then the name; the place keeps room for its words, whole on hover", () => {
    const { root, at } = drawn(<AppBar brand={undefined} name="Farm Bureau POM Workshop" home={{ go: () => undefined, current: false }} faces={faces} places={places} current="place:p" reach={{}} tools={null} />);
    const css = sheet(at);
    const shrink = (rule: string) => Number(new RegExp(`\\.${rule}\\{[^}]*flex:[\\d.]+ ([\\d.]+)`).exec(css)?.[1]);
    expect(shrink("graview-bar-find")).toBeGreaterThan(shrink("graview-bar-app"));
    expect(shrink("graview-bar-mid")).toBeGreaterThan(shrink("graview-bar-app"));
    expect(shrink("graview-bar-faces")).toBe(0);
    // Find gives down to a box that still says "Find"; the place keeps room for its words.
    expect(css).toMatch(/\.graview-bar-find\{[^}]*min-width:\d/);
    expect(css).toMatch(/\.graview-bar-mid\[data-place\]\{min-width:\d+em;/);
    const open = at.querySelector('[data-testid="app-places-open"]')!;
    expect(open.getAttribute("title")).toBe("What the room said about the budget and the county pilot");
    act(() => root.unmount());
  });
});

describe("Find on the bar", () => {
  it("is a small box that says its shortcut — ⌘K on a Mac, Ctrl K elsewhere — and is drawn wide while it is used", () => {
    const platform = Object.getOwnPropertyDescriptor(Navigator.prototype, "platform");
    for (const [said, expected] of [
      ["MacIntel", "⌘K"],
      ["Win32", "Ctrl K"],
    ] as const) {
      Object.defineProperty(navigator, "platform", { value: said, configurable: true });
      const { root, at } = drawn(<AppBar brand={undefined} name="Seedbed" home={{ go: () => undefined, current: false }} faces={faces} places={places} current="home" reach={{}} tools={null} findBox={<input type="search" aria-label="Find anything" placeholder="Find…" />} />);
      const keys = at.querySelector('[data-testid="app-find-keys"]')!;
      expect(keys.textContent).toBe(expected);
      // Said for the eye: the box's own `aria-keyshortcuts` says it to the ear.
      expect(keys.getAttribute("aria-hidden")).toBe("true");
      // The box is the face's, in the bar's place for it, and the keyboard reaches it as it is.
      expect(at.querySelector('[data-testid="app-find"] input[type="search"]')).not.toBeNull();
      const css = sheet(at);
      expect(css).toMatch(/\.graview-bar-find:focus-within/);
      expect(css).toMatch(/\.graview-bar-find:has\(input:not\(:placeholder-shown\)\)/);
      act(() => root.unmount());
      host?.remove();
    }
    if (platform) Object.defineProperty(Navigator.prototype, "platform", platform);
    delete (navigator as unknown as Record<string, unknown>)["platform"];
  });
});

describe("the switch as its marks alone", () => {
  it("is asked for by `switch: \"icons\"`, and keeps its words as its buttons' names and titles", () => {
    const { root, at } = drawn(<AppBar brand={undefined} name="Seedbed" home={{ go: () => undefined, current: false }} faces={faces} places={places} current="home" reach={{}} tools={null} find={false} switch="icons" />);
    const group = at.querySelector('[data-testid="app-faces"]')!;
    expect(group.getAttribute("data-switch")).toBe("icons");
    const buttons = [...group.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual(["Scene", "Pages"]);
    expect(buttons.map((button) => button.getAttribute("title"))).toEqual(["Scene", "Pages"]);
    expect(group.getAttribute("data-switch-drawn")).toBe("icons");
    expect(sheet(at)).toMatch(/\[data-switch=icons\],\[data-switch-drawn=icons\]\) \.graview-bar-face span\{[^}]*clip/);
    act(() => root.unmount());
  });

  it("says its words by default, and goes to its marks on its own when they do not fit or the bar is a phone's", () => {
    const { root, at } = drawn(<AppBar brand={undefined} name="Seedbed" home={{ go: () => undefined, current: false }} faces={faces} places={places} current="home" reach={{}} tools={null} find={false} />);
    expect(at.querySelector('[data-testid="app-faces"]')?.getAttribute("data-switch")).toBe("words");
    expect(sheet(at)).toMatch(/@container graview-bar \(max-width: ?\d+px\)\{[^@]*\.graview-bar-face span\{[^}]*clip/);
    act(() => root.unmount());
  });
});
