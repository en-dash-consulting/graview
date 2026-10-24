// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { sam, threatApp, threatSeed } from "../../../../scripts/fixtures/threat-app.js";
import { drawTranscript } from "../../src/headless/draw.js";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../../src/headless/index.js";
import { sayRefusal } from "../../src/headless/judge.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { createLinks, type Arrival } from "../../src/host/links.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { judgeElement } from "../../src/host/open-judge.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { NEVER_DRAWN } from "../../src/open-kit.js";

/*
 * A LINK IN A VIEW'S SVG IS DRAWN AS A LINK (Roadmap f-view-svg-link-not-drawn).
 * Civics Desk drew each amendment on its timeline as an SVG
 * `<a class="dot" data-record aria-label>`; the open kit left SVG's `<a>`
 * out, every dot vanished, and the view was kept with eighteen lines of
 * "not in the open kit". Now an `<a data-record>` or `<a data-place>` in a
 * drawing is a link as an HTML one is — the address the face goes to as
 * its `href`, the keyboard where there is none, followed on a click and on
 * Enter. A view still gives it no `href` of its own: a link out is an HTML
 * `<a href>`, which the host opens with no opener and no referrer, and the
 * refusal says so.
 */
const PHISHING = "threat:phishing";
const SVG = "http://www.w3.org/2000/svg";
const store = () => new Store({ schema: threatApp.schema, mutations: threatApp.mutations ?? [], policy: threatApp.policy!, snapshot: structuredClone(threatSeed) as never }) as unknown as Store<AnySchema>;
const hrefOf = (to: Arrival) => ("record" in to ? `/a/watch/threats/${encodeURIComponent(to.record)}` : undefined);

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `s${(ids += 1)}`, type: 1, element: name, attributes, children });
const timeline = (dot: Record<string, string>) =>
  element("svg", { viewBox: "0 0 100 20", role: "group", "aria-label": "Threats, by when they came" }, [element("a", { id: "dot", class: "dot", "data-record": PHISHING, "aria-label": "Invoice phishing", ...dot }, [element("circle", { cx: "10", cy: "10", r: "4" })])]);

function region(withAddresses = true) {
  const s = store();
  const went: Arrival[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const links = createLinks({ sees: (id) => s.seenBy(sam).graph.has(id), places: () => [], schema: s.schema, onNavigate: (to) => went.push(to), ...(withAddresses ? { hrefOf } : {}) });
  const drawing = createOpenDrawing(shadow, {
    origin: "https://app.example",
    send: () => {},
    decorate: (made) => {
      if (made.hasAttribute("data-record")) links.link(made);
    },
    before: (event, at, root) => void links.pressed(event, at, root),
  });
  drawing.apply([[0, "~", timeline({}), 0]]);
  links.refresh(shadow);
  return { dot: shadow.getElementById("dot")!, went, drawing };
}

describe("an <a> in a view's SVG", () => {
  it("is in the open kit, and drawn in SVG's namespace", () => {
    expect(judgeElement("a", "svg")).toEqual({ namespace: "svg", name: "a" });
    expect(NEVER_DRAWN.svg as readonly string[]).not.toContain("a");
    const { dot } = region();
    expect(dot.namespaceURI).toBe(SVG);
    expect(dot.querySelector("circle")).not.toBeNull();
  });

  it("bound to a record, carries the address the face goes to as its href, as an HTML one does", () => {
    const { dot } = region();
    expect(dot.getAttribute("href")).toBe("/a/watch/threats/threat%3Aphishing");
    expect(dot.hasAttribute("data-graview-link")).toBe(true);
  });

  it("where the face has no addresses, is a link by its role and takes the keyboard", () => {
    const { dot } = region(false);
    expect(dot.hasAttribute("href")).toBe(false);
    expect(dot.getAttribute("role")).toBe("link");
    expect(dot.getAttribute("tabindex")).toBe("0");
  });

  it("is followed in the app on a click and on Enter", () => {
    const { dot, went } = region(false);
    dot.querySelector("circle")!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));
    dot.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, composed: true, cancelable: true }));
    expect(went).toEqual([{ record: PHISHING }, { record: PHISHING }]);
  });

  it("takes no href of the view's, and the refusal says where a link out is drawn", () => {
    const drawn = drawTranscript([[[0, "~", timeline({ href: "https://elsewhere.example/" }), 0]]], [], { maxNodes: 100, link: (value) => value });
    expect(drawn.refused).toEqual([{ reason: "attribute", element: "a", name: "href" }]);
    expect(sayRefusal(drawn.refused[0]!).says).toMatch(/a link out is an HTML <a href>/);
  });

  it("run headless as Graview Cloud runs a view, is drawn with no problem and said as a link to the record", async () => {
    const source = `graview.onProps(() => graview.render('<svg viewBox="0 0 100 20" role="group" aria-label="Threats"><a data-record="${PHISHING}" aria-label="Invoice phishing"><circle cx="10" cy="10" r="4"/></a></svg>'));`;
    const manifest = { name: "timeline", attach: "threat", cardinality: "many" } as unknown as WorkerViewManifest;
    const result = (await runWorkerViewHeadless({ manifest, source, store: store(), principal: sam, run: nodeIsolate(), audit: true })) as HeadlessDescribed;
    expect(result.ok).toBe(true);
    expect(result.description.problems).toEqual([]);
    expect(result.description.text).toContain("Invoice phishing");
    expect(result.audit?.problems).toEqual([]);
  });
});
