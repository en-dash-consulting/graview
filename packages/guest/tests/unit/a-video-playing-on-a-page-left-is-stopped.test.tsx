// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { AnySchema, Store } from "@graview/core";
import { createViews, GraviewProvider, PageOfItsOwn, type ReactViewRegistry, type ViewComponent } from "@graview/react/provider";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMBED_ORIGINS } from "../../src/host/embeds.js";
import { viewAhead } from "../../src/host/view-ahead.js";
import { registerWorkerView } from "../../src/host/worker-react.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { schema, showroom, staff } from "./showroom.js";

/**
 * A VIDEO PLAYING ON A PAGE LEFT IS STOPPED (the 0.2.16 batch: a drawing
 * kept as its page is left, f-custom-pages-do-not-flash, beside a view's
 * YouTube or Vimeo player, f-view-video-embeds). A kept drawing is taken off
 * the page, not hidden on it, and its players are let go with it: what a
 * person pressed play on is not heard from a page they left, and the page
 * gone back to stands at the video's poster, its play button there to press.
 */

/** A stand-in worker that draws one `<graview-video>` naming a YouTube video, and answers each push. */
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  terminated = false;
  port: MessagePort | undefined;
  nonce = "";
  constructor() {
    FakeWorker.made.push(this);
    setTimeout(() => !this.terminated && this.onmessage?.({ data: { graview: "guest-ready", protocol: GUEST_PROTOCOL } } as MessageEvent), 0);
  }
  postMessage(message: unknown, transfer: unknown[] = []) {
    this.nonce = (message as HostHello).nonce;
    this.port = transfer[0] as MessagePort;
    let drawn = 0;
    this.port.onmessage = ({ data }) => {
      if (data.type === "heartbeat") this.say({ type: "heartbeat", beat: data.beat });
      if (data.type !== "props") return;
      if (drawn === 0) this.say({ type: "render", records: [[0, "~", { id: "v", type: 1, element: "graview-video", attributes: { "data-provider": "youtube", "data-video": "dQw4w9WgXcQ", "data-title": "The launch" }, children: [] }, 0]] });
      drawn += 1;
      this.say({ type: "pushed", push: data.push, ms: 1 });
    };
  }
  say(message: object) {
    this.port?.postMessage({ nonce: this.nonce, ...message });
  }
  terminate() {
    this.terminated = true;
    this.port?.close();
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });

const manifest: WorkerViewManifest = { name: "films", title: "Films", attach: "car", cardinality: "many" };
const roots: { root: Root; host: HTMLElement }[] = [];
afterEach(async () => {
  for (const { root, host } of roots.splice(0)) {
    await act(async () => root.unmount());
    host.remove();
  }
  FakeWorker.made = [];
});

describe("a view that plays a video, fetched ahead of its first visit (f-custom-pages-first-visit)", () => {
  it("fetches its code and nothing of a provider's: no player, no frame, no address of YouTube's or Vimeo's, no worker", async () => {
    const store = showroom() as unknown as Store<AnySchema>;
    const fetched: string[] = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      fetched.push(String(input instanceof Request ? input.url : input));
      return new Response("/* the view */");
    });
    const made = vi.spyOn(document, "createElement");
    try {
      viewAhead({ manifest, worker: async () => ({ script: "/* draws a <graview-video data-provider> */" }) }, { store, principal: staff, intent: true });
      await new Promise((done) => setTimeout(done, 50));
      expect(made.mock.calls.map(([name]) => String(name).toLowerCase())).not.toContain("iframe");
      expect(fetched.filter((url) => Object.values(EMBED_ORIGINS).some((origin) => url.startsWith(origin)))).toEqual([]);
      expect(document.querySelector("iframe, graview-video")).toBeNull();
      expect(FakeWorker.made).toHaveLength(0);
    } finally {
      fetchSpy.mockRestore();
      made.mockRestore();
    }
  });
});

describe("a video a view plays, on a page that is left and gone back to", () => {
  it("stops as the page is left, and stands at its poster with its play button as the page is gone back to", async () => {
    const store = showroom() as unknown as Store<AnySchema>;
    const views = registerWorkerView(createViews(schema as never) as unknown as ReactViewRegistry<AnySchema>, { manifest, worker: { script: "/* the view */" }, onFailure: vi.fn() });
    const View = views.lookup("car" as never, { cardinality: "many", fidelity: "full" }) as ViewComponent<AnySchema>;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    roots.push({ root, host });
    const draw = (here: boolean) =>
      act(async () => {
        root.render(
          <GraviewProvider<AnySchema> store={store} views={views} principal={staff}>
            <PageOfItsOwn.Provider value="place films">{here ? <View nodes={store.graph.nodesOfKind("car" as never) as never} fidelity="full" cardinality="many" mode="fullscreen" selected={false} /> : <p>Elsewhere</p>}</PageOfItsOwn.Provider>
          </GraviewProvider>,
        );
      });
    await draw(true);
    let region = host.querySelector<HTMLElement>("[data-worker-view]");
    const video = () => region?.shadowRoot?.querySelector("graview-video")?.shadowRoot ?? null;
    await act(async () => {
      await vi.waitFor(() => {
        region = host.querySelector<HTMLElement>("[data-worker-view]");
        expect(video()?.querySelector("[data-graview-embed-play]")).toBeTruthy();
      });
    });
    region = host.querySelector<HTMLElement>("[data-worker-view]");
    await act(async () => (video()!.querySelector("[data-graview-embed-play]") as HTMLButtonElement).click());
    const player = video()!.querySelector("iframe[data-graview-embed]");
    expect(player?.getAttribute("src")).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1/);

    await draw(false);
    // Kept, not torn down: the same worker, its drawing off the page and its player gone with it.
    expect(FakeWorker.made[0]!.terminated).toBe(false);
    expect(region!.isConnected).toBe(false);
    expect(player!.isConnected).toBe(false);
    expect(video()!.querySelector("iframe")).toBeNull();

    await draw(true);
    expect(host.querySelector("[data-worker-view]")).toBe(region);
    await act(async () => {
      await vi.waitFor(() => expect(video()?.querySelector("[data-graview-embed-play]")).toBeTruthy());
    });
    expect(video()!.querySelector("iframe")).toBeNull();
    expect(FakeWorker.made).toHaveLength(1);
  });
});
