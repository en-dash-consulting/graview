// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { mountWorkerView } from "../../src/host/view.js";
import { club, member, visitor } from "./club.js";

/*
 * WHERE EVERYTHING A VIEW READS IS KEPT FROM ITS SEAT, THE HOST DRAWS THE
 * WAY IN (Roadmap f-view-knows-what-its-seat-cannot-see, FR-183). A view of
 * the vendors drawn for a visitor was a part with nothing in it. Now it is
 * not started, and the host draws in its place the one line a reader with
 * no acts is given — the host's way in for a visitor — or, where the host
 * offers none, that nothing here is shown to the reader.
 */
class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage() {}
  terminate() {}
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:http://localhost:3000/1", revokeObjectURL: () => undefined });

const vendors: WorkerViewManifest = { name: "the-vendors", title: "The vendors", attach: "home", cardinality: "many", reads: { kinds: ["vendor", "memo"] } };
const source = { source: "graview.render('vendors');" };

const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const mount = (principal: typeof visitor, signIn?: { label: string; run: () => void }) => {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const view = mountWorkerView(element, { manifest: vendors, worker: source, store: club(), principal, ...(signIn ? { signIn: () => signIn } : {}) });
  live.push(view);
  return view;
};

describe("a view whose seat sees nothing it reads", () => {
  it("is not started, and the host's way in is drawn in its place", () => {
    const run = vi.fn();
    const view = mount(visitor, { label: "Sign in to see more", run });
    expect(FakeWorker.made).toHaveLength(0);
    const button = view.shadow.querySelector<HTMLButtonElement>('[data-testid="sign-in"]');
    expect(button?.textContent).toBe("Sign in to see more");
    expect(view.element.hasAttribute("data-worker-view-unseen")).toBe(true);
    button!.click();
    expect(run).toHaveBeenCalledOnce();
  });

  it("says that nothing here is shown where the host offers no way in", () => {
    const view = mount(visitor);
    expect(FakeWorker.made).toHaveLength(0);
    expect(view.shadow.querySelector("[data-graview-unseen]")?.textContent).toBe("Nothing here is shown to you.");
  });

  it("is started for a seat that sees what it reads", async () => {
    mount(member, { label: "Sign in to see more", run: () => {} });
    await vi.waitFor(() => expect(FakeWorker.made).toHaveLength(1));
  });
});
