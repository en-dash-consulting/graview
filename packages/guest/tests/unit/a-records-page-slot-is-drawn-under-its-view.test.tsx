// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews, registerViewSpecs } from "@graview/primitives";
import { createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A RECORD PAGE'S SLOT AND ITS VIEW (Roadmap
 * feature:page-slot-blocks-on-a-kind-with-a-record-view-unclear-whether-and-where-they-draw).
 * Threat Watch, on Graview Cloud, gave a kind a page slot — "Read the
 * sources", as blocks — and a record view of its own, and could not tell
 * whether the slot was drawn or where. It is drawn in one place: the view,
 * then the slot's blocks, then the facts the slot did not already say. A
 * view whose manifest says `replaces: "page"` is the whole page, and the
 * slot is not drawn (`describePlace` says so as a problem). In a browser at
 * 390 and 1440: `verify-address` (aRecordPagesSlotIsDrawnUnderItsViewAndAboveTheFacts).
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
const SLOT = { deliverable: { page: [{ headline: "Read the sources" }, { field: "status", label: "Where it stands" }] } };
const beside: WorkerViewManifest = { name: "brief", attach: "deliverable", cardinality: "one" };
const replacing: WorkerViewManifest = { ...beside, replaces: "page" };
const registry = (manifest?: WorkerViewManifest) => {
  const views = registerViewSpecs(registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema)), workshopApp.schema as AnySchema, SLOT as never);
  return manifest ? registerWorkerView(views, { manifest, worker: { source: "graview.onProps(() => graview.render('drawn'));" } }) : views;
};

const page = async (manifest?: WorkerViewManifest) => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: registry(manifest) as never, principal: nick }} initialPath="/deliverables/deliverable%3Aemail" />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const text = host.textContent ?? "";
  const place = host.querySelector('[data-worker-view-place="brief"]');
  const slot = host.querySelector('[data-graview-spec="page"]');
  const facts = host.querySelector('[data-testid="record-fields"]');
  const said = {
    view: Boolean(place),
    slot: Boolean(slot) && text.includes("Read the sources"),
    // The slot under the view, in document order; the facts under both.
    slotUnderView: Boolean(place && slot && place.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING),
    factsUnderSlot: Boolean(slot && facts && slot.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING),
    facts: Boolean(facts),
    // What the slot says is not said again among the facts (FR-141).
    statusAgain: [...(facts?.querySelectorAll("dt") ?? [])].some((dt) => /status/i.test(dt.textContent ?? "")),
  };
  await act(async () => root.unmount());
  host.remove();
  return said;
};

describe("a kind's page slot, with a view of one of its records", () => {
  it("is drawn under a view that sits above the page, over the facts it did not say", async () => {
    expect(await page(beside)).toEqual({ view: true, slot: true, slotUnderView: true, factsUnderSlot: true, facts: true, statusAgain: false });
  });
  it("leaves out the same facts it leaves out with no view at all", async () => {
    expect(await page()).toMatchObject({ view: false, slot: true, factsUnderSlot: true, statusAgain: false });
  });
  it("is not drawn under a view that replaces the page, which is drawn alone", async () => {
    expect(await page(replacing)).toEqual({ view: true, slot: false, slotUnderView: false, factsUnderSlot: false, facts: false, statusAgain: false });
  });
});
