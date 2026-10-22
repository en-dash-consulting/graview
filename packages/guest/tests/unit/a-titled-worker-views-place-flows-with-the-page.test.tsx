// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A TITLED WORKER VIEW'S PLACE FLOWS WITH THE PAGE (Roadmap
 * f-view-places-flow). Every view opened at `/places/<slug>` was drawn in a
 * frame most of the window tall that scrolled inside itself, under the
 * page's own scroll — on a phone, a box that traps the thumb. It is drawn
 * as a place of blocks is: in the page's column, as long as it is. That no
 * box between the view and the page scrolls, at 1440 and 390, and that a
 * board keeps its frame, is `verify-address`
 * (aTitledViewsPlaceFlowsWithThePageWhileABoardKeepsItsFrame).
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
const store = () => new Store({ schema: offersApp.schema, mutations: offersApp.mutations ?? [], policy: offersApp.policy!, snapshot: structuredClone(offersSeed) as never }) as unknown as Store<AnySchema>;
const packages: WorkerViewManifest = { name: "packages", title: "The packages", attach: "package", cardinality: "many" };
const SOURCE = "graview.onProps(() => graview.render('drawn'));";
const registry = () => registerWorkerView(registerDefaultViews(offersApp.schema as AnySchema, createViews(offersApp.schema as AnySchema)), { manifest: packages, worker: { source: SOURCE } });

describe("a titled worker view's place", () => {
  it("is marked to flow, as a place of blocks is", () => {
    const view = registry().resolve("package", { cardinality: "many", fidelity: "full" }, "the-packages")?.view as { flows?: boolean } | undefined;
    expect(view?.flows).toBe(true);
  });

  it("is drawn in the page's column with no height of its own and nothing that scrolls inside it", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store(), views: registry() as never, principal: lin }} initialPath="/places/the-packages" />));
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    const lens = host.querySelector<HTMLElement>('[data-testid="place-lens"]');
    expect(lens).not.toBeNull();
    expect(lens!.hasAttribute("data-flows")).toBe(true);
    expect(lens!.style.height).toBe("");
    expect(lens!.style.overflow).toBe("");
    await act(async () => root.unmount());
    host.remove();
  });
});
