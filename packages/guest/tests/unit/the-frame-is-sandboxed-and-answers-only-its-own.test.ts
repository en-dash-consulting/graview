// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { mountGuestView } from "../../src/host/index.js";
import { GUEST_PROTOCOL, type HostHello, type HostMessage } from "../../src/protocol.js";
import { bethan, settle, showroom, staff } from "./showroom.js";

/**
 * THE FRAME (FR-04): sandboxed to scripts alone, so its origin is opaque;
 * a `guest-ready` answered only from its own window and only from the
 * opaque origin; and each answer a fresh nonce and port. That the sandbox
 * does what it says in a browser is `scripts/guest-sandbox.mjs`.
 */
const ready = { graview: "guest-ready", protocol: GUEST_PROTOCOL };
const from = (source: Window | null, origin: string, data: unknown = ready) =>
  window.dispatchEvent(new MessageEvent("message", { data, origin, source }));

function mounted(principal = bethan, store = showroom()) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store, principal, input: () => ({ node: { id: "car:golf" } }) });
  const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
  return { frame, posted, store, guest: frame.iframe.contentWindow! };
}

describe("the frame a guest view is drawn in", () => {
  it("is sandboxed to scripts alone, never to its own origin", () => {
    const { frame } = mounted();
    // Exactly one token: no allow-same-origin, allow-top-navigation, allow-popups or allow-forms.
    expect(frame.iframe.getAttribute("sandbox")!.split(/\s+/)).toEqual(["allow-scripts"]);
    expect(frame.iframe.getAttribute("allow")).toBe("");
    expect(frame.iframe.getAttribute("referrerpolicy")).toBe("no-referrer");
    frame.dispose();
  });

  it("answers a ready only from its own window, and only from the opaque origin", () => {
    const { frame, posted, guest } = mounted();
    from(window, "null"); // the host page itself
    from(null, "null"); // nobody
    const other = document.createElement("iframe");
    document.body.appendChild(other);
    from(other.contentWindow, "null"); // another frame
    from(guest, "https://cards.example"); // a frame with an origin of its own is not sandboxed
    from(guest, location.origin); // nor one that shares the host's
    from(guest, "null", { graview: "guest-ready", protocol: 99 });
    expect(posted).not.toHaveBeenCalled();
    from(guest, "null");
    expect(posted).toHaveBeenCalledTimes(1);
    const [hello, target, transfer] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
    expect(hello).toMatchObject({ graview: "host-hello", protocol: GUEST_PROTOCOL, view: "card" });
    expect(hello.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(target).toBe("*");
    expect(transfer).toHaveLength(1);
    frame.dispose();
  });

  it("hands each ready a fresh nonce and port, and closes the one before", async () => {
    const { frame, posted, guest, store } = mounted(staff);
    from(guest, "null");
    from(guest, "null");
    const [first, second] = posted.mock.calls.map((call) => call as unknown as [HostHello, string, MessagePort[]]);
    expect(first![0].nonce).not.toBe(second![0].nonce);
    const old = first![2][0]!;
    const fresh = second![2][0]!;
    const heard: HostMessage[] = [];
    fresh.onmessage = (event) => heard.push(event.data as HostMessage);
    // The old document's port, with its old nonce, reaches nobody.
    old.postMessage({ type: "act", nonce: first![0].nonce, id: 1, name: "retire-car", args: { carId: "car:golf" } });
    // The new port with the old nonce is a forgery.
    fresh.postMessage({ type: "act", nonce: first![0].nonce, id: 2, name: "retire-car", args: { carId: "car:golf" } });
    await settle();
    await settle();
    expect(store.graph.has("car:golf")).toBe(true);
    fresh.postMessage({ type: "act", nonce: second![0].nonce, id: 3, name: "retire-car", args: { carId: "car:golf" } });
    await vi.waitFor(() => expect(heard.some((one) => one.type === "answer" && one.id === 3)).toBe(true));
    expect(store.graph.has("car:golf")).toBe(false);
    expect(store.log.all().at(-1)!.via).toBe("view:card");
    fresh.close();
    frame.dispose();
  });

  it("keeps one allowance of acts across every ready, so reloading buys no more", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const store = showroom();
    const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store, principal: staff, limits: { acts: 1 } });
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    const ask = async (label: string) => {
      from(frame.iframe.contentWindow, "null");
      const [hello, , [port]] = posted.mock.calls.at(-1)! as unknown as [HostHello, string, MessagePort[]];
      const heard: HostMessage[] = [];
      port!.onmessage = (event) => heard.push(event.data as HostMessage);
      port!.postMessage({ type: "act", nonce: hello.nonce, id: 1, name: "ask", args: { shopperId: "shopper:bethan", label } });
      await vi.waitFor(() => expect(heard.find((one) => one.type === "answer")).toBeDefined());
      port!.close();
      return heard.find((one) => one.type === "answer");
    };
    expect(await ask("First")).toMatchObject({ ok: true });
    expect(await ask("Second")).toMatchObject({ ok: false, reason: "rate-limited" });
    expect(frame.stats).toMatchObject({ applied: 1, refused: 1 });
    frame.dispose();
  });

  it("counts a flood of readies against the frame's allowance", () => {
    const element = document.createElement("div");
    const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, limits: { messages: 3 } });
    document.body.appendChild(element);
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    for (let i = 0; i < 100; i += 1) from(frame.iframe.contentWindow, "null");
    expect(posted).toHaveBeenCalledTimes(3);
    expect(frame.stats.dropped).toBe(97);
    frame.dispose();
  });
});
