// @vitest-environment jsdom
import { judgeRecordBoxes, MOST_RECORD_BOXES, RECORD_BOXES_ATTRIBUTE, RECORD_BOXES_MOVED, recordBoxesOf } from "@graview/core/record-boxes";
import { describe, expect, it, vi } from "vitest";
import { mountGuestView } from "../../src/host/frame.js";
import { createGuestHost, RECORDS_A_SECOND } from "../../src/host/session.js";
import { createViewRecords } from "../../src/host/view-records.js";
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
    // Handed the Golf and the shoppers Bethan may see: herself, and never Freya.
    const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }), reads: { kinds: ["shopper"] } });
    // jsdom lays nothing out: the frame is as wide and as tall as a page would make it.
    Object.defineProperty(frame.iframe, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(frame.iframe, "clientHeight", { value: 300, configurable: true });
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: ready, origin: "null", source: frame.iframe.contentWindow }));
    const [hello, , ports] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
    return { frame, element, port: ports[0]!, nonce: hello.nonce };
  }

  it("holds what the frame said inside it, of records it was handed as its seat sees them, and says when which it shows changes", async () => {
    const { frame, element, port, nonce } = opened();
    expect(frame.iframe.hasAttribute(RECORD_BOXES_ATTRIBUTE)).toBe(true);
    const read = recordBoxesOf(frame.iframe)!;
    expect(read.boxes()).toEqual([]);
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
      shows: ["car:golf", "shopper:freya", "nobody", "shopper:bethan", "car:golf"],
    });
    await vi.waitFor(() => expect(read.boxes()).toHaveLength(2));
    expect(read.boxes()).toEqual([
      { id: "car:golf", x: 10, y: 20, width: 380, height: 40 },
      { id: "shopper:bethan", x: 10, y: 280, width: 390, height: 20 },
    ]);
    expect(read.shows()).toEqual(["car:golf", "shopper:bethan"]);
    expect(moved).toHaveBeenCalledTimes(1);
    // A row scrolled out of sight: its box goes, what it shows does not, and nothing has moved for a list of them.
    port.postMessage({ type: "records", nonce, boxes: [{ id: "car:golf", x: 10, y: 30, width: 380, height: 40 }], shows: ["car:golf", "shopper:freya", "nobody", "shopper:bethan", "car:golf"] });
    await vi.waitFor(() => expect(read.boxes()[0]!.y).toBe(30));
    expect(read.boxes()).toHaveLength(1);
    expect(read.shows()).toEqual(["car:golf", "shopper:bethan"]);
    expect(moved).toHaveBeenCalledTimes(1);
    // Under another nonce: no one's.
    port.postMessage({ type: "records", nonce: "f".repeat(32), boxes: [], shows: [] });
    await settle();
    expect(read.boxes()).toHaveLength(1);
    frame.dispose();
    expect(recordBoxesOf(frame.iframe), "a frame that has gone holds nothing").toBeUndefined();
  });

  it("never names a record of a kind it was not handed, though the seat may see it", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }) });
    Object.defineProperty(frame.iframe, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(frame.iframe, "clientHeight", { value: 300, configurable: true });
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: ready, origin: "null", source: frame.iframe.contentWindow }));
    const [hello, , ports] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
    ports[0]!.postMessage({ type: "records", nonce: hello.nonce, boxes: [{ id: "shopper:bethan", x: 0, y: 0, width: 10, height: 10 }, { id: "car:golf", x: 0, y: 20, width: 10, height: 10 }], shows: ["shopper:bethan", "car:golf"] });
    const read = recordBoxesOf(frame.iframe)!;
    await vi.waitFor(() => expect(read.boxes()).toHaveLength(1));
    expect(read.boxes()[0]!.id).toBe("car:golf");
    expect(read.shows()).toEqual(["car:golf"]);
    frame.dispose();
  });

  it("is judged again as it is read: against the frame's size, and the records there are now", async () => {
    const store = showroom();
    const element = document.createElement("div");
    document.body.appendChild(element);
    const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store, principal: bethan, input: () => ({ node: { id: "car:golf" } }), reads: { kinds: ["shopper"] } });
    Object.defineProperty(frame.iframe, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(frame.iframe, "clientHeight", { value: 300, configurable: true });
    const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
    window.dispatchEvent(new MessageEvent("message", { data: ready, origin: "null", source: frame.iframe.contentWindow }));
    const [hello, , ports] = posted.mock.calls[0]! as unknown as [HostHello, string, MessagePort[]];
    ports[0]!.postMessage({ type: "records", nonce: hello.nonce, boxes: [{ id: "car:golf", x: 0, y: 250, width: 400, height: 40 }, { id: "shopper:bethan", x: 0, y: 10, width: 400, height: 40 }], shows: ["car:golf", "shopper:bethan"] });
    const read = recordBoxesOf(frame.iframe)!;
    await vi.waitFor(() => expect(read.boxes()).toHaveLength(2));
    Object.defineProperty(frame.iframe, "clientHeight", { value: 260, configurable: true });
    expect(read.boxes()[0]).toEqual({ id: "car:golf", x: 0, y: 250, width: 400, height: 10 });
    Object.defineProperty(frame.iframe, "clientHeight", { value: 200, configurable: true });
    expect(read.boxes().map((box) => box.id)).toEqual(["shopper:bethan"]);
    // A record gone since it was said: no line to it, without the frame saying anything again.
    Object.defineProperty(frame.iframe, "clientHeight", { value: 300, configurable: true });
    store.apply({ name: "retire-car", args: { carId: "car:golf" } }, { author: { kind: "human", id: "staff:rhian", roles: ["staff"] } });
    await vi.waitFor(() => expect(read.boxes().map((box) => box.id)).toEqual(["shopper:bethan"]));
    expect(read.shows()).toEqual(["shopper:bethan"]);
    frame.dispose();
  });
});

describe("a frame's records have an allowance of their own", () => {
  it("never spends what its acts and its height are asked with, and past its own the latest is kept and taken once it allows", () => {
    vi.useFakeTimers();
    try {
      let now = 0;
      const heard: unknown[] = [];
      const sizes: number[] = [];
      const host = createGuestHost({ store: showroom(), principal: bethan, view: "card", nonce: "n", send: () => {}, now: () => now, limits: { messages: 5 }, onRecords: (boxes) => heard.push(boxes), onSize: (height) => sizes.push(height) });
      for (let at = 0; at < RECORDS_A_SECOND + 10; at += 1) host.receive({ type: "records", nonce: "n", boxes: [at] });
      expect(heard).toHaveLength(RECORDS_A_SECOND);
      host.receive({ type: "size", nonce: "n", height: 120 });
      expect(sizes, "its height is still asked for").toEqual([120]);
      // Within the window nothing more is taken; once it moves, the last said is, and only it.
      vi.advanceTimersByTime(200);
      expect(heard).toHaveLength(RECORDS_A_SECOND);
      now += 1_001;
      vi.advanceTimersByTime(100);
      expect(heard).toHaveLength(RECORDS_A_SECOND + 1);
      expect(heard.at(-1)).toEqual([RECORDS_A_SECOND + 9]);
      vi.advanceTimersByTime(1_000);
      expect(heard).toHaveLength(RECORDS_A_SECOND + 1);
      host.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("is dropped unread by a host that draws no lines", () => {
    const host = createGuestHost({ store: showroom(), principal: bethan, view: "card", nonce: "n", send: () => {} });
    host.receive({ type: "records", nonce: "n", boxes: [] });
    expect(host.stats.dropped).toBe(1);
    host.dispose();
  });
});

describe("a worker view's records, as its host measures them", () => {
  /* A region and a shadow root laid out by hand: jsdom lays nothing out. */
  function region(marks: readonly { id: string; top: number; height?: number; inside?: "list" }[]) {
    const host = document.createElement("div");
    document.body.appendChild(host);
    Object.defineProperty(host, "offsetWidth", { value: 400, configurable: true });
    Object.defineProperty(host, "offsetHeight", { value: 600, configurable: true });
    const rect = (top: number, height: number, left = 0, width = 400) => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    host.getBoundingClientRect = () => rect(100, 600);
    const shadow = host.attachShadow({ mode: "open" });
    const list = document.createElement("div");
    list.style.overflowX = "hidden";
    list.style.overflowY = "hidden";
    list.getBoundingClientRect = () => rect(100, 200);
    shadow.append(list);
    let measured = 0;
    for (const mark of marks) {
      const element = document.createElement("div");
      element.setAttribute("data-record", mark.id);
      element.getBoundingClientRect = () => (measured++, rect(mark.top, mark.height ?? 40));
      (mark.inside === "list" ? list : shadow).append(element);
    }
    return { host, shadow, measured: () => measured };
  }

  it("names only records it was handed as its seat sees them, says every one it shows in sight or not, and measures again only once something moved", async () => {
    const handed = new Set(["car:golf", "car:polo"]);
    const { host, shadow, measured } = region([
      { id: "car:golf", top: 120, inside: "list" },
      // Scrolled out of its list: shown, not in sight.
      { id: "car:polo", top: 400, inside: "list" },
      // Not handed, or not the seat's to see: never named.
      { id: "shopper:freya", top: 500 },
    ]);
    const records = createViewRecords(host, shadow, (id) => handed.has(id));
    const held = recordBoxesOf(host)!;
    expect(held.boxes()).toEqual([{ id: "car:golf", x: 0, y: 20, width: 400, height: 40 }]);
    expect(held.shows()).toEqual(["car:golf", "car:polo"]);
    const once = measured();
    held.boxes();
    held.boxes();
    expect(measured(), "read again, not measured again").toBe(once);
    shadow.querySelector("[data-record]")!.setAttribute("data-moved", "");
    await Promise.resolve();
    held.boxes();
    expect(measured(), "measured again once something in it moved").toBeGreaterThan(once);
    records.dispose();
    expect(recordBoxesOf(host)).toBeUndefined();
  });
});
