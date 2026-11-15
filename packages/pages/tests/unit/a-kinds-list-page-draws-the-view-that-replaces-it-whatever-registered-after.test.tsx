import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, markReplacesPage, type ViewComponent } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A KIND'S LIST PAGE DRAWS THE VIEW THAT REPLACES IT, WHATEVER REGISTERED
 * AFTER (FR-238). On a Graview Cloud app the view `deliverables-board`, of
 * many deliverables and titled "Deliverables", said `replaces: "page"`; a
 * second titled view of many, "Status", registered after it, won the kind's
 * default cell, and `/deliverables` drew the plain list. The list page now
 * draws the view that replaces it, and its own place still offers no way to
 * the list it already is.
 */
const deliverable = defineNode("deliverable", { fields: z.object({ label: z.string() }), plural: "Deliverables" });
const schema = createSchema([deliverable]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "d1", kind: "deliverable", label: "Brand guide" },
        { id: "d2", kind: "deliverable", label: "Launch site" },
      ] as never,
      edges: [],
    },
  });
const many = { cardinality: "many", fidelity: "full" } as const;
const Board: ViewComponent<typeof schema> = markReplacesPage(({ nodes }) => <p data-testid="board">{nodes?.length ?? 0} on the board</p>);
const Status: ViewComponent<typeof schema> = ({ nodes }) => <p data-testid="status">{nodes?.length ?? 0} by status</p>;
const draw = (path: string, views: ReturnType<typeof createViews<typeof schema>>) =>
  renderToStaticMarkup(<PagesApp context={{ store: store(), views } as PageContext<typeof schema>} initialPath={path} />);

describe("a kind's list page with a view that replaces it and another registered after", () => {
  const views = () =>
    registerDefaultViews(schema, createViews(schema))
      .register("deliverable", many, Board, { title: "Deliverables", name: "deliverables-board", lens: "view" })
      .register("deliverable", many, Status, { title: "Status", name: "status", lens: "view" });

  it("draws the view that replaces it, not the plain list", () => {
    const html = draw("/deliverables", views());
    expect(html).toContain('data-testid="list-view"');
    expect(html).toContain("2 on the board");
    expect(html).not.toContain("by status");
    expect(html).not.toContain('data-testid="records"');
  });

  it("is the plain list asked for by its address", () => {
    const html = draw("/deliverables?drawn=built-in", views());
    expect(html).not.toContain("on the board");
    expect(html).toContain('data-testid="records"');
  });

  it("offers no way to the list from the place that is the list, and from the other the list itself", () => {
    expect(draw("/places/deliverables", views())).not.toContain("All deliverables as a list");
    const status = draw("/places/status", views());
    expect(status).toContain("All deliverables as a list");
    // The list it offers is the list itself, not the view that is the list page.
    expect(status).toMatch(/href="\/deliverables\?drawn=built-in"[^>]*data-testid="place-as-list"|data-testid="place-as-list"[^>]*href="\/deliverables\?drawn=built-in"/);
  });
});
