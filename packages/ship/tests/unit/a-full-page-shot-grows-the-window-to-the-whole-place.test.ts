import { describe, expect, it } from "vitest";
import { OVERFLOW_PAST_THE_WINDOW, TALLEST_SHOT, wholePlace } from "../../src/shots.js";

/** A page whose place scrolls inside its box: `hidden` is what each measure says is still past the window's foot. */
function pageHiding(...hidden: number[]) {
  const sizes: { width: number; height: number }[] = [];
  const page = {
    async evaluate<T>(fn: string): Promise<T> {
      if (fn === OVERFLOW_PAST_THE_WINDOW) return (hidden.shift() ?? 0) as T;
      return undefined as T;
    },
    async setViewportSize(size: { width: number; height: number }) {
      sizes.push(size);
    },
  };
  return { page, sizes };
}

describe("a full-page shot grows the window to the whole place", () => {
  it("grows the window by what the place's scroller hides, so the picture is the whole place", async () => {
    const { page, sizes } = pageHiding(508, 0);
    expect(await wholePlace(page, 1280, 900)).toBe(1408);
    expect(sizes).toEqual([{ width: 1280, height: 1408 }]);
  });

  it("measures again when the place drew more once it had the room", async () => {
    const { page, sizes } = pageHiding(400, 300, 0);
    expect(await wholePlace(page, 390, 844)).toBe(1544);
    expect(sizes).toEqual([
      { width: 390, height: 1244 },
      { width: 390, height: 1544 },
    ]);
  });

  it("leaves a place that fits the window at the window", async () => {
    const { page, sizes } = pageHiding(0);
    expect(await wholePlace(page, 1280, 900)).toBe(900);
    expect(sizes).toEqual([]);
  });

  it("stops at the tallest picture a browser takes", async () => {
    const { page, sizes } = pageHiding(50_000, 50_000);
    expect(await wholePlace(page, 1280, 900)).toBe(TALLEST_SHOT);
    expect(sizes).toEqual([{ width: 1280, height: TALLEST_SHOT }]);
  });
});
