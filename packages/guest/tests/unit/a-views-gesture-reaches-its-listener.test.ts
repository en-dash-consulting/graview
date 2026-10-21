// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";
import { createGuestGestures } from "../../src/host/gestures.js";
import { createOpenDrawing } from "../../src/host/open-draw.js";
import { createGuestHost } from "../../src/host/session.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import type { ViewEvent } from "../../src/worker/view-global.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A VIEW'S GESTURE REACHES ITS LISTENER (0.1.42), the whole way: the view's
 * runtime says where it listens, the session hands that to the host's
 * gestures, a wheel over what it drew is taken from the page and summed
 * over a frame, and the view's `graview.on("wheel", …)` hears it with its
 * deltas, where the pointer is and the element's size.
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
const nonce = "g1g";
const frames: (() => void)[] = [];
const drawing = createOpenDrawing(shadow, { origin: "https://app.example", send: (message) => channel.port1.postMessage(message) });
const gestures = createGuestGestures(shadow, { root: () => shadow.querySelector("[data-graview-view-root]") ?? undefined, idOf: (one) => drawing.renderer.idOf(one), send: (message) => channel.port1.postMessage(message), frame: (run) => frames.push(run) });
const session = createGuestHost({
  store,
  principal: bethan,
  view: "map",
  nonce,
  send: (message) => channel.port1.postMessage(message),
  onRender: (records) => drawing.apply(records),
  onGestures: (bound) => gestures.bind(bound),
});
channel.port1.onmessage = (event) => session.receive(event.data);

const heard: ViewEvent[] = [];
graview.on("wheel", ".map", (event) => heard.push(event));
graview.onProps(() => graview.render('<svg class="map" viewBox="0 0 800 500"><circle r="30"></circle></svg><p>Elsewhere</p>'));

afterAll(() => {
  channel.port1.close();
  session.dispose();
  gestures.dispose();
  drawing.dispose();
});

describe("a view's wheel", () => {
  it("is heard by its listener with the deltas of the frame summed, where the pointer is and the element's size", async () => {
    const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce, view: "map" };
    for (const hear of hearing) hear({ data: hello, ports: [channel.port2] } as unknown as MessageEvent);
    session.push();
    await settle();
    const wheel = (on: Element, deltaY: number) => {
      const event = new dom.window.WheelEvent("wheel", { bubbles: true, composed: true, cancelable: true, deltaY, clientX: 30, clientY: 20 });
      on.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect([wheel(shadow.querySelector("circle")!, -50), wheel(shadow.querySelector("circle")!, -70)]).toEqual([true, true]);
    expect(wheel(shadow.querySelector("p")!, -50)).toBe(false);
    frames.splice(0).forEach((run) => run());
    await settle();
    expect(heard).toEqual([expect.objectContaining({ type: "wheel", deltaY: -120, deltaX: 0, deltaMode: 0, ctrlKey: false, x: 30, y: 20, width: 0, height: 0 })]);
    expect(heard[0]!.element.localName).toBe("svg");
  });
});
