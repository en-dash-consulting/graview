import { describe, expect, it } from "vitest";
import { sceneCss } from "../../src/index.js";

/*
 * A RECORD'S OWN VIEW LEAVES THE RECORD UNDER IT WHOLE (Nick, 2026-10-15,
 * on The Beatles app: `#focus=album:beatles-for-sale`). A view of one
 * record draws the record's own card under it, and that card is a Panel
 * held to its box — so inside the focus frame, itself held to the box, it
 * was held twice: the grid stacking the two gave the card whatever the
 * view left, and "Made by" and the chip under it were cut to a sliver
 * while the frame had room it never used. A panel inside the frame's body
 * is drawn whole; the body is the one thing that scrolls. The page itself
 * is `verify-drawn-once`'s `aRecordsOwnViewLeavesTheRecordUnderItWhole`.
 */
const rule = (css: string, selector: string): string | undefined => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? undefined : css.slice(at, css.indexOf("}", at));
};

describe("the record in focus", () => {
  it("scrolls its body once, and draws a panel inside that body whole", () => {
    for (const scheme of ["light", "dark"] as const) {
      const css = sceneCss(scheme);
      expect(rule(css, "[data-graview-record-focus] > :not(.graview-kind-tag)")).toMatch(/overflow-y: auto/);
      const inner = rule(css, '[data-graview-record-focus] > :not(.graview-kind-tag) [data-graview-primitive="panel"]');
      expect(inner).toMatch(/max-height: none !important/);
      expect(inner).toMatch(/height: auto !important/);
      expect(inner).toMatch(/overflow: visible !important/);
      expect(rule(css, '[data-graview-record-focus] > :not(.graview-kind-tag) [data-graview-primitive="panel"] > .graview-scroll')).toMatch(/overflow: visible/);
    }
  });
});
