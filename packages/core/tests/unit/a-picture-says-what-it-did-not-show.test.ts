// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { MEASURE_PICTURED_PAGE, picturedCoverage, type PageMeasure } from "../../src/revisions.js";

/*
 * A PICTURE SAYS WHAT IT DID NOT SHOW (Roadmap f-revisions-say-what-broke).
 * A picture of the first screen of a taller page looks whole: Homeflow's
 * "This week" lost its style below it and nothing said so. Measured as it
 * is pictured, a page says how much the picture held and names each
 * section wholly outside it.
 */
const home: PageMeasure = {
  height: 5_100,
  top: 0,
  window: 900,
  sections: [
    { name: "Good evening", as: "heading", top: 40, bottom: 90 },
    { name: "Today", as: "section", top: 120, bottom: 860 },
    { name: "This week", as: "section", top: 880, bottom: 2_400 },
    { name: "Dinner", as: "section", top: 2_450, bottom: 3_200 },
    { name: "navigation", as: "nav", top: 4_900, bottom: 5_100 },
  ],
};

describe("a picture of part of a page", () => {
  it("says it is the first screen only and names the sections below it", () => {
    const coverage = picturedCoverage(home);
    expect(coverage.whole).toBe(false);
    expect(coverage.pictured).toEqual({ top: 0, bottom: 900 });
    expect(coverage.below.map((one) => one.name)).toEqual(["Dinner", "navigation"]);
    expect(coverage.said).toBe("First screen only (900 of 5,100px); not shown: Dinner, navigation.");
  });

  it("counts a section begun in the picture as shown", () => {
    expect(picturedCoverage(home).below.map((one) => one.name)).not.toContain("This week");
    expect(picturedCoverage(home, { top: 0, height: 800 }).below.map((one) => one.name)).toEqual(["This week", "Dinner", "navigation"]);
  });

  it("names what is above a picture scrolled down, and what is below it", () => {
    const coverage = picturedCoverage(home, { top: 2_400, height: 900 });
    expect(coverage.above.map((one) => one.name)).toEqual(["Good evening", "Today", "This week"]);
    expect(coverage.said).toBe("Only 2,400–3,300 of 5,100px; not shown: above it, Good evening, Today, This week; below it, navigation.");
  });

  it("says a picture of the whole page is whole", () => {
    const coverage = picturedCoverage(home, { top: 0, height: 5_100 });
    expect(coverage).toMatchObject({ whole: true, above: [], below: [], said: "The whole page is pictured (5,100px)." });
  });
});

describe("the page measured as it is pictured", () => {
  it("finds what scrolls, and each section on it by its heading or its name, a worker view's in its shadow root among them", () => {
    const dom = new JSDOM(
      `<!doctype html><body><div data-embed-content style="overflow-y:auto">
        <h1>Good evening</h1>
        <section aria-labelledby="wk"><h2 id="wk">This week</h2></section>
        <div id="view"></div>
        <nav><a href="/">Home</a></nav>
      </div></body>`,
      { pretendToBeVisual: true, runScripts: "outside-only" },
    );
    const { window } = dom;
    const view = window.document.getElementById("view")!;
    view.attachShadow({ mode: "open" }).innerHTML = `<div data-graview-as="aside"><h3>Dinner</h3></div>`;
    /* jsdom lays nothing out: each element's box, by what it holds. */
    const tops: Record<string, number> = { H1: 20, SECTION: 900, H2: 900, H3: 2_000, NAV: 3_000 };
    window.HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const top = this.hasAttribute("data-embed-content") ? 0 : this.getAttribute("data-graview-as") === "aside" ? 1_990 : (tops[this.tagName] ?? 0);
      return { top, bottom: top + 100, height: 100, width: 300, left: 0, right: 300, x: 0, y: top, toJSON() {} } as DOMRect;
    };
    const content = window.document.querySelector<HTMLElement>("[data-embed-content]")!;
    Object.defineProperty(content, "scrollHeight", { value: 4_000 });
    Object.defineProperty(content, "clientHeight", { value: 900 });
    Object.defineProperty(window, "innerHeight", { value: 900 });
    const measure = window.eval(MEASURE_PICTURED_PAGE) as PageMeasure;
    expect(measure.height).toBe(4_000);
    expect(measure.window).toBe(900);
    expect(measure.sections.map(({ name, as, top }) => ({ name, as, top }))).toEqual([
      { name: "Good evening", as: "heading", top: 20 },
      { name: "This week", as: "section", top: 900 },
      { name: "Dinner", as: "aside", top: 1_990 },
      { name: "navigation", as: "nav", top: 3_000 },
    ]);
    expect(picturedCoverage(measure).said).toBe("First screen only (900 of 4,000px); not shown: This week, Dinner, navigation.");
  });
});
