import { describe, expect, it } from "vitest";
import { EMPTY_VIEW, fromUrl, overviewFragment, overviewStop, toUrl, withFocus, withOverview } from "../../src/view.js";

/**
 * THE OVERVIEW'S ADDRESS MEANS THE OVERVIEW (FR-154).
 *
 * The overview at altitude was `/places/overview#overview=1`, the altitude
 * in the fragment alone. A fragment never reaches a server, so the address
 * back through a sign-in door, a stored link or a bookmark came back bare
 * and opened the overview descended on nothing. The address alone says it
 * now: a fragment that says nothing is at altitude, and the overview at
 * altitude over nothing is written with no fragment at all.
 */
describe("the stop the overview's address holds", () => {
  it("is at altitude over nothing when the fragment says nothing", () => {
    for (const fragment of ["", "#", "#nothing-a-stop-is-made-of=1"]) {
      expect(overviewStop(fragment)).toEqual({ ...EMPTY_VIEW, overview: true });
    }
  });

  it("is what the fragment says when it says where it stands", () => {
    expect(overviewStop("#focus=t1")).toEqual(fromUrl("#focus=t1"));
    expect(overviewStop("#focus=t1").overview).toBeUndefined();
    expect(overviewStop("#overview=1&focus=aggregate%3Atask")).toEqual(fromUrl("#overview=1&focus=aggregate%3Atask"));
    expect(overviewStop("#in.view=the-board").within).toEqual({ view: "the-board" });
  });
});

describe("the fragment the overview's address carries", () => {
  it("is none at altitude over nothing, so a server hands back the same overview", () => {
    const up = withOverview(EMPTY_VIEW, true);
    expect(overviewFragment(up)).toBe("");
    expect(overviewStop(overviewFragment(up))).toEqual(up);
  });

  it("is the stop's own anywhere else, read back as it was written", () => {
    for (const view of [withFocus(EMPTY_VIEW, "t1"), withOverview(withFocus(EMPTY_VIEW, "aggregate:task"), true)]) {
      expect(overviewFragment(view)).toBe(toUrl(view));
      expect(toUrl(overviewStop(overviewFragment(view)))).toBe(toUrl(view));
    }
  });
});
