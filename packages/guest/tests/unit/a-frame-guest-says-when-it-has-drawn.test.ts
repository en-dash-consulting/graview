// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountGuestView, type GuestFrame } from "../../src/host/frame.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A FRAME GUEST SAYS WHEN IT HAS DRAWN (FR-188). The embed's root wears
 * `data-graview-drawn` once every worker view on the place has drawn or
 * failed; a frame guest was not counted, so a place drawn by one was said
 * drawn while its frame stood empty. The frame now says
 * `data-guest-view-drawn` once the guest has said it is ready, been handed
 * what it shows, and asked for its height (or stayed quiet a moment after,
 * for a guest that never asks one), and `data-guest-view-failed="silent"`
 * when it never says it is ready in `limits.readyMs`; it is `aria-busy`
 * until one or the other, which is what the embed waits for. In a browser:
 * `pnpm verify drawn`.
 */
const ready = { graview: "guest-ready", protocol: GUEST_PROTOCOL };
let frame: GuestFrame | undefined;
afterEach(() => {
  frame?.dispose();
  frame = undefined;
  vi.useRealTimers();
});

function mounted(limits?: { readyMs?: number }) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }), ...(limits ? { limits } : {}) });
  const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
  const sayReady = () => window.dispatchEvent(new MessageEvent("message", { data: ready, origin: "null", source: frame!.iframe.contentWindow }));
  const hello = () => posted.mock.calls.at(-1) as unknown as [HostHello, string, MessagePort[]];
  return { element, iframe: frame.iframe, sayReady, hello };
}

const drawn = (iframe: HTMLIFrameElement) => iframe.hasAttribute("data-guest-view-drawn");
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("a frame guest says when it has drawn", () => {
  it("says it once the guest has been handed what it shows and asked for its height", async () => {
    const { element, iframe, sayReady, hello } = mounted();
    expect(drawn(iframe), "not before it says it is ready").toBe(false);
    // Busy until it has drawn, as aria-busy says it: the element it is drawn in is not, from the moment the frame is in it.
    expect(iframe.getAttribute("aria-busy")).toBe("true");
    expect(element.hasAttribute("aria-busy")).toBe(false);
    sayReady();
    const [said, , [port]] = hello();
    port!.start();
    expect(drawn(iframe), "not the moment it is handed its props").toBe(false);
    port!.postMessage({ type: "size", nonce: said.nonce, height: 220 });
    await vi.waitFor(() => expect(drawn(iframe)).toBe(true));
    expect(iframe.hasAttribute("data-guest-view-failed")).toBe(false);
    expect(iframe.hasAttribute("aria-busy")).toBe(false);
  });

  it("says it a moment after it was handed its props when the guest never asks for a height", async () => {
    const { iframe, sayReady } = mounted();
    sayReady();
    expect(drawn(iframe)).toBe(false);
    await vi.waitFor(() => expect(drawn(iframe)).toBe(true), { timeout: 2000 });
  });

  it("says it failed when the guest never says it is ready, and drawn if it says so after all", async () => {
    const { iframe, sayReady, hello } = mounted({ readyMs: 150 });
    await wait(60);
    expect(iframe.hasAttribute("data-guest-view-failed")).toBe(false);
    await vi.waitFor(() => expect(iframe.getAttribute("data-guest-view-failed")).toBe("silent"));
    expect(drawn(iframe)).toBe(false);
    expect(iframe.hasAttribute("aria-busy"), "settled: no longer busy").toBe(false);
    sayReady();
    const [said, , [port]] = hello();
    port!.start();
    port!.postMessage({ type: "size", nonce: said.nonce, height: 120 });
    await vi.waitFor(() => expect(drawn(iframe)).toBe(true));
    expect(iframe.hasAttribute("data-guest-view-failed")).toBe(false);
  });
});
