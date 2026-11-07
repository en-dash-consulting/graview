import { describe, expect, it } from "vitest";
import type { ViewerState, ViewerStateAnswer } from "@graview/core";
import { createMine, MINE_WRITES_A_MINUTE } from "../../src/host/mine.js";

/**
 * A VIEW DRAWN AGAIN IS THE SAME VIEW TO THE HOST (Roadmap
 * f-viewer-state-and-me-framework). A page remounts a view whenever its
 * definition, store or seat moves, with a write of the drawing before it still
 * on its way. Drawings on a page share one line per key, so that write cannot
 * land over the next drawing's, and the drawing on the page hears what lands.
 */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type Script = { readonly ms?: number; readonly answer?: ViewerStateAnswer; readonly throws?: boolean; readonly hangs?: boolean };

function hostOf(script: readonly Script[], initial: Record<string, string> = {}) {
  const db = new Map(Object.entries(initial));
  const calls: (string | null)[] = [];
  let at = 0;
  const state: ViewerState = {
    read: async () => Object.fromEntries(db),
    write: async (_view, key, value) => {
      calls.push(value);
      const step = script[at++] ?? {};
      if (step.hangs) return new Promise<ViewerStateAnswer>(() => {});
      await wait(step.ms ?? 0);
      if (step.throws) throw new Error("the host's own secret");
      if (step.answer && !step.answer.ok) return step.answer;
      if (value === null) db.delete(key);
      else db.set(key, value);
      return { ok: true };
    },
  };
  return { db, calls, state };
}

describe("a view drawn again with a write on its way", () => {
  it("cannot have the older land over the newer, with no timeout at all", async () => {
    const { db, calls, state } = hostOf([{ ms: 40 }]);
    const first = createMine({ view: "v", state });
    await first.ready;
    void first.set("k", "older");
    await wait(5);
    const second = createMine({ view: "v", state });
    await second.ready;
    await expect(second.set("k", "newer")).resolves.toEqual({ ok: true });
    await wait(60);
    expect(calls).toEqual(["older", "newer"]);
    expect(db.get("k")).toBe("newer");
    expect(second.values()).toEqual({ k: "newer" });
  });

  it("cannot have the older land over the newer past its time either", async () => {
    const { db, calls, state } = hostOf([{ ms: 60 }]);
    const first = createMine({ view: "v", state, writeMs: 15 });
    await first.ready;
    expect((await first.set("k", "older")).ok).toBe(false);
    const second = createMine({ view: "v", state, writeMs: 15 });
    await second.ready;
    expect((await second.set("k", "newer")).ok).toBe(false);
    await wait(100);
    expect(calls).toEqual(["older", "newer"]);
    expect(db.get("k")).toBe("newer");
    await expect(second.get("k")).resolves.toEqual({ ok: true, value: "newer" });
  });

  it("does not send a value of the old drawing's that was waiting once the new one asks for another", async () => {
    const { db, calls, state } = hostOf([{ ms: 40 }]);
    const first = createMine({ view: "v", state, writeMs: 10 });
    await first.ready;
    await first.set("k", "first");
    await first.set("k", "waiting");
    first.dispose();
    const second = createMine({ view: "v", state, writeMs: 10 });
    await second.ready;
    await second.set("k", "newest");
    await wait(80);
    expect(calls).toEqual(["first", "newest"]);
    expect(db.get("k")).toBe("newest");
  });

  it("hears the value that lands, from the old drawing's write, and is drawn with it", async () => {
    const { db, state } = hostOf([{ ms: 40 }], { k: "stored" });
    const first = createMine({ view: "v", state, writeMs: 10 });
    await first.ready;
    await first.set("k", "A");
    await first.set("k", "B");
    first.dispose();
    let pushed = 0;
    const second = createMine({ view: "v", state, writeMs: 10, onLate: () => (pushed += 1) });
    await second.ready;
    expect(second.values()).toEqual({ k: "stored" });
    await wait(80);
    expect(db.get("k")).toBe("B");
    expect(second.values()).toEqual({ k: "B" });
    await expect(second.get("k")).resolves.toEqual({ ok: true, value: "B" });
    expect(pushed).toBeGreaterThan(0);
  });

  it("keeps what landed while it was still reading, over what it read", async () => {
    let answer: (values: Record<string, string>) => void = () => {};
    const state: ViewerState = { read: () => new Promise((resolve) => (answer = resolve)), write: async () => (await wait(5), { ok: true }) };
    const first = createMine({ view: "v", state });
    answer({});
    await first.ready;
    const landing = first.set("k", "landed");
    const second = createMine({ view: "v", state });
    await landing;
    answer({ k: "stale" });
    await second.ready;
    expect(second.values()).toEqual({ k: "landed" });
  });

  it("is told of a change by another drawing on the page, which it did not ask for", async () => {
    const { state } = hostOf([]);
    let pushed = 0;
    const other = createMine({ view: "v", state, onLate: () => (pushed += 1) });
    const mine = createMine({ view: "v", state });
    await Promise.all([other.ready, mine.ready]);
    await mine.set("k", "x");
    expect(other.values()).toEqual({ k: "x" });
    expect(pushed).toBe(1);
  });

  it("is not told through a drawing that has gone", async () => {
    const { state } = hostOf([]);
    let pushed = 0;
    const gone = createMine({ view: "v", state, onLate: () => (pushed += 1) });
    await gone.ready;
    gone.dispose();
    await createMine({ view: "v", state }).set("k", "x");
    expect(pushed).toBe(0);
  });

  it("shares nothing with another viewer or another view on one state", async () => {
    const { db, calls, state } = hostOf([{ hangs: true }]);
    const mia = createMine({ view: "v", viewer: "mia", state, writeMs: 5 });
    await mia.set("k", "hers");
    const leo = createMine({ view: "v", viewer: "leo", state, writeMs: 5 });
    await expect(leo.set("k", "his")).resolves.toEqual({ ok: true });
    expect(calls).toEqual(["hers", "his"]);
    expect(db.get("k")).toBe("his");
  });
});

describe("a value that lands after an earlier one failed late", () => {
  for (const [how, first] of [["refused", { ms: 30, answer: { ok: false, sentence: "over cap" } }], ["threw", { ms: 30, throws: true }]] as const) {
    it(`is pushed to the view, when the first ${how}`, async () => {
      const { db, state } = hostOf([first]);
      let pushed = 0;
      const mine = createMine({ view: "v", state, writeMs: 5, onLate: () => (pushed += 1) });
      await mine.ready;
      expect((await mine.set("k", "A")).ok).toBe(false);
      expect((await mine.set("k", "B")).ok).toBe(false);
      await wait(60);
      expect(db.get("k")).toBe("B");
      expect(mine.values()).toEqual({ k: "B" });
      expect(pushed).toBe(1);
    });
  }
});

describe("the newest value, when its turn comes", () => {
  it("is sent whatever the write rate says: it was asked for inside it, and the view was told it would follow", async () => {
    const { db, calls, state } = hostOf([{ ms: 40 }]);
    const mine = createMine({ view: "v", state, writeMs: 5, now: () => 1 });
    await mine.ready;
    await mine.set("k", "older");
    await mine.set("k", "newest");
    await Promise.all(Array.from({ length: MINE_WRITES_A_MINUTE - 1 }, (_, one) => mine.set(`other${one}`, "x")));
    await wait(70);
    expect(calls.filter((one) => one !== "x")).toEqual(["older", "newest"]);
    expect(db.get("k")).toBe("newest");
    expect(mine.values()["k"]).toBe("newest");
  });
});

describe("a host that never answers many keys", () => {
  it("holds a bounded number open, and says so of the rest without asking it", async () => {
    const { calls, state } = hostOf(Array.from({ length: 1_000 }, () => ({ hangs: true })));
    let at = 0;
    const mine = createMine({ view: "v", state, writeMs: 1, now: () => at });
    await mine.ready;
    const sent: ViewerStateAnswer[] = [];
    for (let one = 0; one < 400; one++) {
      at += 60_001;
      sent.push(await mine.set(`k${one}`, "x"));
    }
    expect(calls.length).toBe(200);
    expect(sent.at(-1)).toMatchObject({ ok: false, sentence: expect.stringMatching(/not answered/) });
  });
});
