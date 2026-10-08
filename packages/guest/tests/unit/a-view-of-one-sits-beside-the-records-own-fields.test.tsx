// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import { checkManifest, type WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A VIEW OF ONE SITS BESIDE THE RECORD'S OWN FIELDS (FR-149). Graview
 * Cloud's workshop: a chat wrote a view of a deliverable, `cardinality:
 * "one"`, and once applied the record was the view and nothing else, so its
 * three-thousand-character draft could no longer be changed. A view of one
 * is now drawn above the record's own editable fields on the scene, and
 * above the record page's facts and acts on Pages; it replaces them only
 * when its manifest says `replaces: "page"`. In a browser, on both faces and
 * in three engines: `guest-sandbox --transport=record`.
 */
/* jsdom starts no worker: a worker that never says ready keeps the view's region drawn for as long as these tests look. */
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
const beside: WorkerViewManifest = { name: "deliverable", attach: "deliverable", cardinality: "one", acts: ["set-draft"] };
const replacing: WorkerViewManifest = { ...beside, replaces: "page" };
const registry = (manifest: WorkerViewManifest) => registerWorkerView(registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema)), { manifest, worker: { source: "graview.onProps(() => graview.render('drawn'));" } });

describe("a manifest's replaces", () => {
  it("is sound as page, on a view of one record", () => {
    expect(checkManifest(replacing, store())).toEqual([]);
    expect(checkManifest(beside, store())).toEqual([]);
  });
  it("is said wrong when it is not page, or on a view of many or of the home", () => {
    expect(checkManifest({ ...beside, replaces: "card" as never }, store())).toEqual([expect.stringMatching(/replaces.*"card".*page/)]);
    expect(checkManifest({ ...replacing, cardinality: "many" }, store())).toEqual([expect.stringMatching(/one record/)]);
    expect(checkManifest({ ...replacing, attach: "home", cardinality: "many" }, store())).toEqual([expect.stringMatching(/one record/)]);
  });
});

describe("on the scene, the record drawn at full", () => {
  const drawn = (manifest: WorkerViewManifest) => {
    const views = registry(manifest);
    const s = store();
    const View = views.lookup("deliverable", { cardinality: "one", fidelity: "full" }) as ViewComponent<AnySchema>;
    return renderToStaticMarkup(
      <GraviewProvider store={s} views={views} initialView={EMPTY_VIEW}>
        <View node={s.graph.getNode("deliverable:email") as never} cardinality="one" fidelity="full" mode="fullscreen" selected />
      </GraviewProvider>,
    );
  };
  it("is the view, then the record's own fields, each editable where an act writes it", () => {
    const html = drawn(beside);
    expect(html).toContain('data-worker-view-place="deliverable"');
    expect(html).toContain('data-graview-fields="deliverable:email"');
    expect(html).toMatch(/data-graview-field="draft"[^>]*data-graview-editable="set-draft"/);
    expect(html.indexOf("data-worker-view-place")).toBeLessThan(html.indexOf("data-graview-fields"));
  });
  it("is the view alone when its manifest says it replaces the page", () => {
    const html = drawn(replacing);
    expect(html).toContain('data-worker-view-place="deliverable"');
    expect(html).not.toContain("data-graview-fields");
  });
});

describe("on Pages, the record's page", () => {
  const page = async (manifest: WorkerViewManifest) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<PagesApp context={{ store: store(), views: registry(manifest) as never, principal: nick }} initialPath="/deliverables/deliverable%3Aemail" />));
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    const said = {
      view: Boolean(host.querySelector('[data-testid="record-view"] [data-worker-view-place="deliverable"]')),
      facts: Boolean(host.querySelector('[data-testid="record-fields"]')),
      acts: Boolean(host.querySelector('[data-testid="record-actions"]')),
      /* The page is the framework's own record: the view does not draw the default's fields a second time inside it. */
      twice: Boolean(host.querySelector('[data-testid="record-view"] [data-graview-fields]')),
    };
    await act(async () => root.unmount());
    host.remove();
    return said;
  };
  it("is the view at its head, then the facts and what can be done", async () => {
    expect(await page(beside)).toEqual({ view: true, facts: true, acts: true, twice: false });
  });
  it("is the view alone under the heading when its manifest says it replaces the page", async () => {
    expect(await page(replacing)).toEqual({ view: true, facts: false, acts: false, twice: false });
  });
});
