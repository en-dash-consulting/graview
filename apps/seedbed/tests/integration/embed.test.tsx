// @vitest-environment jsdom
import { mount } from "@graview/embed";
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../../src/domain/chapters.js";
import { seedbedPages } from "../../src/ui/pages.js";
import { seedbedViews } from "../../src/ui/views.js";

/**
 * A chapter of the garden, mounted into an element that is not on any page:
 * what the marketing page, the docs and a builder's preview all do. The
 * proof is that the framework needs nothing from the document — no viewport,
 * no address bar, no :root theme — to show a declared app.
 */
// Motion off, as a test is: the scene lands on a view at once rather than
// flying there over 640ms, which is the framework's own reduced-motion path.
window.matchMedia = ((query: string) =>
  ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as never;

describe("a chapter, embedded", () => {
  const chapter = CHAPTERS[10]!; // what grows where: four kinds, two lenses, a policy
  const into = () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    return element;
  };

  it("mounts from altitude, themed within the element, and the districts are there", () => {
    const element = into();
    const handle = mount(element, {
      app: chapter.app,
      seed: chapter.seed,
      face: "graview",
      principal: chapter.principal,
      views: (schema) => seedbedViews(schema as never, { lens: true, board: true }) as never,
    });
    expect(element.querySelectorAll('[data-graview-view^="kind:"]').length).toBe(4);
    const style = element.querySelector("style")?.textContent ?? "";
    expect(style).toContain(".graview-embed-");
    expect(style).not.toContain(":root");
    expect(element.querySelector('[data-testid="embed-face-graview"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(element.querySelector('[data-testid="standing"]')?.textContent).toContain("Everything is in order");
    handle.unmount();
    expect(element.innerHTML).toBe("");
  });

  it("switches faces: down into a district, and over to the pages", () => {
    const element = into();
    const handle = mount(element, { app: chapter.app, seed: chapter.seed, face: "graview", principal: chapter.principal, pages: seedbedPages(chapter.app.schema) });
    handle.setFace("scene");
    // Descended: the ground is no longer at altitude, and the shelf is drawn.
    expect(element.querySelector("[data-graview-altitude]")).toBeNull();
    expect(element.querySelectorAll("[data-graview-view]").length).toBeGreaterThan(0);
    handle.setFace("pages");
    expect(element.querySelector('nav[aria-label="Kinds"]')).not.toBeNull();
    expect(element.textContent).toContain("Plots");
    handle.setStop("#focus=plot-2");
    handle.setFace("scene");
    expect(element.querySelector('[data-graview-view="plot-2"]')).not.toBeNull();
    handle.unmount();
  });

  it("never touches the host page's address or theme", () => {
    const before = window.location.href;
    const element = into();
    const handle = mount(element, { app: chapter.app, seed: chapter.seed, face: "pages", pages: seedbedPages(chapter.app.schema), path: "/plots/plot-2" });
    expect(element.querySelector('[data-testid="plot-page"]')).not.toBeNull();
    expect(window.location.href).toBe(before);
    expect(getComputedStyle(document.documentElement).getPropertyValue("--graview-accent")).toBe("");
    handle.unmount();
  });
});
