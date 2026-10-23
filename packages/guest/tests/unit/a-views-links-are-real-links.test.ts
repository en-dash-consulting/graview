// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it, vi } from "vitest";
import { sam, threatApp, threatSeed } from "../../../../scripts/fixtures/threat-app.js";
import { createLinks, type Arrival } from "../../src/host/links.js";
import { createOpenDrawing, REGION_CSS, ringReach } from "../../src/host/open-draw.js";
import { createPressReader, markPresses } from "../../src/host/press.js";

/**
 * A VIEW'S LINKS ARE REAL LINKS, AND ITS BUTTONS PLAIN ONES (0.1.47).
 * Threat Watch's links were followed on a press but were no links to the
 * browser: no address on hover, nothing in a new tab on Cmd-click, nothing
 * to copy — and a view that drew a real `<button>` had the browser's gray
 * box to undo, so it drew a `<div>` instead. Now an `<a data-record>` or
 * `<a data-place>` carries the address the face goes to as its `href`,
 * which the view never writes; a plain click, a tap and Enter are followed
 * in the app, and a press with Ctrl, Cmd or Shift, or a middle click, is
 * the browser's. A `<button data-record>` goes where it says as an `<a>`
 * does; a button bound to an act is that act's press, its `data-record`
 * the act's record. A button and a link the host made are reset to the
 * words around them at no specificity, so a view's own class always wins.
 * In three engines: `guest-sandbox --transport=taps`.
 */
const store = () => new Store({ schema: threatApp.schema, mutations: threatApp.mutations ?? [], policy: threatApp.policy!, snapshot: structuredClone(threatSeed) as never }) as unknown as Store<AnySchema>;
const PHISHING = "threat:phishing";
const VPN = "threat:vpn";
const places = [{ as: "the-watch", title: "The watch", kind: "threat" }];
/* The routed face's addresses, under the app's base, as the face writes them (GoTo.href). */
const hrefOf = (to: Arrival) => ("record" in to ? `/a/watch/threats/${encodeURIComponent(to.record)}` : "place" in to ? `/a/watch/places/${to.place}` : `/a/watch/${to.list}`);

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `l${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `l${(ids += 1)}`, type: 3, data });

function region(withAddresses = true) {
  const s = store();
  const went: Arrival[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const face: string[] = [];
  host.addEventListener("click", () => face.push("click"));
  const shadow = host.attachShadow({ mode: "open" });
  const links = createLinks({ sees: (id) => s.seenBy(sam).graph.has(id), places: () => places, schema: s.schema, onNavigate: (to) => went.push(to), ...(withAddresses ? { hrefOf } : {}) });
  const reader = createPressReader(() => true);
  const pressed: { as: string; record?: string }[] = [];
  const drawing = createOpenDrawing(shadow, {
    origin: "https://app.example",
    send: () => {},
    decorate: (made) => {
      if (made.hasAttribute("data-record") || made.hasAttribute("data-place")) links.link(made);
    },
    before: (event, at, root) => {
      if (links.pressed(event, at, root)) return;
      const press = reader.press(event, at, root);
      if (press) pressed.push({ as: press.as, ...(press.record ? { record: press.record } : {}) });
    },
  });
  drawing.apply([
    [
      0,
      "~",
      element("div", {}, [
        element("a", { id: "link", "data-record": PHISHING }, [element("b", { id: "link-words" }, [text("Invoice phishing")])]),
        element("a", { id: "place", "data-place": "the-watch", "data-filter": "severity:critical" }, [text("Critical only")]),
        element("a", { id: "nowhere", "data-record": "threat:gone" }, [text("Gone")]),
        element("div", { id: "card", "data-record": VPN }, [text("Old VPN appliance")]),
        element("button", { id: "go", "data-record": VPN }, [text("Open the VPN")]),
        element("div", { "data-record": PHISHING }, [element("button", { id: "ack", "data-act": "acknowledge" }, [text("Acknowledge")])]),
        element("button", { id: "ack-vpn", "data-act": "acknowledge", "data-record": VPN }, [text("Acknowledge the VPN")]),
      ]),
      0,
    ],
  ]);
  links.refresh(shadow);
  markPresses(shadow);
  const at = (id: string) => shadow.getElementById(id)!;
  const click = (id: string, init: MouseEventInit = {}) => {
    const event = new MouseEvent("click", { bubbles: true, composed: true, cancelable: true, ...init });
    at(id).dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { at, click, went, face, pressed, links, shadow };
}

describe("an <a> a view binds to a record or a place", () => {
  it("carries the address the face goes to as its href, in this tab, with no role or tab stop patched on", () => {
    const { at } = region();
    expect(at("link").getAttribute("href")).toBe("/a/watch/threats/threat%3Aphishing");
    expect(at("place").getAttribute("href")).toBe("/a/watch/places/the-watch");
    for (const id of ["link", "place"]) {
      expect(at(id).hasAttribute("role"), id).toBe(false);
      expect(at(id).hasAttribute("tabindex"), id).toBe(false);
      expect(at(id).hasAttribute("target"), id).toBe(false);
    }
  });

  it("is followed in the app on a plain click, and the face around the view does not take it too", () => {
    const { click, went, face } = region();
    expect(click("link-words")).toBe(true);
    expect(went).toEqual([{ record: PHISHING }]);
    expect(face).toEqual([]);
  });

  it("is the browser's on a click with Cmd, Ctrl or Shift, or a middle click: not followed in the app, and not kept from the browser", () => {
    const { click, went, face } = region();
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) expect(click("link", init), JSON.stringify(init)).toBe(false);
    expect(went).toEqual([]);
    expect(face).toEqual([]);
  });

  it("has no address where it goes nowhere, and is a link given the keyboard instead", () => {
    const { at } = region();
    expect(at("nowhere").hasAttribute("href")).toBe(false);
    expect(at("nowhere").getAttribute("role")).toBe("link");
    expect(at("nowhere").getAttribute("tabindex")).toBe("0");
  });

  it("has no address on a face whose places are no addresses (the scene), and is given the keyboard and a link's role", () => {
    const { at } = region(false);
    expect(at("link").hasAttribute("href")).toBe(false);
    expect(at("link").getAttribute("role")).toBe("link");
    expect(at("link").getAttribute("tabindex")).toBe("0");
    expect(at("link").getAttribute("target")).toBe("_blank");
  });

  it("gives its address back when it stops naming a record, as the open kit drew it", () => {
    const { at, links } = region();
    at("link").removeAttribute("data-record");
    links.link(at("link"));
    expect(at("link").hasAttribute("href")).toBe(false);
    expect(at("link").getAttribute("target")).toBe("_blank");
    expect(at("link").hasAttribute("data-graview-link")).toBe(false);
  });
});

describe("a <button> a view binds to a record", () => {
  it("goes there on a click as an <a> does, and keeps the button's own role and tab stop", () => {
    const { at, click, went } = region();
    expect(at("go").hasAttribute("role")).toBe(false);
    expect(at("go").hasAttribute("tabindex")).toBe(false);
    click("go");
    expect(went).toEqual([{ record: VPN }]);
  });

  it("bound to an act as well is the act's press, its data-record the act's record, and goes nowhere", () => {
    const { click, went, pressed } = region();
    click("ack-vpn");
    click("ack");
    expect(pressed).toEqual([
      { as: "acknowledge", record: VPN },
      { as: "acknowledge", record: PHISHING },
    ]);
    expect(went).toEqual([]);
  });
});

describe("the region's own rules", () => {
  it("reset a button to the words around it at no specificity, so a view's class always wins", () => {
    expect(REGION_CSS).toContain(":where([data-graview-view-root]) :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; text-align: inherit; appearance: none; cursor: pointer; }");
  });

  it("reset a link the host made the same way, and say only a link out opens a new tab", () => {
    expect(REGION_CSS).toContain(":where([data-graview-view-root]) :where(a[data-graview-link]) { color: inherit; text-decoration: none; }");
    expect(REGION_CSS).toMatch(/a\[href\]:not\(\[data-graview-link\]\)::after/);
  });

  it("let a ring at the region's edge paint whole while the keyboard is in it, and nothing else past it", () => {
    /*
     * The region clips what the view draws, and cut the ring of a link flush
     * with its edge in half. It lets the ring's reach (2px and its 2px offset)
     * past its edge only while something in it has the keyboard; where the
     * engine has no overflow-clip-margin (WebKit), a control the host finds
     * at the edge as it takes the keyboard draws its ring inside its own
     * edge, after the ring's own rule so it wins. In three engines:
     * `guest-sandbox --transport=taps` ("a focused link flush with the
     * region's left edge shows its whole ring, and so does one the view rings
     * wider").
     */
    expect(REGION_CSS).toMatch(/:host \{[^}]*contain: layout paint style;[^}]*overflow: clip;/);
    expect(REGION_CSS).toContain(":host(:focus-within) { overflow-clip-margin: var(--graview-ring-reach, 4px); }");
    const ring = REGION_CSS.indexOf("[data-graview-view-root] :focus-visible { outline:");
    const inside = REGION_CSS.indexOf("[data-graview-view-root] [data-graview-ring-inside]:focus-visible { outline-offset: calc(-1 * max(2px, var(--graview-focus-width, 2px))) !important; }");
    expect(ring).toBeGreaterThan(0);
    expect(inside).toBeGreaterThan(ring);
  });

  it("let a wider ring than the default past the region's edge by as much as it reaches, and never past 16px", () => {
    /*
     * A view that sets --graview-focus-width or --graview-focus-offset in its
     * own drawing, where the region's rule cannot read them, was clipped at
     * the edge past the default 4px in Chromium and Firefox. The ring is
     * measured as a control takes the keyboard, and the region told its
     * reach. In a browser: `guest-sandbox --transport=taps` ("a focused link
     * flush with the region's left edge shows its whole ring, and so does one
     * the view rings wider").
     */
    const ringed = (outline: string) => {
      const one = document.createElement("a");
      one.style.cssText = outline;
      document.body.append(one);
      return one;
    };
    expect(ringReach(ringed("outline-width: 2px; outline-style: solid; outline-offset: 2px"))).toBe(4);
    expect(ringReach(ringed("outline-width: 6px; outline-style: solid; outline-offset: 4px"))).toBe(10);
    expect(ringReach(ringed("outline-width: 6px; outline-style: solid; outline-offset: -6px"))).toBe(6);
    expect(ringReach(ringed("outline-width: 20px; outline-style: solid; outline-offset: 8px"))).toBe(16);
    const supports = vi.spyOn(CSS, "supports").mockReturnValue(true);
    const chromium = region();
    chromium.at("link").style.cssText = "outline-width: 6px; outline-style: solid; outline-offset: 4px";
    chromium.at("link").dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    expect((chromium.at("link").getRootNode() as ShadowRoot).host.getAttribute("style")).toContain("--graview-ring-reach: 10px");
    supports.mockRestore();
  });

  it("mark a control at the region's edge, as it takes the keyboard, to draw its ring inside, where the engine has no overflow-clip-margin", () => {
    // jsdom lays nothing out, so every control is at the edge; it is asked as WebKit answers.
    const supports = vi.spyOn(CSS, "supports").mockReturnValue(false);
    const webkit = region();
    webkit.at("link").dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    expect(webkit.at("link").hasAttribute("data-graview-ring-inside")).toBe(true);
    supports.mockRestore();
    // Where the region lets the ring past its edge, nothing is marked.
    const chromium = region();
    chromium.at("link").dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    expect(chromium.at("link").hasAttribute("data-graview-ring-inside")).toBe(false);
  });
});

