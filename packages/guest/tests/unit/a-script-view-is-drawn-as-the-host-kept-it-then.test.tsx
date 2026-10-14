import { Store, type AnySchema } from "@graview/core";
import type { HistoryHost } from "@graview/core/history";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider, PlaybackContext, type Playback, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A SCRIPT VIEW IS DRAWN AS THE HOST KEPT IT THEN (Roadmap f-playback). The
 * log holds no view's code: the host does. While a face shows the app as it
 * was, a worker view is drawn from the code the host hands for that moment
 * (`history.viewAt(name, seq)`); one the host says did not exist then is
 * the kind's own face; and where the host says nothing, today's.
 */
const manifest: WorkerViewManifest = { name: "deliverable", attach: "deliverable", cardinality: "one", acts: ["set-draft"] };

function drawnAt(viewAt: HistoryHost["viewAt"]) {
  const views = registerWorkerView(registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema)), { manifest, worker: { source: "graview.onProps(() => graview.render('now'));" } });
  const store = new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
  const past = store.at(0);
  const asked: [string, number][] = [];
  const playback: Playback = {
    past: { seq: 0, at: undefined, store: past },
    open: true,
    show: () => {},
    live: store,
    host: viewAt ? { viewAt: (name, seq) => (asked.push([name, seq]), viewAt(name, seq)) } : {},
    owns: () => true,
  };
  const View = views.lookup("deliverable", { cardinality: "one", fidelity: "full" }) as ViewComponent<AnySchema>;
  const html = renderToStaticMarkup(
    <PlaybackContext.Provider value={playback}>
      <GraviewProvider store={past} views={views} initialView={EMPTY_VIEW}>
        <View node={store.graph.getNode("deliverable:email") as never} cardinality="one" fidelity="full" mode="fullscreen" selected />
      </GraviewProvider>
    </PlaybackContext.Provider>,
  );
  return { html, asked };
}

describe("a script view in the past", () => {
  it("asks the host for its code at the moment drawn, and is drawn from it", () => {
    const { html, asked } = drawnAt(() => ({ source: "graview.onProps(() => graview.render('then'));" }));
    expect(asked).toEqual([["deliverable", 0]]);
    expect(html).toContain('data-worker-view-place="deliverable"');
  });

  it("is the kind's own face where the host says it did not exist then", () => {
    const { html } = drawnAt(() => null);
    expect(html).not.toContain("data-worker-view-place");
    expect(html).toContain('data-graview-fields="deliverable:email"');
  });

  it("is today's where the host does not say", () => {
    const { html } = drawnAt(undefined);
    expect(html).toContain('data-worker-view-place="deliverable"');
  });
});
