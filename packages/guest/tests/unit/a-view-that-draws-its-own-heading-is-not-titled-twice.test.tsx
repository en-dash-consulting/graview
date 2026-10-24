// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { checkManifest, type WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A VIEW THAT DRAWS ITS OWN HEADING IS NOT TITLED TWICE (Roadmap
 * f-place-header-repeats-view-title). Book Manuscript's mind map, on Graview
 * Cloud at 390 pixels: its place said "Mind map", "1 purpose" and "All
 * purposes as a list", and then the view said "Mind map" again as its own
 * h2 — a quarter of a phone's screen before the view. A manifest that says
 * `heading: "own"` keeps the place's title for a screen reader and the
 * keyboard, and draws neither it nor the count; the way to the kind's list
 * stays. Measured in a browser by `verify-address`.
 */
URL.createObjectURL ??= () => "blob:test";
URL.revokeObjectURL ??= () => {};
(globalThis as { Worker?: unknown }).Worker ??= class {
  onmessage = null;
  onerror = null;
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
};
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const SOURCE = "graview.onProps(() => graview.render('drawn'));";
const registry = (manifest: WorkerViewManifest) => registerWorkerView(registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema)), { manifest, worker: { source: SOURCE } });
const map: WorkerViewManifest = { name: "mind-map", title: "Mind map", attach: "deliverable", cardinality: "many" };

let done: (() => Promise<void>) | undefined;
afterEach(async () => {
  await done?.();
  done = undefined;
});
async function place(manifest: WorkerViewManifest) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: registry(manifest) as never, principal: nick }} initialPath="/places/mind-map" />));
  done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}
/** Drawn for the eye: not inside a box clipped to nothing. */
const shown = (element: Element | null) => element !== null && (element as HTMLElement).style.clip === "";

describe("a manifest's heading", () => {
  it('is "own", or left out', () => {
    expect(checkManifest({ ...map, heading: "own" }, store())).toEqual([]);
    expect(checkManifest({ ...map, heading: "theirs" } as unknown as WorkerViewManifest, store())).toEqual([expect.stringContaining('heading is "theirs"')]);
    expect(checkManifest({ ...map, title: undefined, heading: "own" }, store())).toEqual([expect.stringContaining("heading")]);
  });
});

describe("a view's place on Pages", () => {
  it("says the title and the count over a view that does not draw its own heading, as it was", async () => {
    const host = await place(map);
    expect(shown(host.querySelector("[data-graview-page-title]"))).toBe(true);
    expect(host.querySelector("[data-graview-page-title]")?.textContent).toBe("Mind map");
    expect(host.querySelector('[data-testid="place-lede"]')).not.toBeNull();
  });
  it('says the title only to a screen reader over a view that draws its own, with no count, and keeps the way to the list', async () => {
    const host = await place({ ...map, heading: "own" });
    const title = host.querySelector<HTMLElement>("[data-graview-page-title]");
    expect(title?.textContent).toBe("Mind map");
    expect(shown(title)).toBe(false);
    expect(host.querySelector('[data-testid="place-lede"]')).toBeNull();
    expect(host.querySelector('[data-testid="place-as-list"]')).not.toBeNull();
    expect(host.querySelector('[data-worker-view-place="mind-map"]')).not.toBeNull();
  });
});
