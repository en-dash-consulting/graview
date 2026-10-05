// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createKitRenderer, type KitRefusal } from "../../src/host/kit.js";
import { GUEST_KIT, KIT_HOST_ATTRIBUTES, KIT_HOST_EVENTS, KIT_HOST_TAGS, type Kit, type KitComponent } from "../../src/kit.js";

/**
 * THE HOST DRAWS ONLY THE KIT (FR-69). A worker guest says what to draw as
 * Remote DOM mutation records, and nothing stops a hostile one writing any
 * record it likes. So every case is written here as a raw record, for
 * every component the kit declares — a component added to the kit is held
 * to all of it with nothing written here.
 */
const INSERT = 0;
const UPDATE = 3;
const PROPERTY = 1;
const ATTRIBUTE = 2;
const LISTENER = 3;

let ids = 0;
const element = (name: string, more: Record<string, unknown> = {}) => ({ id: `n${(ids += 1)}`, type: 1, element: name, children: [], ...more });
const text = (data: string) => ({ id: `n${(ids += 1)}`, type: 3, data });

function drawn(kit: Kit = GUEST_KIT) {
  const into = document.createElement("div");
  const raised: { listener: number; detail?: string }[] = [];
  const renderer = createKitRenderer(into, { kit, onEvent: (listener, detail) => raised.push({ listener, ...(detail !== undefined ? { detail } : {}) }) });
  return { into, renderer, raised };
}

/** A value of the declared type, for a property that must be accepted. */
const goodValue = (component: KitComponent, name: string): unknown => {
  const type = component.properties[name]!.type;
  if (type === "number") return 3;
  if (type === "boolean") return true;
  if (type === "url") return "https://example.org/recipe";
  if (typeof type === "object") return type.oneOf[0];
  return "words";
};

/** Where a component may be put: the root holds anything. */
const holder = (into: HTMLElement) => into;
const refusedAs = (refused: readonly KitRefusal[], reason: KitRefusal["reason"]) => refused.filter((one) => one.reason === reason);

/** The attributes a host element has that no guest chose. */
const FIXED = new Set(["data-gv", "class", "rel", "target", "referrerpolicy", "type"]);
const chosen = (node: Element) => [...node.attributes].map((one) => one.name).filter((name) => !FIXED.has(name));

const NOT_IN_THE_KIT = ["script", "iframe", "img", "object", "embed", "a", "form", "style", "link", "div", "svg", "gv-evil", "graview-root"];
const NOT_HTTPS = ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<script>alert(1)</script>", "http://example.org/", "blob:https://example.org/0a6c", "/relative/path", "relative", "//example.org/protocol-relative", "vbscript:msgbox", "file:///etc/passwd", "https:", "ftp://example.org/"];

describe("the kit, as the host draws it", () => {
  for (const [name, component] of Object.entries(GUEST_KIT) as [string, KitComponent][]) {
    describe(name, () => {
      it("is drawn, with every property it declares, as the host element it names", () => {
        const { into, renderer } = drawn();
        const properties = Object.fromEntries(Object.keys(component.properties).map((key) => [key, goodValue(component, key)]));
        renderer.apply([[INSERT, "~", element(name, { properties }), 0]]);
        const node = holder(into).firstElementChild!;
        expect(node.tagName.toLowerCase()).toBe(component.host);
        expect(node.getAttribute("data-gv")).toBe(name.slice(3));
        expect(renderer.refused).toEqual([]);
        expect(chosen(node).length).toBe(Object.keys(component.properties).length);
      });

      it("(a) refuses a property it does not declare, on the way in and as an update", () => {
        const { into, renderer } = drawn();
        const all: Record<string, unknown> = { onclick: "alert(1)", style: "position:fixed", src: "https://example.org/x.png", href: "https://example.org/", srcdoc: "<script>", undeclared: "x" };
        const strays = Object.fromEntries(Object.entries(all).filter(([key]) => !Object.hasOwn(component.properties, key)));
        renderer.apply([[INSERT, "~", element(name, { id: "it", properties: JSON.parse(`{"__proto__": {"polluted": true}, ${JSON.stringify(strays).slice(1)}`) }), 0]]);
        renderer.apply([[UPDATE, "it", "onmouseover", "alert(1)", PROPERTY], [UPDATE, "it", "constructor", "x", PROPERTY]]);
        const node = into.firstElementChild!;
        expect(chosen(node)).toEqual([]);
        const named = refusedAs(renderer.refused, "property").map((one) => one.name);
        for (const key of [...Object.keys(strays), "__proto__"]) expect(named).toContain(key);
        expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
        expect(named).toEqual(expect.arrayContaining(["onmouseover", "constructor"]));
        expect(refusedAs(renderer.refused, "property").every((one) => one.element === name)).toBe(true);
      });

      it("(a) refuses a raw attribute: a kit component has properties, never attributes", () => {
        const { into, renderer } = drawn();
        renderer.apply([[INSERT, "~", element(name, { id: "it", attributes: { onclick: "alert(1)", class: "evil" } }), 0]]);
        renderer.apply([[UPDATE, "it", "onfocus", "alert(1)", ATTRIBUTE]]);
        expect(chosen(into.firstElementChild!)).toEqual([]);
        expect(into.firstElementChild!.className).toBe(`graview-guest-${name.slice(3)}`);
        expect(refusedAs(renderer.refused, "attribute").map((one) => one.name)).toEqual(["onclick", "class", "onfocus"]);
      });

      it("(a) refuses a declared property given a value of another type", () => {
        const { into, renderer } = drawn();
        renderer.apply([[INSERT, "~", element(name, { id: "it" }), 0]]);
        for (const [key, property] of Object.entries(component.properties)) {
          const wrong = property.type === "number" ? "3" : property.type === "boolean" ? "true" : typeof property.type === "object" ? "not-one-of-them" : 3;
          renderer.apply([[UPDATE, "it", key, wrong, PROPERTY], [UPDATE, "it", key, { toString: "x" }, PROPERTY]]);
        }
        expect(chosen(into.firstElementChild!)).toEqual([]);
        expect(renderer.refused.length).toBe(Object.keys(component.properties).length * 2);
        expect(renderer.refused.every((one) => one.reason === "value" || one.reason === "url")).toBe(true);
      });

      it("(b) refuses an event it does not declare, and raises nothing for it", () => {
        const { into, renderer, raised } = drawn();
        const strays = { click: { listener: 1 }, focus: { listener: 2 }, undeclared: { listener: 3 } };
        renderer.apply([[INSERT, "~", element(name, { id: "it", eventListeners: strays }), 0]]);
        renderer.apply([[UPDATE, "it", "keydown", { listener: 4 }, LISTENER]]);
        const node = into.firstElementChild as HTMLElement;
        for (const type of [...KIT_HOST_EVENTS, "focus", "keydown"]) node.dispatchEvent(new Event(type, { bubbles: true }));
        expect(raised).toEqual([]);
        expect(refusedAs(renderer.refused, "event").map((one) => one.name)).toEqual(["click", "focus", "undeclared", "keydown"]);
      });

      it("(b) raises an event it declares, from the DOM event the kit names, with only the declared detail", () => {
        const { into, renderer, raised } = drawn();
        const listeners = Object.fromEntries(Object.keys(component.events).map((event, index) => [event, { listener: index + 10 }]));
        renderer.apply([[INSERT, "~", element(name, { eventListeners: listeners }), 0]]);
        const node = into.firstElementChild as HTMLElement;
        for (const event of Object.values(component.events)) node.dispatchEvent(new Event(event.from, { bubbles: true }));
        expect(raised.map((one) => one.listener)).toEqual(Object.keys(component.events).map((_, index) => index + 10));
        expect(renderer.refused).toEqual([]);
      });

      it("(c) refuses an element outside the kit put in it, and draws nothing of it or under it", () => {
        const { into, renderer } = drawn();
        renderer.apply([[INSERT, "~", element(name, { id: "it" }), 0]]);
        NOT_IN_THE_KIT.forEach((stray, index) => {
          const child = element(stray, { properties: { src: "https://example.org/x" }, attributes: { src: "https://example.org/x" }, children: [text("inside")] });
          renderer.apply([[INSERT, component.children === "any" ? "it" : "~", child, index]]);
        });
        expect(into.querySelectorAll("*").length).toBe(1);
        expect(into.innerHTML).not.toContain("inside");
        expect(refusedAs(renderer.refused, "element").map((one) => one.element)).toEqual(NOT_IN_THE_KIT);
      });

      it("(c) holds only the children it may: words, kit elements, or nothing", () => {
        const { into, renderer } = drawn();
        renderer.apply([[INSERT, "~", element(name, { id: "it" }), 0]]);
        renderer.apply([[INSERT, "it", text("words"), 0], [INSERT, "it", element("gv-text"), 1]]);
        const node = into.firstElementChild!;
        expect(node.textContent).toBe(component.children === "none" ? "" : "words");
        expect(node.children.length).toBe(component.children === "any" ? 1 : 0);
        expect(refusedAs(renderer.refused, "child").length).toBe(component.children === "any" ? 0 : component.children === "text" ? 1 : 2);
      });

      it("(d) refuses a url that is not absolute https:, and no other property of it is ever a link", () => {
        const urls = Object.entries(component.properties).filter(([, property]) => property.type === "url");
        const strings = Object.entries(component.properties).filter(([, property]) => property.type === "string");
        const { into, renderer } = drawn();
        renderer.apply([[INSERT, "~", element(name, { id: "it" }), 0]]);
        for (const [key] of [...urls, ...strings]) for (const bad of NOT_HTTPS) renderer.apply([[UPDATE, "it", key, bad, PROPERTY]]);
        const node = into.firstElementChild!;
        expect(node.hasAttribute("href")).toBe(false);
        expect(refusedAs(renderer.refused, "url").length).toBe(urls.length * NOT_HTTPS.length);
        for (const [key] of urls) {
          renderer.apply([[UPDATE, "it", key, "https://example.org/a?b#c", PROPERTY]]);
          expect(node.getAttribute("href")).toBe("https://example.org/a?b#c");
          // A bad one after a good one takes the good one away rather than leaving it standing.
          renderer.apply([[UPDATE, "it", key, "javascript:alert(1)", PROPERTY]]);
          expect(node.hasAttribute("href")).toBe(false);
        }
      });
    });
  }

  it("declares nothing the host would draw as a handler, a style, a source or a frame", () => {
    for (const [name, component] of Object.entries(GUEST_KIT) as [string, KitComponent][]) {
      expect(name).toMatch(/^gv-[a-z]+$/);
      expect(KIT_HOST_TAGS).toContain(component.host);
      for (const property of Object.values(component.properties)) {
        if (property.as !== undefined) expect(KIT_HOST_ATTRIBUTES).toContain(property.as);
        if (property.type === "url") expect(property.as).toBeUndefined();
      }
      for (const event of Object.values(component.events)) expect(KIT_HOST_EVENTS).toContain(event.from);
    }
  });

  it("refuses a kit, not only a guest, that names a host attribute or element outside the closed lists", () => {
    const { into, renderer } = drawn({ "gv-evil": { host: "iframe" as never, properties: { onclick: { type: "string", as: "onload" as never } }, events: {}, children: "any" } });
    renderer.apply([[INSERT, "~", element("gv-evil", { properties: { onclick: "alert(1)" } }), 0]]);
    expect(into.querySelector("iframe")).toBeNull();
    expect(into.innerHTML).not.toContain("onload");
  });

  it("refuses a record it does not know, and a node it was never sent", () => {
    const { into, renderer } = drawn();
    renderer.apply([[9, "~"], [UPDATE, "nobody", "tone", "good", PROPERTY], "not a record", [INSERT, "~", { id: 7, type: 1, element: "gv-card" }, 0]]);
    renderer.apply("not a list");
    expect(into.childElementCount).toBe(0);
    expect(refusedAs(renderer.refused, "record").length).toBe(5);
  });
});
