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
