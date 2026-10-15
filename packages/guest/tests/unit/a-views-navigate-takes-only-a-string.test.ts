// @vitest-environment jsdom
import { Store } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { judgeTranscript } from "../../src/headless/judge.js";
import { mountWorkerView, type WorkerViewLimits } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/**
 * A VIEW'S NAVIGATE TAKES ONLY A STRING. What a worker sends is the
 * worker's to choose, so a navigate whose destination is no string — an
 * object, a number — is refused without a sentence: nothing it holds
 * reaches the host's `onProblem`, and from there a problems list. One that
 * is a string but goes nowhere says why, quoting at most 80 characters of
 * it, so a view cannot write a sentence of any length into the host's
 * problems. Every navigate is a message, and the flood allowance counts it.
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
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never });
const manifest = { name: "packages", title: "The packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"], edges: ["includes"] } } as const;
const places = [{ as: "the-packages", title: "The packages", kind: "package" }];

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

/** A view past its ready, whose runtime the test speaks for. */
function started(limits: WorkerViewLimits = {}) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const problems: string[] = [];
  const failures: string[] = [];
  const view = mountWorkerView(element, {
    manifest,
    worker: { script: "/* the view */" },
    store: store(),
    principal: lin,
    places: () => places,
    limits: { silentMs: 5_000, ...limits },
    onProblem: (said) => problems.push(said),
    onFailure: (reason) => failures.push(reason),
  });
  live.push(view);
  const worker = FakeWorker.made.at(-1)!;
  worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
  const hello = worker.posted[0]!.message as HostHello;
  const port = worker.posted[0]!.transfer[0] as MessagePort;
  port.onmessage = (event) => {
    const data = event.data as { type?: string; beat?: number; push?: number };
    if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
    if (data.type === "props" && typeof data.push === "number") port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 3 });
  };
  const say = (message: Record<string, unknown>) => port.postMessage({ ...message, nonce: hello.nonce });
  return { problems, failures, worker, say };
}

describe("a view's navigate", () => {
  it("is refused without a sentence when its destination is no string: an object, a number", async () => {
    const { problems, say } = started();
    say({ type: "navigate", to: { record: "x".repeat(10_000) } });
    say({ type: "navigate", to: { toString: "nowhere" } });
    say({ type: "navigate", to: 42 });
    say({ type: "navigate", place: 7, to: [1, 2, 3] });
    say({ type: "navigate" });
    await wait(50);
    expect(problems).toEqual([]);
  });

  it("quotes at most 80 characters of a destination that goes nowhere, ending with an ellipsis", async () => {
    const { problems, say } = started();
    say({ type: "navigate", to: "x".repeat(10_000) });
    say({ type: "navigate", place: "y".repeat(10_000) });
    await wait(50);
    expect(problems).toEqual([
      `"${"x".repeat(79)}…" is no record this viewer may see and is no place of this app: it goes nowhere. Its places: "the-packages" (The packages). Its lists: "parties", "offers", "packages", "what-we-heard".`,
      `The place "${"y".repeat(79)}…" is no place of this app: it goes nowhere. Its places: "the-packages" (The packages). Its lists: "parties", "offers", "packages", "what-we-heard".`,
    ]);
    // Bounded whatever was asked: the quote, the places and at most eight lists.
    for (const said of problems) expect(said.length).toBeLessThan(320);
  });

  it("quotes a destination of 80 characters or fewer whole", async () => {
    const { problems, say } = started();
    say({ type: "navigate", to: "z".repeat(80) });
    await wait(50);
    expect(problems).toEqual([`"${"z".repeat(80)}" is no record this viewer may see and is no place of this app: it goes nowhere. Its places: "the-packages" (The packages). Its lists: "parties", "offers", "packages", "what-we-heard".`]);
  });

  it("counts every navigate, lost or refused, against the flood allowance, and says no more once the view is stopped", async () => {
    const { problems, failures, worker, say } = started({ messages: 20, messageWindowMs: 1_000 });
    for (let i = 0; i < 500; i += 1) say(i % 2 ? { type: "navigate", to: `lost-${i}` } : { type: "navigate", to: { i } });
    await wait(100);
    expect(failures).toEqual(["flood"]);
    expect(worker.terminated).toBe(true);
    // Only the string navigates within the allowance were said: half of at most 20.
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.length).toBeLessThanOrEqual(10);
    for (const said of problems) expect(said).toMatch(/^"lost-\d+" is no record this viewer may see/);
  });

  it("is quoted the same bounded way in a headless run's problems", () => {
    const judged = judgeTranscript(
      { renders: [], asked: [], went: [{ record: "x".repeat(10_000) }, { place: "y".repeat(10_000) }], ms: 1, logs: [], messages: 2 },
      { props: {} as never, acts: [], places: [{ as: "the-packages" }], limits: { maxNodes: 100, messages: 100, pushMs: 1_000 } },
    );
    expect(judged.ok).toBe(true);
    const says = judged.ok ? judged.problems.filter((problem) => problem.at === "navigate").map((problem) => problem.says) : [];
    expect(says).toHaveLength(2);
    expect(says[0]).toContain(`"${"x".repeat(79)}…"`);
    expect(says[1]).toContain(`"${"y".repeat(79)}…"`);
    for (const said of says) expect(said.length).toBeLessThan(300);
  });
});
