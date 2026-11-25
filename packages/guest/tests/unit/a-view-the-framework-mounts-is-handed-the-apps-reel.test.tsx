// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema, type AppVideo } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews, Shell } from "@graview/primitives";
import { createViews, GraviewProvider } from "@graview/react";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { guestView } from "../../src/host/react.js";
import { registerWorkerView, workerView } from "../../src/host/worker-react.js";

/**
 * A VIEW THE FRAMEWORK MOUNTS IS HANDED THE APP'S REEL (HQ
 * f-reel-mount-tests-and-frames).
 *
 * A host hands the app's reel once — `reel` on `GraviewProvider`, on the
 * Shell or on the routed face (`PagesApp`'s context) — and every worker
 * view the framework mounts (`WorkerViewMount`) and every frame view
 * (`guestView`) under it is handed that reel to read from, each time it is
 * pushed: the one it is handed now, never one it was handed before.
 */
type Handed = { readonly reel?: () => AppVideo | undefined; update?: () => void };
const mounted = vi.hoisted(() => ({ worker: [] as Handed[], frame: [] as Handed[], updates: { worker: 0, frame: 0 } }));
vi.mock("../../src/host/worker.js", () => ({
  mountWorkerView: (_element: HTMLElement, options: Handed) => (mounted.worker.push(options), { update: () => void (mounted.updates.worker += 1), rest: () => false, dispose() {} }),
  // What the view's place lends a revision (Roadmap f-make-this-section-better): made with the worker's host, nothing to these claims.
  viewPlaceHandle: () => ({}),
}));
vi.mock("../../src/host/frame.js", () => ({
  mountGuestView: (_element: HTMLElement, options: Handed) => (mounted.frame.push(options), { iframe: document.createElement("iframe"), update: () => void (mounted.updates.frame += 1), rest: () => false, dispose() {} }),
}));
URL.createObjectURL ??= () => "blob:test";
URL.revokeObjectURL ??= () => {};

const reel: AppVideo = { href: "/graview/files/reel.mp4", poster: "/graview/files/reel.jpg", duration: 30, playable: true };
const other: AppVideo = { href: "https://media.example/other.webm", type: "video/webm", duration: 12 };
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const schema = workshopApp.schema as AnySchema;
const home: WorkerViewManifest = { name: "hero", title: "Hero", attach: "home", cardinality: "many" };
const SOURCE = "graview.onProps(() => graview.render('drawn'));";
const registry = (manifest: WorkerViewManifest = home) => registerWorkerView(registerDefaultViews(schema, createViews(schema)), { manifest, worker: { source: SOURCE } });
/** A titled view of every deliverable: a place the Shell draws when the deliverables are its focus. */
const deliverables: WorkerViewManifest = { name: "deliverables", title: "Deliverables board", attach: "deliverable", cardinality: "many" };

let done: (() => Promise<void>) | undefined;
afterEach(async () => {
  await done?.();
  done = undefined;
  mounted.worker.length = 0;
  mounted.frame.length = 0;
  mounted.updates.worker = 0;
  mounted.updates.frame = 0;
});

/** Draw `face`, and wait for a view to be mounted in it; `again` draws it once more. */
async function drawn(face: (reel?: AppVideo) => ReactNode, first: AppVideo | undefined) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(face(first)));
  for (let tries = 0; tries < 100 && mounted.worker.length + mounted.frame.length === 0; tries++) await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return { again: (next?: AppVideo) => act(async () => root.render(face(next))) };
}

describe("a worker view the framework mounts", () => {
  it("under GraviewProvider, reads the reel the provider was handed, and the next one", async () => {
    const views = registry();
    const shown = store();
    const View = workerView({ manifest: home, worker: { source: SOURCE } });
    const face = (given?: AppVideo) => (
      <GraviewProvider store={shown} principal={nick} views={views} initialView={EMPTY_VIEW} {...(given ? { reel: given } : {})}>
        <View nodes={[]} cardinality="many" fidelity="full" mode="fullscreen" selected={false} />
      </GraviewProvider>
    );
    const { again } = await drawn(face, reel);
    expect(mounted.worker).toHaveLength(1);
    expect(mounted.worker[0]!.reel?.()).toEqual(reel);
    const before = mounted.updates.worker;
    await again(other);
    // Pushed again with the reel it is handed now, in the same view: never mounted afresh for it.
    expect(mounted.worker).toHaveLength(1);
    expect(mounted.worker[0]!.reel?.()).toEqual(other);
    expect(mounted.updates.worker).toBeGreaterThan(before);
    await again(undefined);
    expect(mounted.worker[0]!.reel?.()).toBeUndefined();
  });

  it("on the routed face, reads the reel PagesApp's context was handed", async () => {
    const views = registry();
    const shown = store();
    const { again } = await drawn((given) => <PagesApp context={{ store: shown, views: views as never, principal: nick, ...(given ? { reel: given } : {}) }} initialPath="/" />, reel);
    expect(mounted.worker.length).toBeGreaterThan(0);
    expect(mounted.worker.at(-1)!.reel?.()).toEqual(reel);
    const drawnViews = mounted.worker.length;
    await again(other);
    expect(mounted.worker.at(-1)!.reel?.()).toEqual(other);
    await again(undefined);
    expect(mounted.worker.at(-1)!.reel?.()).toBeUndefined();
    // Handed, changed and taken away, the reel moved in the views already drawn: none was mounted afresh for it.
    expect(mounted.worker).toHaveLength(drawnViews);
  });

  it("in the Shell, reads the reel the Shell was handed where the provider around it was handed none", async () => {
    const views = registry(deliverables);
    const shown = store();
    const face = (given?: AppVideo) => (
      <GraviewProvider store={shown} principal={nick} views={views} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("deliverable") }}>
        <Shell scheme="light" onScheme={() => {}} {...(given ? { reel: given } : {})} />
      </GraviewProvider>
    );
    const { again } = await drawn(face, reel);
    expect(mounted.worker.length).toBeGreaterThan(0);
    expect(mounted.worker.at(-1)!.reel?.()).toEqual(reel);
    const drawnViews = mounted.worker.length;
    await again(other);
    expect(mounted.worker.at(-1)!.reel?.()).toEqual(other);
    await again(undefined);
    expect(mounted.worker.at(-1)!.reel?.()).toBeUndefined();
    // Handed, changed and taken away, the reel moved in the views already drawn: none was mounted afresh for it.
    expect(mounted.worker).toHaveLength(drawnViews);
  });

  it("in the Shell or on the routed face handed none, reads the reel the provider around it was handed", async () => {
    const shown = store();
    const shellViews = registry(deliverables);
    const shell = await drawn(
      (given) => (
        <GraviewProvider store={shown} principal={nick} views={shellViews} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("deliverable") }} {...(given ? { reel: given } : {})}>
          <Shell scheme="light" onScheme={() => {}} />
        </GraviewProvider>
      ),
      reel,
    );
    expect(mounted.worker.at(-1)!.reel?.()).toEqual(reel);
    await shell.again(other);
    expect(mounted.worker.at(-1)!.reel?.()).toEqual(other);
    await done?.();
    mounted.worker.length = 0;
    const pageViews = registry();
    const pages = await drawn(
      (given) => (
        <GraviewProvider store={shown} principal={nick} views={pageViews} initialView={EMPTY_VIEW} {...(given ? { reel: given } : {})}>
          <PagesApp context={{ store: shown, views: pageViews as never, principal: nick }} initialPath="/" />
        </GraviewProvider>
      ),
      reel,
    );
    expect(mounted.worker.length).toBeGreaterThan(0);
    expect(mounted.worker.at(-1)!.reel?.()).toEqual(reel);
    await pages.again(other);
    expect(mounted.worker.at(-1)!.reel?.()).toEqual(other);
  });

  it("is handed no reel where no host handed one", async () => {
    const views = registry();
    const shown = store();
    await drawn(() => <PagesApp context={{ store: shown, views: views as never, principal: nick }} initialPath="/" />, undefined);
    expect(mounted.worker.length).toBeGreaterThan(0);
    expect(mounted.worker.at(-1)!.reel?.()).toBeUndefined();
  });
});

describe("a frame view the framework mounts", () => {
  it("reads the reel the provider was handed, and is pushed again when another is handed", async () => {
    const shown = store();
    const views = createViews(schema);
    const Frame = guestView({ url: "https://guest.example/view.html", name: "hero-frame" });
    const face = (given?: AppVideo) => (
      <GraviewProvider store={shown} principal={nick} views={views} initialView={EMPTY_VIEW} {...(given ? { reel: given } : {})}>
        <Frame nodes={[]} cardinality="many" fidelity="full" mode="fullscreen" selected={false} />
      </GraviewProvider>
    );
    const { again } = await drawn(face, reel);
    expect(mounted.frame).toHaveLength(1);
    expect(mounted.frame[0]!.reel?.()).toEqual(reel);
    const before = mounted.updates.frame;
    await again(other);
    expect(mounted.frame).toHaveLength(1);
    expect(mounted.frame[0]!.reel?.()).toEqual(other);
    expect(mounted.updates.frame).toBeGreaterThan(before);
    await again(undefined);
    expect(mounted.frame[0]!.reel?.()).toBeUndefined();
  });
});
