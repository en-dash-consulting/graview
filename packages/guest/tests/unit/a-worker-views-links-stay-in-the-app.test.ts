// @vitest-environment jsdom
import { Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { createLinks, type Arrival } from "../../src/host/links.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createGuestHost } from "../../src/host/session.js";

/**
 * LINKS STAY IN THE APP (FR-93). A worker view links to a record or a named
 * place of this app, and nowhere else: `<a href="https://…">` is drawn as
 * text, `<a data-record>` and `<a data-place>` are made links by the host
 * and followed by it, and only to a record the viewer may see or a place
 * the app has — from a press, from Enter, or from the view's code. That a
 * followed link lands on the record or the place on both faces is
 * `guest-sandbox --transport=place`.
 */
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
const places = [{ as: "the-packages", title: "The packages", kind: "package" }];

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `l${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `l${(ids += 1)}`, type: 3, data });

function region() {
  const shelf = store();
  const went: Arrival[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const lost: string[] = [];
  const links = createLinks({ sees: (id) => shelf.seenBy(lin).graph.has(id), places: () => places, onNavigate: (to) => went.push(to), onLost: (said) => lost.push(said) });
  const drawing = createOpenDrawing(shadow, {
    origin: "null",
    send: () => {},
    decorate: (made) => {
      if (made.localName === "a") links.link(made);
    },
    onAttribute: (made, name) => {
      if (made.localName === "a" && (name === "data-record" || name === "data-place")) links.link(made);
    },
    before: (event, at, root) => {
      const anchor = at.closest("a[data-graview-link]");
      if (anchor && root.contains(anchor) && (event.type === "click" || (event.type === "keydown" && (event as KeyboardEvent).key === "Enter"))) links.follow(anchor);
    },
  });
  drawing.apply([
    [
      0,
      "~",
      element("nav", {}, [
        element("a", { id: "record", "data-record": "offer:coaching" }, [text("Team coaching")]),
        element("a", { id: "place", "data-place": "the-packages" }, [text("All the packages")]),
        element("a", { id: "out", href: "https://attacker.example/out" }, [text("Somewhere else")]),
        element("a", { id: "hidden", "data-record": "offer:margin" }, [text("The margin")]),
        element("a", { id: "nowhere", "data-place": "the-secrets" }, [text("No such place")]),
      ]),
      0,
    ],
  ]);
  const at = (id: string) => shadow.getElementById(id)!;
  return { shelf, went, lost, at, links };
}

describe("a worker view's links", () => {
  it("draws a link to an address as text: no href, no role, nothing to follow", () => {
    const { at, went } = region();
    const out = at("out");
    expect(out.hasAttribute("href")).toBe(false);
    expect(out.getAttribute("role")).toBeNull();
    expect(out.textContent).toBe("Somewhere else");
    out.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(went).toEqual([]);
  });

  it("makes a link to a record or a place of the app a link: focusable, and one to assistive technology", () => {
    const { at } = region();
    for (const id of ["record", "place"]) {
      expect(at(id).getAttribute("role")).toBe("link");
      expect(at(id).getAttribute("tabindex")).toBe("0");
      expect(at(id).hasAttribute("href")).toBe(false);
    }
  });

  it("follows it to the record, and to the place, by a press or by Enter", () => {
    const { at, went } = region();
    at("record").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    at("place").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true }));
    expect(went).toEqual([{ record: "offer:coaching" }, { place: "the-packages" }]);
  });

  it("goes nowhere for a record the viewer may not see, or a place the app does not have", () => {
    const { at, went, lost } = region();
    at("hidden").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    at("nowhere").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(went).toEqual([]);
    // And says why, naming the places there are: a link that goes nowhere is not silent.
    expect(lost).toEqual([
      '"offer:margin" is no record this viewer may see and is no place of this app: it goes nowhere. Its places: "the-packages".',
      'The place "the-secrets" is no place of this app: it goes nowhere. Its places: "the-packages".',
    ]);
  });

  it("holds the view's code to the same: a place by its slug, a record by its id, nothing else", () => {
    const shelf = store();
    const went: Arrival[] = [];
    const links = createLinks({ sees: (id) => shelf.seenBy(lin).graph.has(id), places: () => places, onNavigate: (to) => went.push(to) });
    const host = createGuestHost({
      store: shelf,
      principal: lin,
      view: "packages",
      nonce: "n",
      send: () => {},
      onNavigate: (record) => void links.go({ record }),
      onNavigatePlace: (place) => void links.go({ place }),
      places: () => places.map((place) => place.as),
    });
    for (const asked of [{ to: "offer:strategy" }, { place: "the-packages" }, { to: "offer:margin" }, { place: "https://attacker.example" }, { to: "https://attacker.example" }]) host.receive({ type: "navigate", nonce: "n", ...asked });
    expect(went).toEqual([{ record: "offer:strategy" }, { place: "the-packages" }]);
    expect(host.stats.dropped).toBe(3);
    // The worker view's host hands every navigate to the links, as `mountWorkerView` does, so one that goes nowhere says why.
    const lost: string[] = [];
    const judged = createLinks({ sees: (id) => shelf.seenBy(lin).graph.has(id), places: () => places, onLost: (said) => lost.push(said) });
    for (const to of [{ record: "offer:margin" }, { place: "https://attacker.example" }, { record: "https://attacker.example" }]) expect(judged.go(to)).toBe(false);
    expect(lost).toHaveLength(3);
    for (const said of lost) expect(said).toMatch(/: it goes nowhere\. Its places: "the-packages"\.$/);
  });

  it("takes a bare string that is no record but is a place's slug to that place, and a record before a place of the same name", () => {
    const shelf = store();
    const went: Arrival[] = [];
    const lost: string[] = [];
    const links = createLinks({
      sees: (id) => shelf.seenBy(lin).graph.has(id),
      places: () => [...places, { as: "offer:strategy", title: "Strategy", kind: "package" }],
      onNavigate: (to) => went.push(to),
      onLost: (said) => lost.push(said),
    });
    // graview.navigate("the-packages"): no record has that id, and a place has that slug.
    expect(links.go({ record: "the-packages" })).toBe(true);
    // A record the viewer may see comes first, though a place shares its name.
    expect(links.go({ record: "offer:strategy" })).toBe(true);
    expect(went).toEqual([{ place: "the-packages" }, { record: "offer:strategy" }]);
    expect(lost).toEqual([]);
  });

  it("says so when the app has no places at all", () => {
    const lost: string[] = [];
    createLinks({ sees: () => false, places: () => [], onLost: (said) => lost.push(said) }).go({ record: "projections" });
    expect(lost).toEqual(['"projections" is no record this viewer may see and is no place of this app: it goes nowhere. Its places: none.']);
  });
});
