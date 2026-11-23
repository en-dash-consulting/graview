// @vitest-environment jsdom
import { createSchema, defineNode, Store, z, type AnySchema, type AppVideo, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { mountWorkerView } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type GuestProps, type HostHello } from "../../src/protocol.js";

/**
 * A MOUNTED VIEW IS HANDED THE APP'S REEL (HQ f-view-names-app-video).
 *
 * The host a page mounts a worker view with takes the app's reel as
 * `reel`, and pushes its facts in `props.theme.reel` — never its address —
 * and again when the host hands another.
 */
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: { message: unknown; transfer: unknown[] }[] = [];
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage(message: unknown, transfer: unknown[] = []) {
    this.posted.push({ message, transfer });
  }
  terminate() {}
  say(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const moment = defineNode("moment", { fields: z.object({ name: z.string() }), plural: "Moments" });
const store = () => new Store<AnySchema>({ schema: createSchema([moment]) as AnySchema, mutations: [] });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

describe("a worker view on the page", () => {
  it("is pushed the reel's facts in props.theme.reel, never its address, and pushed again when the host hands another", async () => {
    const element = document.createElement("div");
    document.body.appendChild(element);
    let reel: AppVideo | undefined = { href: "/graview/files/reel.mp4", poster: "/graview/files/reel.jpg", duration: 30 };
    const view = mountWorkerView(element, { manifest: { name: "home", title: "Home", attach: "home", cardinality: "many" }, worker: { script: "/* the view */" }, store: store(), principal: owner, reel: () => reel });
    live.push(view);
    const worker = FakeWorker.made.at(-1)!;
    worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
    const hello = worker.posted[0]!.message as HostHello;
    const port = worker.posted[0]!.transfer[0] as MessagePort;
    const pushed: GuestProps[] = [];
    port.onmessage = (event) => {
      const data = event.data as { type?: string; beat?: number; push?: number; props?: GuestProps };
      if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
      if (data.type === "props" && data.props) pushed.push(data.props);
      if (data.type === "props" && typeof data.push === "number") port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 3 });
    };
    await wait(50);
    expect(pushed.length).toBeGreaterThan(0);
    const first = pushed.at(-1);
    expect(first?.theme?.reel).toEqual({ name: "reel", type: "video/mp4", duration: 30, poster: true, playable: true });
    expect(JSON.stringify(first)).not.toContain("/graview/files/");
    reel = undefined;
    view.update();
    await wait(50);
    expect(pushed.length).toBeGreaterThan(1);
    expect(pushed.at(-1)?.theme).not.toHaveProperty("reel");
  });
});
