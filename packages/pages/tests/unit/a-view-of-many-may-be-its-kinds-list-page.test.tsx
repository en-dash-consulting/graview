import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, markReplacesPage, type ViewComponent } from "@graview/react";
import { registerDefaultViews } from "@graview/primitives";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, type PageContext } from "../../src/index.js";

/**
 * A VIEW OF MANY MAY BE ITS KIND'S LIST PAGE (FR-203). In Graview Cloud an
 * agent designed a view of a team's players and could not make it the
 * players' list: a view of many was drawn at its own `/places/<slug>` when
 * titled and nowhere when not, and `/players` kept the app's own list. A
 * view whose manifest says `replaces: "page"` is now drawn under the list
 * page's heading in place of the list, as a view of one that says so is a
 * record's page (FR-149). Without it, the list is the app's own.
 */
const player = defineNode("player", { fields: z.object({ label: z.string() }), plural: "Players" });
const team = defineNode("team", { fields: z.object({ label: z.string() }), plural: "Teams" });
const schema = createSchema([player, team]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "p1", kind: "player", label: "Pelé" },
        { id: "p2", kind: "player", label: "Garrincha" },
        { id: "t1", kind: "team", label: "Santos" },
      ] as never,
      edges: [],
    },
  });
const Roster: ViewComponent<typeof schema> = ({ nodes }) => <p data-testid="roster">{nodes?.length ?? 0} on the roster</p>;
const views = (view: ViewComponent<typeof schema>, meta?: { title: string }) =>
  registerDefaultViews(schema, createViews(schema)).register("player", { cardinality: "many", fidelity: "full" }, view, { name: "roster", ...(meta ? { ...meta, lens: "view" } : {}) });
const draw = (path: string, registry: ReturnType<typeof views>) => renderToStaticMarkup(<PagesApp context={{ store: store(), views: registry } as PageContext<typeof schema>} initialPath={path} />);

describe("a kind's list page", () => {
  it("is the view of many under the list's heading when the view replaces the page", () => {
    const html = draw("/players", views(markReplacesPage((props) => <Roster {...props} />)));
    expect(html).toContain('data-testid="list-view"');
    expect(html).toContain("2 on the roster");
    expect(html).toMatch(/data-graview-page-title="">Players</);
    // No rows of its own, and no form: what is done here is what the view offers.
    expect(html).not.toContain('data-testid="records"');
    expect(html).not.toContain('data-testid="beginnings-open"');
  });

  it("is the derived list when the view of many does not replace the page", () => {
    const html = draw("/players", views((props) => <Roster {...props} />));
    expect(html).not.toContain('data-testid="list-view"');
    expect(html).not.toContain("on the roster");
    expect(html).toContain('data-testid="records"');
    expect(html).toContain("Garrincha");
  });

  it("is the derived list for every other kind", () => {
    const html = draw("/teams", views(markReplacesPage((props) => <Roster {...props} />)));
    expect(html).not.toContain('data-testid="list-view"');
    expect(html).toContain("Santos");
  });

  it("is the titled view's own place too, which offers no way to the list it already is", () => {
    const registry = views(markReplacesPage((props) => <Roster {...props} />), { title: "The roster" });
    expect(draw("/players", registry)).toContain("2 on the roster");
    const place = draw("/places/the-roster", registry);
    expect(place).toContain("2 on the roster");
    expect(place).not.toContain("All players as a list");
  });
});
