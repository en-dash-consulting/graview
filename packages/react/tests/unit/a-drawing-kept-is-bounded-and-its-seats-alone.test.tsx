// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createKeptDrawings, KEPT_MS, MOST_KEPT, useOwnKeptDrawings, type KeptDrawings } from "../../src/kept-drawings.js";

/**
 * WHAT A PAGE KEEPS OF THE CUSTOM PAGES A PERSON LEFT (Graview HQ
 * f-custom-pages-do-not-flash): a few, for a while, each taken back only as
 * exactly what it was, and none past the seat, the store or the registry it
 * was drawn under.
 */
const drawing = (...of: unknown[]) => ({ of, dispose: vi.fn() });
afterEach(() => vi.useRealTimers());

describe("drawings kept", () => {
  it("are at most MOST_KEPT, the one left longest ago let go first", () => {
    const kept = createKeptDrawings();
    const all = Array.from({ length: MOST_KEPT + 2 }, () => drawing("v"));
    all.forEach((one, at) => kept.keep(`p${at}`, one));
    expect(all.map((one) => one.dispose.mock.calls.length)).toEqual([1, 1, ...Array<number>(MOST_KEPT).fill(0)]);
    expect(kept.take("p0", ["v"])).toBeUndefined();
    expect(kept.take(`p${MOST_KEPT}`, ["v"])).toBe(all[MOST_KEPT]);
    kept.clear();
  });

  it("are let go of KEPT_MS after their page was left, and not where they were taken back", () => {
    vi.useFakeTimers();
    const kept = createKeptDrawings();
    const left = drawing("v");
    const back = drawing("v");
    kept.keep("left", left);
    kept.keep("back", back);
    expect(kept.take("back", ["v"])).toBe(back);
    vi.advanceTimersByTime(KEPT_MS + 1);
    expect(left.dispose).toHaveBeenCalledTimes(1);
    expect(back.dispose).not.toHaveBeenCalled();
  });

  it("are taken back only as exactly what they were: another seat's, store's or version's is let go of", () => {
    const kept = createKeptDrawings();
    const [view, store, seat] = [{}, {}, { id: "a" }];
    for (const asked of [[{}, store, seat], [view, {}, seat], [view, store, { id: "a" }], [view, store]]) {
      const one = drawing(view, store, seat);
      kept.keep("p", one);
      expect(kept.take("p", asked)).toBeUndefined();
      expect(one.dispose).toHaveBeenCalledTimes(1);
      expect(kept.take("p", [view, store, seat])).toBeUndefined();
    }
  });

  it("are let go of as anything they were drawn under changes, and as the provider goes", async () => {
    let kept!: KeptDrawings;
    function Provider({ under }: { readonly under: readonly unknown[] }) {
      kept = useOwnKeptDrawings(...under);
      return null;
    }
    const root = createRoot(document.createElement("div"));
    const draw = (...under: unknown[]) => act(async () => root.render(<Provider under={under} />));
    await draw("store", "seat", "views", false);
    for (const next of [["store", "another seat", "views", false], ["another store", "another seat", "views", false], ["another store", "another seat", "tidied views", false], ["another store", "another seat", "tidied views", true]]) {
      const one = drawing("v");
      kept.keep("p", one);
      await draw(...next);
      expect(one.dispose).toHaveBeenCalledTimes(1);
    }
    const same = drawing("v");
    kept.keep("p", same);
    await draw("another store", "another seat", "tidied views", true);
    expect(same.dispose).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    expect(same.dispose).toHaveBeenCalledTimes(1);
  });
});
