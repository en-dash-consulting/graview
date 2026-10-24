import { type AnySchema } from "@graview/core";
import { registerDefaultViews } from "@graview/primitives";
import { createViews } from "@graview/react";
import { describe, expect, it } from "vitest";
import { offersApp } from "../../../../scripts/fixtures/offers-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A WORKER VIEW IS REGISTERED BY ITS NAME, TITLED OR NOT (FR-202), so a
 * host's tidying keeps a deleted one undrawn whatever registered after it.
 * In Graview Cloud's Eagles app a home view deleted that morning drew over
 * the live one: a home and an untitled view of a kind registered with no
 * name, and the home went to whichever registered last. That the deleted
 * home is not drawn on the page is `verify-address`
 * (aDeletedHomeViewNeverDrawsOverTheLiveOne).
 */
const SOURCE = "graview.onProps(() => graview.render('drawn'));";
const views = () => registerDefaultViews(offersApp.schema as AnySchema, createViews(offersApp.schema as AnySchema));
const many = { cardinality: "many", fidelity: "full" } as const;

describe("a worker view registered by its name", () => {
  it("gives the home its name, and fails over to the app's own home rather than to another view", () => {
    const registry = views();
    const nest: WorkerViewManifest = { name: "eagles-nest", attach: "home", cardinality: "many" };
    const story: WorkerViewManifest = { name: "eagles-story", attach: "home", cardinality: "many" };
    registerWorkerView(registry, { manifest: nest, worker: { source: SOURCE } });
    registerWorkerView(registry, { manifest: story, worker: { source: SOURCE } });
    expect(registry.homes?.().map((one) => one.name)).toEqual(["eagles-nest", "eagles-story"]);
  });

  it("gives an untitled view of a kind its name, and none to a draft", () => {
    const registry = views();
    registerWorkerView(registry, { manifest: { name: "package-cards", attach: "package", cardinality: "many" }, worker: { source: SOURCE } });
    expect(registry.resolve("package", many)?.name).toBe("package-cards");
    registerWorkerView(registry, { manifest: { name: "package-draft", attach: "package", cardinality: "many" }, worker: { source: SOURCE }, draft: true });
    expect(registry.resolve("package", many)?.name).toBeUndefined();
  });
});
