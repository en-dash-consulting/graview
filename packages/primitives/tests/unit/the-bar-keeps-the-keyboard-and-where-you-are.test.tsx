// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { AppBar } from "../../src/index.js";

/**
 * THE BAR KEEPS THE KEYBOARD (FR-131). On a phone the bar's Find is a
 * magnifier that opens the box over the bar's first row; put away by
 * Escape, the box gave the keyboard to the page's body — the scene's Find
 * takes Escape for itself and lets go of the keys on an empty box — and a
 * reader on a keyboard had to start again from the top of the page. It
 * goes back to the magnifier that opened it.
 */
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

/** A box that behaves as the scene's does: Escape clears the words, and on an empty box lets go of the keys. */
function SceneLikeBox() {
  const [words, setWords] = useState("");
  return (
    <input
      aria-label="Find"
      value={words}
      onChange={(event) => setWords(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        if (words) setWords("");
        else event.currentTarget.blur();
      }}
    />
  );
}

let host: HTMLDivElement | undefined;
afterEach(() => {
  host?.remove();
  host = undefined;
});

describe("the bar's Find on a phone", () => {
  it("gives the keyboard back to the magnifier when Escape puts the box away, after the words are cleared first", async () => {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<AppBar brand={undefined} name="Errands" home={{ go: () => undefined, current: true }} places={[]} current={null} reach={{}} tools={null} findBox={<SceneLikeBox />} />);
    });
    const opener = host.querySelector<HTMLButtonElement>('[data-testid="app-find-open"]')!;
    opener.focus();
    await act(async () => {
      opener.click();
      await frame();
    });
    const box = host.querySelector<HTMLInputElement>('[data-testid="app-find"] input')!;
    expect(document.activeElement).toBe(box);
    const escape = () =>
      act(async () => {
        box.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        await frame();
      });
    // Words in the box: Escape clears them, and the box stays out with the keyboard in it.
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      set.call(box, "stamps");
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await escape();
    expect(box.value).toBe("");
    expect(document.activeElement).toBe(box);
    // The empty box: put away, and the keyboard is on the magnifier, not the body.
    await escape();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(opener);
    await act(async () => root.unmount());
  });
});

describe("the bar's places on a row that holds none of them", () => {
  it("keeps the place you are on on the row, beside More, never only inside it", async () => {
    const real = HTMLElement.prototype.getBoundingClientRect;
    // A row 60 px wide, and every tab and More 80 px: not even one tab fits beside More.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const width = this.classList.contains("graview-bar-places") ? 60 : this.classList.contains("graview-bar-tab") ? 80 : 0;
      return { width, height: 20, top: 0, left: 0, right: width, bottom: 20, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    };
    try {
      host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      const places = ["Overview", "Tasks", "People", "Rooms"].map((label) => ({ key: `kind:${label}`, label, path: `/${label.toLowerCase()}` }));
      await act(async () => {
        root.render(<AppBar brand={undefined} name="Errands" home={{ go: () => undefined, current: false }} places={places} current="kind:People" reach={{}} tools={null} find={false} />);
      });
      const row = host.querySelector('[data-testid="app-places"]')!;
      const onRow = [...row.querySelectorAll(":scope > .graview-bar-tab")].map((tab) => tab.textContent);
      expect(onRow).toEqual(["People"]);
      expect(row.querySelector('[aria-current="page"]')?.textContent).toBe("People");
      expect(host.querySelector('[data-testid="app-places-more"]')).not.toBeNull();
      await act(async () => root.unmount());
    } finally {
      HTMLElement.prototype.getBoundingClientRect = real;
    }
  });
});
