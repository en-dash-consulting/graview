import { describe, expect, it } from "vitest";
import { connectGuest } from "../../src/index.js";
import { createGuestHost } from "../../src/host/index.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { showroom, staff } from "./showroom.js";

/**
 * THE GUEST'S HALF (FR-04): it says it is ready, takes the first hello from
 * its parent and only its parent, and from then on talks over the port,
 * every request carrying the nonce. Joined to a real host over a real
 * MessageChannel, an act it asks for is the viewer's.
 */
function guestWindow() {
  const listeners = new Set<(event: MessageEvent) => void>();
  const toParent: unknown[] = [];
  const parent = { postMessage: (message: unknown) => toParent.push(message) };
  return {
    parent,
    toParent,
    addEventListener: (_: "message", listener: (event: MessageEvent) => void) => listeners.add(listener),
    removeEventListener: (_: "message", listener: (event: MessageEvent) => void) => listeners.delete(listener),
    deliver: (event: Partial<MessageEvent>) => {
      for (const listener of [...listeners]) listener({ ports: [], origin: "https://host.example", ...event } as MessageEvent);
    },
  };
}

function joined(at: ReturnType<typeof guestWindow>, nonce = "f00d") {
  const store = showroom();
  const channel = new MessageChannel();
  const host = createGuestHost({ store, principal: staff, view: "card", nonce, send: (message) => channel.port1.postMessage(message), input: () => ({ node: { id: "car:golf" } }) });
  channel.port1.onmessage = (event) => host.receive(event.data);
  const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce, view: "card" };
  return { store, host, channel, hello };
}

describe("a guest", () => {
  it("says it is ready to its parent, and nothing else", () => {
    const at = guestWindow();
    connectGuest({ window: at }).close();
    expect(at.toParent).toEqual([{ graview: "guest-ready", protocol: GUEST_PROTOCOL }]);
  });

  it("takes a hello only from its parent, and from the host's origin when it knows it", async () => {
    const at = guestWindow();
    const { channel, hello, host, store } = joined(at);
    const guest = connectGuest({ window: at, hostOrigin: "https://host.example" });
    const forger = new MessageChannel();
    at.deliver({ source: {} as never, data: { ...hello, nonce: "forged" }, ports: [forger.port2] });
    at.deliver({ source: at.parent as never, origin: "https://evil.example", data: { ...hello, nonce: "forged" }, ports: [forger.port2] });
    at.deliver({ source: at.parent as never, data: hello, ports: [channel.port2] });
    host.push();
    await new Promise<void>((resolve) => guest.subscribe(() => resolve()));
    expect(guest.props?.node?.id).toBe("car:golf");
    const answer = await guest.act("retire-car", { carId: "car:golf" });
    expect(answer).toMatchObject({ ok: true });
    expect(store.log.all().at(-1)).toMatchObject({ author: staff, via: "view:card" });
    guest.close();
    channel.port1.close();
    forger.port1.close();
  });

  it("holds what it asks for before the hello, and sends it with the nonce after", async () => {
    const at = guestWindow();
    const { channel, hello, store } = joined(at, "beef");
    const guest = connectGuest({ window: at });
    const asked = guest.act("ask", { shopperId: "shopper:bethan", label: "Early" });
    at.deliver({ source: at.parent as never, data: hello, ports: [channel.port2] });
    expect(await asked).toMatchObject({ ok: true, intent: "Ask “Early”" });
    expect(store.graph.nodesOfKind("enquiry").map((node) => node.label)).toContain("Early");
    guest.close();
    channel.port1.close();
  });
});
