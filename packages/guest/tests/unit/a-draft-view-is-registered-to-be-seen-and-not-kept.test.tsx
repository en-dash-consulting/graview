// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { registerDefaultViews } from "@graview/primitives";
import { createViews, GraviewProvider, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { workshopApp, workshopSeed } from "../../../../scripts/fixtures/workshop-app.js";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { registerWorkerView } from "../../src/host/worker-react.js";

/**
 * A DRAFT VIEW IS REGISTERED TO BE SEEN, NOT KEPT (FR-187). A view proposed
 * and not yet kept is drawn where it attaches, marked as a draft; it goes by
 * no name the place menu or the host's tidying could keep it under; and
 * where it fails it says why in its place, never standing the kind's own
 * face there as though the proposal had drawn.
 */
const store = () => new Store({ schema: workshopApp.schema, mutations: workshopApp.mutations ?? [], policy: workshopApp.policy!, snapshot: structuredClone(workshopSeed) as never }) as unknown as Store<AnySchema>;
const manifest: WorkerViewManifest = { name: "deliverables-board", title: "Deliverables board", attach: "deliverable", cardinality: "many", reads: { kinds: ["deliverable"] } };
const worker = { source: "graview.onProps(() => graview.render('drawn'));" };
const registry = (draft: boolean) => registerWorkerView(registerDefaultViews(workshopApp.schema as AnySchema, createViews(workshopApp.schema as AnySchema)), { manifest, worker, ...(draft ? { draft } : {}) });

describe("a draft view", () => {
  it("is a place by its title, under no name", () => {
    const place = (draft: boolean) => registry(draft).places().find((one) => one.title === "Deliverables board");
    expect(place(false)?.name).toBe("deliverables-board");
    expect(place(true)).toBeDefined();
    expect(place(true)?.name).toBeUndefined();
  });

  it("is drawn under its one line, Draft — its title · Not kept", () => {
    const views = registry(true);
    const s = store();
    const View = views.lookup("deliverable", { cardinality: "many", fidelity: "full" }) as ViewComponent<AnySchema>;
    const html = renderToStaticMarkup(
      <GraviewProvider store={s} views={views} initialView={EMPTY_VIEW}>
        <View nodes={s.graph.nodesOfKind("deliverable" as never) as never} cardinality="many" fidelity="full" mode="fullscreen" selected={false} />
      </GraviewProvider>,
    );
    expect(html).toContain('data-graview-draft-view="deliverables-board"');
    expect(html).toContain('aria-label="Draft: Deliverables board"');
    expect(html).toMatch(/data-testid="draft-view-line"[^]*Draft — [^]*Deliverables board[^]*Not kept/);
    expect(html).toContain('data-worker-view-place="deliverables-board"');
  });

  it("is never drawn without its mark", () => {
    const views = registry(false);
    const s = store();
    const View = views.lookup("deliverable", { cardinality: "many", fidelity: "full" }) as ViewComponent<AnySchema>;
    const html = renderToStaticMarkup(
      <GraviewProvider store={s} views={views} initialView={EMPTY_VIEW}>
        <View nodes={s.graph.nodesOfKind("deliverable" as never) as never} cardinality="many" fidelity="full" mode="fullscreen" selected={false} />
      </GraviewProvider>,
    );
    expect(html).not.toContain("data-graview-draft-view");
  });
});
