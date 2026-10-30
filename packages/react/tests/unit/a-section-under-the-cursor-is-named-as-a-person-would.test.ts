// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sectionsArrive, sectionsWanted, sectionUnderNow, setViewPlace, viewPlaceOf, type ViewPlaceHandle } from "../../src/view-places.js";
import { sectionUnder } from "../../src/view-sections.js";

/*
 * THE SECTION UNDER THE CURSOR (Roadmap f-make-this-section-better): a
 * right-click inside a worker view's shadow root finds the nearest part a
 * person would call a section — marked `data-section`, a landmark (as the
 * host draws one, `data-graview-as`) by its label, what labels it or its
 * heading, else a heading's block — and its name heads the menu.
 */
function view(html: string): { place: HTMLElement; shadow: ShadowRoot } {
  const place = document.createElement("div");
  place.setAttribute("data-worker-view-place", "home");
  const region = document.createElement("div");
  region.setAttribute("data-worker-view", "home");
  place.appendChild(region);
  document.body.appendChild(place);
  const shadow = region.attachShadow({ mode: "open" });
  shadow.innerHTML = `<div data-graview-view-root>${html}</div>`;
  return { place, shadow };
}

describe("the section under the cursor", () => {
  it("is the landmark around it, named by what labels it", () => {
    const { shadow } = view('<div data-graview-as="section" aria-labelledby="wk"><h2 id="wk">This week</h2><div class="day"><h3>Mon</h3><p id="here">Soup</p></div></div>');
    const found = sectionUnder(shadow.getElementById("here"));
    expect(found?.name).toBe("This week");
    expect(found?.view).toBe("home");
    expect(found?.elements[0]?.getAttribute("data-graview-as")).toBe("section");
  });

  it("is what the view marked data-section, before a landmark around it", () => {
    const { shadow } = view('<section aria-label="Outer"><div data-section="Dinner"><b id="here">Soup</b></div></section>');
    expect(sectionUnder(shadow.getElementById("here"))?.name).toBe("Dinner");
  });

  it("is a heading's block where no landmark holds it", () => {
    const { shadow } = view('<h2>Soon</h2><p id="a">x</p><h2>Later</h2><p id="b">y</p>');
    const soon = sectionUnder(shadow.getElementById("a"));
    expect(soon?.name).toBe("Soon");
    expect(soon?.elements.map((element) => element.localName)).toEqual(["h2", "p"]);
    expect(sectionUnder(shadow.getElementById("b"))?.name).toBe("Later");
  });

  it("is nothing outside a worker view", () => {
    const outside = document.createElement("section");
    outside.setAttribute("aria-label", "Page");
    document.body.appendChild(outside);
    expect(sectionUnder(outside)).toBeUndefined();
  });

  it("is found once the finder has arrived, which the first right-click inside a view waits for, and leads to what the view's place lends", async () => {
    const { place, shadow } = view('<section aria-label="Lists"><p id="here">x</p></section>');
    const here = shadow.getElementById("here");
    expect(sectionsWanted(document.body)).toBe(false);
    if (sectionsWanted(here)) await sectionsArrive();
    expect(sectionsWanted(here)).toBe(false);
    expect(sectionUnderNow(here)?.name).toBe("Lists");
    const handle = { name: "home" } as ViewPlaceHandle;
    setViewPlace(place, handle);
    expect(viewPlaceOf(place)).toBe(handle);
    setViewPlace(place, null);
    expect(viewPlaceOf(place)).toBeUndefined();
  });
});
