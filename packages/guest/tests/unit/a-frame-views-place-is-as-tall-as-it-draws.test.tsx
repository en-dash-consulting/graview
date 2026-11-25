// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { mountGuestView, type GuestFrame } from "../../src/host/frame.js";
import { guestView } from "../../src/host/react.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A FRAME VIEW'S PLACE IS AS TALL AS IT DRAWS (Graview HQ
 * f-frame-view-autosize-short-on-desk). A frame view of many at
 * `/places/<slug>` asked for all of its height and was given it, and its
 * place still drew it in a frame most of the window tall (`min(72vh,
 * 760px)`) that scrolled inside itself: at 390 wide a model of about 750px
 * fit, at 900 wide its foot was cut at about 760px, and nothing was said.
 * Its place now flows with the page, as a worker view's does, unless it
 * says `flows: false`. And a height past `limits.maxHeight`, which was
 * clamped unsaid, is said. That the frame fits what it draws at 390, 900
 * and 1280 in Chromium, WebKit and Firefox, and after a resize, is
 * `guest-sandbox --transport=client`.
 */
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never }) as unknown as Store<AnySchema>;
const registry = (flows?: boolean) => {
  const views = registerDefaultViews(offersApp.schema as AnySchema, createViews(offersApp.schema as AnySchema));
  views.register("package", { cardinality: "many", fidelity: "full" }, guestView({ url: "https://views.example/model.html", name: "model", title: "The model", ...(flows === undefined ? {} : { flows }) }), { title: "The model" });
  return views;
};

const lensOf = async (flows?: boolean) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: registry(flows) as never, principal: lin }} initialPath="/places/the-model" />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const lens = host.querySelector<HTMLElement>('[data-testid="place-lens"]');
  const seen = lens ? { flows: lens.hasAttribute("data-flows"), height: lens.style.height, overflow: lens.style.overflow } : null;
  await act(async () => root.unmount());
  host.remove();
  return seen;
};

describe("a frame view's place", () => {
  it("flows with the page, with no height of its own and nothing that scrolls inside it", async () => {
    expect(await lensOf()).toEqual({ flows: true, height: "", overflow: "" });
  });

  it("keeps the place's frame where the view says flows: false, for a fixed canvas", async () => {
    expect(await lensOf(false)).toEqual({ flows: false, height: "min(72vh, 760px)", overflow: "auto" });
  });
});

describe("a frame that asks to be taller than it may be", () => {
  let frame: GuestFrame | undefined;
  afterEach(() => {
    frame?.dispose();
    frame = undefined;
  });

  it("is given the most it may be, and that is said once, with its code", async () => {
    const said: [string, unknown][] = [];
    const element = document.createElement("div");
    document.body.appendChild(element);
    frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "long", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }), limits: { maxHeight: 2_000 }, onProblem: (words, problem) => said.push([words, problem]) });
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: frame.iframe.contentWindow }));
    const [hello, , [port]] = posted.mock.calls.at(-1) as unknown as [HostHello, string, MessagePort[]];
    port!.start();
    const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
    port!.postMessage({ type: "size", nonce: hello.nonce, height: 1_500 });
    await tick();
    expect(said, "within the most: nothing said").toEqual([]);
    port!.postMessage({ type: "size", nonce: hello.nonce, height: 2_600 });
    await tick();
    port!.postMessage({ type: "size", nonce: hello.nonce, height: 3_100 });
    await tick();
    expect(frame.iframe.style.height).toBe("2000px");
    expect(said).toEqual([['The view "long" asked to be 2600px tall, more than the 2000px it may be here, so it is 2000px tall and what it drew below that is cut off.', { code: "taller-than-allowed" }]]);
    expect(frame.iframe.hasAttribute("data-guest-view-held"), "not the growth guard's hold").toBe(false);
  });
});
