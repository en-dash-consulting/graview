// @vitest-environment jsdom
import { Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { createLinks, type Arrival } from "../../src/host/links.js";
import { createOpenDrawing, REGION_CSS } from "../../src/host/open-draw.js";

/**
 * A CARD BOUND TO A RECORD OPENS ON A PRESS, NOT ONLY AN `<a>` (0.1.45).
 * Graview Cloud's Threat Watch drew its home as cards — `<div class="card"
 * data-record="threat:…">` with a heading, badges and a line inside — and
 * the describer listed them as record cards, yet a press on one opened
 * nothing, and on a phone a tap on its heading did nothing at all. Now any
 * element with `data-record` or `data-place` is a link the host follows on
 * a click, a tap (which a phone makes a click) or Enter, from wherever
 * inside it the press lands — unless it lands on a press of its own (a
 * button bound to an act), or the element is a press scope (a fieldset, a
 * form holding a field to type into). This drives the host's own wiring as
 * `mountWorkerView` does: the drawing, the links, and the links looked at
 * again after each batch. On a phone, in Chromium and WebKit:
 * `guest-sandbox --transport=taps`.
 */
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
const places = [{ as: "the-packages", title: "The packages", kind: "package" }];

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `c${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `c${(ids += 1)}`, type: 3, data });

function region() {
  const shelf = store();
  const went: Arrival[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  /* The face around the view: a press the host followed never reaches it. */
  const face: string[] = [];
  host.addEventListener("click", () => face.push("click"));
  const shadow = host.attachShadow({ mode: "open" });
  const links = createLinks({ sees: (id) => shelf.seenBy(lin).graph.has(id), places: () => places, onNavigate: (to) => went.push(to) });
  const told: string[] = [];
  const drawing = createOpenDrawing(shadow, {
    origin: "null",
    send: (message) => told.push(message.event),
    decorate: (made) => {
      if (made.hasAttribute("data-record") || made.hasAttribute("data-place")) links.link(made);
    },
    onAttribute: (made, name) => {
      if (name === "data-record" || name === "data-place") links.link(made);
    },
    before: (event, at, root) => void links.pressed(event, at, root),
  });
  drawing.apply([
    [
      0,
      "~",
      element("div", { class: "home" }, [
        element("div", { id: "card", class: "card", "data-record": "offer:coaching" }, [
          element("h3", { id: "heading" }, [text("Team coaching")]),
          element("span", { id: "badge", class: "badge" }, [text("High")]),
          element("p", {}, [element("strong", { id: "deep" }, [text("Seen twice this week")])]),
          element("button", { id: "dismiss", "data-act": "recommend" }, [text("Recommend")]),
        ]),
        element("ul", {}, [element("li", { id: "row", "data-record": "offer:strategy" }, [text("Strategy day")])]),
        element("section", { id: "place", "data-place": "the-packages" }, [element("h2", { id: "place-heading" }, [text("All the packages")])]),
        element("fieldset", { id: "form", "data-record": "offer:coaching" }, [element("input", { id: "note", name: "note" }), element("button", { "data-act": "set-summary" }, [text("Say it")])]),
        element("div", { id: "holds", "data-record": "offer:coaching" }, [element("input", { id: "words", name: "summary" })]),
        element("div", { id: "ticks", "data-record": "offer:strategy" }, [element("input", { id: "tick", type: "checkbox", name: "done" }), text("Done")]),
        element("div", { id: "hidden", "data-record": "offer:margin" }, [text("The margin")]),
      ]),
      0,
    ],
  ]);
  /* As the host does after every batch: what a card holds is known only once it is drawn whole. */
  links.refresh(shadow);
  const at = (id: string) => shadow.getElementById(id)!;
  const click = (id: string) => at(id).dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));
  const enter = (id: string) => at(id).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true, cancelable: true }));
  return { at, click, enter, went, face, told };
}

describe("a card bound to a record", () => {
  it("is a link the host made: focusable, a link to assistive technology, and drawn as something to press", () => {
    const { at } = region();
    expect(at("card").hasAttribute("data-graview-link")).toBe(true);
    expect(at("card").getAttribute("role")).toBe("link");
    expect(at("card").getAttribute("tabindex")).toBe("0");
    expect(at("place").getAttribute("role")).toBe("link");
    // A list's item keeps its own meaning: a link, and still the list's item.
    expect(at("row").hasAttribute("data-graview-link")).toBe(true);
    expect(at("row").getAttribute("role")).toBeNull();
    expect(at("row").getAttribute("tabindex")).toBe("0");
    // A pointer, no double-tap zoom, a faint flash under the finger: what makes iOS take a tap on it for a click.
    expect(REGION_CSS).toMatch(/\[data-graview-link\][^{]*\{ cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: [^;]+; \}/);
  });

  it("opens on a press anywhere inside it — its heading, a badge, a line nested deeper — and the face around it never hears the press", () => {
    const { click, went, face, told } = region();
    for (const id of ["heading", "badge", "deep", "card"]) click(id);
    click("row");
    click("place-heading");
    expect(went).toEqual([{ record: "offer:coaching" }, { record: "offer:coaching" }, { record: "offer:coaching" }, { record: "offer:coaching" }, { record: "offer:strategy" }, { place: "the-packages" }]);
    expect(face).toEqual([]);
    // The view still hears the click, as it hears any.
    expect(told.filter((one) => one === "click")).toHaveLength(6);
  });

  it("opens on Enter, as a link does", () => {
    const { enter, went } = region();
    enter("card");
    enter("row");
    expect(went).toEqual([{ record: "offer:coaching" }, { record: "offer:strategy" }]);
  });

  it("leaves a press of its own to itself: a button bound to an act inside the card, a checkbox inside a row", () => {
    const { click, went } = region();
    click("dismiss");
    click("tick");
    expect(went).toEqual([]);
    // A tap beside the checkbox is a tap on the row.
    click("ticks");
    expect(went).toEqual([{ record: "offer:strategy" }]);
  });

  it("is no link when it is a press scope: a fieldset an act is done to, or a card holding a field to type into", () => {
    const { at, click, went } = region();
    for (const id of ["form", "holds"]) {
      expect(at(id).hasAttribute("data-graview-link"), id).toBe(false);
      expect(at(id).getAttribute("role"), id).toBeNull();
      expect(at(id).getAttribute("tabindex"), id).toBeNull();
    }
    for (const id of ["form", "note", "holds", "words"]) click(id);
    expect(went).toEqual([]);
  });

  it("goes nowhere for a record the viewer may not see, as an <a> does", () => {
    const { click, went } = region();
    click("hidden");
    expect(went).toEqual([]);
  });
});
