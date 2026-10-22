// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, previewOf } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { lin, offersApp, offersSeed } from "../../../../scripts/fixtures/offers-app.js";
import { checkManifest, type WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A VIEW'S MANIFEST SAYS HOW IT IS SIZED ON EACH SURFACE (Roadmap
 * f-view-content-height). A worker view is as tall as what it draws — its
 * content height, which the host measures and the view never says. On
 * Pages its place flows at that height; on the Scene it is a card held to
 * its box, faded where there is more, with Open to its place. Two hints say
 * otherwise: `flows: false`, a fixed canvas that keeps its place's frame,
 * and `scene.maxHeight`, the tallest its Scene preview is drawn. That the
 * Scene draws a tall view bounded with Open, at 1440 and 390, and Open
 * lands on its place, is `verify-address`
 * (aTallViewOnTheSceneIsDrawnBoundedWithOpenAndOpenLandsOnItsPlace).
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
const PACKAGES: WorkerViewManifest = { name: "packages", title: "The packages", attach: "package", cardinality: "many" };
const SOURCE = "graview.onProps(() => graview.render('drawn'));";
const registry = (manifest: WorkerViewManifest) => registerWorkerView(registerDefaultViews(offersApp.schema as AnySchema, createViews(offersApp.schema as AnySchema)), { manifest, worker: { source: SOURCE } });
const viewOf = (manifest: WorkerViewManifest, cardinality: "one" | "many" = manifest.cardinality) => registry(manifest).resolve(manifest.attach, { cardinality, fidelity: "full" }, manifest.title ? "the-packages" : undefined)?.view;

describe("a manifest's two hints", () => {
  it("takes flows: false on a place and scene.maxHeight on a view of the members", () => {
    expect(checkManifest({ ...PACKAGES, flows: false, scene: { maxHeight: 320 } }, store())).toEqual([]);
    expect(checkManifest({ ...PACKAGES, flows: true }, store())).toEqual([]);
  });

  it("refuses either said wrongly, in a sentence that says what it takes", () => {
    const s = store();
    expect(checkManifest({ ...PACKAGES, flows: "no" } as unknown as WorkerViewManifest, s)).toEqual([expect.stringContaining('flows is "no"')]);
    expect(checkManifest({ ...PACKAGES, title: undefined, flows: false } as WorkerViewManifest, s)).toEqual([expect.stringContaining("flows false needs a title and cardinality many")]);
    expect(checkManifest({ ...PACKAGES, cardinality: "one", flows: false }, s)).toEqual([expect.stringContaining("flows false needs a title and cardinality many")]);
    expect(checkManifest({ ...PACKAGES, scene: { maxHeight: 10 } }, s)).toEqual([expect.stringContaining("maxHeight is a whole number of pixels from 80 to 4000")]);
    expect(checkManifest({ ...PACKAGES, scene: { maxHeight: 300, width: 2 } } as unknown as WorkerViewManifest, s)).toEqual([expect.stringContaining('only "maxHeight" is read')]);
    expect(checkManifest({ ...PACKAGES, scene: 300 } as unknown as WorkerViewManifest, s)).toEqual([expect.stringContaining('scene is { "maxHeight"')]);
    expect(checkManifest({ ...PACKAGES, cardinality: "one", scene: { maxHeight: 300 } }, s)).toEqual([expect.stringContaining("scene needs cardinality many on a kind")]);
  });
});

describe("a worker view, registered", () => {
  it("is previewed on the Scene, a kind's members held to its scene.maxHeight where it says one, and one record's view too", () => {
    expect(previewOf(viewOf(PACKAGES))).toEqual({});
    expect(previewOf(viewOf({ ...PACKAGES, scene: { maxHeight: 320 } }))).toEqual({ maxHeight: 320 });
    /*
     * A view of one record is the same card (Roadmap f-scene-record-view-card),
     * Open going to the record's page: no longer the record in focus held to
     * its box and scrolling inside it (FR-141), which a view the host draws
     * in React still is.
     */
    expect(previewOf(viewOf({ name: "one-package", attach: "package", cardinality: "one" }))).toEqual({});
    expect(previewOf(viewOf({ name: "one-package", attach: "package", cardinality: "one", replaces: "page" }))).toEqual({});
  });

  it("flows on Pages, and keeps its place's frame where its manifest says flows: false", async () => {
    expect((viewOf(PACKAGES) as { flows?: boolean }).flows).toBe(true);
    expect((viewOf({ ...PACKAGES, flows: false }) as { flows?: boolean }).flows).toBe(false);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store(), views: registry({ ...PACKAGES, flows: false }) as never, principal: lin }} initialPath="/places/the-packages" />));
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    const lens = host.querySelector<HTMLElement>('[data-testid="place-lens"]');
    expect(lens?.hasAttribute("data-flows")).toBe(false);
    expect(lens?.style.height).toBe("min(72vh, 760px)");
    expect(lens?.style.overflow).toBe("auto");
    await act(async () => root.unmount());
    host.remove();
  });
});
