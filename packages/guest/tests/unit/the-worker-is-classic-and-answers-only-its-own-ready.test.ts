// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountGuestWorker } from "../../src/host/index.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, settle, showroom } from "./showroom.js";

/**
 * THE WORKER'S HOST (FR-68): a classic worker — never `type: "module"` —
 * from a `blob:` URL it makes of the script's text, or from one it is
 * given; its `guest-ready` answered once with a fresh nonce and a port;
 * and a host that is told, rather than left blank, when the worker never
 * starts or never speaks.
 */
class FakeWorker {
  static made: FakeWorker[] = [];
  static refuse = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: { message: unknown; transfer: unknown[] }[] = [];
  terminated = false;
  constructor(
    readonly url: string,
    readonly options?: WorkerOptions,
  ) {
    if (FakeWorker.refuse) throw new DOMException("Refused by the page's policy", "SecurityError");
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
const blobs: Blob[] = [];
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, {
  createObjectURL: (blob: Blob) => (blobs.push(blob), `blob:https://host.example/${blobs.length}`),
  revokeObjectURL: vi.fn(),
});

const ready = { graview: "guest-ready", protocol: GUEST_PROTOCOL };
afterEach(() => {
  FakeWorker.made = [];
  FakeWorker.refuse = false;
  document.body.replaceChildren();
});

function mounted(options: Record<string, unknown> = {}) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const failures: string[] = [];
  const guest = mountGuestWorker(element, {
    worker: { script: "/* the guest */" },
    view: "card",
    store: showroom(),
    principal: bethan,
    input: () => ({ node: { id: "car:golf" } }),
    onFailure: (reason: string) => failures.push(reason),
    ...options,
  } as unknown as Parameters<typeof mountGuestWorker>[1]);
  return { guest, worker: FakeWorker.made[0], failures, element };
}

describe("a worker guest's host", () => {
  it("starts a classic worker from a blob: URL it makes of the script", async () => {
    const { guest, worker } = mounted();
    expect(worker!.url).toMatch(/^blob:/);
    expect(worker!.options?.type).toBeUndefined();
    expect(await blobs.at(-1)!.text()).toBe("/* the guest */");
    guest.dispose();
    expect(worker!.terminated).toBe(true);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(worker!.url);
  });

  it("starts one from a URL it is given, as it is given", () => {
    const { guest, worker } = mounted({ worker: { url: "blob:https://host.example/given" } });
    expect(worker!.url).toBe("blob:https://host.example/given");
    guest.dispose();
  });

  it("answers the first ready with a fresh nonce and a port, and no other", () => {
    const { guest, worker } = mounted();
    worker!.say({ graview: "guest-ready", protocol: 99 });
    worker!.say({ type: "act", nonce: "guess", id: 1, name: "retire-car", args: { carId: "car:golf" } });
    expect(worker!.posted).toHaveLength(0);
    worker!.say(ready);
    worker!.say(ready);
    expect(worker!.posted).toHaveLength(1);
    const { message, transfer } = worker!.posted[0]!;
    expect(message as HostHello).toMatchObject({ graview: "host-hello", protocol: GUEST_PROTOCOL, view: "card" });
    expect((message as HostHello).nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(transfer).toHaveLength(1);
    expect(guest.stats.dropped).toBe(3);
    guest.dispose();
  });

  it("pushes what the viewer sees over the port", async () => {
    const { guest, worker } = mounted();
    worker!.say(ready);
    const port = worker!.posted[0]!.transfer[0] as MessagePort;
    const heard: unknown[] = [];
    port.onmessage = (event) => heard.push(event.data);
    for (let i = 0; i < 50 && heard.length === 0; i += 1) await settle();
    expect(heard[0]).toMatchObject({ type: "props", props: { view: "card", node: { id: "car:golf" } } });
    guest.dispose();
  });

  it("says so when the page refuses the worker", async () => {
    FakeWorker.refuse = true;
    const { guest, failures } = mounted();
    await settle();
    expect(failures).toEqual(["refused"]);
    expect(guest.worker).toBeUndefined();
  });

  it("says so, and stops it, when the worker never says ready", async () => {
    vi.useFakeTimers();
    const { worker, failures } = mounted({ limits: { readyMs: 50 } });
    vi.advanceTimersByTime(60);
    vi.useRealTimers();
    expect(failures).toEqual(["silent"]);
    expect(worker!.terminated).toBe(true);
  });
});
