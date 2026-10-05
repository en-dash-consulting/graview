// @vitest-environment jsdom
import { Store } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { mountWorkerView, type WorkerViewLimits } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/**
 * A WORKER VIEW PAST ITS LIMITS IS STOPPED, AND THE PLAIN FACE IS DRAWN IN
 * ITS PLACE (FR-94). The host caps a view's source, the nodes it draws, the
 * messages it sends a second and the time it takes over each push of what
 * it is shown. Past any of them the worker is terminated, the plain face of
 * what the view was shown — its title and each record's label — is drawn
 * in the region, and `onFailure` hears the reason and a sentence saying it.
 * The worker here is a stand-in the test speaks for; a real view that
 * spins, floods and draws 100 000 nodes, in Chromium, WebKit and Firefox,
 * is `guest-sandbox --transport=limits`.
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
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

/** A view past its ready, whose runtime the test speaks for: it answers heartbeats, and acks each push unless told not to. */
function started(limits: WorkerViewLimits, runtime: { readonly acks?: boolean | { readonly ms: number } } = {}, script = "/* the view */") {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const failures: { reason: string; detail?: string; at: number }[] = [];
  const view = mountWorkerView(element, {
    manifest,
    worker: { script },
    store: store(),
    principal: lin,
    limits: { silentMs: 5_000, ...limits },
    onFailure: (reason, detail) => failures.push({ reason, ...(detail ? { detail } : {}), at: performance.now() }),
  });
  live.push(view);
  const worker = FakeWorker.made.at(-1);
  if (!worker) return { view, failures };
  worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
  const hello = worker.posted[0]!.message as HostHello;
  const port = worker.posted[0]!.transfer[0] as MessagePort;
  const pushes: number[] = [];
  port.onmessage = (event) => {
    const data = event.data as { type?: string; beat?: number; push?: number };
    if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
    if (data.type === "props" && typeof data.push === "number") {
      pushes.push(data.push);
      if (runtime.acks !== false) port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: typeof runtime.acks === "object" ? runtime.acks.ms : 3 });
    }
  };
  const say = (message: Record<string, unknown>) => port.postMessage({ ...message, nonce: hello.nonce });
  return { view, failures, worker, say, pushes, readyAt: performance.now() };
}

/** The plain face's records, as the region draws them. */
const face = (view: { shadow: ShadowRoot }) => [...view.shadow.querySelectorAll("[data-graview-fallback] li")].map((item) => item.textContent);

describe("a worker view past its limits", () => {
  it("is never started when its code is longer than maxSourceBytes, and its plain face is drawn", async () => {
    const { view, failures } = started({ maxSourceBytes: 1_000 }, {}, "x".repeat(1_001));
    await until(() => failures.length > 0);
    expect(FakeWorker.made).toHaveLength(0);
    expect(failures[0]).toMatchObject({ reason: "source", detail: "Its code is longer than the 1,000 bytes a view may be." });
    expect(face(view)).toEqual(expect.arrayContaining(["A way in", "Team coaching"]));
    expect(view.element.getAttribute("data-worker-view-failed")).toBe("source");
  });

  it("is stopped when it draws more than maxNodes, and its plain face is drawn in its place", async () => {
    const { view, failures, worker, say } = started({ maxNodes: 50 });
    let id = 0;
    const many = { id: `n${(id += 1)}`, type: 1, element: "ul", attributes: {}, children: Array.from({ length: 100_000 }, () => ({ id: `n${(id += 1)}`, type: 1, element: "li", attributes: {}, children: [] })) };
    say!({ type: "render", records: [[0, "~", many, 0]] });
    await until(() => failures.length > 0);
    expect(failures[0]).toMatchObject({ reason: "nodes", detail: "It drew more than the 50 things a view may draw." });
    expect(worker!.terminated).toBe(true);
    expect(face(view)).toContain("The whole thing");
    expect(view.shadow.querySelectorAll("li").length).toBeLessThan(20);
  });

  it("is stopped when it floods the host with messages, at the allowance", async () => {
    const { failures, worker, say } = started({ messages: 20, messageWindowMs: 1_000 });
    for (let i = 0; i < 500; i += 1) say!({ type: "style", css: `.x${i} { color: red }` });
    await until(() => failures.length > 0);
    expect(failures[0]).toMatchObject({ reason: "flood", detail: "It sent more than 20 messages in 1,000 ms." });
    expect(worker!.terminated).toBe(true);
  });

  it("is stopped as slow when it never says it drew a push, within pushMs and one interval of it", async () => {
    const { failures, worker, readyAt } = started({ pushMs: 200 }, { acks: false });
    await until(() => failures.length > 0);
    expect(failures[0]).toMatchObject({ reason: "slow", detail: "It took longer than 200 ms to draw what it was shown." });
    expect(failures[0]!.at - readyAt!).toBeGreaterThanOrEqual(180);
    expect(failures[0]!.at - readyAt!).toBeLessThan(200 + 50 + 250);
    expect(worker!.terminated).toBe(true);
  });

  it("is stopped as slow when its runtime says its listeners took longer than pushMs", async () => {
    const { failures } = started({ pushMs: 200 }, { acks: { ms: 450 } });
    await until(() => failures.length > 0);
    expect(failures[0]).toMatchObject({ reason: "slow" });
  });

  it("is kept when it draws each push in time, however long it lives", async () => {
    const { failures, view, pushes } = started({ pushMs: 100 });
    for (let i = 0; i < 6; i += 1) {
      view.update();
      await wait(60);
    }
    expect(failures).toEqual([]);
    expect(pushes!.length).toBeGreaterThanOrEqual(2);
  });

  it("is stopped when it throws before it draws anything, and the engine's words are said", async () => {
    const { failures, worker } = started({});
    worker!.onerror?.({ message: "ReferenceError: grapview is not defined" } as unknown as Event);
    await until(() => failures.length > 0);
    expect(failures[0]).toMatchObject({ reason: "error", detail: "It failed before it drew anything: ReferenceError: grapview is not defined" });
  });

  it("draws what the host says in its place, or nothing, when the host draws its own", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const drawn: string[] = [];
    const custom = mountWorkerView(element, { manifest, worker: { script: "y".repeat(20) }, store: store(), principal: lin, limits: { maxSourceBytes: 10 }, fallback: (_, reason, said) => drawn.push(`${reason}: ${said}`) });
    const none = mountWorkerView(element, { manifest, worker: { script: "y".repeat(20) }, store: store(), principal: lin, limits: { maxSourceBytes: 10 }, fallback: false });
    live.push(custom, none);
    await until(() => drawn.length > 0);
    await wait(10);
    expect(drawn).toEqual(["source: Its code is longer than the 10 bytes a view may be."]);
    expect(none.shadow.childNodes).toHaveLength(0);
  });
});
