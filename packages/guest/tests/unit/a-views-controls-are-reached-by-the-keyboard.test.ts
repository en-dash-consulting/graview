// @vitest-environment jsdom
import { Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { createLinks, type Arrival } from "../../src/host/links.js";
import { createOpenDrawing, REGION_CSS } from "../../src/host/open-draw.js";
import { markPresses, quietPictures } from "../../src/host/press.js";

/**
 * A VIEW'S CONTROLS ARE REACHED BY THE KEYBOARD BY DEFAULT (0.1.47).
 * Graview Cloud's Threat Watch was tabbed through: the keyboard reached 6
 * of the home's 92 things a person could click, and none on most views.
 * Now the host gives the keyboard to whatever a person
 * presses there: a row's first cell, a control the view drew itself (a
 * role of button, checkbox, switch or tab, `aria-pressed`, `aria-expanded`),
 * and Enter and Space press it — told to the view as a click, as a button's
 * is, without the page scrolling under Space. Whatever has the keyboard
 * shows a ring a view cannot take away by accident, a picture that says
 * nothing is hidden from assistive technology, and `.graview-sr` says words
 * only to it. In three engines: `guest-sandbox --transport=taps`.
 */
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `k${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `k${(ids += 1)}`, type: 3, data });

function region() {
  const shelf = store();
  const went: Arrival[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const links = createLinks({ sees: (id) => shelf.seenBy(lin).graph.has(id), places: () => [], onNavigate: (to) => went.push(to) });
  /* What the view is told, by the id of the element it drew. */
  const told: string[] = [];
  const drawing = createOpenDrawing(shadow, {
    origin: "null",
    send: (message) => told.push(`${message.event}${message.key ? `:${message.key}` : ""}`),
    before: (event, at, root) => void links.pressed(event, at, root),
  });
  drawing.apply([
    [
      0,
      "~",
      element("div", {}, [
        element("table", {}, [element("tbody", {}, [element("tr", { id: "row", "data-record": "offer:coaching" }, [element("td", { id: "cell" }, [text("Team coaching")]), element("td", {}, [text("High")])])])]),
        element("div", { id: "toggle", role: "button" }, [text("More")]),
        element("span", { id: "pressed", "aria-pressed": "false" }, [text("Bold")]),
        element("span", { id: "expands", "aria-expanded": "false" }, [element("b", { id: "expands-words" }, [text("Show all")])]),
        element("span", { id: "check", role: "checkbox", "aria-checked": "false" }, [text("Done")]),
        element("span", { id: "switch", role: "switch", "aria-checked": "true" }, [text("Live")]),
        element("div", { role: "tablist" }, [element("span", { id: "tab", role: "tab", "aria-selected": "true" }, [text("Developers")]), element("span", { id: "roving", role: "tab", tabindex: "-1" }, [text("Ops")])]),
        element("button", { id: "button", "aria-pressed": "true" }, [text("Pinned")]),
        element("svg", { id: "icon", viewBox: "0 0 10 10" }, [element("circle", { cx: "5", cy: "5", r: "4" })]),
        element("svg", { id: "chart", viewBox: "0 0 10 10", role: "img", "aria-label": "Sales" }, [element("rect", { width: "4", height: "4" })]),
        element("svg", { id: "titled", viewBox: "0 0 10 10" }, [element("title", {}, [text("A ring")]), element("circle", { cx: "5", cy: "5", r: "4" })]),
        element("svg", { id: "holds", viewBox: "0 0 10 10" }, [element("g", { id: "ring", role: "button", "aria-label": "Ring" }, [element("circle", { cx: "5", cy: "5", r: "4" })])]),
        element("span", { id: "hidden-words", class: "graview-sr" }, [text("Three threats")]),
      ]),
      0,
    ],
  ]);
  /* As the host does after every batch (view.ts). */
  links.refresh(shadow);
  markPresses(shadow);
  quietPictures(shadow);
  const at = (id: string) => shadow.getElementById(id)!;
  const key = (id: string, name: string) => {
    const event = new KeyboardEvent("keydown", { key: name, bubbles: true, composed: true, cancelable: true });
    at(id).dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { at, key, went, told, shadow };
}

describe("a table's row bound to a record", () => {
  it("keeps its role, and its first cell takes the keyboard for it", () => {
    const { at } = region();
    expect(at("row").hasAttribute("role")).toBe(false);
    expect(at("row").hasAttribute("tabindex")).toBe(false);
    expect(at("cell").getAttribute("tabindex")).toBe("0");
  });

  it("opens on Enter on its first cell", () => {
    const { key, went } = region();
    expect(key("cell", "Enter")).toBe(true);
    expect(went).toEqual([{ record: "offer:coaching" }]);
  });
});

describe("a control the view drew itself and hears with graview.on(\"click\")", () => {
  it("is given the keyboard where it has none: a role of button, checkbox, switch or tab, aria-pressed, aria-expanded", () => {
    const { at } = region();
    for (const id of ["toggle", "pressed", "expands", "check", "switch", "tab"]) {
      expect(at(id).getAttribute("tabindex"), id).toBe("0");
      expect(at(id).hasAttribute("data-graview-press"), id).toBe(true);
    }
    // A tab the view keeps out of the tab order keeps its own -1; its role is the view's, unchanged.
    expect(at("roving").getAttribute("tabindex")).toBe("-1");
    expect(at("toggle").getAttribute("role")).toBe("button");
    expect(at("pressed").hasAttribute("role")).toBe(false);
  });

  it("is pressed by Enter and by Space, told to the view as the key and then a click, and Space does not scroll the page", () => {
    const { key, told } = region();
    expect(key("toggle", "Enter")).toBe(true);
    expect(key("check", " ")).toBe(true);
    expect(key("tab", " ")).toBe(true);
    expect(told).toEqual(["keydown:Enter", "click", "keydown: ", "click", "keydown: ", "click"]);
  });

  it("is left as it is when it presses of itself: a button that says aria-pressed is a button", () => {
    const { at, key, told } = region();
    expect(at("button").hasAttribute("tabindex")).toBe(false);
    expect(at("button").hasAttribute("data-graview-press")).toBe(false);
    expect(key("button", "Enter")).toBe(false);
    expect(told).toEqual(["keydown:Enter"]);
  });

  it("is not pressed by a key that reaches it from inside, only by one on itself", () => {
    const { key, told } = region();
    expect(key("expands-words", " ")).toBe(false);
    expect(told).toEqual(["keydown: "]);
  });
});

describe("whatever has the keyboard", () => {
  it("shows a whole ring at least 2px wide, set off from it, in the app's accent, that a view's outline: none does not take away", () => {
    const rule = REGION_CSS.split("\n").find((line) => line.includes(":focus-visible"))!;
    expect(rule).toMatch(/outline: max\(2px, var\(--graview-focus-width, 2px\)\) solid var\(--graview-focus-color, var\(--graview-accent, Highlight\)\) !important/);
    expect(rule).toMatch(/outline-offset: var\(--graview-focus-offset, 2px\) !important/);
  });
});

describe("a picture the view drew", () => {
  it("is hidden from assistive technology when it says nothing: no role, no label, no title", () => {
    const { at } = region();
    expect(at("icon").getAttribute("aria-hidden")).toBe("true");
  });

  it("is left to say what it says: a role and a label, a title, or a press inside it", () => {
    const { at } = region();
    for (const id of ["chart", "titled", "holds"]) expect(at(id).hasAttribute("aria-hidden"), id).toBe(false);
    expect(at("ring").getAttribute("tabindex")).toBe("0");
  });
});

describe("words for assistive technology alone", () => {
  it("are a class the host draws as nothing on the page, and a view may use it", () => {
    const rule = REGION_CSS.split("\n").find((line) => line.includes(".graview-sr"))!;
    for (const part of ["position: absolute", "width: 1px", "height: 1px", "overflow: hidden", "clip-path: inset(50%)", "white-space: nowrap"]) expect(rule, part).toContain(part);
    expect(region().at("hidden-words").className).toBe("graview-sr");
  });
});
