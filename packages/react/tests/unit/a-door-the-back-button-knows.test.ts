import { EMPTY_VIEW, withShown, withWithin, withFocus, withSelection } from "@graview/layout";
import { describe, expect, it } from "vitest";
import { adjustment } from "../../src/index.js";

/**
 * A DOOR THE BACK BUTTON DOES NOT KNOW ABOUT IS A TRAP.
 *
 * Every stop in a Graview app is a URL, and `adjustment` is what decides
 * whether a change pushes an entry or merely tidies the one you are on. Two
 * doors were missing from it, and both failed the same quiet way: the
 * address updated, no entry was pushed, the arrows stayed grey, and one
 * Back left the app instead of the door.
 */
const at = { ...EMPTY_VIEW, focusId: "aggregate:shift" };

describe("what counts as travelling", () => {
  it("counts showing a module — the installation is a place you go", () => {
    const shown = withShown(at, "installation", true);
    expect(adjustment(at, shown)).toBe(false);
    expect(adjustment(shown, withShown(shown, "installation", false))).toBe(false);
  });

  it("counts opening the studio, which is a stop like any other", () => {
    const studio = withWithin(at, "studio", "open");
    expect(adjustment(at, studio)).toBe(false);
    expect(adjustment(studio, withWithin(studio, "studio", null))).toBe(false);
  });

  it("counts going somewhere, as it always did", () => {
    expect(adjustment(at, withFocus(at, "aggregate:volunteer"))).toBe(false);
    expect(adjustment(at, { ...at, overview: true })).toBe(false);
  });

  /*
   * And the other half of the rule, which is what keeps Back meaning
   * something: pointing at a thing is an adjustment of where you are
   * standing, not a journey. A run of clicks is not a run of entries.
   */
  it("does not count pointing at something, or arriving", () => {
    expect(adjustment(at, withSelection(at, ["s-mon-open"]))).toBe(true);
    expect(adjustment(null, at)).toBe(false);
  });
});
