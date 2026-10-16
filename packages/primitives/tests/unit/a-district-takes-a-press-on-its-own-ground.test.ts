import { describe, expect, it } from "vitest";
import { sceneCss } from "../../src/index.js";

/*
 * A DISTRICT TAKES A PRESS ON ITS OWN GROUND, not on the box around it. On
 * a phone the vendor shortlist's "CATEGORIES 2 ⚠ 2" stood on bare ground
 * at the corner of the vendors' box, clear of their diamond, and a press on
 * "⚠ 2" landed on the vendors (the watch's `control-covered`, in
 * `verify-chrome-quiet` on Firefox at 390 wide). From altitude the card
 * takes no press and a diamond over its plot does; its name and showings
 * still take theirs. The rule must come after the one that hands every
 * view's content the press, which would otherwise win.
 */
const at = (css: string, selector: string): number => css.indexOf(`${selector} {`);
const rule = (css: string, selector: string): string | undefined => {
  const from = at(css, selector);
  return from < 0 ? undefined : css.slice(from, css.indexOf("}", from));
};

describe("a district from altitude", () => {
  it("takes a press on its diamond, not on its box's corners", () => {
    for (const scheme of ["light", "dark"] as const) {
      const css = sceneCss(scheme);
      const card = "[data-graview-altitude] [data-graview-view][data-graview-plot] > .graview-kind-card";
      expect(rule(css, card)).toMatch(/pointer-events: none/);
      const diamond = rule(css, "[data-graview-altitude] [data-graview-plot] > .graview-kind-card::before");
      expect(diamond).toMatch(/clip-path: polygon\(50% 0, 100% 50%, 50% 100%, 0 50%\)/);
      expect(diamond).toMatch(/height: calc\(2 \* var\(--graview-center-y, 50%\)\)/);
      expect(diamond).toMatch(/pointer-events: auto/);
      expect(rule(css, "[data-graview-altitude] [data-graview-plot] > .graview-kind-card > .graview-drive-in")).toMatch(/pointer-events: auto/);
      expect(css).toContain('[data-graview-altitude] [data-graview-plot] > .graview-kind-card > .graview-kind-face:not([data-graview-nameplate="none"]),');
      const content = at(css, '[data-graview-stage="gpu"][data-graview-hit="platform"] > [data-graview-view] > [data-graview-natural] > *');
      expect(content).toBeGreaterThan(0);
      expect(at(css, card)).toBeGreaterThan(content);
    }
  });
});
