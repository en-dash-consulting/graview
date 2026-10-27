// @vitest-environment jsdom
import { Store } from "@graview/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { FAST_START_MS, PACE_CEILING, fitBudget, forgetStart, keepStart, keptStart, paceOf } from "../../src/host/device-pace.js";
import { mountWorkerView, type WorkerViewLimits } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/**
 * A WORKER VIEW'S DRAW BUDGET FITS THE DEVICE (Roadmap
 * f-view-budget-fits-device). The time a view has over a push (`pushMs`)
 * and the page's time drawing it (`drawMs`) were fixed, so the slowest
 * devices lost their views first. The page measures its first worker's
 * start — from `new Worker` to its ready — once, keeps it, and gives every
 * view its base times that pace: 1 for a start of 60 ms or under, up to 4.
 * The host's own base is honored, the counts never scale, and the sentence
 * a stopped view is given names the budget it was actually held to. The
 * worker here is a stand-in the test speaks for, saying ready when the test
 * says; the real start, in a real browser, is `guest-sandbox
 * --transport=limits`.
 */
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: { message: unknown; transfer: unknown[] }[] = [];
  terminated = false;
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage(message: unknown, transfer: unknown[] = []) {
    this.posted.push({ message, transfer });
  }
  terminate() {
    this.terminated = true;
  }
  say(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (done: () => boolean, ms = 3_000) => {
  for (const start = performance.now(); !done() && performance.now() - start < ms; ) await wait(10);
};
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
const manifest = { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } } as const;

const live: { dispose(): void }[] = [];
beforeEach(() => forgetStart(window));
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
  forgetStart(window);
});

/** A view mounted, whose worker says ready after `startMs` of the page's time; its runtime, which the test speaks for, answers heartbeats and acks each push unless told not to. */
async function started(limits: WorkerViewLimits, runtime: { readonly startMs?: number; readonly acks?: boolean | { readonly ms: number } } = {}) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const failures: { reason: string; detail?: string }[] = [];
  const view = mountWorkerView(element, {
    manifest,
    worker: { script: "/* the view */" },
    store: store(),
    principal: lin,
    limits: { silentMs: 5_000, ...limits },
    onFailure: (reason, detail) => failures.push({ reason, ...(detail ? { detail } : {}) }),
  });
  live.push(view);
  const worker = FakeWorker.made.at(-1)!;
  if (runtime.startMs) await wait(runtime.startMs);
  worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
  const hello = worker.posted[0]!.message as HostHello;
  const port = worker.posted[0]!.transfer[0] as MessagePort;
  port.onmessage = (event) => {
    const data = event.data as { type?: string; beat?: number; push?: number };
    if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
    if (data.type === "props" && typeof data.push === "number" && runtime.acks !== false) port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: typeof runtime.acks === "object" ? runtime.acks.ms : 3 });
  };
  const say = (message: Record<string, unknown>) => port.postMessage({ ...message, nonce: hello.nonce });
  return { view, failures, worker, say };
}

describe("the pace a start says", () => {
  it("is 1 for a fast start — 60 ms or under — so a fast device keeps today's guard", () => {
    expect(paceOf(0)).toBe(1);
    expect(paceOf(12)).toBe(1);
    expect(paceOf(FAST_START_MS)).toBe(1);
  });

  it("grows with the start, to a tenth, and never past the ceiling of 4", () => {
    expect(paceOf(90)).toBe(1.5);
    expect(paceOf(120)).toBe(2);
    expect(paceOf(144)).toBe(2.4);
    expect(paceOf(240)).toBe(PACE_CEILING);
    expect(paceOf(5_000)).toBe(PACE_CEILING);
    expect(paceOf(Number.NaN)).toBe(1);
  });

  it("fits the host's own base, not only the defaults, and leaves the counts alone", () => {
    expect(fitBudget({ pushMs: 1_000, drawMs: 100 }, 2.4)).toEqual({ pushMs: 2_400, drawMs: 240 });
    /* Graview Cloud's 3 000 / 300 is scaled too, never past four times. */
    expect(fitBudget({ pushMs: 3_000, drawMs: 300 }, 4)).toEqual({ pushMs: 12_000, drawMs: 1_200 });
    expect(fitBudget({ pushMs: 1_000, drawMs: 100, messages: 120, maxNodes: 5_000 }, 4)).toEqual({ pushMs: 4_000, drawMs: 400, messages: 120, maxNodes: 5_000 });
  });

  it("is measured once a page and kept: the first start wins, until it is forgotten", () => {
    const page = {};
    expect(keptStart(page)).toBeUndefined();
    expect(keepStart(page, 150)).toBe(150);
    expect(keepStart(page, 2)).toBe(150);
    expect(keptStart(page)).toBe(150);
    forgetStart(page);
    expect(keepStart(page, 2)).toBe(2);
  });
});

describe("a worker view's draw budget", () => {
  it("is the host's base on a page whose worker started fast, and says so when the view is slow", async () => {
    const { view, failures } = await started({ pushMs: 200 }, { acks: false });
    await until(() => failures.length > 0);
    expect(view.pace).toBe(1);
    expect(failures[0]).toMatchObject({ reason: "slow", detail: "It took longer than 200 ms to draw what it was shown." });
  });

  it("is four times the base on a page whose worker took four times a fast start or longer, and the sentence names the budget used", async () => {
    const { view, failures } = await started({ pushMs: 200 }, { startMs: FAST_START_MS * PACE_CEILING + 40, acks: false });
    expect(view.pace).toBe(PACE_CEILING);
    /* Within the base it would have been stopped at; it is not. */
    await wait(350);
    expect(failures).toEqual([]);
    await until(() => failures.length > 0, 2_000);
    expect(failures[0]).toMatchObject({ reason: "slow", detail: "It took longer than 800 ms to draw what it was shown." });
  });

  it("keeps a view whose listeners take longer than the base but not the fitted budget", async () => {
    const { failures } = await started({ pushMs: 200 }, { startMs: FAST_START_MS * PACE_CEILING + 40, acks: { ms: 450 } });
    await wait(300);
    expect(failures).toEqual([]);
  });

  it("is measured once a page: the second view's worker is not measured, and is given the pace the first one said", async () => {
    const first = await started({ pushMs: 200 }, { startMs: FAST_START_MS * PACE_CEILING + 40 });
    expect(first.view.pace).toBe(PACE_CEILING);
    const second = await started({ pushMs: 200 }, { acks: false });
    expect(second.view.pace).toBe(PACE_CEILING);
    await until(() => second.failures.length > 0, 2_000);
    expect(second.failures[0]).toMatchObject({ reason: "slow", detail: "It took longer than 800 ms to draw what it was shown." });
  });

  it("never fits the message allowance: a flood is a flood on a slow device too", async () => {
    const { failures, worker, say } = await started({ messages: 20, messageWindowMs: 1_000 }, { startMs: FAST_START_MS * PACE_CEILING + 40 });
    for (let i = 0; i < 500; i += 1) say({ type: "style", sheets: [`.x${i} { color: red }`] });
    await until(() => failures.length > 0);
    expect(failures[0]).toMatchObject({ reason: "flood", detail: "It sent more than 20 messages in 1,000 ms." });
    expect(worker.terminated).toBe(true);
  });

  it("is undefined until the worker has said ready", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const view = mountWorkerView(element, { manifest, worker: { script: "/* the view */" }, store: store(), principal: lin });
    live.push(view);
    expect(view.pace).toBeUndefined();
  });
});
