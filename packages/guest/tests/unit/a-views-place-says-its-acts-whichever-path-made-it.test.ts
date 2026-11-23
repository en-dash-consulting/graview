import type { AnySchema } from "@graview/core";
import { viewPlaceOf } from "@graview/core/seat";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { describe, expect, it } from "vitest";
import { offersApp } from "../../../../scripts/fixtures/offers-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A VIEW'S PLACE SAYS ITS ACTS, WHICHEVER PATH MADE IT (HQ
 * f-forms-and-downloads-follow-ups). A worker view registered on a page
 * gave its place the manifest's acts and the kinds it reads, which the bar
 * reads to list a form beside its kind's list; the same view's place as
 * the router, the seat and a headless check know it (`viewPlaceOf`) said
 * neither. Both now say the same.
 */
(globalThis as { Worker?: unknown }).Worker ??= class {
  onmessage = null;
  onerror = null;
  postMessage() {}
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
};
const manifest: WorkerViewManifest = { name: "note-pad", title: "Notes on packages", attach: "package", cardinality: "many", reads: { kinds: ["offer"] }, acts: ["add-note", { act: "set-summary" }] };
const SOURCE = "graview.onProps(() => graview.render('drawn'));";

describe("a titled view's place", () => {
  it("carries the view's acts and the kinds it reads, as the place a page registers does", () => {
    const registry = registerWorkerView(registerDefaultViews(offersApp.schema as AnySchema, createViews(offersApp.schema as AnySchema)), { manifest, worker: { source: SOURCE } });
    const registered = registry.places().find((place) => place.name === "note-pad");
    expect(registered).toMatchObject({ acts: ["add-note", "set-summary"], reads: ["offer"] });
    const described = viewPlaceOf(manifest);
    expect(described).toMatchObject({ acts: ["add-note", "set-summary"], reads: ["offer"] });
    expect({ acts: described?.acts, reads: described?.reads }).toEqual({ acts: registered?.acts, reads: registered?.reads });
  });

  it("says no acts where the view asks for none", () => {
    expect(viewPlaceOf({ name: "plain", title: "Plain", attach: "package", cardinality: "many" })).not.toHaveProperty("acts");
  });
});
