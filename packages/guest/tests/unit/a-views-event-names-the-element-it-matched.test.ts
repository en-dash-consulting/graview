// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createGuestHost } from "../../src/host/session.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A VIEW'S EVENT NAMES THE ELEMENT IT MATCHED. `graview.on(type, selector,
 * listener)` hands the listener `event.element`, the element the selector
 * matched at or above what was pressed, so a delegated handler reads that
 * element's `data-*` rather than walking up from `event.target`. A worker's
 * elements are Remote DOM's polyfill, which has no `closest` or `matches`:
 * a view that reaches for one is told the way that works, by name, and not
 * that undefined is not a function. And what the host says went nowhere —
 * a link to no record and no place — the runtime says in the view's console.
 */

const hearing = new Set<(event: MessageEvent) => void>();
Object.assign(globalThis, {
  addEventListener: (_: string, listener: (event: MessageEvent) => void) => hearing.add(listener),
  removeEventListener: (_: string, listener: (event: MessageEvent) => void) => hearing.delete(listener),
  postMessage: () => {},
});
const { graview } = await import("../../src/worker/view.js");

const settle = async (times = 6) => {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const dom = new JSDOM("<!doctype html><main></main>");
const shadow = dom.window.document.querySelector("main")!.attachShadow({ mode: "open" });
const store = showroom();
const channel = new MessageChannel();
const nonce = "e1e";
const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: (message) => channel.port1.postMessage(message) });
const session = createGuestHost({
  store,
  principal: bethan,
  view: "cards",
  nonce,
  send: (message) => channel.port1.postMessage(message),
  onRender: (records) => drawing.apply(records),
  input: () => ({ nodes: store.graph.allNodes().map(({ id }) => ({ id })) }),
});
channel.port1.onmessage = (event) => session.receive(event.data);

/* The view: a delegated handler on each card's button, which holds a label inside it. */
const opened: { readonly id: string | null; readonly target: string; readonly element: string }[] = [];
const said: string[] = [];
graview.on("click", "button", (event) => {
  opened.push({ id: event.element.getAttribute("data-id"), target: event.target.localName, element: event.element.localName });
  for (const reach of [() => (event.target as Element).closest("button"), () => (event.target as Element).matches("button"), () => (event.element as HTMLElement).dataset]) {
    try {
      reach();
    } catch (error) {
      said.push((error as Error).message);
    }
  }
});
graview.onProps((props) => {
  graview.render(graview.html`${(props.nodes ?? []).map((node) => graview.html`<article><button type="button" data-id="${node.id}"><span>${node.label}</span></button></article>`)}`);
});

afterAll(() => {
  channel.port1.close();
  session.dispose();
  drawing.dispose();
});

describe("a view's event", () => {
  it("names the element its selector matched, so a delegated handler reads that element's data-*", async () => {
    const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce, view: "cards" };
    for (const heard of hearing) heard({ data: hello, ports: [channel.port2] } as unknown as MessageEvent);
    session.push();
    await settle();
    shadow.querySelector('button[data-id="car:golf"] span')!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, composed: true }));
    await settle();
    expect(opened).toEqual([{ id: "car:golf", target: "span", element: "button" }]);
  });

  it("says, when a view reaches for a DOM method the worker's elements lack, that event.element is the way", () => {
    expect(said).toHaveLength(3);
    for (const [index, name] of ["closest", "matches", "dataset"].entries()) {
      expect(said[index]).toBe(
        `A view's element has no ${name}: graview.on hands event.element, the element its selector matched; read event.element.getAttribute("data-…").`,
      );
    }
  });

  it("says in the view's console what the host says went nowhere", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    channel.port1.postMessage({ type: "notice", text: '"projections" is no place of this app: it goes nowhere.' });
    await settle();
    expect(warn).toHaveBeenCalledWith('"projections" is no place of this app: it goes nowhere.');
    warn.mockRestore();
  });
});
