// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { Store, type AnySchema } from "@graview/core";
import { pastOf } from "@graview/core/past";
import { EMPTY_VIEW } from "@graview/layout";
import { PagesApp } from "@graview/pages";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider, markBleeds, bleedsFull, PlaybackContext, type Playback, type ViewComponent } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { nick, workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView, workerView } from "../../src/host/worker-react.js";

/**
 * WHAT `bleed: "full"` TAKES IS THE VIEW'S ALONE (Roadmap
 * f-views-bleed-full-width, the review of pull request 533). A view that did
 * not draw goes back to the column with its spacing and the app's line; a
 * trail over a place keeps its spacing; the kind's page blocks under a
 * record's view and a draft's line keep the page's gutter; another face on the
 * document keeps its padding. jsdom lays nothing out, so this holds what the
 * rules name and what the page marks; `verify-address` measures them
 * (aViewThatBleedsFullThatDidNotDrawKeepsTheColumnAndTheLine and those after it).
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
const hero: WorkerViewManifest = { name: "hero", attach: "home", cardinality: "many", bleed: "full" };
const brief: WorkerViewManifest = { name: "brief", attach: "deliverable", cardinality: "one", bleed: "full" };
const SOURCE = "graview.onProps(() => graview.render('drawn'));";
const base = () => registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema));

async function on<T>(views: unknown, path: string, read: (host: HTMLElement) => T): Promise<T> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<PagesApp context={{ store: store(), views: views as never, principal: nick }} initialPath={path} />));
  await act(async () => new Promise((done) => setTimeout(done, 20)));
  const said = read(host);
  await act(async () => root.unmount());
  host.remove();
  return said;
}
const slotRule = (host: HTMLElement) => host.querySelector("[data-graview-bleed=full] > style")?.textContent ?? "";
const topRule = (host: HTMLElement) => host.querySelector("[data-graview-page-main] > style")?.textContent ?? "";

describe("a view that bleeds full and did not draw", () => {
  const home = () => on(registerWorkerView(base(), { manifest: hero, worker: { source: SOURCE } }), "/", (host) => ({ slot: slotRule(host), top: topRule(host) }));
  it("gives the slot back to the column wherever the view failed, fell back or threw", async () => {
    const { slot } = await home();
    expect(slot).toContain(":not(:has([data-worker-view-fallback],[data-worker-view-failed],[data-graview-view-error]))");
  });
  it("keeps the page's spacing and the app's line drawn wherever the view failed, fell back or threw", async () => {
    const { top } = await home();
    expect(top.match(/:not\(:has\(\[data-graview-bleed=full\] :is\(\[data-worker-view-fallback\],\[data-worker-view-failed\],\[data-graview-view-error\]\)\)\)/g)).toHaveLength(3);
  });
  it("is marked where the host says the view did not exist then, and there is nothing to draw in its stead", () => {
    const source = store();
    const past = pastOf(source, 0);
    const playback: Playback = { past: { seq: 0, at: undefined, store: past }, open: true, show: () => {}, live: source, host: { viewAt: () => null }, owns: () => true, archive: null };
    const View = workerView({ manifest: hero, worker: { source: SOURCE } }) as ViewComponent<AnySchema>;
    const html = renderToStaticMarkup(
      <PlaybackContext.Provider value={playback}>
        <GraviewProvider store={past} views={base()} initialView={EMPTY_VIEW}>
          <View cardinality="many" fidelity="full" mode="fullscreen" selected={false} />
        </GraviewProvider>
      </PlaybackContext.Provider>,
    );
    expect(html).toContain("data-worker-view-fallback");
  });
});

describe("the top of a page that bleeds full", () => {
  it("keeps its spacing where the header holds more than the title: a trail or a narrowing stays above the view", async () => {
    const top = await on(registerWorkerView(base(), { manifest: hero, worker: { source: SOURCE } }), "/", topRule);
    expect(top.split("}")[0]).toContain(":not(:has(>header>:not([data-graview-page-title])))");
  });
  it("is said for its own page only, so another face on the document keeps its padding", async () => {
    const said = await on(registerWorkerView(base(), { manifest: hero, worker: { source: SOURCE } }), "/", (host) => ({ value: host.querySelector("[data-graview-page-main]")?.getAttribute("data-graview-bleed-top"), top: topRule(host) }));
    expect(said.value).toBe("full");
    expect(said.top).not.toMatch(/\[data-graview-bleed-top\]/);
    expect(said.top).toContain("[data-graview-bleed-top=full]");
  });
  it("does not reach a page that bleeds full from the phone's own rule", async () => {
    const said = await on(registerWorkerView(base(), { manifest: { ...hero, bleed: true }, worker: { source: SOURCE } }), "/", topRule);
    expect(said).toContain('[data-graview-bleed-top=""]');
  });
});

describe("the page a view that bleeds full spans", () => {
  it("holds its width in a shell that lays its children out in a row or a centered grid", async () => {
    const box = await on(registerWorkerView(base(), { manifest: hero, worker: { source: SOURCE } }), "/", (host) => (host.querySelector("[data-graview-page-spans]") as HTMLElement).style);
    expect(box.width).toBe("100%");
    expect(box.flexGrow).toBe("1");
    expect(box.flexBasis).toBe("0%");
  });
  it("takes each side's safe area on that side, whichever way the page reads", async () => {
    const slot = await on(registerWorkerView(base(), { manifest: hero, worker: { source: SOURCE } }), "/", slotRule);
    expect(slot).toContain("margin-left:calc(50% - 50cqw + env(safe-area-inset-left,0px))");
    expect(slot).toContain("margin-right:calc(50% - 50cqw + env(safe-area-inset-right,0px))");
    expect(slot.split("}")[0]).not.toContain("margin-inline");
  });
});

describe("what stands in the slot with a view that bleeds full", () => {
  const withBlocks = () => {
    const views = base();
    views.register("deliverable", { cardinality: "one", fidelity: "full" }, (() => <p data-testid="the-blocks">The blocks</p>) as never);
    return registerWorkerView(views, { manifest: brief, worker: { source: SOURCE } });
  };
  it("gives the kind's page blocks under a record's view the column back", async () => {
    const said = await on(withBlocks(), "/deliverables/deliverable%3Aemail", (host) => ({ under: Boolean(host.querySelector('[data-testid="the-blocks"]')?.closest("[data-worker-view-beside-under]")), slot: slotRule(host) }));
    expect(said.under).toBe(true);
    expect(said.slot).toContain("[data-worker-view-beside-under]{");
    expect(said.slot).toContain("max-width:calc(760px + 2*var(--graview-page-gutter,20px))");
    expect(said.slot).toContain("padding-inline:var(--graview-page-gutter,20px)");
  });
  it("leaves the blocks of a view that does not bleed full as they were", async () => {
    const views = base();
    views.register("deliverable", { cardinality: "one", fidelity: "full" }, (() => <p data-testid="the-blocks">The blocks</p>) as never);
    const under = await on(registerWorkerView(views, { manifest: { ...brief, bleed: true }, worker: { source: SOURCE } }), "/deliverables/deliverable%3Aemail", (host) => host.querySelector("[data-worker-view-beside-under]"));
    expect(under).toBeNull();
  });
  it("gives a draft's line the page's gutter", async () => {
    const said = await on(registerWorkerView(base(), { manifest: hero, worker: { source: SOURCE }, draft: true }), "/", (host) => ({ line: Boolean(host.querySelector('[data-testid="draft-view-line"]')), slot: slotRule(host) }));
    expect(said.line).toBe(true);
    expect(said.slot).toContain('[data-testid="draft-view-line"]{padding-inline:var(--graview-page-gutter,20px)');
  });
});

describe("marking a view as it bleeds", () => {
  it("may say so again, the last saying being what holds", () => {
    const view = () => null;
    markBleeds(view);
    expect(() => markBleeds(view, "full")).not.toThrow();
    expect(bleedsFull(view)).toBe(true);
  });
});
