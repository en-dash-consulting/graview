// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPLASH_ID, splashHtml } from "../../src/splash.js";

/**
 * AN OPENING SCREEN LIFTS WHEN THE PAGE HAS DRAWN. It waited for
 * `data-graview-drawn`, which waits for the one face under the page: on a
 * slow network the page and its view were painted within a second and the
 * screen stood over them until the face came. It lifts on
 * `data-graview-painted` now, and still on the drawn mark alone, which is
 * all a page built before the other says. And it does not lift on the
 * page's own live region (`role="alert"`), which stands empty from the first
 * commit: it lifted there onto a page with nothing on it. In a browser,
 * over the one face held back: `pnpm verify drawn`.
 */
const open = () => {
  document.body.innerHTML = `${splashHtml({ name: "Shelf", splash: { style: "plain" } }, { fade: false }).html}<section data-graview-embed="pages"></section>`;
  // As a host inlines it.
  new Function(splashHtml({ name: "Shelf", splash: { style: "plain" } }, { fade: false }).script)();
  return document.querySelector("section")!;
};
const up = () => document.getElementById(SPLASH_ID) !== null;
const turn = async () => void (await vi.advanceTimersByTimeAsync(10));

beforeEach(() => void vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("the opening screen", () => {
  for (const mark of ["data-graview-painted", "data-graview-drawn"]) {
    it(`lifts on ${mark} alone`, async () => {
      const root = open();
      await turn();
      expect(up()).toBe(true);
      root.setAttribute(mark, "/");
      await turn();
      expect(up()).toBe(false);
    });
  }

  it("stays up over an alert region with nothing said in it, and lifts once it says something", async () => {
    const root = open();
    root.innerHTML = '<div role="alert"></div>';
    await turn();
    expect(up()).toBe(true);
    root.firstElementChild!.textContent = "Shelf did not load.";
    await turn();
    expect(up()).toBe(false);
  });

  it("stays up while the page draws and says neither, and for fifteen seconds at most", async () => {
    const root = open();
    root.innerHTML = '<h1>Shelf</h1><div data-worker-view-place="front" aria-busy="true"></div>';
    await vi.advanceTimersByTimeAsync(14_900);
    expect(up()).toBe(true);
    await vi.advanceTimersByTimeAsync(200);
    expect(up()).toBe(false);
  });
});
