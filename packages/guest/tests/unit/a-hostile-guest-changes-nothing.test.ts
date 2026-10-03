import { describe, expect, it } from "vitest";
import { createGuestHost, createGuestLimiter } from "../../src/host/index.js";
import type { GuestAnswer } from "../../src/protocol.js";
import { bethan, inbox, showroom, staff } from "./showroom.js";

/**
 * A HOSTILE GUEST CHANGES NOTHING AND IS RATE-LIMITED (FR-04). What the
 * frame's sandbox stops (fetch with credentials, top navigation, the host's
 * cookies) is held in a real browser by `scripts/guest-sandbox.mjs`; what the
 * host makes of messages is held here.
 */
const answers = (said: readonly unknown[]) => said.filter((one): one is GuestAnswer => (one as GuestAnswer).type === "answer");
const asking = (id: number, nonce = "n") => ({ type: "act", nonce, id, name: "ask", args: { shopperId: "shopper:bethan", label: `Question ${id}` } });

describe("forged messages", () => {
  it("are dropped unanswered without the frame's nonce", () => {
    const store = showroom();
    const before = store.snapshot();
    const { said, send } = inbox();
    const host = createGuestHost({ store, principal: staff, view: "card", nonce: "a1b2", send });
    for (const forged of [
      asking(1, "guess"),
      { ...asking(2), nonce: undefined },
      { type: "act", id: 3, name: "retire-car", args: { carId: "car:golf" } },
      "act retire-car",
      null,
      [asking(4, "a1b2")],
    ]) host.receive(forged);
    expect(said).toEqual([]);
    expect(store.snapshot()).toEqual(before);
    expect(host.stats.dropped).toBe(6);
  });

  it("answer a request the protocol does not know as malformed or unknown, and change nothing", () => {
    const store = showroom();
    const before = store.snapshot();
    const { said, send } = inbox();
    const host = createGuestHost({ store, principal: staff, view: "card", nonce: "n", send });
    host.receive({ type: "act", nonce: "n", id: 1, name: "ask", args: "shopper:bethan" });
    host.receive({ type: "act", nonce: "n", id: 2, name: "drop-database", args: {} });
    host.receive({ type: "eval", nonce: "n", code: "store.apply(...)" });
    expect(answers(said).map((one) => [one.id, !one.ok && one.reason])).toEqual([[1, "malformed"], [2, "unknown-act"]]);
    expect(store.snapshot()).toEqual(before);
  });

  it("go nowhere when they ask to navigate to a record the viewer may not see", () => {
    const went: string[] = [];
    const host = createGuestHost({ store: showroom(), principal: bethan, view: "card", nonce: "n", send: () => {}, onNavigate: (id) => went.push(id) });
    host.receive({ type: "navigate", nonce: "n", to: "shopper:freya" });
    host.receive({ type: "navigate", nonce: "n", to: "car:golf" });
    expect(went).toEqual(["car:golf"]);
  });

  it("cannot ask for a height past the host's ceiling", () => {
    const heights: number[] = [];
    const host = createGuestHost({ store: showroom(), principal: bethan, view: "card", nonce: "n", send: () => {}, onSize: (h) => heights.push(h), limits: { maxHeight: 900 } });
    host.receive({ type: "size", nonce: "n", height: 1e9 });
    host.receive({ type: "size", nonce: "n", height: -40 });
    host.receive({ type: "size", nonce: "n", height: Number.NaN });
    expect(heights).toEqual([900, 0]);
  });
});

describe("a flood", () => {
  it("of acts is applied up to the frame's allowance and refused as rate-limited past it", () => {
    let clock = 0;
    const store = showroom();
    const { said, send } = inbox();
    const host = createGuestHost({ store, principal: staff, view: "card", nonce: "n", send, now: () => clock, limits: { acts: 5, actWindowMs: 60_000 } });
    for (let id = 1; id <= 50; id += 1) host.receive(asking(id));
    const said50 = answers(said);
    expect(said50.filter((one) => one.ok)).toHaveLength(5);
    expect(said50.filter((one) => !one.ok && one.reason === "rate-limited")).toHaveLength(45);
    expect(store.graph.nodesOfKind("enquiry")).toHaveLength(6);
    // A minute on, the frame may ask again.
    clock = 60_001;
    host.receive(asking(51));
    expect(answers(said).at(-1)).toMatchObject({ id: 51, ok: true });
  });

  it("of messages past the frame's allowance is dropped unread", () => {
    const store = showroom();
    const before = store.snapshot();
    const { said, send } = inbox();
    const host = createGuestHost({ store, principal: staff, view: "card", nonce: "n", send, now: () => 0, limits: { messages: 10, acts: 1_000 } });
    for (let id = 1; id <= 1_000; id += 1) host.receive({ type: "size", nonce: "n", height: id });
    host.receive(asking(1));
    expect(host.stats.dropped).toBe(991);
    expect(answers(said)).toEqual([]);
    expect(store.snapshot()).toEqual(before);
  });

  it("is the frame's to spend, not a session's: saying ready again buys no new allowance", () => {
    const limiter = createGuestLimiter({ acts: 2 }, () => 0);
    const store = showroom();
    const first = inbox();
    const one = createGuestHost({ store, principal: staff, view: "card", nonce: "one", send: first.send, limiter });
    one.receive(asking(1, "one"));
    one.receive(asking(2, "one"));
    const second = inbox();
    const two = createGuestHost({ store, principal: staff, view: "card", nonce: "two", send: second.send, limiter });
    two.receive(asking(3, "two"));
    expect(answers(second.said)).toEqual([expect.objectContaining({ id: 3, ok: false, reason: "rate-limited" })]);
  });
});
