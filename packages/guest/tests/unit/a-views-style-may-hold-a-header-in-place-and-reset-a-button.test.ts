import { describe, expect, it } from "vitest";
import { sanitizeDeclarations, sanitizeStylesheet } from "../../src/host/css.js";
import { REGION_CSS } from "../../src/host/open-draw.js";

/*
 * A VIEW'S STYLE MAY HOLD A HEADER IN PLACE AND RESET A BUTTON
 * (2026-10-15, The Beatles).
 *
 * `graview.style` refused `position: sticky` and `all: unset`, so a view
 * could not keep its header in place as it scrolled, nor take the browser's
 * chrome off a button it drew as a toggle. Both are kept: sticky sticks
 * within its own parent's box, and the region is painted contained, so it
 * never paints past the view or over the app; `all` takes only the four
 * keywords every property takes, which reset and load nothing. `fixed`,
 * which escapes to the page's viewport, is still refused.
 */
describe("a view's style", () => {
  it("keeps position: sticky, in any case", () => {
    expect(sanitizeStylesheet("thead th { position: sticky; top: 0 }").css).toBe("thead th { position: sticky; top: 0; }");
    expect(sanitizeStylesheet(".h { position: STICKY }").refused).toEqual([]);
  });

  it("keeps all: unset and the other keywords, and nothing else for all", () => {
    expect(sanitizeStylesheet("button.toggle { all: unset; cursor: pointer }").css).toBe("button.toggle { all: unset; cursor: pointer; }");
    for (const word of ["initial", "inherit", "revert"]) expect(sanitizeDeclarations(`all: ${word}`).css).toBe(`all: ${word}`);
    for (const css of [".x { all: var(--reset) }", ".x { all: url(https://attacker.example/x) }", ".x { all: fixed }"]) {
      const said = sanitizeStylesheet(css);
      expect(said.css, css).not.toMatch(/all:/);
      expect(said.refused.length, css).toBeGreaterThan(0);
    }
  });

  it("still refuses position: fixed", () => {
    expect(sanitizeStylesheet(".x { position: fixed }").refused).toContainEqual({ reason: "value", name: "position" });
  });

  it("is drawn in a region painted contained, which a sticky element cannot paint past", () => {
    expect(REGION_CSS).toMatch(/:host \{[^}]*contain: layout paint style/);
    expect(REGION_CSS).toMatch(/:host \{[^}]*overflow: clip/);
    expect(REGION_CSS).toMatch(/:host \{[^}]*isolation: isolate/);
  });
});
