// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { sam, threatApp, threatSeed, WATCH_MANIFEST } from "../../../../scripts/fixtures/threat-app.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createOpenDrawing, REGION_CSS } from "../../src/host/open-draw.js";
import { createPressReader, judgePress, markPresses } from "../../src/host/press.js";
import { createGuestHost } from "../../src/host/session.js";
import { judgeCodeAct } from "../../src/host/writes.js";

/**
 * AN ELEMENT BOUND TO AN ACT IS PRESSED AS A BUTTON IS (0.1.45). The guide
 * said "a data-act button", and Graview Cloud's Threat Watch drew
 * `<span role="button" data-act>` inside a fieldset: whether the host
 * honored it was found out only on the page. Now any element with
 * `data-act` is a press — a click, a phone's tap — save what can never be
 * pressed by itself (an option, a label, a field to type into that does not
 * save); one that does not press of itself is given the keyboard, is a
 * button to assistive technology unless it says a role, is drawn as
 * something to press, and Enter or Space on it presses it. This drives the
 * host's wiring as `mountWorkerView` does. On a phone, in Chromium and
 * WebKit: `guest-sandbox --transport=taps`.
 */
const store = () => new Store({ schema: threatApp.schema, mutations: threatApp.mutations ?? [], policy: threatApp.policy!, snapshot: structuredClone(threatSeed) as never }) as unknown as Store<AnySchema>;
const manifest = WATCH_MANIFEST as unknown as WorkerViewManifest;
const PHISHING = "threat:phishing";
const VPN = "threat:vpn";

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `p${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `p${(ids += 1)}`, type: 3, data });

function region() {
  const s = store();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const props = () => workerViewProps(s, sam, { manifest });
  const shown = new Set([PHISHING, VPN]);
  const session = createGuestHost({ store: s, principal: sam, view: manifest.name, nonce: "n", send: () => {}, props, judgeAct: (name, args) => judgeCodeAct(s, manifest, name, args) });
  /* The person's own events are the ones the test marks. */
  const trusted = (event: Event) => (event as Event & { person?: boolean }).person === true;
  const reader = createPressReader(trusted);
  const pressed: string[] = [];
  const drawing = createOpenDrawing(shadow, {
    origin: "null",
    send: () => {},
    onFieldSet: (field) => reader.filled(field),
    before: (event, at, root) => {
      reader.heard(event, at);
      const press = reader.press(event, at, root);
      if (!press) return;
      if (event.type === "keydown") event.preventDefault();
      const outcome = session.pressed(judgePress(s, manifest, shown, press));
      pressed.push(`${press.as}:${outcome.ok ? "ok" : outcome.message}`);
      return { pressed: { as: press.as, ...outcome } };
    },
  });
  drawing.apply([
    [
      0,
      "~",
      element("div", {}, [
        element("fieldset", { "data-record": PHISHING }, [
          element("input", { id: "note", name: "note" }),
          element("span", { id: "save", role: "button", "data-act": "set-note" }, [element("b", { id: "save-words" }, [text("Save the note")])]),
        ]),
        element("div", { id: "ack", "data-act": "acknowledge", "data-record": VPN }, [text("Acknowledge")]),
        element("button", { id: "button", "data-act": "acknowledge", "data-record": PHISHING }, [text("Acknowledge")]),
        element("select", { id: "pick", name: "status", "data-act": "acknowledge", "data-record": PHISHING }, [element("option", { value: "new" }, [text("New")])]),
        element("label", { id: "label", "data-act": "acknowledge", "data-record": PHISHING }, [text("Acknowledge")]),
        element("svg", { viewBox: "0 0 10 10" }, [element("g", { id: "ring", "data-act": "acknowledge", "data-record": VPN }, [element("circle", { cx: "5", cy: "5", r: "4" })])]),
      ]),
      0,
    ],
  ]);
  /* As the host does after every batch. */
  markPresses(shadow);
  const at = (id: string) => shadow.getElementById(id) ?? shadow.querySelector(`[id="${id}"]`)!;
  const person = <E extends Event>(event: E): E => Object.defineProperty(event, "person", { value: true });
  const click = (id: string) => at(id).dispatchEvent(person(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true })));
  const key = (id: string, name: string) => {
    const event = person(new KeyboardEvent("keydown", { key: name, bubbles: true, composed: true, cancelable: true }));
    at(id).dispatchEvent(event);
    return event.defaultPrevented;
  };
  const type = (id: string, words: string) => {
    const field = at(id) as HTMLInputElement;
    field.value = words;
    field.dispatchEvent(person(new Event("input", { bubbles: true, composed: true })));
  };
  const node = (id: string) => s.graph.getNode(id) as unknown as { status: string; note?: string };
  return { at, click, key, type, pressed, node };
}

describe("an element bound to an act", () => {
  it("that does not press of itself is made a press: the keyboard, a button's role unless it says one, and drawn as something to press", () => {
    const { at } = region();
    for (const id of ["save", "ack", "ring"]) {
      expect(at(id).getAttribute("tabindex"), id).toBe("0");
      expect(at(id).getAttribute("role"), id).toBe("button");
      expect(at(id).hasAttribute("data-graview-press"), id).toBe(true);
    }
    // A button presses of itself: left as it is.
    expect(at("button").hasAttribute("tabindex")).toBe(false);
    expect(at("button").hasAttribute("data-graview-press")).toBe(false);
    expect(REGION_CSS).toMatch(/\[data-graview-press\][^{]*\{ cursor: pointer; touch-action: manipulation;/);
  });

  it("is pressed by a click on it or on anything inside it, a <span role=\"button\"> in a fieldset carrying the words typed beside it", () => {
    const { click, type, pressed, node } = region();
    type("note", "Forwarded to the mail team");
    click("save-words");
    expect(pressed).toEqual(["set-note:ok"]);
    expect(node(PHISHING).note).toBe("Forwarded to the mail team");
    click("ring");
    expect(node(VPN).status).toBe("acknowledged");
  });

  it("is pressed by Enter and by Space when it does not press of itself, and Space does not scroll the page", () => {
    const { key, pressed, node } = region();
    expect(key("ack", "Enter")).toBe(true);
    expect(node(VPN).status).toBe("acknowledged");
    expect(key("save", " ")).toBe(true);
    expect(pressed).toEqual(["acknowledge:ok", "set-note:ok"]);
  });

  it("is not pressed twice by a button's own Enter, which clicks it already", () => {
    const { key, pressed } = region();
    expect(key("button", "Enter")).toBe(false);
    expect(pressed).toEqual([]);
  });

  it("is never pressed when it cannot be by itself: a select to pick from, a label that presses its field too", () => {
    const { at, click, key, pressed, node } = region();
    click("pick");
    click("label");
    key("label", "Enter");
    expect(pressed).toEqual([]);
    expect(node(PHISHING).status).toBe("new");
    for (const id of ["pick", "label"]) expect(at(id).hasAttribute("data-graview-press"), id).toBe(false);
  });
});
