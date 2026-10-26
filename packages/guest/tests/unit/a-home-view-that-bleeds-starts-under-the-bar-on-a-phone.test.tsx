// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A HOME VIEW THAT BLEEDS STARTS RIGHT UNDER THE BAR ON A PHONE (FR-216).
 * At 390 pixels a home whose manifest says `bleed: true` took back its side
 * gutters and kept the page's 40 pixels of top padding, so the hero sat
 * under an empty band between the section nav and its first pixel. The
 * page now gives that padding back on a phone and keeps it at a desk; jsdom
 * cannot measure a media query, so `verify-address` measures it at 390 and
 * 1440 (aHomeViewThatBleedsStartsUnderTheBarOnAPhoneAndKeepsItsSpacingAtADesk).
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

const home = async (manifest: WorkerViewManifest) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: registry(manifest) as never, principal: nick }} initialPath="/" />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const main = host.querySelector('[data-graview-page-main]:has([data-testid="home-view"])');
  const said = { home: Boolean(main), bleedsTop: main?.hasAttribute("data-graview-bleed-top") ?? false, rule: main?.querySelector(":scope > style")?.textContent ?? "" };
  await act(async () => root.unmount());
  host.remove();
  return said;
};

describe("a home view that bleeds", () => {
  it("gives the page's top padding back on a phone only, unless the view did not draw", async () => {
    const said = await home({ name: "hero", attach: "home", cardinality: "many", bleed: true });
    expect(said).toMatchObject({ home: true, bleedsTop: true });
    expect(said.rule).toMatch(/^@media \(max-width:680px\)\{\[data-graview-bleed-top\]:not\(:has\(\[data-graview-bleed\]>\[data-worker-view-fallback\]\)\)\{padding-top:0 !important\}\}$/);
  });

  it("leaves a home view that does not bleed its spacing", async () => {
    expect(await home({ name: "hero", attach: "home", cardinality: "many" })).toEqual({ home: true, bleedsTop: false, rule: "" });
  });
});
