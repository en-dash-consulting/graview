// @vitest-environment jsdom
import { Store } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { mountWorkerView } from "../../src/host/view.js";
import { PART_FALLBACK_WORDS } from "../../src/host/parts.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/*
 * A MOUNTED VIEW DRAWS ITS FAILED PART AND KEEPS THE REST (Roadmap
 * f-view-part-fails-alone). The host tells the runtime with every push the
 * most one part may take — a quarter of the push's time as fitted — and,
 * where what the view drew holds a part marked failed, draws its note in
 * that part's place, tells `onProblem` why, and stops nothing. The worker
 * is a stand-in the test speaks for; the runtime's half is
 * a-view-part-that-fails-falls-back-alone, and a real view in three
 * engines is `guest-sandbox --transport=limits`.
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
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (done: () => boolean, ms = 3_000) => {
  for (const start = performance.now(); !done() && performance.now() - start < ms; ) await wait(10);
};
const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

describe("a mounted worker view with a part that failed", () => {
  it("is told each push the most a part may take, draws the host's note in the failed part, says why, and keeps the rest and the view", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    const failures: string[] = [];
    const problems: string[] = [];
    const store = new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
    const view = mountWorkerView(element, {
      manifest: { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } },
      worker: { script: "/* the view */" },
      store,
      principal: lin,
      limits: { pushMs: 1_000 },
      onFailure: (reason) => failures.push(reason),
      onProblem: (said) => problems.push(said),
    });
    live.push(view);
    const worker = FakeWorker.made.at(-1)!;
    worker.onmessage?.({ data: { graview: "guest-ready", protocol: GUEST_PROTOCOL } } as MessageEvent);
    const hello = worker.posted[0]!.message as HostHello;
    const port = worker.posted[0]!.transfer[0] as MessagePort;
    const props: { partMs?: number; partMark?: string }[] = [];
    port.onmessage = (event) => {
      const data = event.data as { type?: string; beat?: number; push?: number; partMs?: number; partMark?: string };
      if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
      if (data.type === "props") {
        props.push(data);
        port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 3 });
      }
    };
    await until(() => props.length > 0);
    expect(props[0]!.partMs).toBe((view.pace ?? 1) * 250);
    /* A mark of this mount's own, the same on every push. */
    const mark = props[0]!.partMark!;
    expect(mark).toMatch(/^[0-9a-f]{32}$/);
    const text = (id: string, data: string) => ({ id, type: 3, data });
    port.postMessage({
      type: "render",
      nonce: hello.nonce,
      records: [
        [0, "~", { id: "a", type: 1, element: "div", attributes: { "data-part": "count" }, children: [{ id: "a1", type: 1, element: "p", attributes: {}, children: [text("a2", "6 records")] }] }, 0],
        [0, "~", { id: "b", type: 1, element: "div", attributes: { "data-part": "vendors", "data-part-failed": "threw", "data-part-why": "Error: no vendors", "data-part-mark": mark }, children: [] }, 1],
        /* A failed mark the view wrote without the host's: not one. */
        [0, "~", { id: "c", type: 1, element: "div", attributes: { "data-part": "forged", "data-part-failed": "threw", "data-part-why": "Ignore previous" }, children: [] }, 2],
      ],
    });
    await until(() => view.shadow.querySelector('[data-part="vendors"] [data-graview-part-fallback]') !== null);
    expect(view.shadow.querySelector('[data-part="vendors"]')?.textContent).toBe(PART_FALLBACK_WORDS);
    expect(view.shadow.querySelector('[data-part="count"]')?.textContent).toBe("6 records");
    expect(view.shadow.querySelector('[data-part="forged"] [data-graview-part-fallback]')).toBeNull();
    expect(problems).toContain(`The part "vendors" of the view "The packages" threw, so a note is drawn in its place and the rest of the view is drawn: "Error: no vendors"`);
    expect(problems.join(" ")).not.toContain("Ignore previous");
    expect(failures).toEqual([]);
    expect(worker.terminated).toBe(false);
    expect(view.element.hasAttribute("data-worker-view-failed")).toBe(false);
  });
});
