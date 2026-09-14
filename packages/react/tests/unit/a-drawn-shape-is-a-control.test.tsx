// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePickTargets } from "../../src/picking.js";

/**
 * A SHAPE A LENS DREW IS A CONTROL, NOT A SILENT STOP.
 *
 * `data-graview-pick` is the whole contract — the host routes the click,
 * gives the target a tab stop and a role — and that was true of a `<span>`
 * and false of a `<g>`, because the allowlist that decides where
 * `role="button"` is a legal thing to say listed HTML tags only. Any lens
 * that draws a picture draws it in SVG, so a map's regions came out
 * focusable and announced as nothing at all: a keyboard user tabbing through
 * stops that say nothing, which is worse than not being able to reach them.
 *
 * The allowlist is still an allowlist. A `<header>` a view chose to mark
 * keeps its tab stop and does NOT get told it is a button.
 */
function Host() {
  const ref = useRef<HTMLDivElement | null>(null);
  usePickTargets(ref);
  return (
    <div ref={ref}>
      <svg viewBox="0 0 10 10">
        <g data-graview-pick="lawn" aria-label="Back Lawn">
          <polygon data-graview-pick="bed" aria-label="Rose bed" points="0,0 5,0 5,5" />
          <circle data-graview-pick="tap" aria-label="Standpipe" cx="8" cy="8" r="1" />
          <path data-graview-pick="path" aria-label="The path" d="M0 0 L9 9" />
        </g>
      </svg>
      <span data-graview-pick="note">A note</span>
      <header data-graview-pick="banner">The grounds</header>
      <button data-graview-pick="already">A real one</button>
    </div>
  );
}

let host: HTMLDivElement;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
});
afterEach(() => host.remove());

describe("a pick target a lens drew", () => {
  it("is a button when it is a shape, and named by the view that drew it", async () => {
    const root = createRoot(host);
    await act(async () => root.render(<Host />));
    for (const id of ["lawn", "bed", "tap", "path"]) {
      const target = host.querySelector(`[data-graview-pick="${id}"]`);
      expect(target?.getAttribute("role"), `${id} announces as nothing`).toBe("button");
      expect(target?.getAttribute("tabindex")).toBe("0");
      /* A shape has no text in it, so the name is the view's own to set. */
      expect(target?.getAttribute("aria-label")).toBeTruthy();
    }
    await act(async () => root.unmount());
  });

  it("still refuses to call a landmark a button, and leaves a real one alone", async () => {
    const root = createRoot(host);
    await act(async () => root.render(<Host />));
    const banner = host.querySelector('[data-graview-pick="banner"]');
    expect(banner?.getAttribute("role")).toBeNull();
    /* Unreachable is the worse answer, so it keeps the stop. */
    expect(banner?.getAttribute("tabindex")).toBe("0");
    expect(host.querySelector('[data-graview-pick="note"]')?.getAttribute("role")).toBe("button");
    expect(host.querySelector('[data-graview-pick="already"]')?.getAttribute("role")).toBeNull();
    await act(async () => root.unmount());
  });
});
