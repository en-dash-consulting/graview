// @vitest-environment jsdom
import { Store } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { mountWorkerView } from "../../src/host/view.js";
import { mountGuestWorker } from "../../src/host/worker.js";
import { GUEST_PROTOCOL } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A WORKER THAT CANNOT START SAYS `start` (FR-102). A worker is made from a
 * `blob:` URL, so a page whose Content-Security-Policy has no `worker-src
 * blob:` (and no `blob:` in the `script-src` it falls back to) refuses it.
 * The engines say so three ways: Chromium and WebKit throw a SecurityError
 * from `new Worker`; Firefox makes the worker and then fires `error` on it,
 * with no message, after a `securitypolicyviolation` on the document; and a
 * worker that never runs a line never says ready. Each is `start` — never
 * `silent`, which is a worker that said ready and then stopped answering —
 * said once, with a sentence that names the directive when the policy was
 * the cause, and the plain face drawn. The engines themselves are
 * `guest-sandbox --transport=limits`, in Chromium, WebKit and Firefox.
 */
class FakeWorker {
  static made: FakeWorker[] = [];
  static refuse = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  constructor(readonly url: string) {
    if (FakeWorker.refuse) throw new DOMException("The operation is insecure.", "SecurityError");
    FakeWorker.made.push(this);
  }
  postMessage() {}
  terminate() {
    this.terminated = true;
  }
  /** What Firefox does with a worker its page's policy refuses: a violation on the document, then an error with no words. */
  refusedLikeFirefox(directive = "worker-src") {
    const violation = Object.assign(new Event("securitypolicyviolation"), { effectiveDirective: directive, violatedDirective: directive, blockedURI: "blob", disposition: "enforce" });
    document.dispatchEvent(violation);
    this.onerror?.({ message: undefined } as unknown as ErrorEvent);
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });

/* The page's console, for the whole file: it is told once per page, and every test here is the same page. */
const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (done: () => boolean, ms = 2_000) => {
  for (const start = performance.now(); !done() && performance.now() - start < ms; ) await wait(5);
};
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
const manifest = { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } } as const;

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  FakeWorker.refuse = false;
  document.body.replaceChildren();
});

function view(limits: Record<string, number> = {}) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const failures: { reason: string; detail?: string }[] = [];
  const mounted = mountWorkerView(element, { manifest, worker: { script: "/* the view */" }, store: store(), principal: lin, limits, onFailure: (reason, detail) => failures.push({ reason, ...(detail ? { detail } : {}) }) });
  live.push(mounted);
  return { view: mounted, failures, worker: FakeWorker.made.at(-1) };
}

const note = (mounted: { shadow: ShadowRoot }) => mounted.shadow.querySelector("[data-graview-fallback] p")?.textContent ?? "";
const face = (mounted: { shadow: ShadowRoot }) => [...mounted.shadow.querySelectorAll("[data-graview-fallback] li")].map((item) => item.textContent);

describe("a worker the page will not start", () => {
  it("says start once when new Worker throws, names worker-src blob:, and draws the plain face (Chromium, WebKit)", async () => {
    FakeWorker.refuse = true;
    const { view: mounted, failures } = view();
    await until(() => failures.length > 0);
    await wait(20);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason).toBe("start");
    expect(failures[0]!.detail).toMatch(/worker-src blob:/);
    expect(mounted.element.getAttribute("data-worker-view-failed")).toBe("start");
    expect(face(mounted)).toEqual(expect.arrayContaining(["A way in", "Team coaching"]));
    expect(note(mounted)).toContain("worker-src blob:");
    expect(mounted.worker).toBeUndefined();
  });

  it("says start once when the worker errs after a policy violation, names the directive, and stops it (Firefox)", async () => {
    const { view: mounted, failures, worker } = view({ readyMs: 300 });
    worker!.refusedLikeFirefox();
    await until(() => failures.length > 0);
    /* Past readyMs too: the timeout that would have fired says nothing more. */
    await wait(400);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ reason: "start" });
    expect(failures[0]!.detail).toMatch(/worker-src blob:/);
    expect(worker!.terminated).toBe(true);
    expect(mounted.element.getAttribute("data-worker-view-failed")).toBe("start");
  });

  it("says start, not silent, when the worker never says ready", async () => {
    const { failures, worker } = view({ readyMs: 50 });
    await until(() => failures.length > 0);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason).toBe("start");
    expect(failures[0]!.detail).toMatch(/50 ms/);
    expect(worker!.terminated).toBe(true);
  });

  it("says start with the engine's own words when the worker fails before ready and no policy refused it", async () => {
    const { failures, worker } = view();
    worker!.onerror?.({ message: "Uncaught SyntaxError: missing ) after argument list" } as ErrorEvent);
    await until(() => failures.length > 0);
    expect(failures).toEqual([{ reason: "start", detail: expect.stringContaining("SyntaxError") }]);
    expect(failures[0]!.detail).not.toMatch(/worker-src/);
  });

  it("is silent only once it has said ready and then stopped answering", async () => {
    const { failures, worker } = view({ silentMs: 60 });
    worker!.onmessage?.({ data: { graview: "guest-ready", protocol: GUEST_PROTOCOL } } as MessageEvent);
    await until(() => failures.length > 0);
    expect(failures.map((one) => one.reason)).toEqual(["silent"]);
  });

  it("tells the page's console what its policy lacks once, however many views it refuses", async () => {
    FakeWorker.refuse = true;
    const one = view();
    const two = view();
    await until(() => one.failures.length > 0 && two.failures.length > 0);
    expect([...one.failures, ...two.failures].map((failure) => failure.reason)).toEqual(["start", "start"]);
    const said = warn.mock.calls.filter((call) => String(call[0]).includes("worker-src"));
    /* The tests before this one refused views on this page too: still once. */
    expect(said).toHaveLength(1);
    expect(String(said[0]![0])).toContain("worker: { url }");
  });
});

describe("a kit guest the page will not start", () => {
  function guest(limits: Record<string, number> = {}) {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const failures: { reason: string; detail?: string }[] = [];
    const mounted = mountGuestWorker(element, { worker: { script: "/* the guest */" }, view: "card", store: showroom(), principal: bethan, limits, onFailure: (reason, detail) => failures.push({ reason, ...(detail ? { detail } : {}) }) });
    live.push(mounted);
    return { failures, worker: FakeWorker.made.at(-1) };
  }

  it("says start, with the directive, when the page refuses it", async () => {
    FakeWorker.refuse = true;
    const { failures } = guest();
    await until(() => failures.length > 0);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason).toBe("start");
    expect(failures[0]!.detail).toMatch(/worker-src blob:/);
  });

  it("says start, not silent, when it never says ready", async () => {
    const { failures } = guest({ readyMs: 50 });
    await until(() => failures.length > 0);
    expect(failures.map((one) => one.reason)).toEqual(["start"]);
  });
});
