// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ana, jobsApp, jobsSeed } from "../../../../scripts/fixtures/jobs-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { createGuestHost } from "../../src/host/session.js";
import { mountWorkerView } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type GuestFile, type GuestProps, type HostHello } from "../../src/protocol.js";

/*
 * A VIEW WITH MANY PICTURES IS NOT STOPPED AS A FLOOD (FR-207). Graview
 * Cloud's "the-faces" drew sixty records each with a small photo, and fell
 * back to the app's own page: the host pushed the view again for every
 * picture that settled, each push a full props message the view drew and
 * answered, so sixty pictures arriving within a second came back as more
 * than the 120 messages a view may send in 1 000 ms. The host now pushes
 * at most once per 100 ms however many pictures settle in it, and the
 * view's answer that it drew a push the host sent is not charged to its
 * allowance: the host asked for it.
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

const PICTURES = 64;
const faces: WorkerViewManifest = { name: "the-faces", title: "The faces", attach: "job", cardinality: "many", pictures: true };
const href = (i: number) => `/graview/files/face-${i}.png`;
const store = () =>
  new Store({
    schema: jobsApp.schema,
    mutations: [],
    policy: jobsApp.policy!,
    snapshot: {
      ...structuredClone(jobsSeed),
      nodes: [
        ...jobsSeed.nodes.filter((node) => node.kind !== "job"),
        ...Array.from({ length: PICTURES }, (_, i) => ({ id: `job:face-${i}`, kind: "job", label: `Face ${i}`, photos: [{ href: href(i), name: `face-${i}.png`, type: "image/png", bytes: 300, width: 40, height: 40 }] })),
      ],
      edges: Array.from({ length: PICTURES }, (_, i) => ({ kind: "on", from: `job:face-${i}`, to: "crew:ana" })),
    } as never,
  }) as unknown as Store<AnySchema>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (done: () => boolean, ms = 3_000) => {
  for (const start = performance.now(); !done() && performance.now() - start < ms; ) await wait(10);
};

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** The host's files route: each picture answered 8 ms after the one before, so they settle one by one across half a second, as a page fetching sixty photos sees them. */
function served() {
  let made = 0;
  Object.assign(window.URL, { createObjectURL: () => `blob:http://localhost:3000/${(made += 1)}`, revokeObjectURL: () => undefined });
  /* The page loads its own `blob:` images. */
  vi.spyOn(window, "Image").mockImplementation(function () {
    const image = { set src(_: string) { queueMicrotask(() => image.onload?.()); }, onload: undefined as undefined | (() => void), onerror: undefined };
    return image as never;
  } as never);
  vi.spyOn(window, "fetch").mockImplementation(async (url) => {
    const i = Number(/face-(\d+)\.png$/.exec(new URL(String(url)).pathname)?.[1] ?? -1);
    if (i < 0) return new Response(null, { status: 404 });
    await wait(8 * i);
    return new Response(new Uint8Array(300), { status: 200, headers: { "content-type": "image/png" } });
  });
}

/** The view, drawn: its runtime, which the test speaks for, draws each push it is sent and says it drew it — two messages a push, as a real view's are. */
function mounted() {
  served();
  const element = document.createElement("div");
  document.body.appendChild(element);
  const failures: { reason: string; detail?: string }[] = [];
  const view = mountWorkerView(element, { manifest: faces, worker: { script: "/* the faces */" }, store: store(), principal: ana, onFailure: (reason, detail) => failures.push({ reason, ...(detail ? { detail } : {}) }) });
  live.push(view);
  const props: GuestProps[] = [];
  const ready = async () => {
    await until(() => FakeWorker.made.length > 0);
    const worker = FakeWorker.made.at(-1)!;
    worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
    const hello = worker.posted[0]!.message as HostHello;
    const port = worker.posted[0]!.transfer[0] as MessagePort;
    let id = 0;
    port.onmessage = (event) => {
      const data = event.data as { type?: string; beat?: number; push?: number; props?: GuestProps };
      if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
      if (data.type === "props" && typeof data.push === "number") {
        props.push(data.props!);
        port.postMessage({ type: "render", nonce: hello.nonce, records: [[0, "~", { id: `p${(id += 1)}`, type: 1, element: "p", attributes: {}, children: [] }, 0]] });
        port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 2 });
      }
    };
    return worker;
  };
  return { view, failures, props, ready };
}

const srcs = (props: GuestProps | undefined) => (props?.nodes ?? []).flatMap((node) => ((node as unknown as { photos?: GuestFile[] }).photos ?? []).map((photo) => photo.src));

describe("a view handed sixty-four pictures that settle within a second", () => {
  it("is not stopped as a flood, and is handed every picture's address in the end", async () => {
    const { failures, props, ready } = mounted();
    const worker = await ready();
    await until(() => srcs(props.at(-1)).filter(Boolean).length === PICTURES || failures.length > 0);
    await wait(150);
    expect(failures).toEqual([]);
    expect(worker.terminated).toBe(false);
    expect(srcs(props.at(-1))).toHaveLength(PICTURES);
    expect(srcs(props.at(-1)).every((src) => src?.startsWith("blob:"))).toBe(true);
  });

  it("is pushed at most once in each 100 ms however many pictures settle in it, not once a picture", async () => {
    const { failures, props, ready } = mounted();
    await ready();
    const began = performance.now();
    await until(() => srcs(props.at(-1)).filter(Boolean).length === PICTURES || failures.length > 0);
    const took = performance.now() - began;
    /* The first push, and one for each 100 ms the pictures took to settle, with one to spare. */
    expect(props.length).toBeLessThanOrEqual(Math.ceil(took / 100) + 2);
    expect(props.length).toBeLessThan(PICTURES / 2);
  });
});

describe("a view's answer that it drew a push", () => {
  const host = (messages: number) => {
    let floods = 0;
    const sent: number[] = [];
    const session = createGuestHost({
      store: store(),
      principal: ana,
      view: "the-faces",
      nonce: "n",
      limits: { messages, messageWindowMs: 1_000 },
      send: (message) => {
        if (message.type === "props" && message.push !== undefined) sent.push(message.push);
      },
      onPushed: () => undefined,
      onFlood: () => (floods += 1),
    });
    return { session, sent, floods: () => floods };
  };

  it("is not charged to the view's allowance when it answers a push the host sent", () => {
    const { session, sent, floods } = host(5);
    for (let i = 0; i < 20; i += 1) {
      session.push();
      session.receive({ type: "pushed", nonce: "n", push: sent.at(-1), ms: 1 });
    }
    expect(floods()).toBe(0);
    expect(session.stats.dropped).toBe(0);
  });

  it("is charged when it answers a push the host never sent, or answers one twice", () => {
    const { session, sent, floods } = host(5);
    session.push();
    session.receive({ type: "pushed", nonce: "n", push: sent.at(-1), ms: 1 });
    for (let i = 0; i < 5; i += 1) session.receive({ type: "pushed", nonce: "n", push: sent.at(-1), ms: 1 });
    expect(floods()).toBe(0);
    session.receive({ type: "pushed", nonce: "n", push: 999, ms: 1 });
    expect(floods()).toBe(1);
  });
});
