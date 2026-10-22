// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { bleeds, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { checkManifest, type WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A VIEW THAT SAYS `bleed: true` IS DRAWN EDGE TO EDGE ON A PHONE (Roadmap
 * feature:views-on-phones-the-page-container-s-fixed-20px-side-gutter-…).
 * Threat Watch, on Graview Cloud: at 390 pixels the home and the record
 * page stood 20px of gutter either side of a view's box, and a hero's
 * `margin: 0 -14px` was clipped at the box's edge — its rounded corners cut
 * rather than the hero widened. The manifest now says so, and the pages
 * face takes the gutter back for that view, on a phone only. Measured in a
 * browser at 390 and 1440 by `verify-address`
 * (aViewThatBleedsSpansAPhoneLessItsSafeAreasAndTheColumnAtADesk).
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
const hero: WorkerViewManifest = { name: "hero", attach: "home", cardinality: "many", bleed: true };
const SOURCE = "graview.onProps(() => graview.render('drawn'));";
const registry = (...manifests: WorkerViewManifest[]) => manifests.reduce((views, manifest) => registerWorkerView(views, { manifest, worker: { source: SOURCE } }), registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema)));

describe("a manifest's bleed", () => {
  it("is true, or left out", () => {
    expect(checkManifest({ ...brief, bleed: true }, store())).toEqual([]);
    expect(checkManifest(hero, store())).toEqual([]);
    expect(checkManifest({ ...brief, bleed: "yes" } as unknown as WorkerViewManifest, store())).toEqual([expect.stringContaining('bleed is "yes"')]);
  });
  it("marks the view it registers, a record's and the home's, and no other", () => {
    expect(bleeds(registry({ ...brief, bleed: true }).lookup("deliverable", { cardinality: "one", fidelity: "full" }))).toBe(true);
    expect(bleeds(registry(brief).lookup("deliverable", { cardinality: "one", fidelity: "full" }))).toBe(false);
    expect(bleeds(registry(hero).homeView?.())).toBe(true);
  });
});

describe("on Pages", () => {
  const page = async (manifest: WorkerViewManifest) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store(), views: registry(manifest) as never, principal: nick }} initialPath="/deliverables/deliverable%3Aemail" />));
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    const region = host.querySelector('[data-testid="record-view"] [data-worker-view-place="brief"]');
    const said = { view: Boolean(region), bleeds: Boolean(region?.closest("[data-graview-bleed]")), rule: host.querySelector("[data-graview-bleed] style")?.textContent ?? "" };
    await act(async () => root.unmount());
    host.remove();
    return said;
  };
  it("draws a view that bleeds in a box that takes the gutter back on a phone, keeping the safe areas", async () => {
    const said = await page({ ...brief, bleed: true });
    expect(said).toMatchObject({ view: true, bleeds: true });
    expect(said.rule).toContain("max-width:680px");
    expect(said.rule).toContain("env(safe-area-inset-left,0px) - var(--graview-page-gutter,20px)");
  });
  it("draws any other view inside the gutter, as it was", async () => {
    expect(await page(brief)).toEqual({ view: true, bleeds: false, rule: "" });
  });
});
