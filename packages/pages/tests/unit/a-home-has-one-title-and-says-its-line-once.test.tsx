// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { fetchDeclaredLenses, fetchHomeView } from "@graview/primitives";
import { beforeAll, describe, expect, it } from "vitest";
import { rendered } from "./the-review.js";

/**
 * A HOME HAS ONE TITLE AND SAYS ITS LINE ONCE. A headline at the top of a
 * column inside a row group was drawn as the page's title, with the app's
 * description repeated under it: two columns, two more titles and two more
 * lines. A nested headline is a section heading, and the line stands under
 * the real title alone.
 */
beforeAll(() => Promise.all([fetchDeclaredLenses(), fetchHomeView()]));

describe("a home has one title and says its line once", () => {
  it("draws its first headline as the page's heading and a nested one as a section's", async () => {
    const { host, done } = await rendered("/");
    const home = host.querySelector('[data-testid="home-view"]')!;
    const headlines = [...home.querySelectorAll(".graview-spec-headline")].map((h) => `${h.tagName.toLowerCase()} ${h.getAttribute("data-level")} ${h.textContent}`);
    expect(headlines).toEqual(["h2 1 The review, at a glance", "h3 2 Where the problems are, by the part of the app", "h3 2 When they are planned, now or later"]);
    await done();
  });

  it("says the app's line once, under the page's heading", async () => {
    const { host, done } = await rendered("/");
    const lines = [...host.querySelectorAll('[data-testid="app-subtitle"]')];
    expect(lines.map((line) => line.textContent)).toEqual(["What a review found, where it is and how bad it is."]);
    expect(lines[0]!.previousElementSibling?.textContent).toBe("The review, at a glance");
    await done();
  });

  it("draws a figure said large as large", async () => {
    const { host, done } = await rendered("/");
    const figures = [...host.querySelectorAll(".graview-spec-number")].map((figure) => [figure.querySelector(".graview-spec-label")?.textContent, figure.getAttribute("data-emphasis")]);
    expect(figures).toEqual([
      ["findings", "large"],
      ["high", null],
      ["now", null],
      ["later", null],
    ]);
    await done();
  });
});
