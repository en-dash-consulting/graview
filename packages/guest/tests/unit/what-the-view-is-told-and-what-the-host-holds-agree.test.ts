import { describe, expect, it } from "vitest";
import type { ViewerState, ViewerStateAnswer } from "@graview/core";
import { createMine, MINE_WRITES_A_MINUTE } from "../../src/host/mine.js";

/**
 * A HOST THAT IS SLOW IS NOT A HOST THAT REFUSED (Roadmap
 * f-viewer-state-and-me-framework). A write past its time may still land, and
 * nothing can cancel it, so the view is told "not kept yet", and writes to one
 * key never overtake each other: a newer value waits for the older to settle,
 * and only the newest is sent. What the host ends holding is what the view
 * asked for last.
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function slowHost(delays: number[]) {
  const db = new Map<string, string>();
  const sent: string[] = [];
  const state: ViewerState = {
    read: async () => Object.fromEntries(db),
    write: async (_view, key, value) => {
      sent.push(String(value));
      await wait(delays.shift() ?? 0);
      if (value === null) db.delete(key);
      else db.set(key, value);
      return { ok: true };
    },
  };
  return { db, sent, state };
}

describe("a write that takes longer than its time", () => {
  it("cannot land over a newer one: the host ends holding the newest, and so does the view", async () => {
    const { db, sent, state } = slowHost([60]);
    let late = 0;
    const mine = createMine({ view: "v", state, writeMs: 15, onLate: () => (late += 1) });
    await mine.ready;
    expect((await mine.set("k", "older")).ok).toBe(false);
    expect((await mine.set("k", "newer")).ok).toBe(false);
    await wait(100);
    expect(sent).toEqual(["older", "newer"]);
    expect(db.get("k")).toBe("newer");
    expect(mine.values()).toEqual({ k: "newer" });
    await expect(mine.get("k")).resolves.toEqual({ ok: true, value: "newer" });
    expect(late).toBe(1);
  });

  it("alone, is said as not kept yet, never as refused, and shows once it lands", async () => {
    const { db, state } = slowHost([40]);
    let late = 0;
    const mine = createMine({ view: "v", state, writeMs: 10, onLate: () => (late += 1) });
    await mine.ready;
    const answer = await mine.set("k", "x");
    expect(answer).toEqual({ ok: false, sentence: expect.stringMatching(/not kept yet/) });
    expect(mine.values()).toEqual({});
    await wait(70);
    expect(db.get("k")).toBe("x");
    expect(mine.values()).toEqual({ k: "x" });
    expect(late).toBe(1);
  });

  it("that the host then refuses is said to the host's problems, and nothing shows", async () => {
    const problems: string[] = [];
    const state: ViewerState = { read: async () => ({}), write: async () => (await wait(30), { ok: false, sentence: "That is full." }) };
    const mine = createMine({ view: "v", state, writeMs: 5, onRefused: (sentence) => problems.push(sentence) });
    await mine.set("k", "x");
    await wait(50);
    expect(mine.values()).toEqual({});
    expect(problems).toContain("That is full.");
  });

  it("does not hold up writes to other keys", async () => {
    const started: string[] = [];
    const state: ViewerState = { read: async () => ({}), write: (_view, key) => (started.push(key), key === "stuck" ? new Promise<ViewerStateAnswer>(() => {}) : Promise.resolve({ ok: true })) };
    const mine = createMine({ view: "v", state, writeMs: 1_000 });
    await mine.ready;
    void mine.set("stuck", "x");
    const began = Date.now();
    await expect(mine.set("free", "y")).resolves.toEqual({ ok: true });
    await expect(mine.get("free")).resolves.toEqual({ ok: true, value: "y" });
    expect(started).toEqual(["stuck", "free"]);
    expect(Date.now() - began).toBeLessThan(500);
  });
});

describe("while a write is under way", () => {
  it("only the newest of several waiting is sent, and each is told how it went", async () => {
    const { db, sent, state } = slowHost([10, 0]);
    const mine = createMine({ view: "v", state });
    await mine.ready;
    const answers = await Promise.all(["a", "b", "c", "d"].map((value) => mine.set("k", value)));
    expect(answers).toEqual(Array(4).fill({ ok: true }));
    expect(sent).toEqual(["a", "d"]);
    expect(db.get("k")).toBe("d");
  });
});

describe("a host that never answers a write", () => {
  it("costs a get one timeout at most, and an ask after that nothing", async () => {
    const state: ViewerState = { read: async () => ({}), write: () => new Promise<ViewerStateAnswer>(() => {}) };
    const mine = createMine({ view: "v", state, writeMs: 30 });
    await mine.ready;
    const began = Date.now();
    const all = Array.from({ length: 10 }, (_, one) => mine.set("k", String(one)));
    await expect(mine.get("k")).resolves.toEqual({ ok: false, sentence: expect.stringMatching(/not kept yet|not answered/) });
    expect(Date.now() - began).toBeLessThan(200);
    const after = Date.now();
    await expect(mine.set("k", "more")).resolves.toMatchObject({ ok: false });
    await expect(mine.get("k")).resolves.toMatchObject({ ok: false });
    expect(Date.now() - after).toBeLessThan(20);
    await Promise.all(all);
  });
});

describe("the write rate", () => {
  it("is each viewer's: a host handing one object does not let Mia's writes refuse Leo's", async () => {
    const state: ViewerState = { read: async () => ({}), write: async () => ({ ok: true }) };
    const miaMine = createMine({ view: "v", viewer: "mia", state, now: () => 1 });
    for (let one = 0; one < MINE_WRITES_A_MINUTE; one++) await miaMine.set(`k${one}`, "x");
    await expect(miaMine.set("over", "x")).resolves.toMatchObject({ ok: false });
    const leoMine = createMine({ view: "v", viewer: "leo", state, now: () => 1 });
    await expect(leoMine.set("k", "x")).resolves.toEqual({ ok: true });
  });

  it("counts only what is sent: writes refused while unread spend none of it", async () => {
    let reads = 0;
    const state: ViewerState = { read: () => (++reads === 1 ? Promise.reject(new Error("no")) : Promise.resolve({})), write: async () => ({ ok: true }) };
    const unread = createMine({ view: "v", state, now: () => 1 });
    for (let one = 0; one < MINE_WRITES_A_MINUTE; one++) await unread.set("k", "x");
    const again = createMine({ view: "v", state, now: () => 1 });
    await expect(again.set("k", "x")).resolves.toEqual({ ok: true });
  });
});
