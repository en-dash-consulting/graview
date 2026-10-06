// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { openGuest } from "../../src/channel.js";
import { mountGuestWorker } from "../../src/host/worker.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";

/**
 * A WORKER THAT STOPS ANSWERING IS STOPPED (FR-68's watchdog). A guest
 * whose code spins — `while (true) {}` after it said ready — holds a
 * thread of the viewer's machine for as long as the page is open, and no
 * message of the protocol would ever say so. So the host asks the worker's
 * runtime, over the session's port, on an interval, and the runtime
 * answers: the runtime, not the guest's code, which can stop it only by
 * blocking its own event loop. Past `limits.silentMs` with no answer, the
 * worker is terminated and the host hears `silent`. A guest that is busy
 * but yields answers late, and is not stopped.
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
/** Wait for something, up to a bound that a loaded machine still meets. */
const until = async (done: () => boolean, ms = 3_000) => {
  for (const start = performance.now(); !done() && performance.now() - start < ms; ) await wait(10);
};
const SILENT = 200;

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

/**
 * A worker guest past its ready, with a runtime that answers each heartbeat
 * as `answer` says: at once, after a delay, with another nonce, or never.
 */
function started(answer: "at-once" | "never" | { readonly after: number } | "wrong-nonce", limits: Record<string, number> = {}) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const failures: { reason: string; at: number }[] = [];
  const guest = mountGuestWorker(element, {
    worker: { script: "/* the guest */" },
    view: "card",
    store: showroom(),
    principal: bethan,
    limits: { silentMs: SILENT, ...limits },
    onFailure: (reason) => failures.push({ reason, at: performance.now() }),
  });
  live.push(guest);
  const worker = FakeWorker.made.at(-1)!;
  // The clock starts as the guest says it is ready, before anything this test sets up after it.
  const readyAt = performance.now();
  worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
  const hello = worker.posted[0]!.message as HostHello;
  const port = worker.posted[0]!.transfer[0] as MessagePort;
  const beats: number[] = [];
  port.onmessage = (event) => {
    const data = event.data as { type?: string; beat?: number };
    if (data.type !== "heartbeat") return;
    beats.push(data.beat!);
    const reply = { type: "heartbeat", nonce: answer === "wrong-nonce" ? "not-the-nonce" : hello.nonce, beat: data.beat };
    if (answer === "at-once" || answer === "wrong-nonce") port.postMessage(reply);
    else if (answer !== "never") setTimeout(() => port.postMessage(reply), answer.after);
  };
  const say = (message: Record<string, unknown>) => port.postMessage({ ...message, nonce: hello.nonce });
  return { guest, worker, failures, beats, say, readyAt };
}

/**
 * THE HOST'S OWN TIME, DRAWING A KIT GUEST (FR-94's draw budget, for the
 * kit's worker). Under the node cap a guest may still ask the page to build
 * a subtree, take it away and build it again, hundreds of times in one
 * message — the ids come free once it is removed — and the page draws it
 * all on its main thread. Over any one second the host spends at most
 * `drawMs` drawing a guest; past it the batch is left undrawn and the
 * guest is stopped as slow.
 */
describe("the host's time drawing a worker guest", () => {
  it("stops a guest whose one message asks for more building than drawMs allows, and leaves the rest undrawn", async () => {
    const { worker, failures, say } = started("at-once", { drawMs: 50, maxNodes: 2_000 });
    const tree = { id: "t", type: 1, element: "gv-group", properties: {}, children: Array.from({ length: 1_000 }, (_, index) => ({ id: `t${index}`, type: 1, element: "gv-badge", properties: {}, children: [] })) };
    const records: unknown[] = [];
    for (let i = 0; i < 100; i += 1) records.push([0, "~", tree, 0], [1, "~", 0]);
    const began = performance.now();
    say({ type: "render", records });
    await until(() => failures.length > 0, 5_000);
    expect(failures.map((one) => one.reason)).toEqual(["slow"]);
    expect(worker.terminated).toBe(true);
    /* The page was held for about drawMs, not for 100 000 nodes built and taken away. */
    expect(performance.now() - began).toBeLessThan(1_000);
  });
});

describe("the host's watchdog over a worker guest", () => {
  it("stops a worker whose runtime never answers within silentMs of its ready, and says silent", async () => {
    const { worker, failures, beats, readyAt } = started("never");
    await until(() => failures.length > 0);
    expect(beats.length).toBeGreaterThan(0);
    expect(failures.map((one) => one.reason)).toEqual(["silent"]);
    expect(worker.terminated).toBe(true);
    /* At the limit, give or take the interval it is checked on: never before it, never long after. */
    const took = failures[0]!.at - readyAt;
    expect(took).toBeGreaterThanOrEqual(SILENT - 5);
    expect(took).toBeLessThan(SILENT * 2.5);
  });

  it("keeps a worker whose runtime answers, however long it lives", async () => {
    const { worker, failures, beats } = started("at-once");
    await wait(SILENT * 5);
    expect(failures).toEqual([]);
    expect(worker.terminated).toBe(false);
    expect(beats.length).toBeGreaterThanOrEqual(10);
    expect(beats).toEqual(beats.map((_, index) => index + 1));
  });

  it("keeps a worker that is busy but yields, and answers late within the limit", async () => {
    const { worker, failures } = started({ after: SILENT * 0.4 });
    await wait(SILENT * 5);
    expect(failures).toEqual([]);
    expect(worker.terminated).toBe(false);
  });

  it("stops a worker that answers too late, every time", async () => {
    const { worker, failures } = started({ after: SILENT * 3 });
    await until(() => failures.length > 0);
    expect(failures.map((one) => one.reason)).toEqual(["silent"]);
    expect(worker.terminated).toBe(true);
  });

  it("takes an answer only with the session's nonce: any other is dropped, and is no answer", async () => {
    const { guest, worker, failures } = started("wrong-nonce");
    await until(() => failures.length > 0);
    expect(failures.map((one) => one.reason)).toEqual(["silent"]);
    expect(worker.terminated).toBe(true);
    expect(guest.stats.dropped).toBeGreaterThan(0);
  });

  it("does not spend the guest's message allowance on the heartbeat, nor count it dropped", async () => {
    const { guest, failures } = started("at-once", { messages: 1, messageWindowMs: 60_000 });
    await wait(SILENT * 4);
    expect(failures).toEqual([]);
    expect(guest.stats.dropped).toBe(0);
  });

  it("stops asking once the guest is disposed", async () => {
    const { guest, worker, failures, beats } = started("never");
    guest.dispose();
    const before = beats.length;
    await wait(SILENT * 3);
    expect(failures).toEqual([]);
    expect(beats.length).toBe(before);
    expect(worker.terminated).toBe(true);
  });

  it("asks at least once a second by default, and gives 5 000 ms", async () => {
    const { failures, beats } = started("never", { silentMs: undefined as unknown as number });
    await wait(1_100);
    expect(beats.length).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});

describe("a guest's runtime", () => {
  it("answers the host's heartbeat over the port, with the hello's nonce and the same beat", async () => {
    const hearing = new Set<(event: MessageEvent) => void>();
    const { guest } = openGuest({
      listen: (heard) => {
        hearing.add(heard);
        return () => hearing.delete(heard);
      },
      fromHost: () => true,
      ready: () => undefined,
    });
    const channel = new MessageChannel();
    const hello: HostHello = { graview: "host-hello", protocol: GUEST_PROTOCOL, nonce: "c0ffee", view: "card" };
    for (const heard of hearing) heard({ data: hello, ports: [channel.port2] } as unknown as MessageEvent);
    const heard: unknown[] = [];
    channel.port1.onmessage = (event) => heard.push(event.data);
    channel.port1.postMessage({ type: "heartbeat", beat: 7 });
    channel.port1.postMessage({ type: "heartbeat", beat: "seven" });
    await wait(20);
    expect(heard).toEqual([{ type: "heartbeat", nonce: "c0ffee", beat: 7 }]);
    guest.close();
    channel.port1.close();
  });
});
