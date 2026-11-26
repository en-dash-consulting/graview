// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountGuestView, type GuestFrame } from "../../src/host/frame.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A FRAME GUEST LOADED AGAIN IS SAID DRAWN ONLY ONCE IT HAS DRAWN AGAIN
 * (Graview HQ feature:f-frame-guest-mark-after-move). Where a browser has
 * no `moveBefore`, an element moved is taken out of the page and put back,
 * and a frame in it loads its page again from nothing: the one face does
 * that as it takes in the page a frame guest is drawn on. The frame kept
 * `data-guest-view-drawn` from the document before, so a page could be
 * said painted and drawn over a guest that was drawing again. The mark now
 * comes off, and the frame is busy, the moment its document is another,
 * and is said again once the new one has drawn (or, silent, its time is
 * up). jsdom has no `moveBefore`, and loads a frame again as such a
 * browser does: a new window.
 */
const ready = { graview: "guest-ready", protocol: GUEST_PROTOCOL };
let frame: GuestFrame | undefined;
afterEach(() => {
  frame?.dispose();
  frame = undefined;
});

/** A frame drawn in `element`, its guest said ready and its height asked: drawn. */
async function drawnFrame(limits?: { readyMs?: number }) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }), ...(limits ? { limits } : {}) });
  const iframe = frame.iframe;
  const ask = () => {
    const posted = vi.spyOn(iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: ready, origin: "null", source: iframe.contentWindow }));
    const [hello, , [port]] = posted.mock.calls.at(-1) as unknown as [HostHello, string, MessagePort[]];
    port!.start();
    return { hello, port: port! };
  };
  const first = ask();
  first.port.postMessage({ type: "size", nonce: first.hello.nonce, height: 220 });
  await vi.waitFor(() => expect(iframe.hasAttribute("data-guest-view-drawn")).toBe(true));
  return { element, iframe, ask, first };
}

const drawn = (iframe: HTMLIFrameElement) => iframe.hasAttribute("data-guest-view-drawn");
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("a frame guest whose element is moved where the browser cannot move it as it is", () => {
  it("is not said drawn while its page loads again, and is once the new page has drawn", async () => {
    const { element, iframe, ask } = await drawnFrame();
    expect("moveBefore" in document.body, "a browser without moveBefore").toBe(false);
    const was = iframe.contentWindow;
    // As the one face takes the page in: the element the frame is drawn in, moved into the face's sheet.
    const sheet = document.createElement("section");
    document.body.appendChild(sheet);
    sheet.appendChild(element);
    expect(iframe.contentWindow === was, "a new window: the page loaded again").toBe(false);
    await settle();
    expect(drawn(iframe), "not drawn while its page loads again").toBe(false);
    expect(iframe.getAttribute("aria-busy"), "busy, so a page that says it has drawn waits").toBe("true");
    // The new page says it is ready and is handed what it shows: still drawing.
    const again = ask();
    await settle();
    expect(drawn(iframe)).toBe(false);
    again.port.postMessage({ type: "size", nonce: again.hello.nonce, height: 220 });
    await vi.waitFor(() => expect(drawn(iframe)).toBe(true));
    expect(iframe.hasAttribute("aria-busy")).toBe(false);
  });

  it("says it failed where the page loaded again never says it is ready", async () => {
    const { element, iframe } = await drawnFrame({ readyMs: 120 });
    document.body.appendChild(document.createElement("section")).appendChild(element);
    await settle();
    expect(drawn(iframe)).toBe(false);
    await vi.waitFor(() => expect(iframe.getAttribute("data-guest-view-failed")).toBe("silent"));
    expect(iframe.hasAttribute("aria-busy")).toBe(false);
  });

  it("keeps its mark where its page is not loaded again", async () => {
    const { iframe } = await drawnFrame();
    // The page around it changes; the frame stays where it stood.
    document.body.appendChild(document.createElement("p"));
    await settle();
    expect(drawn(iframe)).toBe(true);
  });
});
