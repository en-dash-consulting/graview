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
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A VIEW'S PLACE FITS A PHONE (Roadmap f-view-place-min-width,
 * f-bleed-on-places, f-fallback-lens-loses-gutter). Found on Graview Cloud
 * at 390 pixels: a view's wide content (an SVG 640 wide in a box that
 * scrolls sideways) widened its place, which was a grid item at its
 * content's min-content width, and the page clipped on the right; `bleed:
 * true` took the gutter back on the home and a record's page but not on a
 * view titled as a place; and where a home that bleeds did not draw, the
 * app's own page drawn in its slot lost its gutters too. Measured in a
 * browser at 390 and 1440 by `verify-address`.
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
const registry = (...manifests: WorkerViewManifest[]) => manifests.reduce((views, manifest) => registerWorkerView(views, { manifest, worker: { source: SOURCE } }), registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema)));

let done: (() => Promise<void>) | undefined;
afterEach(async () => {
  await done?.();
  done = undefined;
});
async function page(path: string, ...manifests: WorkerViewManifest[]) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: registry(...manifests) as never, principal: nick }} initialPath={path} />));
  await act(async () => new Promise((settle) => setTimeout(settle, 20)));
  done = async () => {
    await act(async () => root.unmount());
    host.remove();
  };
  return host;
}

const board: WorkerViewManifest = { name: "board", title: "The board", attach: "deliverable", cardinality: "many" };
const brief: WorkerViewManifest = { name: "brief", attach: "deliverable", cardinality: "one" };
const hero: WorkerViewManifest = { name: "hero", attach: "home", cardinality: "many", bleed: true };

describe("a view's place on Pages", () => {
  it("may be narrower than what the view draws, on the home, a place and a record's page", async () => {
    for (const [path, manifest, name] of [
      ["/", { ...hero, bleed: false }, "hero"],
      ["/places/the-board", board, "board"],
      ["/deliverables/deliverable%3Aemail", brief, "brief"],
    ] as const) {
      const host = await page(path, manifest);
      const place = host.querySelector<HTMLElement>(`[data-worker-view-place="${name}"]`);
      expect(place, path).not.toBeNull();
      expect(place!.style.minWidth, path).toBe("0px");
      await done?.();
      done = undefined;
    }
  });
});

describe("a place declared bleed", () => {
  it("draws its view in the box that takes the gutter back on a phone", async () => {
    const host = await page("/places/the-board", { ...board, bleed: true });
    const place = host.querySelector('[data-testid="place-lens"] [data-worker-view-place="board"]');
    expect(place).not.toBeNull();
    expect(place!.closest("[data-graview-bleed]")).not.toBeNull();
  });
  it("and a place that does not say so draws inside the gutter, as it was", async () => {
    const host = await page("/places/the-board", board);
    expect(host.querySelector('[data-worker-view-place="board"]')).not.toBeNull();
    expect(host.querySelector("[data-graview-bleed]")).toBeNull();
  });
});

describe("what is drawn in the slot of a view that bleeds and did not draw", () => {
  it("is the app's own page, marked as drawn in the view's stead, and the bleed is the view's alone", async () => {
    // A manifest that asks for an act the app does not declare is refused before it starts: the kind's own face is drawn in its place.
    const host = await page("/places/the-board", { ...board, bleed: true, acts: ["no-such-act"] });
    await act(async () => new Promise((settle) => setTimeout(settle, 20)));
    const bleed = host.querySelector("[data-graview-bleed]");
    expect(bleed).not.toBeNull();
    expect(host.querySelector('[data-worker-view-place="board"]')).toBeNull();
    // The fallback stands directly in the bleed's box, marked, so the rule that takes the gutter back passes it by.
    expect(bleed!.querySelector(":scope > [data-worker-view-fallback]")).not.toBeNull();
    const rule = bleed!.querySelector("style")?.textContent ?? "";
    expect(rule).toContain("[data-graview-bleed]:not(:has(>[data-worker-view-fallback]))");
  });
  it("is not marked where the view drew", async () => {
    const host = await page("/places/the-board", { ...board, bleed: true });
    expect(host.querySelector("[data-worker-view-fallback]")).toBeNull();
  });
});
