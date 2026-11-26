// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { connectGuest, type Guest } from "../../src/guest.js";
import { mountGuestView, type GuestFrame } from "../../src/host/frame.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A FRAME GUEST KEPT OUT OF SIGHT IS TOLD SO, AND ITS OWN MEDIA STOPS
 * (Graview HQ feature:f-kept-frame-told-off-page). A frame its host said may
 * be kept (`keeps: true`) is moved, still running, to a shelf off the page
 * as its page is left, so a video it played went on playing there, heard
 * from a page the person had left. The host now tells it `{ type: "away",
 * away: true }` as it is put on the shelf and `away: false` as it is put
 * back; the client pauses the guest's playing `<video>` and `<audio>` on
 * the first, plays again what it paused on the second, and the guest's own
 * code hears both (`guest.onAway`), for a sound of its own making.
 */
const ready = { graview: "guest-ready", protocol: GUEST_PROTOCOL };
let frame: GuestFrame | undefined;
let guest: Guest | undefined;
const moves = Element.prototype as Element & { moveBefore?: (node: Node, child: Node | null) => void };
afterEach(() => {
  guest?.close();
  frame?.dispose();
  frame = undefined;
  guest = undefined;
  delete moves.moveBefore;
});

/** A media element as a browser keeps one, playing until it is paused. */
function media(tag: "video" | "audio", doc: Document, playing: boolean) {
  const element = doc.createElement(tag);
  let paused = !playing;
  Object.defineProperty(element, "paused", { get: () => paused, configurable: true });
  element.pause = () => void (paused = true);
  element.play = () => ((paused = false), Promise.resolve());
  doc.body.appendChild(element);
  return element;
}

/** A frame kept on a shelf, its guest the client in a document of its own. */
async function kept() {
  // A browser that moves a frame without loading it again. Where nothing is laid out the move is the browser's; here the frame stays put.
  moves.moveBefore = () => undefined;
  const element = document.createElement("div");
  document.body.appendChild(element);
  frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }) });
  const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
  window.dispatchEvent(new MessageEvent("message", { data: ready, origin: "null", source: frame.iframe.contentWindow }));
  const [hello, , [port]] = posted.mock.calls.at(-1) as unknown as [HostHello, string, MessagePort[]];
  // The guest's own window: its document, and the parent its hello comes from.
  const own = document.implementation.createHTMLDocument("card");
  const parent = { postMessage: () => undefined };
  const heard = new Set<(event: MessageEvent) => void>();
  guest = connectGuest({ window: { parent, document: own, addEventListener: (_type: string, listener: (event: MessageEvent) => void) => heard.add(listener), removeEventListener: (_type: string, listener: (event: MessageEvent) => void) => heard.delete(listener) } as never });
  for (const listener of [...heard]) listener({ data: hello, source: parent, origin: "https://host.example", ports: [port] } as unknown as MessageEvent);
  guest.size(220);
  await vi.waitFor(() => expect(frame!.iframe.hasAttribute("data-guest-view-drawn")).toBe(true));
  return { own, guest, frame };
}

describe("a frame guest kept for a return", () => {
  it("has its playing media paused as its page is left, and played again on return", async () => {
    const { own, guest, frame } = await kept();
    const film = media("video", own, true);
    const song = media("audio", own, true);
    const stopped = media("video", own, false);
    expect(guest.away).toBe(false);
    expect(frame.rest(() => undefined)).toBe(true);
    await vi.waitFor(() => expect(film.paused).toBe(true));
    expect(song.paused).toBe(true);
    expect(guest.away).toBe(true);
    const onto = document.createElement("div");
    document.body.appendChild(onto);
    expect(frame.wake(onto)).toBe(true);
    await vi.waitFor(() => expect(film.paused).toBe(false));
    expect(song.paused).toBe(false);
    expect(stopped.paused, "what the guest had paused itself stays paused").toBe(true);
    expect(guest.away).toBe(false);
  });

  it("hears that it is off the page and back, for a sound of its own", async () => {
    const { guest, frame } = await kept();
    const told: boolean[] = [];
    const stop = guest.onAway((away) => told.push(away));
    frame.rest(() => undefined);
    await vi.waitFor(() => expect(told).toEqual([true]));
    const onto = document.createElement("div");
    document.body.appendChild(onto);
    frame.wake(onto);
    await vi.waitFor(() => expect(told).toEqual([true, false]));
    stop();
    frame.rest(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(told, "not after it stopped listening").toEqual([true, false]);
  });
});
