// @vitest-environment jsdom
import { judgeRecordBoxes, MOST_RECORD_BOXES, RECORD_BOXES_ATTRIBUTE, RECORD_BOXES_MOVED, recordBoxesOf } from "@graview/core/record-boxes";
import { describe, expect, it, vi } from "vitest";
import { mountGuestView } from "../../src/host/frame.js";
import { createGuestHost, RECORDS_A_SECOND } from "../../src/host/session.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, settle, showroom } from "./showroom.js";

/**
 * WHERE A FRAME'S RECORDS ARE (Graview HQ
 * feature:f-one-face-lines-from-frame-views). The one face draws a line from
 * each record a page shows to its building; a frame guest is another origin,
 * so it says where its `data-record` elements are, and its host keeps of it
 * only what is inside the frame and names a record the seat may see, no more
 * than the most, for drawing and nothing else. That the lines land on them
 * in a browser is `scripts/verify-frame-lines.mjs`.
 */
const sees = (id: string) => id !== "secret";

describe("what a view says of its records, judged", () => {
  it("clamps each box to the element and drops one with no area left inside it", () => {
    expect(
      judgeRecordBoxes(
        [
          { id: "a", x: -20, y: 10, width: 60, height: 20 },
          { id: "b", x: 380, y: 290, width: 100, height: 100 },
          { id: "c", x: 500, y: 10, width: 40, height: 40 },
          { id: "d", x: 10, y: -80, width: 40, height: 40 },
        ],
        { width: 400, height: 300, sees },
      ),
    ).toEqual([
      { id: "a", x: 0, y: 10, width: 40, height: 20 },
      { id: "b", x: 380, y: 290, width: 20, height: 10 },
    ]);
  });

  it("keeps only records the seat may see, and asks of nothing that is not a box", () => {
    const asked: string[] = [];
    const judged = judgeRecordBoxes([{ id: "secret", x: 0, y: 0, width: 10, height: 10 }, { id: "car", x: 0, y: 0, width: 10, height: 10 }, { id: "nan", x: Number.NaN, y: 0, width: 10, height: 10 }, { id: 7, x: 0, y: 0, width: 10, height: 10 }, "car", null, [1, 2], { id: "", x: 0, y: 0, width: 10, height: 10 }, { id: "x".repeat(201), x: 0, y: 0, width: 10, height: 10 }], {
      width: 100,
      height: 100,
      sees: (id) => (asked.push(id), sees(id)),
    });
    expect(judged).toEqual([{ id: "car", x: 0, y: 0, width: 10, height: 10 }]);
    expect(asked, "the seat's sight is asked only of a well-formed box").toEqual(["secret", "car"]);
  });

  it("keeps a plain box of its own and nothing else the view put on one", () => {
    const [kept] = judgeRecordBoxes([{ id: "car", x: 1, y: 2, width: 3, height: 4, href: "javascript:alert(1)", __proto__: { evil: true } }], { width: 100, height: 100, sees });
    expect(Object.keys(kept!)).toEqual(["id", "x", "y", "width", "height"]);
  });

  it("keeps no more than the most, and reads no further than twice it", () => {
    let asked = 0;
    const many = Array.from({ length: 10_000 }, (_, at) => ({ id: `r${at}`, x: 0, y: 0, width: 10, height: 10 }));
    expect(judgeRecordBoxes(many, { width: 100, height: 100, sees: () => (asked++, true) })).toHaveLength(MOST_RECORD_BOXES);
    const unseen = judgeRecordBoxes(many, { width: 100, height: 100, sees: () => (asked++, false) });
    expect(unseen).toEqual([]);
    expect(asked).toBe(MOST_RECORD_BOXES + MOST_RECORD_BOXES * 2);
    expect(judgeRecordBoxes("not a list", { width: 100, height: 100, sees })).toEqual([]);
  });
});

describe("a frame's records, as its host keeps them", () => {
  const ready = { graview: "guest-ready", protocol: GUEST_PROTOCOL };

  function opened() {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }) });
    // jsdom lays nothing out: the frame is as wide and as tall as a page would make it.
    Object.defineProperty(frame.iframe, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(frame.iframe, "clientHeight", { value: 300, configurable: true });
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: ready, origin: "null", source: frame.iframe.contentWindow }));
    const [hello, , ports] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
    return { frame, element, port: ports[0]!, nonce: hello.nonce };
  }

  it("holds what the frame said inside it, of records its seat may see, and says when they change", async () => {
    const { frame, element, port, nonce } = opened();
    expect(frame.iframe.hasAttribute(RECORD_BOXES_ATTRIBUTE)).toBe(true);
    const read = recordBoxesOf(frame.iframe)!;
    expect(read()).toEqual([]);
    const moved = vi.fn();
    element.addEventListener(RECORD_BOXES_MOVED, moved);
    port.postMessage({
      type: "records",
      nonce,
      boxes: [
        { id: "car:golf", x: 10, y: 20, width: 380, height: 40 },
        // Freya is not Bethan's to see, and an id nobody has is no record.
        { id: "shopper:freya", x: 10, y: 80, width: 380, height: 40 },
        { id: "nobody", x: 10, y: 140, width: 380, height: 40 },
        // Past the frame's foot: clamped to it.
        { id: "shopper:bethan", x: 10, y: 280, width: 500, height: 60 },
      ],
    });
    await vi.waitFor(() => expect(read()).toHaveLength(2));
    expect(read()).toEqual([
      { id: "car:golf", x: 10, y: 20, width: 380, height: 40 },
      { id: "shopper:bethan", x: 10, y: 280, width: 390, height: 20 },
    ]);
    expect(moved).toHaveBeenCalledTimes(1);
    // Said again the same, nothing has moved for a list of them.
    port.postMessage({ type: "records", nonce, boxes: [{ id: "car:golf", x: 10, y: 30, width: 380, height: 40 }, { id: "shopper:bethan", x: 10, y: 200, width: 100, height: 20 }] });
    await vi.waitFor(() => expect(read()[0]!.y).toBe(30));
    expect(moved).toHaveBeenCalledTimes(1);
    // Under another nonce: no one's.
    port.postMessage({ type: "records", nonce: "f".repeat(32), boxes: [] });
    await settle();
    expect(read()).toHaveLength(2);
    frame.dispose();
    expect(recordBoxesOf(frame.iframe), "a frame that has gone holds nothing").toBeUndefined();
  });

  it("is judged again against the frame's size as it is read", async () => {
    const { frame, port, nonce } = opened();
    port.postMessage({ type: "records", nonce, boxes: [{ id: "car:golf", x: 0, y: 250, width: 400, height: 40 }] });
    const read = recordBoxesOf(frame.iframe)!;
    await vi.waitFor(() => expect(read()).toHaveLength(1));
    Object.defineProperty(frame.iframe, "clientHeight", { value: 260, configurable: true });
    expect(read()).toEqual([{ id: "car:golf", x: 0, y: 250, width: 400, height: 10 }]);
    Object.defineProperty(frame.iframe, "clientHeight", { value: 200, configurable: true });
    expect(read()).toEqual([]);
    frame.dispose();
  });
});

describe("a frame's records have an allowance of their own", () => {
  it("never spends what its acts and its height are asked with, and past its own is dropped", () => {
    let now = 0;
    const heard: unknown[] = [];
    const sizes: number[] = [];
    const host = createGuestHost({ store: showroom(), principal: bethan, view: "card", nonce: "n", send: () => {}, now: () => now, limits: { messages: 5 }, onRecords: (boxes) => heard.push(boxes), onSize: (height) => sizes.push(height) });
    for (let at = 0; at < RECORDS_A_SECOND + 10; at += 1) host.receive({ type: "records", nonce: "n", boxes: [at] });
    expect(heard).toHaveLength(RECORDS_A_SECOND);
    expect(host.stats.dropped).toBe(10);
    host.receive({ type: "size", nonce: "n", height: 120 });
    expect(sizes, "its height is still asked for").toEqual([120]);
    now += 1_001;
    host.receive({ type: "records", nonce: "n", boxes: [] });
    expect(heard).toHaveLength(RECORDS_A_SECOND + 1);
    host.dispose();
  });

  it("is dropped unread by a host that draws no lines", () => {
    const host = createGuestHost({ store: showroom(), principal: bethan, view: "card", nonce: "n", send: () => {} });
    host.receive({ type: "records", nonce: "n", boxes: [] });
    expect(host.stats.dropped).toBe(1);
    host.dispose();
  });
});
