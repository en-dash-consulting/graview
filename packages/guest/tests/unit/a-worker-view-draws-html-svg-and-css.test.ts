// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createGuestHost } from "../../src/host/session.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom, UNSEEN } from "./showroom.js";

/**
 * A WORKER VIEW ON THE OPEN KIT (FR-90), joined to a real host over a real
 * MessageChannel: the view's runtime (`@graview/guest/worker/view`) — Remote DOM's
 * polyfill and the `graview` global — with the worker's global stood in for
 * by this process's, and the host's region by a shadow root in a JSDOM
 * document. The view draws HTML, SVG and one stylesheet; the host draws
 * what the open kit allows of them, and tells the view what the viewer did.
 * That it holds in a real worker, in Chromium, WebKit and Firefox, and that
 * nothing it tries reaches the network, is `guest-sandbox --transport=open`.
 */

const toOwner: unknown[] = [];
const hearing = new Set<(event: MessageEvent) => void>();
Object.assign(globalThis, {
  addEventListener: (_: string, listener: (event: MessageEvent) => void) => hearing.add(listener),
  removeEventListener: (_: string, listener: (event: MessageEvent) => void) => hearing.delete(listener),
  postMessage: (message: unknown) => toOwner.push(message),
});
const { graview } = await import("../../src/worker/view.js");

const settle = async (times = 6) => {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const dom = new JSDOM("<!doctype html><main></main>");
const region = dom.window.document.querySelector("main")!;
const shadow = region.attachShadow({ mode: "open" });
const store = showroom();
const channel = new MessageChannel();
const nonce = "f00d";
const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: (message) => channel.port1.postMessage(message) });
const sent: unknown[] = [];
const pushed: number[] = [];
const session = createGuestHost({
  store,
  principal: bethan,
  view: "grid",
  nonce,
  send: (message) => {
    sent.push(structuredClone(message));
    channel.port1.postMessage(message);
  },
  onRender: (records) => drawing.apply(records),
  onStyle: (css) => drawing.style(css),
  onPushed: (push) => pushed.push(push),
  input: () => ({ nodes: store.graph.allNodes().map(({ id }) => ({ id })) }),
});
channel.port1.onmessage = (event) => session.receive(event.data);

/* The view, as a person writes one: no imports, one global. */
const clicked: string[] = [];
const typed: string[] = [];
graview.style(`
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 8px; }
.card { background: var(--graview-panel); border: 1px solid var(--graview-edge); border-radius: 10px; padding: 8px; }
.card:hover { background: url(https://attacker.example/hover.png); }
@import url(https://attacker.example/import.css);
.ring { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }`);
graview.on("click", ".card", (event) => clicked.push(event.element.getAttribute("data-key")!));
graview.on("input", "input", (event) => typed.push(event.value ?? ""));
graview.onProps((props) => {
  const nodes = props.nodes ?? [];
  graview.render(graview.html`
    <section class="grid">${nodes.map((node) => graview.html`<article class="card" data-key="${node.id}"><h3>${node.label}</h3></article>`)}</section>
    <svg viewBox="0 0 100 20" role="img" aria-label="Bars">
      <defs><linearGradient id="g"><stop offset="0" stop-color="var(--graview-accent)"/></linearGradient></defs>
      ${nodes.map((node, index) => graview.html`<rect x="${index * 20}" width="15" height="${10 + index}" fill="url(#g)"><title>${node.label}</title></rect>`)}
      <image href="https://attacker.example/svg.png" width="10" height="10"/>
    </svg>
    <input name="q" placeholder="Filter">
    <script>fetch("https://attacker.example/script")</script>`);
});

afterAll(() => {
  channel.port1.close();
  session.dispose();
  drawing.dispose();
});

describe("a worker view on the open kit", () => {
  it("says ready to the worker's owner, as any worker guest does", () => {
    expect(toOwner).toEqual([{ graview: "guest-ready", protocol: GUEST_PROTOCOL }]);
  });

  it("draws a styled card grid and an SVG chart in the host's shadow root", async () => {
    const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce, view: "grid" };
    for (const heard of hearing) heard({ data: hello, ports: [channel.port2] } as unknown as MessageEvent);
    session.push();
    await settle();
    const cards = [...shadow.querySelectorAll("article.card")].map((card) => [card.getAttribute("data-key"), card.textContent]);
    expect(cards).toEqual([
      ["car:golf", "Golf"],
      ["shopper:bethan", "Bethan Okonkwo"],
    ]);
    const svg = shadow.querySelector("svg")!;
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 20");
    expect([...svg.querySelectorAll("rect")].map((rect) => rect.getAttribute("fill"))).toEqual(['url("#g")', 'url("#g")']);
    expect(svg.querySelector("linearGradient")?.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("drew none of what could fetch: the script, the SVG image, the stylesheet's url and @import", () => {
    expect(shadow.querySelector("script")).toBeNull();
    expect(shadow.querySelector("image")).toBeNull();
    expect(drawing.css).not.toMatch(/attacker|@import|url\(/);
    expect(drawing.css).toContain("@keyframes spin");
    expect(drawing.css).toContain("grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr))");
    const reasons = drawing.refused.map((one) => `${one.reason}:${"element" in one ? one.element : ""}${"css" in one && one.css ? one.css.reason : ""}`);
    expect(reasons).toEqual(expect.arrayContaining(["element:image", "element:script", "css:url", "css:at-rule"]));
  });

  it("told its author at once what the host would not draw, from the same allowlist", () => {
    expect(graview.refused).toEqual(expect.arrayContaining(["<image>", "<script>"]));
  });

  it("was handed nothing the viewer may not see", () => {
    const wire = JSON.stringify(sent) + shadow.innerHTML;
    expect(UNSEEN.filter((word) => wire.includes(word))).toEqual([]);
    expect(wire).not.toContain("sk-session");
  });

  it("hears the viewer's click on what it drew, by its own element", async () => {
    shadow.querySelector('article[data-key="car:golf"] h3')!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }));
    await settle();
    expect(clicked).toEqual(["car:golf"]);
  });

  it("hears what the viewer typed, as the host read it, and keeps the field across a push", async () => {
    const field = shadow.querySelector("input")!;
    field.value = "Gol";
    field.dispatchEvent(new dom.window.Event("input", { bubbles: true, composed: true }));
    await settle();
    expect(typed).toEqual(["Gol"]);
    session.push();
    await settle();
    expect(shadow.querySelector("input")).toBe(field);
    expect(field.value).toBe("Gol");
  });

  it("says when it has drawn each push", async () => {
    await settle();
    expect(pushed.length).toBeGreaterThanOrEqual(2);
  });

  it("draws a record's words as words, however they are written", async () => {
    const label = '<img src="https://attacker.example/x" onerror="fetch(1)">';
    store.apply({ name: "ask", args: { shopperId: "shopper:bethan", label } }, { author: bethan });
    await settle(10);
    expect(shadow.querySelector("img")).toBeNull();
    expect([...shadow.querySelectorAll("article h3")].map((one) => one.textContent)).toContain(label);
  });
});
