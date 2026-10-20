import { describe, expect, it } from "vitest";
import { afterFirstDraw, firstDrawn, placeDrawn, placeWatched } from "../../src/lazy-part.js";

/*
 * AN EARLY FETCH WAITS FOR THE FIRST DRAW (FR-194). The acts' pane fetched
 * when the page was idle, a date's editor and the other face were asked
 * for while the place was still drawing, on a phone's network beside the
 * parts the place waited for. Where an embed watches its place settle,
 * they wait until it has; where nothing watches, they go at once.
 */
describe("an early fetch", () => {
  it("goes at once where nothing watches a place settle", () => {
    expect(firstDrawn()).toBe(true);
    let ran = 0;
    afterFirstDraw(() => (ran += 1));
    expect(ran).toBe(1);
  });

  it("waits, once a place is watched, until it has first drawn, and one forgotten never goes", () => {
    placeWatched();
    expect(firstDrawn()).toBe(false);
    const ran: string[] = [];
    afterFirstDraw(() => ran.push("pane"));
    const forget = afterFirstDraw(() => ran.push("forgotten"));
    afterFirstDraw(() => ran.push("editor"));
    forget();
    expect(ran).toEqual([]);
    placeDrawn();
    expect(ran).toEqual(["pane", "editor"]);
    expect(firstDrawn()).toBe(true);
    // After the first draw, at once; a place drawn again runs nothing twice.
    afterFirstDraw(() => ran.push("later"));
    placeDrawn();
    expect(ran).toEqual(["pane", "editor", "later"]);
  });
});
