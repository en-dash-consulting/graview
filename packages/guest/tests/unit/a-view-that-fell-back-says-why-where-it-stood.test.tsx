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
 * A VIEW THAT FELL BACK SAYS WHY, WHERE IT STOOD (Roadmap
 * r-visitor-sees-lens-not-view). A view that cannot be drawn — its code
 * refused to a signed-out visitor, a manifest the app no longer matches —
 * is drawn as the kind's own face in its place, so a person is never left
 * a blank. That is as it should be; but nothing on the page said so, and a
 * visitor drawn a built-in page where the owner was drawn the view left
 * nobody a way to tell why. The face it fell back to stands in an element
 * that names the view and the reason (`data-worker-view-fell-back`,
 * `data-worker-view-failed`), drawing nothing of its own.
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
const faces: WorkerViewManifest = { name: "the-faces", title: "The faces", attach: "package", cardinality: "many" };

describe("a view that fell back", () => {
  it("draws the kind's own face in an element that names the view and why", async () => {
    // Its code, refused: as a code address that needs a signed-in session answers a visitor.
    const registry = registerWorkerView(registerDefaultViews(offersApp.schema as AnySchema, createViews(offersApp.schema as AnySchema)), { manifest: faces, worker: () => Promise.reject(new Error("401")) });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store(), views: registry as never, principal: lin }} initialPath="/places/the-faces" />));
    for (let turn = 0; turn < 100 && !host.querySelector("[data-worker-view-fell-back]"); turn++) await act(async () => new Promise((done) => setTimeout(done, 10)));
    const fell = host.querySelector<HTMLElement>("[data-worker-view-fell-back]");
    expect(fell?.getAttribute("data-worker-view-fell-back")).toBe("the-faces");
    expect(fell?.getAttribute("data-worker-view-failed")).toBe("source");
    expect(fell?.style.display).toBe("contents");
    // The kind's own face is drawn inside it, and the view's region is gone.
    expect(fell?.textContent ?? "").not.toBe("");
    expect(host.querySelector("[data-worker-view]")).toBeNull();
    await act(async () => root.unmount());
    host.remove();
  });
});
