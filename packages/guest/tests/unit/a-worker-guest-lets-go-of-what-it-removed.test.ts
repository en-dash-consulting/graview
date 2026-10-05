// @ts-expect-error — jsdom is the workspace's, and carries no types of its own.
import { JSDOM } from "jsdom";
import { afterAll, describe, expect, it } from "vitest";
import { createGuestHost } from "../../src/host/session.js";
import { createKitRenderer } from "../../src/host/kit.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A LONG-LIVED WORKER GUEST HOLDS WHAT IT DRAWS, AND NO MORE (FR-68). A
 * listener crosses to the host as an id. A view that keeps adding and
 * removing elements with listeners — a list that refilters, a card redrawn
 * on every push — must not leave an id, a function or an element behind on
 * either side for each one it took away, and an id it let go must never
 * reach a listener again, the one it named or any later one.
 */

const toOwner: unknown[] = [];
const hearing = new Set<(event: MessageEvent) => void>();
Object.assign(globalThis, {
  addEventListener: (_: string, listener: (event: MessageEvent) => void) => hearing.add(listener),
  removeEventListener: (_: string, listener: (event: MessageEvent) => void) => hearing.delete(listener),
  postMessage: (message: unknown) => toOwner.push(message),
});
const { connectGuest } = await import("../../src/worker/index.js");
const { createListenerLedger } = await import("../../src/worker/listeners.js");
const { RemoteRootElement } = await import("@remote-dom/core/elements");

const settle = async (times = 3) => {
  for (let i = 0; i < times; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
};
const N = 10_000;

/** Every listener id in what was sent, in order. */
const idsIn = (value: unknown, into: number[] = []): number[] => {
  if (Array.isArray(value)) for (const one of value) idsIn(one, into);
  else if (value && typeof value === "object") {
    const listener = (value as { listener?: unknown }).listener;
    if (typeof listener === "number") into.push(listener);
    else for (const one of Object.values(value)) idsIn(one, into);
  }
  return into;
};

describe("the runtime's listener ledger, with Remote DOM's own records and the host's renderer", () => {
  const dom = new JSDOM("<!doctype html><main></main>");
  const host = dom.window.document.querySelector("main")!;
  const ledger = createListenerLedger();
  const raised: number[] = [];
  const renderer = createKitRenderer(host as unknown as HTMLElement, {
    maxNodes: 100_000,
    onEvent: (listener) => {
      raised.push(listener);
      ledger.listener(listener)?.();
    },
  });
  const sent: number[] = [];
  /* Synchronous, record by record: the host sees each mutation as it happens, the worst case for holding. */
  const root = document.createElement("graview-root") as unknown as InstanceType<typeof RemoteRootElement>;
  root.connect({
    mutate(records: readonly unknown[]) {
      const wire = structuredClone(ledger.encode(records));
      idsIn(wire, sent);
      renderer.apply(wire);
    },
    call: () => undefined,
  } as never);
  const element = root as unknown as Element;

  /* What stays drawn throughout: a card with a button of its own. */
  const card = document.createElement("gv-card");
  const stays: string[] = [];
  const keep = document.createElement("gv-button");
  keep.addEventListener("press", () => stays.push("pressed"));
  card.append(keep);
  element.append(card);
  const baseline = { listening: ledger.listening, nodes: ledger.nodes, drawn: renderer.size, attached: renderer.listening };

  it(`lets go of every id, function and node after ${N.toLocaleString("en")} elements with listeners come and go, on both sides`, () => {
    expect(baseline.listening).toBe(1);
    expect(baseline.attached).toBe(1);
    let pressed = 0;
    for (let i = 0; i < N; i += 1) {
      const button = document.createElement("gv-button");
      const press = () => (pressed += 1);
      button.addEventListener("press", press);
      button.textContent = `Button ${i}`;
      /* Removed four ways: by itself, as part of a subtree, replaced, and by taking its listener away first. */
      if (i % 4 === 0) {
        card.append(button);
        button.remove();
      } else if (i % 4 === 1) {
        const group = document.createElement("gv-group");
        group.append(button);
        card.append(group);
        group.remove();
      } else if (i % 4 === 2) {
        card.append(button);
        card.replaceChildren(keep, document.createElement("gv-divider"));
        card.replaceChildren(keep);
      } else {
        card.append(button);
        button.removeEventListener("press", press);
        expect(ledger.listening).toBe(baseline.listening);
        button.remove();
      }
    }
    expect(pressed).toBe(0);
    expect({ listening: ledger.listening, nodes: ledger.nodes, drawn: renderer.size, attached: renderer.listening }).toEqual(baseline);
  });

  it("routes a press to an element added after the churn, and to the one that stayed", () => {
    const fresh: string[] = [];
    const button = document.createElement("gv-button");
    button.addEventListener("press", () => fresh.push("pressed"));
    card.append(button);
    const drawn = host.querySelectorAll("button");
    expect(drawn).toHaveLength(2);
    drawn[1]!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    drawn[0]!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    expect(fresh).toEqual(["pressed"]);
    expect(stays).toEqual(["pressed"]);
    button.remove();
  });

  it("never gives a later listener an id it let go, and an id it let go reaches nothing", () => {
    /* Monotonic: every id sent was new when it was first sent, so none names two listeners. */
    const firsts = [...new Set(sent)];
    expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
    const released = firsts.filter((id) => ledger.listener(id) === undefined);
    expect(released.length).toBeGreaterThanOrEqual(N);
    for (const id of released) expect(ledger.listener(id)).toBeUndefined();
  });
});

describe("a worker guest's runtime, joined to a real host", () => {
  const dom = new JSDOM("<!doctype html><main></main>");
  const host = dom.window.document.querySelector("main")!;
  const channel = new MessageChannel();
  const nonce = "c0ffee";
  const renderer = createKitRenderer(host as unknown as HTMLElement, {
    onEvent: (listener) => channel.port1.postMessage({ type: "event", listener }),
  });
  const sent: number[] = [];
  const store = showroom();
  const session = createGuestHost({
    store,
    principal: bethan,
    view: "card",
    nonce,
    send: (message) => channel.port1.postMessage(message),
    onRender: (records) => {
      idsIn(records, sent);
      renderer.apply(records);
    },
    limits: { messages: 1_000_000 },
  });
  channel.port1.onmessage = (event) => session.receive(event.data);
  const guest = connectGuest();
  const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce, view: "card" };
  for (const heard of hearing) heard({ data: hello, ports: [channel.port2] } as unknown as MessageEvent);

  afterAll(() => {
    guest.close();
    channel.port1.close();
    session.dispose();
  });

  it("never calls the listener of an element it took away, even when the host names its id", async () => {
    const pressed: number[] = [];
    for (let round = 0; round < 50; round += 1) {
      const button = document.createElement("gv-button");
      button.addEventListener("press", () => pressed.push(round));
      guest.root.append(button);
      await settle();
      button.remove();
      await settle();
    }
    expect(renderer.size).toBe(0);
    expect(renderer.listening).toBe(0);
    /* A press already in flight when the element went, or a host that names an old id: nothing runs. */
    for (const id of new Set(sent)) channel.port1.postMessage({ type: "event", listener: id });
    await settle(10);
    expect(pressed).toEqual([]);

    const now: string[] = [];
    const button = document.createElement("gv-button");
    button.addEventListener("press", () => now.push("pressed"));
    guest.root.append(button);
    await settle();
    host.querySelector("button")!.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await settle(10);
    expect(now).toEqual(["pressed"]);
    expect(pressed).toEqual([]);
    expect(Math.max(...sent)).toBe(sent.at(-1));
  });
});
