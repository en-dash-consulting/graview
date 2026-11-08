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
    expect(host.querySelector('[data-testid="place-as-list"]')).not.toBeNull();
  });
  it("says the title only to a screen reader over a view that draws its own, with no count and no link to the list above it", async () => {
    const host = await place({ ...map, heading: "own" });
    const title = host.querySelector<HTMLElement>("[data-graview-page-title]");
    expect(title?.textContent).toBe("Mind map");
    expect(shown(title)).toBe(false);
    expect(host.querySelector('[data-testid="place-lede"]')).toBeNull();
    expect(host.querySelector('[data-testid="place-as-list"]')).toBeNull();
    expect(host.querySelector('[data-worker-view-place="mind-map"]')).not.toBeNull();
  });
});

/*
 * A VIEW OF ONE RECORD THAT REPLACES ITS PAGE DRAWS ITS OWN HEADING TOO
 * (Roadmap f-replacing-view-own-heading). A deliverable's page drawn by a
 * view that titles the deliverable itself still had Graview's head over it:
 * the name, "In the scene", "Seen in" — the name said twice. With `heading:
 * "own"` the page draws none of it, and the name is still the page's one
 * heading, said to a screen reader and the keyboard. `replaces: "page"`
 * alone keeps the head, as it was.
 */
const brief: WorkerViewManifest = { name: "brief", attach: "deliverable", cardinality: "one", replaces: "page" };
const NAMED = "graview.onProps((props) => graview.render(graview.html`<h2>${props.node.label}</h2>`));";
async function page(manifest: WorkerViewManifest) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const views = registerWorkerView(registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema)), { manifest, worker: { source: NAMED } });
  await act(async () => root.render(<PagesApp context={{ store: store(), views: views as never, principal: nick }} initialPath="/deliverables/deliverable%3Aemail" />));
  done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}

describe("a manifest's heading, on a view of one record", () => {
  it('is "own" where the view replaces the record\'s page, and refused where it does not', () => {
    expect(checkManifest({ ...brief, heading: "own" }, store())).toEqual([]);
    const { replaces: _, ...beside } = brief;
    expect(checkManifest({ ...beside, heading: "own" }, store())).toEqual([expect.stringContaining('replaces its page (replaces "page")')]);
  });
});

describe("a record's page drawn by a view that replaces it", () => {
  it("keeps its head over a view that does not draw its own heading, as it was", async () => {
    const host = await page(brief);
    const titles = host.querySelectorAll("[data-graview-page-title]");
    expect(titles).toHaveLength(1);
    expect(shown(titles[0]!)).toBe(true);
    expect(titles[0]!.textContent).toBe("Email to Todd");
    expect(host.querySelector('[data-testid="spatial-link"]')).not.toBeNull();
  });
  it("draws none of its head over a view that draws its own, and says the name once, to a screen reader", async () => {
    const host = await page({ ...brief, heading: "own" });
    const titles = host.querySelectorAll("[data-graview-page-title]");
    expect(titles).toHaveLength(1);
    expect(titles[0]!.textContent).toBe("Email to Todd");
    expect(shown(titles[0]!)).toBe(false);
    // Nothing of the head is drawn for the eye: no "In the scene", no "Seen in", no editable name.
    expect(host.querySelector('[data-testid="spatial-link"]')).toBeNull();
    expect(host.querySelector("[data-graview-record-asides]")).toBeNull();
    expect(titles[0]!.children).toHaveLength(0);
    expect(host.querySelector('[data-worker-view="brief"], [data-testid="record-view"]')).not.toBeNull();
  });
});
