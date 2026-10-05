// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";
import { createGuestHost } from "../../src/host/session.js";
import { createKitRenderer } from "../../src/host/kit.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom, UNSEEN } from "./showroom.js";

/**
 * A GUEST IN A WORKER (FR-68), joined to a real host over a real
 * MessageChannel: the worker entry's own runtime — Remote DOM's polyfill,
 * the kit as remote elements, the guest API — with the worker's global
 * stood in for by this process's, and the host's document by a JSDOM one.
 * It is the frame guest's protocol: ready, a hello with a nonce and a port,
 * props as the viewer sees them, and an act applied as the viewer, through
 * the view. That it holds in a real worker, under a chat's policy, in
 * Chromium and WebKit, is `scripts/guest-sandbox.mjs --transport=worker`.
 */

const toOwner: unknown[] = [];
const hearing = new Set<(event: MessageEvent) => void>();
Object.assign(globalThis, {
  addEventListener: (_: string, listener: (event: MessageEvent) => void) => hearing.add(listener),
  removeEventListener: (_: string, listener: (event: MessageEvent) => void) => hearing.delete(listener),
  postMessage: (message: unknown) => toOwner.push(message),
});
const { connectGuest } = await import("../../src/worker/index.js");

const settle = async (times = 5) => {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};

const dom = new JSDOM("<!doctype html><main></main>");
const host = dom.window.document.querySelector("main")!;
const store = showroom();
const channel = new MessageChannel();
const nonce = "c0ffee";
const events: unknown[] = [];
const renderer = createKitRenderer(host as unknown as HTMLElement, {
  onEvent: (listener, detail) => {
    events.push({ listener, detail });
    channel.port1.postMessage({ type: "event", listener, ...(detail !== undefined ? { detail } : {}) });
  },
});
const sent: unknown[] = [];
const session = createGuestHost({
  store,
  principal: bethan,
  view: "card",
  nonce,
  send: (message) => {
    sent.push(structuredClone(message));
    channel.port1.postMessage(message);
  },
  onRender: (records) => renderer.apply(records),
  input: () => ({ nodes: store.graph.allNodes().map(({ id }) => ({ id })) }),
});
channel.port1.onmessage = (event) => session.receive(event.data);

/* The guest: a card per record it is shown, and a button that asks. */
const guest = connectGuest();
const answers: unknown[] = [];
guest.subscribe((props) => {
  const card = document.createElement("gv-card");
  for (const node of props.nodes ?? []) {
    const title = document.createElement("gv-title");
    title.textContent = node.label ?? node.id;
    card.append(title);
  }
  const ask = document.createElement("gv-button");
  ask.setAttribute("tone", "accent");
  ask.textContent = "Ask about the Golf";
  ask.addEventListener("press", async () => answers.push(await guest.act("ask", { shopperId: "shopper:bethan", label: "Is the Golf still there?" })));
  card.append(ask);
  guest.root.replaceChildren(card);
});

afterAll(() => {
  guest.close();
  channel.port1.close();
  session.dispose();
});

describe("a guest in a worker", () => {
  it("says ready to the worker's owner, in the frame guest's words", () => {
    expect(toOwner).toEqual([{ graview: "guest-ready", protocol: GUEST_PROTOCOL }]);
  });

  it("takes the hello and its port, and draws what the viewer may see in the host's document", async () => {
    const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce, view: "card" };
    for (const heard of hearing) heard({ data: hello, ports: [channel.port2] } as unknown as MessageEvent);
    session.push();
    await settle();
    const titles = [...host.querySelectorAll("strong")].map((one) => one.textContent);
    expect(titles).toEqual(["Golf", "Bethan Okonkwo"]);
    expect(host.querySelector("section")?.getAttribute("data-gv")).toBe("card");
    expect(host.querySelector("button")?.getAttribute("data-gv-tone")).toBe("accent");
  });

  it("was handed nothing the viewer may not see", () => {
    const wire = JSON.stringify(sent) + host.innerHTML;
    expect(UNSEEN.filter((word) => wire.includes(word))).toEqual([]);
    expect(wire).not.toContain("sk-session");
  });

  it("asks for an act when the viewer presses its button, and the act is the viewer's, through the view", async () => {
    host.querySelector("button")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await settle(10);
    expect(events).toHaveLength(1);
    expect(answers).toEqual([expect.objectContaining({ ok: true })]);
    const last = store.log.all().at(-1)!;
    expect(last.author.id).toBe("shopper:bethan");
    expect(last.via).toBe("view:card");
  });

  it("redraws when what the viewer sees moves", async () => {
    await settle(10);
    const titles = [...host.querySelectorAll("strong")].map((one) => one.textContent);
    expect(titles).toContain("Is the Golf still there?");
  });

  it("sends its drawing as one message per turn, not one per node", () => {
    expect(session.stats.dropped).toBe(0);
  });
});
