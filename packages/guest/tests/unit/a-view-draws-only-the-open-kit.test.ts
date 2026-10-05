// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createOpenRenderer } from "../../src/host/open-render.js";
import { HTML_ELEMENTS, NEVER_DRAWN, SVG_ELEMENTS, SVG_NAMESPACE } from "../../src/open-kit.js";

/**
 * A WORKER VIEW DRAWS ONLY THE OPEN KIT (FR-90). A view's runtime says what
 * to draw as Remote DOM mutation records, and nothing stops a hostile one
 * writing any record it likes, so every case here is a raw record: an
 * element, an attribute, a value. What is drawn must hold nothing that could
 * fetch — no `src` but a `data:` or the page's own `blob:` image, no `href`,
 * no `srcset`, no handler, no `<script>`, `<iframe>`, `<link>` or SVG
 * `<image>` — and nothing that leaves the region.
 */
const INSERT = 0;
const UPDATE = 3;
const ATTRIBUTE = 2;
const PROPERTY = 1;
const LISTENER = 3;

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `n${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `n${(ids += 1)}`, type: 3, data });

function draw(...nodes: unknown[]) {
  const into = document.createElement("div");
  const renderer = createOpenRenderer(into, { origin: "https://app.example" });
  renderer.apply(nodes.map((node, index) => [INSERT, "~", node, index]));
  return { into, renderer };
}

/** Every attribute anywhere in what was drawn that could load something. */
function loads(into: Element): string[] {
  const found: string[] = [];
  for (const one of into.querySelectorAll("*")) {
    for (const attribute of Array.from(one.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on")) found.push(`${one.localName} ${name}`);
      if (["href", "xlink:href", "srcset", "action", "formaction", "ping", "poster", "background", "data", "codebase"].includes(name) && !/^#[A-Za-z_]/.test(attribute.value)) found.push(`${one.localName} ${name}=${attribute.value}`);
      if (name === "src" && !/^data:image\/|^blob:https:\/\/app\.example\//.test(attribute.value)) found.push(`${one.localName} src=${attribute.value}`);
      if (/url\(/i.test(attribute.value) && !/url\("#[\w.:-]+"\)/.test(attribute.value)) found.push(`${one.localName} ${name}=${attribute.value}`);
    }
  }
  return found;
}

describe("the elements a view may not draw", () => {
  for (const name of NEVER_DRAWN.html) {
    it(`does not draw <${name}>, nor anything inside it`, () => {
      const { into, renderer } = draw(element(name, { src: "https://attacker.example/x", href: "https://attacker.example/y" }, [text("inside")]));
      expect(into.querySelector(name)).toBeNull();
      expect(into.textContent).not.toContain("inside");
      expect(renderer.refused).toContainEqual(expect.objectContaining({ reason: "element", element: name }));
    });
  }
  for (const name of NEVER_DRAWN.svg) {
    it(`does not draw SVG <${name}>`, () => {
      const { into, renderer } = draw(element("svg", { viewBox: "0 0 10 10" }, [element(name, { href: "https://attacker.example/svg", "xlink:href": "https://attacker.example/xsvg", attributeName: "href", to: "https://attacker.example/smil" })]));
      expect(into.querySelector("svg")!.children).toHaveLength(0);
      expect(loads(into)).toEqual([]);
      expect(renderer.refused).toContainEqual(expect.objectContaining({ reason: "element" }));
    });
  }
  it("does not draw an HTML element inside SVG", () => {
    const { into } = draw(element("svg", {}, [element("div", {}, [text("smuggled")])]));
    expect(into.textContent).toBe("");
  });
  it("does not draw a custom element", () => {
    const { into } = draw(element("x-loader", { src: "https://attacker.example/c" }));
    expect(into.children).toHaveLength(0);
  });
});

describe("the attributes a view may not set", () => {
  const cases: [string, Record<string, string>][] = [
    ["img", { src: "https://attacker.example/img.png" }],
    ["img", { src: "//attacker.example/img.png" }],
    ["img", { src: "/same-origin-path.png" }],
    ["img", { src: "data:text/html,<script>alert(1)</script>" }],
    ["img", { src: "blob:https://attacker.example/0b4f" }],
    ["img", { srcset: "https://attacker.example/a.png 1x" }],
    ["img", { sizes: "100vw", srcset: "x.png 1x" }],
    ["div", { onclick: "fetch('https://attacker.example/handler')" }],
    ["img", { onerror: "fetch('https://attacker.example/onerror')", src: "x" }],
    ["div", { ONMOUSEOVER: "x" }],
    ["a", { href: "https://attacker.example/link" }],
    ["a", { href: "javascript:fetch('https://attacker.example/js')" }],
    ["a", { ping: "https://attacker.example/ping" }],
    ["button", { formaction: "https://attacker.example/form" }],
    ["button", { form: "host-form", type: "submit" }],
    ["input", { type: "image", src: "https://attacker.example/input.png" }],
    ["input", { type: "password" }],
    ["input", { type: "file" }],
    ["input", { autocomplete: "cc-number" }],
    /* A suggestion from a view's list is typed by the browser, trusted: the view's words as the person's. */
    ["input", { list: "hints" }],
    ["div", { style: "background: url(https://attacker.example/inline)" }],
    ["div", { style: "position: fixed; inset: 0" }],
    ["div", { popover: "manual" }],
    ["button", { popovertarget: "x" }],
    ["div", { autofocus: "" }],
    ["div", { accesskey: "s" }],
    ["div", { contenteditable: "true" }],
    ["div", { is: "x-loader" }],
    ["div", { role: "alert" }],
    ["div", { role: "banner" }],
    ["div", { "aria-live": "assertive" }],
    ["div", { tabindex: "5" }],
    ["table", { background: "https://attacker.example/table.png" }],
    ["blockquote", { cite: "https://attacker.example/cite" }],
  ];
  for (const [name, attributes] of cases) {
    it(`<${name} ${Object.entries(attributes).map(([key, value]) => `${key}="${value}"`).join(" ")}> draws none of it`, () => {
      const { into, renderer } = draw(element(name, attributes));
      expect(loads(into)).toEqual([]);
      const drawn = into.firstElementChild;
      if (drawn) {
        for (const key of Object.keys(attributes)) {
          if (key === "type" && attributes[key] === "submit") continue;
          expect([key, drawn.getAttribute(key.toLowerCase())]).not.toEqual([key, attributes[key]]);
        }
      }
      expect(renderer.refused.length).toBeGreaterThan(0);
    });
  }
  it("draws a link with no address: text, until FR-93 makes it a way to a record", () => {
    const { into } = draw(element("a", { href: "https://attacker.example/link" }, [text("Read more")]));
    expect(into.querySelector("a")!.hasAttribute("href")).toBe(false);
    expect(into.textContent).toBe("Read more");
  });
  it("refuses an SVG <use> of another document, and keeps one of its own drawing", () => {
    const { into } = draw(element("svg", {}, [element("use", { href: "https://attacker.example/sprite.svg#a" }), element("use", { "xlink:href": "/sprite.svg#b" }), element("use", { href: "#own" })]));
    const uses = [...into.querySelectorAll("use")].map((one) => one.getAttribute("href"));
    expect(uses).toEqual([null, null, "#own"]);
  });
  it("refuses a paint from another document, and keeps a gradient of its own", () => {
    const { into } = draw(element("svg", {}, [element("rect", { fill: "url(https://attacker.example/p.svg#g)" }), element("rect", { fill: "url(#grad)", stroke: "var(--graview-accent)" })]));
    const rects = [...into.querySelectorAll("rect")];
    expect(rects[0]!.getAttribute("fill")).toBeNull();
    expect(rects[1]!.getAttribute("fill")).toBe('url("#grad")');
    expect(rects[1]!.getAttribute("stroke")).toBe("var(--graview-accent)");
  });
  it("refuses an attribute set later, and takes back what it said before", () => {
    const { into, renderer } = draw(element("img", { src: "data:image/png;base64,AAAA", alt: "dot" }));
    const id = `n${ids}`;
    renderer.apply([[UPDATE, id, "src", "https://attacker.example/later.png", ATTRIBUTE]]);
    expect(into.querySelector("img")!.getAttribute("src")).toBeNull();
    renderer.apply([[UPDATE, id, "onload", "x", ATTRIBUTE], [UPDATE, id, "src", "x", PROPERTY], [UPDATE, id, "load", { listener: 1 }, LISTENER]]);
    expect(loads(into)).toEqual([]);
  });
});

describe("what a view may draw", () => {
  it("draws every HTML element of the kit, as that element", () => {
    const names = Object.keys(HTML_ELEMENTS);
    const { into, renderer } = draw(...names.map((name) => element(name)));
    expect(renderer.refused).toEqual([]);
    expect([...into.children].map((one) => one.localName)).toEqual(names);
  });
  it("draws every SVG element of the kit in SVG's namespace, in its own case, whatever case it was sent in", () => {
    const names = Object.keys(SVG_ELEMENTS).filter((name) => name !== "svg");
    const { into, renderer } = draw(element("svg", { viewbox: "0 0 100 100", preserveaspectratio: "none" }, names.map((name) => element(name.toLowerCase()))));
    expect(renderer.refused).toEqual([]);
    const svg = into.querySelector("svg")!;
    expect(svg.namespaceURI).toBe(SVG_NAMESPACE);
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
    expect([...svg.children].map((one) => [one.localName, one.namespaceURI])).toEqual(names.map((name) => [name, SVG_NAMESPACE]));
  });
  it("draws an image held in the drawing: data:, or a blob: of the page's own", () => {
    const { into } = draw(element("img", { src: "data:image/png;base64,iVBORw0KGgo=", alt: "a dot" }), element("img", { src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>" }), element("img", { src: "blob:https://app.example/7d0c" }));
    expect([...into.querySelectorAll("img")].map((one) => one.getAttribute("src")?.slice(0, 14))).toEqual(["data:image/png", "data:image/svg", "blob:https://a"]);
  });
  it("draws a styled card, with the style written afresh", () => {
    const { into } = draw(element("article", { class: "card", style: "padding: 12px; color: var(--graview-ink)", "data-key": "offer:1", "aria-label": "An offer" }, [element("h3", {}, [text("Coaching")])]));
    const card = into.querySelector("article")!;
    expect(card.getAttribute("style")).toBe("padding: 12px; color: var(--graview-ink)");
    expect(card.getAttribute("data-key")).toBe("offer:1");
    expect(card.getAttribute("aria-label")).toBe("An offer");
  });
  it("draws a field's value live, as well as its attribute", () => {
    const into = document.createElement("div");
    const set: Element[] = [];
    const renderer = createOpenRenderer(into, { origin: "null", onFieldSet: (field) => set.push(field) });
    const input = element("input", { name: "label", value: "first" });
    renderer.apply([[INSERT, "~", input, 0]]);
    const drawn = into.querySelector("input")!;
    expect(drawn.value).toBe("first");
    renderer.apply([[UPDATE, input.id, "value", "second", ATTRIBUTE]]);
    expect(drawn.value).toBe("second");
    expect(set).toContain(drawn);
  });
  it("stops at its budget", () => {
    const into = document.createElement("div");
    let over = 0;
    const renderer = createOpenRenderer(into, { origin: "null", maxNodes: 50, onOverBudget: () => (over += 1) });
    renderer.apply([[INSERT, "~", element("ul", {}, Array.from({ length: 100_000 }, () => element("li"))), 0]]);
    expect(renderer.size).toBe(50);
    expect(over).toBe(1);
  });
});
