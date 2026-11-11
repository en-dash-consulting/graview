// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { bleeds, bleedsFull, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { checkManifest, type WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A VIEW THAT BLEEDS FULL SPANS THE WINDOW AT EVERY WIDTH (Roadmap
 * f-views-bleed-full-width). `bleed: true` takes the page's gutter back on
 * a phone; at a desk or a tablet the view stayed in the page's column, so a
 * full-bleed editorial home read as a boxed card. `bleed: "full"` spans the
 * page's whole width at every width, keeping the safe areas, and a page that
 * opens on the view — the home's, a place's that draws its own heading —
 * starts it right under the bar at every width. jsdom cannot lay out, so
 * `verify-address` measures it at 390, 1024 and 1440
 * (aViewThatBleedsFullSpansTheWindowAtEveryWidthUnderTheBar).
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
const brief: WorkerViewManifest = { name: "brief", attach: "deliverable", cardinality: "one" };
const hero: WorkerViewManifest = { name: "hero", attach: "home", cardinality: "many", bleed: "full" };
const wall: WorkerViewManifest = { name: "the-wall", title: "The wall", attach: "deliverable", cardinality: "many", heading: "own", bleed: "full" };
const SOURCE = "graview.onProps(() => graview.render('drawn'));";
const registry = (...manifests: WorkerViewManifest[]) => manifests.reduce((views, manifest) => registerWorkerView(views, { manifest, worker: { source: SOURCE } }), registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema)));

const drawn = async (manifest: WorkerViewManifest, path: string) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: registry(manifest) as never, principal: nick }} initialPath={path} />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const region = host.querySelector(`[data-worker-view-place="${manifest.name}"]`);
  const slot = region?.closest("[data-graview-bleed]");
  const main = host.querySelector("[data-graview-page-main]");
  const said = {
    view: Boolean(region),
    bleed: slot?.getAttribute("data-graview-bleed") ?? null,
    rule: slot?.querySelector(":scope > style")?.textContent ?? "",
    // The page's width is what the view spans: the main's own box is held in one that says it.
    spans: main?.parentElement?.hasAttribute("data-graview-page-spans") ?? false,
    container: main?.parentElement?.style.containerType ?? "",
    top: main?.hasAttribute("data-graview-bleed-top") ? (main.querySelector(":scope > style")?.textContent ?? "") : null,
  };
  await act(async () => root.unmount());
  host.remove();
  return said;
};

describe("a manifest's bleed of full", () => {
  it('is true, "full", or left out, and nothing else', () => {
    expect(checkManifest({ ...brief, bleed: "full" }, store())).toEqual([]);
    expect(checkManifest(hero, store())).toEqual([]);
    expect(checkManifest({ ...brief, bleed: "wide" } as unknown as WorkerViewManifest, store())).toEqual([expect.stringContaining(`bleed is "wide": it is true (edge to edge on a phone, the column on a desk), "full" (the page's whole width at every width, a desk's included), or left out (view-bleed).`)]);
  });
  it("marks the view it registers as bleeding full, which bleeds on a phone as well", () => {
    const one = registry({ ...brief, bleed: "full" }).lookup("deliverable", { cardinality: "one", fidelity: "full" });
    expect([bleeds(one), bleedsFull(one)]).toEqual([true, true]);
    const phone = registry({ ...brief, bleed: true }).lookup("deliverable", { cardinality: "one", fidelity: "full" });
    expect([bleeds(phone), bleedsFull(phone)]).toEqual([true, false]);
    expect(bleedsFull(registry(hero).homeView?.())).toBe(true);
  });
});

describe("a view that bleeds full spans the window at every width", () => {
  it("draws the home's view across the page's whole width, under the bar, with no media query", async () => {
    const said = await drawn(hero, "/");
    expect(said).toMatchObject({ view: true, bleed: "full", spans: true, container: "inline-size" });
    expect(said.rule).not.toContain("@media");
    expect(said.rule).toContain("50% - 50cqw");
    expect(said.rule).toContain("env(safe-area-inset-left,0px)");
    expect(said.top).not.toBeNull();
    expect(said.top).not.toContain("@media");
    expect(said.top).toContain("padding-top:0");
  });
  it("says the app's line over a home's view to a screen reader only, so the view is what stands under the bar", async () => {
    const line = async (manifest: WorkerViewManifest) => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () => root.render(<PagesApp context={{ store: store(), views: registry(manifest) as never, principal: nick, brand: { subtitle: "What we are making" } as never }} initialPath="/" />));
      await act(async () => new Promise((done) => setTimeout(done, 20)));
      const said = host.querySelector('[data-testid="app-subtitle"]');
      const seen = { text: said?.textContent ?? null, marked: said?.hasAttribute("data-graview-line-over-view") ?? false, top: host.querySelector("[data-graview-page-main] > style")?.textContent ?? "" };
      await act(async () => root.unmount());
      host.remove();
      return seen;
    };
    const full = await line(hero);
    expect(full).toMatchObject({ text: "What we are making", marked: true });
    expect(full.top).toContain("[data-graview-line-over-view]{position:absolute");
    expect(await line({ ...hero, bleed: true })).toMatchObject({ text: "What we are making", marked: false });
  });
  it("draws a record's view across the page's whole width, under the record's own heading", async () => {
    const said = await drawn({ ...brief, bleed: "full" }, "/deliverables/deliverable%3Aemail");
    expect(said).toMatchObject({ view: true, bleed: "full", spans: true, top: null });
  });
  it("draws a place's view that says its own heading across the whole width, under the bar", async () => {
    const said = await drawn(wall, "/places/the-wall");
    expect(said).toMatchObject({ view: true, bleed: "full", spans: true });
    expect(said.top).toContain("padding-top:0");
  });
  it("leaves a view that bleeds on a phone only in the column at a desk, as it was", async () => {
    const said = await drawn({ ...hero, bleed: true }, "/");
    expect(said).toMatchObject({ view: true, bleed: "", spans: false });
    expect(said.rule).toContain("max-width:680px");
  });
});
