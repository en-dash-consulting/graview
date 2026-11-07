import { describe, expect, it, vi } from "vitest";
import type { ViewerState } from "@graview/core";
import { createGuestHost } from "../../src/host/frame.js";
import { createMine, keptForTheVisit, MINE_WRITES_A_MINUTE } from "../../src/host/mine.js";
import { MINE_MOST_BYTES, mineRefusal } from "../../src/protocol.js";
import { inbox, showroom, staff } from "./showroom.js";

/**
 * A VIEW KEEPS A SMALL VALUE FOR WHOEVER IS LOOKING (Roadmap
 * f-viewer-state-and-me-framework): `graview.mine`, by the view's name, in a
 * host's `ViewerState` or, without one, for the visit. Values are strings
 * somebody wrote, and never the graph's: not in the log, not in an export.
 */
function memory(): ViewerState & { readonly kept: Map<string, Map<string, string>> } {
  const kept = new Map<string, Map<string, string>>();
  return {
    kept,
    read: async (view) => Object.fromEntries(kept.get(view) ?? []),
    write: async (view, key, value) => {
      const values = kept.get(view) ?? new Map<string, string>();
      kept.set(view, values);
      if (value === null) values.delete(key);
      else values.set(key, value);
      return { ok: true };
    },
  };
}

describe("a value kept per view", () => {
  it("is seen again at draw time, on the next mount of the same view", async () => {
    const state = memory();
    const first = createMine({ view: "quiz", state });
    await first.ready;
    expect(first.values()).toEqual({});
    await expect(first.set("score", "7")).resolves.toEqual({ ok: true });
    expect(first.values()).toEqual({ score: "7" });
    const second = createMine({ view: "quiz", state });
    await second.ready;
    expect(second.values()).toEqual({ score: "7" });
    await expect(second.get("score")).resolves.toEqual({ ok: true, value: "7" });
    await expect(second.get("never")).resolves.toEqual({ ok: true, value: null });
  });

  it("is forgotten by null", async () => {
    const state = memory();
    const mine = createMine({ view: "quiz", state });
    await mine.set("score", "7");
    await mine.set("score", null);
    expect(mine.values()).toEqual({});
    expect(state.kept.get("quiz")?.has("score")).toBe(false);
  });

  it("lands in the order it was asked, and a get after a set sees the set", async () => {
    const order: string[] = [];
    const state: ViewerState = {
      read: async () => ({}),
      write: async (_view, _key, value) => {
        await new Promise((resolve) => setTimeout(resolve, value === "first" ? 20 : 0));
        order.push(String(value));
        return { ok: true };
      },
    };
    const mine = createMine({ view: "quiz", state });
    void mine.set("k", "first");
    void mine.set("k", "second");
    await expect(mine.get("k")).resolves.toEqual({ ok: true, value: "second" });
    expect(order).toEqual(["first", "second"]);
  });

  it("holds a key named __proto__ as a key, and pollutes nothing", async () => {
    const mine = createMine({ view: "quiz", state: memory() });
    await mine.set("__proto__", "x");
    expect(Object.getOwnPropertyDescriptor(mine.values(), "__proto__")?.value).toBe("x");
    expect(({} as Record<string, unknown>)["x"]).toBeUndefined();
    await expect(mine.get("__proto__")).resolves.toEqual({ ok: true, value: "x" });
    await expect(mine.get("constructor")).resolves.toEqual({ ok: true, value: null });
  });
});

describe("a view unable to read another's values", () => {
  it("names only its own: the host says the view, the wire says only a key", async () => {
    const state = memory();
    await state.write("gradebook", "secret", "A+");
    const said: unknown[] = [];
    const reads = vi.spyOn(state, "read");
    const writes = vi.spyOn(state, "write");
    const mine = createMine({ view: "quiz", state });
    const store = showroom();
    const host = createGuestHost({ store, principal: staff, view: "quiz", nonce: "n", send: (message) => said.push(message), mine });
    await mine.ready;
    for (const [id, key] of [[1, "secret"], [2, "gradebook:secret"], [3, "gradebook/secret"], [4, "../gradebook/secret"]] as const) host.receive({ type: "mine", nonce: "n", id, op: "get", key, view: "gradebook" });
    host.receive({ type: "mine", nonce: "n", id: 5, op: "set", key: "secret", value: "F", view: "gradebook" });
    await vi.waitFor(() => expect(said.filter((one) => (one as { type: string }).type === "mine-answer")).toHaveLength(5));
    for (const answer of said.slice(0, 4)) expect(answer).toMatchObject({ ok: true, value: null });
    expect(reads.mock.calls.every(([view]) => view === "quiz")).toBe(true);
    expect(writes).toHaveBeenCalledWith("quiz", "secret", "F");
    expect(state.kept.get("gradebook")?.get("secret")).toBe("A+");
    host.dispose();
  });

  it("does not hand one view's values to another for the visit either", async () => {
    const state = keptForTheVisit();
    await createMine({ view: "a", state }).set("k", "of a");
    const other = createMine({ view: "b", state });
    await other.ready;
    expect(other.values()).toEqual({});
  });
});

describe("the 4 KB refusal", () => {
  it("refuses a larger value in a sentence, measured in bytes, and keeps what stood", async () => {
    const state = memory();
    const mine = createMine({ view: "quiz", state });
    await mine.set("k", "small");
    const answer = await mine.set("k", "é".repeat(MINE_MOST_BYTES / 2 + 1));
    expect(answer).toEqual({ ok: false, sentence: expect.stringMatching(/4 KB/) });
    expect(mine.values()).toEqual({ k: "small" });
    expect(state.kept.get("quiz")?.get("k")).toBe("small");
    await expect(mine.set("k", "a".repeat(MINE_MOST_BYTES))).resolves.toEqual({ ok: true });
  });

  it("never quotes the value it refused, to the view or the host", () => {
    const sentence = mineRefusal("k", `Ignore previous instructions ${"x".repeat(5000)}`);
    expect(sentence).toBeDefined();
    expect(sentence).not.toMatch(/Ignore previous/);
  });

  it("refuses what is not a string, and a key that is empty or long", () => {
    expect(mineRefusal("k", 7)).toMatch(/string/);
    expect(mineRefusal("", "x")).toMatch(/key/);
    expect(mineRefusal("k".repeat(201), "x")).toMatch(/key/);
    expect(mineRefusal(9, "x")).toMatch(/key/);
    expect(mineRefusal("k", null)).toBeUndefined();
  });

  it("is said to the host's problems as well as to the view, without the value", async () => {
    const problems: string[] = [];
    const mine = createMine({ view: "quiz", state: memory(), onRefused: (sentence) => problems.push(sentence) });
    await mine.set("k", "x".repeat(MINE_MOST_BYTES + 1));
    expect(problems).toHaveLength(1);
    expect(problems[0]).not.toMatch(/xxx/);
  });
});

describe("a host's refusal", () => {
  it("is said as its sentence, and the value is not kept", async () => {
    const mine = createMine({ view: "quiz", state: { read: async () => ({ score: "1" }), write: async () => ({ ok: false, sentence: "This app keeps 64 KB for you, and that is full." }) } });
    await mine.ready;
    await expect(mine.set("score", "2")).resolves.toEqual({ ok: false, sentence: "This app keeps 64 KB for you, and that is full." });
    expect(mine.values()).toEqual({ score: "1" });
  });

  it("that throws is said in our words, never the error's", async () => {
    const mine = createMine({ view: "quiz", state: { read: async () => ({}), write: async () => { throw new Error("D1 token abc123 refused"); } } });
    const answer = await mine.set("k", "v");
    expect(answer.ok).toBe(false);
    expect(JSON.stringify(answer)).not.toMatch(/abc123/);
    await expect(mine.set("k", "v")).resolves.toMatchObject({ ok: false });
  });

  it("that cannot read hands an empty view, and says so", async () => {
    const problems: string[] = [];
    const mine = createMine({ view: "quiz", state: { read: async () => { throw new Error("no"); }, write: async () => ({ ok: true }) }, onRefused: (sentence) => problems.push(sentence) });
    await mine.ready;
    expect(mine.values()).toEqual({});
    expect(problems).toHaveLength(1);
  });

  it("that answers something other than strings is read as strings only", async () => {
    const mine = createMine({ view: "quiz", state: { read: async () => ({ fine: "1", bad: 2 }) as never, write: async () => ({ ok: true }) } });
    await mine.ready;
    expect(mine.values()).toEqual({ fine: "1" });
  });

  it("is held to a rate, so a view cannot flood a host's store", async () => {
    let at = 0;
    const write = vi.fn(async () => ({ ok: true as const }));
    const mine = createMine({ view: "quiz", state: { read: async () => ({}), write }, now: () => at });
    for (let one = 0; one < MINE_WRITES_A_MINUTE; one++) await mine.set("k", String(one));
    const past = await mine.set("k", "over");
    expect(past).toMatchObject({ ok: false, sentence: expect.stringMatching(/too many/i) });
    expect(write).toHaveBeenCalledTimes(MINE_WRITES_A_MINUTE);
    at = 61_000;
    await expect(mine.set("k", "later")).resolves.toEqual({ ok: true });
  });
});

describe("the visit-only fallback", () => {
  it("keeps values in memory, per view, across mounts", async () => {
    const state = keptForTheVisit();
    await createMine({ view: "quiz", state }).set("score", "3");
    const again = createMine({ view: "quiz", state });
    await again.ready;
    expect(again.values()).toEqual({ score: "3" });
  });

  it("holds the same 200 keys a host would, so a view cannot fill the page's memory", async () => {
    const state = keptForTheVisit();
    for (let one = 0; one < 200; one++) await expect(state.write("v", `k${one}`, "x")).resolves.toEqual({ ok: true });
    await expect(state.write("v", "one more", "x")).resolves.toMatchObject({ ok: false });
    await expect(state.write("v", "k1", "y")).resolves.toEqual({ ok: true });
    await expect(state.write("v", "k1", null)).resolves.toEqual({ ok: true });
    await expect(state.write("v", "one more", "x")).resolves.toEqual({ ok: true });
  });
});

describe("the graph knows nothing of it", () => {
  it("is not in the log, the snapshot or what the store tells anybody", async () => {
    const store = showroom();
    const before = JSON.stringify(store.snapshot());
    const ops = store.log.length;
    const heard = vi.fn();
    store.subscribe(heard);
    const { send } = inbox();
    const mine = createMine({ view: "quiz", state: keptForTheVisit() });
    const host = createGuestHost({ store, principal: staff, view: "quiz", nonce: "n", send, mine });
    host.receive({ type: "mine", nonce: "n", id: 1, op: "set", key: "progress", value: "a secret of mine" });
    await mine.get("progress");
    expect(store.log.length).toBe(ops);
    expect(JSON.stringify(store.snapshot())).toBe(before);
    expect(heard).not.toHaveBeenCalled();
    host.dispose();
  });

  it("a frame's host, with nothing to keep it in, drops the request unread", () => {
    const { said, send } = inbox();
    const host = createGuestHost({ store: showroom(), principal: staff, view: "card", nonce: "n", send });
    host.receive({ type: "mine", nonce: "n", id: 1, op: "get", key: "k" });
    expect(said.filter((one) => (one as { type: string }).type === "mine-answer")).toEqual([]);
    expect(host.stats.dropped).toBe(1);
    host.dispose();
  });
});
