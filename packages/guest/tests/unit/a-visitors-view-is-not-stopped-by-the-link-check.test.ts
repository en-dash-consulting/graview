// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ana, jobsApp, jobsSeed } from "../../../../scripts/fixtures/jobs-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { mountWorkerView } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/*
 * A VISITOR'S VIEW IS NOT STOPPED BY THE LINK CHECK (Roadmap
 * f-visitor-link-check-off-the-draw-clock). A home view handed fifty-seven
 * records with pictures, each card a link to its record and to a place,
 * was stopped for every signed-out visitor and drew well for its owner:
 * each link the host made asked the store which kinds the seat is kept
 * from, and for a seat under a `sees` rule that is worked out from every
 * act the seat may do — about a millisecond a time, six hundred and more
 * times a draw, all of it on the view's draw clock. What a seat is kept
 * from is now worked out once a batch the host draws, and again only once
 * the store, the seat or the declaration has changed.
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

const RECORDS = 57;
const faces: WorkerViewManifest = { name: "the-jobs", title: "The jobs", attach: "job", cardinality: "many", pictures: true };
const store = () =>
  new Store({
    schema: jobsApp.schema,
    mutations: [],
    policy: jobsApp.policy!,
    snapshot: {
      ...structuredClone(jobsSeed),
      nodes: [
        ...jobsSeed.nodes.filter((node) => node.kind !== "job"),
        ...Array.from({ length: RECORDS }, (_, i) => ({ id: `job:j${i}`, kind: "job", label: `Job ${i}`, photos: [{ href: `/graview/files/j-${i}.png`, name: `j-${i}.png`, type: "image/png", bytes: 300, width: 40, height: 40 }] })),
      ],
      edges: Array.from({ length: RECORDS }, (_, i) => ({ kind: "on", from: `job:j${i}`, to: "crew:ana" })),
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

let ids = 0;
const element = (name: string, attributes: Record<string, string> = {}, children: unknown[] = []) => ({ id: `v${(ids += 1)}`, type: 1, element: name, attributes, children });
const text = (data: string) => ({ id: `v${(ids += 1)}`, type: 3, data });
/** Each record a card bound to it, its heading a link to it, and two links to places under it: four links a record. */
const cards = () =>
  element(
    "ul",
    {},
    Array.from({ length: RECORDS }, (_, i) =>
      element("li", { "data-record": `job:j${i}` }, [
        element("h3", {}, [element("a", { "data-record": `job:j${i}` }, [text(`Job ${i}`)])]),
        element("a", { "data-place": "home" }, [text("Home")]),
        element("a", { "data-place": "jobs" }, [text("Every job")]),
      ]),
    ),
  );

async function drawn() {
  Object.assign(window.URL, { createObjectURL: () => "blob:http://localhost:3000/1", revokeObjectURL: () => undefined });
  vi.spyOn(window, "Image").mockImplementation(function () {
    const image = { set src(_: string) { queueMicrotask(() => image.onload?.()); }, onload: undefined as undefined | (() => void), onerror: undefined };
    return image as never;
  } as never);
  vi.spyOn(window, "fetch").mockImplementation(async () => new Response(new Uint8Array(300), { status: 200, headers: { "content-type": "image/png" } }));
  const shelf = store();
  const element_ = document.createElement("div");
  document.body.appendChild(element_);
  const failures: { reason: string; detail?: string }[] = [];
  const view = mountWorkerView(element_, {
    manifest: faces,
    worker: { script: "/* the jobs */" },
    store: shelf,
    principal: ana,
    /* What is held here is how often the host asks, not how long jsdom takes to draw: no budget stops it under a loaded suite. */
    limits: { drawMs: 60_000, pushMs: 60_000 },
    /* The pages face: each link carries the address it goes to, as a visitor's home does. */
    goTo: () => ({ record: () => {}, place: () => {}, list: () => {}, href: (to) => ("record" in to ? `/jobs/${to.record}` : "place" in to ? `/${to.place}` : `/${to.list}`) }),
    onFailure: (reason, detail) => failures.push({ reason, ...(detail ? { detail } : {}) }),
  });
  live.push(view);
  await until(() => FakeWorker.made.length > 0);
  const worker = FakeWorker.made.at(-1)!;
  worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
  const hello = worker.posted[0]!.message as HostHello;
  const port = worker.posted[0]!.transfer[0] as MessagePort;
  port.onmessage = (event) => {
    const data = event.data as { type?: string; beat?: number; push?: number };
    if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
    if (data.type === "props" && typeof data.push === "number") port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 2 });
  };
  /* The drawing's own half arrives, and the first push is answered, before the batch is sent: what is counted is the batch alone. */
  await until(() => view.element.hasAttribute("data-worker-view-drawn") || failures.length > 0);
  /* Each call counted and timed: the time is the host's, on the view's draw clock. */
  const asked = shelf.kindsKeptFrom.bind(shelf);
  let ms = 0;
  const kindsKept = vi.spyOn(shelf, "kindsKeptFrom").mockImplementation((principal) => {
    const began = performance.now();
    try {
      return asked(principal);
    } finally {
      ms += performance.now() - began;
    }
  });
  /* What the store works out, rather than answers from what it kept: every act the seat may do, judged. */
  const permitted = vi.spyOn(shelf as unknown as { kindsKeptNow(principal: unknown): ReadonlySet<string> }, "kindsKeptNow");
  const draw = async () => {
    const began = kindsKept.mock.calls.length;
    const worked = permitted.mock.calls.length;
    ms = 0;
    port.postMessage({ type: "render", nonce: hello.nonce, records: [[0, "~", cards(), 0]] });
    await until(() => view.shadow.querySelectorAll("[data-graview-link]").length >= RECORDS * 4 || failures.length > 0);
    await wait(20);
    if (process.env["GRAVIEW_TIMING"]) console.info(`kindsKeptFrom: ${kindsKept.mock.calls.length - began} calls, ${ms.toFixed(1)} ms`);
    return { asked: kindsKept.mock.calls.length - began, worked: permitted.mock.calls.length - worked, ms };
  };
  return { shelf, view, failures, draw };
}

describe("a visitor's view handed fifty-seven records, each with four links", () => {
  it("asks what the seat is kept from once for the batch, not once a link", async () => {
    const { view, failures, draw } = await drawn();
    const { asked, worked } = await draw();
    expect(failures).toEqual([]);
    expect(view.shadow.querySelectorAll("[data-graview-link]").length).toBeGreaterThanOrEqual(RECORDS * 4);
    expect(asked).toBeLessThanOrEqual(1);
    expect(worked).toBeLessThanOrEqual(1);
  });

  it("works it out again only once the store has changed, and then once", async () => {
    const { shelf, failures, draw } = await drawn();
    await draw();
    const same = await draw();
    shelf.reread();
    /* The change pushes the view again, which asks too: the push and the batch share one answer. */
    const again = await draw();
    expect(failures).toEqual([]);
    expect(same).toMatchObject({ asked: 1, worked: 0 });
    expect(again.worked).toBe(1);
    expect(again.asked).toBeLessThanOrEqual(2);
  });
});
