import { afterEach, describe, expect, it } from "vitest";
import { loadPins, NO_PINS, savePins, togglePin } from "../../src/pins.js";

/**
 * One gesture, both directions — including over the dev's declared pin,
 * which the person demotes rather than deletes.
 */

afterEach(() => {
  globalThis.localStorage?.clear?.();
});

describe("togglePin", () => {
  it("pins and unpins an ordinary act", () => {
    const pinned = togglePin(NO_PINS, "rename");
    expect(pinned.pinned).toEqual(["rename"]);
    const back = togglePin(pinned, "rename");
    expect(back.pinned).toEqual([]);
    expect(back.unpinned).toEqual([]);
  });

  it("demotes a declared pin instead of doubling it, and restores it the same way", () => {
    const demoted = togglePin(NO_PINS, "finish", true);
    expect(demoted.unpinned).toEqual(["finish"]);
    expect(demoted.pinned).toEqual([]);
    const restored = togglePin(demoted, "finish", true);
    expect(restored.unpinned).toEqual([]);
  });

  it("survives a browser without storage", () => {
    // savePins/loadPins never throw; in this environment localStorage may
    // simply be absent, and the toggle still applies for the visit.
    expect(loadPins()).toEqual(NO_PINS);
    savePins({ pinned: ["a"], unpinned: [] });
    expect(togglePin(NO_PINS, "a").pinned).toEqual(["a"]);
  });

  it("reads the earlier plain-array storage shape as pins", () => {
    if (!globalThis.localStorage) return;
    globalThis.localStorage.setItem("graview:pins", JSON.stringify(["finish", 3]));
    expect(loadPins()).toEqual({ pinned: ["finish"], unpinned: [] });
  });
});
