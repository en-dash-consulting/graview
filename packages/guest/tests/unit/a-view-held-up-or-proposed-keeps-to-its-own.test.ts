import "@remote-dom/core/polyfill";
import { describe, expect, it } from "vitest";
import type { ViewerState } from "@graview/core";
import { createMine, keptForTheVisit, MINE_WRITES_A_MINUTE, visitOf } from "../../src/host/mine.js";

/**
 * WHAT `graview.mine` HOLDS TO (Roadmap f-viewer-state-and-me-framework): a
 * draft reads nothing of the real view's, a host that does not answer holds
 * nobody up, a view drawn again is the same view to the rate, and a value
 * that is neither a string nor null deletes nothing.
 */
const answering: ViewerState = { read: async () => ({}), write: async () => ({ ok: true }) };

describe("a draft with no host", () => {
  it("reads and overwrites nothing of the view it would replace", async () => {
    const store = {};
    const kept = createMine({ view: "tracker", state: visitOf(store, "user:nick") });
    await kept.set("progress", "mia's");
    const draft = createMine({ view: "tracker", state: keptForTheVisit() });
    await draft.ready;
    expect(draft.values()).toEqual({});
    await draft.set("progress", "the draft's");
    const again = createMine({ view: "tracker", state: visitOf(store, "user:nick") });
    await again.ready;
    expect(again.values()).toEqual({ progress: "mia's" });
  });
});

describe("a host that never answers", () => {
  const hung: ViewerState = { read: () => new Promise(() => {}), write: async () => ({ ok: true }) };
  it("does not hold the first draw, and each ask is answered in a sentence", async () => {
    const problems: string[] = [];
    const mine = createMine({ view: "v", state: hung, readMs: 10, onRefused: (sentence) => problems.push(sentence) });
    await mine.ready;
    expect(mine.values()).toEqual({});
    await expect(mine.get("k")).resolves.toEqual({ ok: false, sentence: expect.stringMatching(/could not be read/) });
    await expect(mine.set("k", "v")).resolves.toEqual({ ok: false, sentence: expect.stringMatching(/not kept/) });
    expect(problems.length).toBeGreaterThan(0);
  });

  it("whose values come late has them pushed, and answers again", async () => {
    let arrive: (values: Record<string, string>) => void = () => {};
    const late: ViewerState = { read: () => new Promise((resolve) => (arrive = resolve)), write: async () => ({ ok: true }) };
    let pushes = 0;
    const mine = createMine({ view: "v", state: late, readMs: 5, onLate: () => (pushes += 1) });
    await mine.ready;
    arrive({ k: "there" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(pushes).toBe(1);
    expect(mine.values()).toEqual({ k: "there" });
    await expect(mine.get("k")).resolves.toEqual({ ok: true, value: "there" });
  });

  it("on one write does not hold up the next", async () => {
    let hang = true;
    const state: ViewerState = { read: async () => ({}), write: () => (hang ? ((hang = false), new Promise(() => {})) : Promise.resolve({ ok: true as const })) };
    const mine = createMine({ view: "v", state, writeMs: 5 });
    await expect(mine.set("a", "1")).resolves.toMatchObject({ ok: false });
    await expect(mine.set("b", "2")).resolves.toEqual({ ok: true });
    expect(mine.values()).toEqual({ b: "2" });
  });
});

describe("the write rate", () => {
  it("is the view's and not the drawing's: drawn again it does not start over", async () => {
    const state: ViewerState = { ...answering };
    const at = 1;
    const first = createMine({ view: "v", state, now: () => at });
    for (let one = 0; one < MINE_WRITES_A_MINUTE; one++) await expect(first.set(`k${one}`, "x")).resolves.toEqual({ ok: true });
    const second = createMine({ view: "v", state, now: () => at });
    await expect(second.set("again", "x")).resolves.toMatchObject({ ok: false, sentence: expect.stringMatching(/too many/) });
    const other = createMine({ view: "w", state, now: () => at });
    await expect(other.set("again", "x")).resolves.toEqual({ ok: true });
  });
});

describe("graview.mine.set", () => {
  it("sends undefined as it was given, so the host refuses it and nothing is deleted", async () => {
    const { createViewRuntime } = await import("../../src/worker/view-global.js");
    const sent: { type: string; value?: unknown; id?: number }[] = [];
    const runtime = createViewRuntime({ send: (request: never) => sent.push(request), act: async () => ({}), navigate() {}, microtask: queueMicrotask, now: () => 0, threw() {}, warn() {}, hardening: () => ({}) } as never);
    const asked = runtime.view.mine.set("k", undefined as never);
    const one = sent.find((message) => message.type === "mine")!;
    expect("value" in one).toBe(true);
    expect(one.value).toBeUndefined();
    const mine = createMine({ view: "v", state: { read: async () => ({ k: "stays" }), write: async () => ({ ok: true }) } });
    await mine.ready;
    await expect(mine.set("k", undefined)).resolves.toMatchObject({ ok: false, sentence: expect.stringMatching(/string or null/) });
    expect(mine.values()).toEqual({ k: "stays" });
    runtime.hear({ type: "mine-answer", id: one.id!, ok: false, sentence: "A view keeps a string or null." });
    await expect(asked).rejects.toThrow("A view keeps a string or null.");
  });

  it("rejects a get the host could not read, in its sentence", async () => {
    const { createViewRuntime } = await import("../../src/worker/view-global.js");
    const sent: { type: string; id?: number }[] = [];
    const runtime = createViewRuntime({ send: (request: never) => sent.push(request), act: async () => ({}), navigate() {}, microtask: queueMicrotask, now: () => 0, threw() {}, warn() {}, hardening: () => ({}) } as never);
    const asked = runtime.view.mine.get("k");
    runtime.hear({ type: "mine-answer", id: sent.find((message) => message.type === "mine")!.id!, ok: false, sentence: "could not be read" });
    await expect(asked).rejects.toThrow("could not be read");
  });
});
