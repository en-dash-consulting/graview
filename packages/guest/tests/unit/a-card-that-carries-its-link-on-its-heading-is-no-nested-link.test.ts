// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { sam, threatApp, threatSeed } from "../../../../scripts/fixtures/threat-app.js";
import { auditView, type AuditedNode } from "../../src/audit/index.js";
import { createLinks, type Arrival } from "../../src/host/links.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";

/*
 * A CARD THAT CARRIES ITS LINK ON ITS HEADING IS NO NESTED LINK (Roadmap
 * f-view-card-heading-link-nested). The guide says a card with data-record
 * opens on a press, and to put the `<a>` on its heading; the Eagles app did
 * just that, `<div data-record><h3><a data-record>`, and the audit refused
 * it as a link inside a link, while the same markup on an `<li>` passed.
 * The host made the card a link too — a role and a tab stop around the
 * heading's. Now a card holding an `<a>` to its own record or place takes
 * neither: the `<a>` is the keyboard's way in and the screen reader's link,
 * the card a bigger target for a pointer and a finger, a `<div>` and an
 * `<li>` alike. A real nested control is still found: a card that is the
 * only link around a button, or around a link to somewhere else.
 */
const PHISHING = "threat:phishing";
const VPN = "threat:vpn";
const page = (markup: string) => new JSDOM(`<!doctype html><div data-graview-view-root>${markup}</div>`).window.document.querySelector("[data-graview-view-root]") as unknown as AuditedNode;
const audit = (markup: string) => auditView(page(markup), { host: "pending" });
const card = (tag: string, inner: string) => `<${tag} class="p" data-key="face" data-record="${PHISHING}"><h3>${inner}</h3><p>Forty mailboxes got the fake invoice.</p></${tag}>`;

describe("the audit of a card bound to a record", () => {
  it("passes the guide's card, a link on its heading, on a <div> and on an <li> alike", () => {
    expect(audit(card("div", `<a data-record="${PHISHING}">Invoice phishing</a>`)).problems).toEqual([]);
    expect(audit(`<ul>${card("li", `<a data-record="${PHISHING}">Invoice phishing</a>`)}</ul>`).problems).toEqual([]);
  });

  it("passes it with a control of its own beside the heading", () => {
    expect(audit(`<div data-record="${PHISHING}"><h3><a data-record="${PHISHING}">Invoice phishing</a></h3><button type="button">More</button></div>`).problems).toEqual([]);
  });

  it("still finds a card that is the only link around a button", () => {
    const found = audit(`<div data-key="face" data-record="${PHISHING}"><h3>Invoice phishing</h3><button type="button">More</button></div>`);
    expect(found.problems).toEqual([expect.objectContaining({ rule: "nested-interactive", at: '[data-key="face"]' })]);
    expect(found.problems[0]!.fix).toMatch(/<a> to the card's own record or place on its heading/);
  });

  it("still finds a card around a link to somewhere else", () => {
    const found = audit(card("div", `<a data-record="${VPN}">Old VPN</a>`));
    expect(found.problems.map((one) => one.rule)).toEqual(["nested-interactive"]);
  });
});

describe("a card the host draws that carries its link on its heading", () => {
  const store = () => new Store({ schema: threatApp.schema, mutations: threatApp.mutations ?? [], policy: threatApp.policy!, snapshot: structuredClone(threatSeed) as never }) as unknown as Store<AnySchema>;
  let ids = 0;
  const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `c${(ids += 1)}`, type: 1, element: name, attributes, children });
  const text = (data: string) => ({ id: `c${(ids += 1)}`, type: 3, data });
  function region() {
    const s = store();
    const went: Arrival[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const links = createLinks({ sees: (id) => s.seenBy(sam).graph.has(id), places: () => [], schema: s.schema, onNavigate: (to) => went.push(to) });
    const drawing = createOpenDrawing(shadow, {
      origin: "https://app.example",
      send: () => {},
      decorate: (made) => {
        if (made.hasAttribute("data-record")) links.link(made);
      },
      before: (event, at, root) => void links.pressed(event, at, root),
    });
    const face = (tag: string, id: string) => element(tag, { id, "data-record": PHISHING }, [element("h3", {}, [element("a", { id: `${id}-link`, "data-record": PHISHING }, [text("Invoice phishing")])]), element("p", { id: `${id}-line` }, [text("Forty mailboxes")])]);
    drawing.apply([[0, "~", element("div", {}, [face("div", "div-card"), element("ul", {}, [face("li", "li-card")])]), 0]]);
    links.refresh(shadow);
    return { at: (id: string) => shadow.getElementById(id)!, went };
  }

  it("gives the card no role and no tab stop, a <div> and an <li> alike, and its heading's link the keyboard", () => {
    const { at } = region();
    for (const id of ["div-card", "li-card"]) {
      expect(at(id).hasAttribute("role"), id).toBe(false);
      expect(at(id).hasAttribute("tabindex"), id).toBe(false);
      expect(at(id).hasAttribute("data-graview-link"), id).toBe(true);
      expect(at(`${id}-link`).getAttribute("tabindex"), id).toBe("0");
    }
  });

  it("still opens the record on a press anywhere on the card", () => {
    const { at, went } = region();
    at("div-card-line").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));
    expect(went).toEqual([{ record: PHISHING }]);
  });
});
