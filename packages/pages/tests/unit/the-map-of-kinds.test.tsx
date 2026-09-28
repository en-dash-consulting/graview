import { createSchema, defineNode, Store } from "@graview/core";
import { createViews, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { kindMap, PagesApp, type PageContext } from "../../src/index.js";

/**
 * RELATIONSHIPS ARE STRUCTURE ON THE ROUTED FACE, not only a record's link
 * groups. The map says how the kinds fit together in the declaration's own
 * words with live counts; a kind's page says what it relates to and can be
 * read as piles per far end; a record links the other way round — to the
 * far kind's list narrowed to itself — and says which pictures it is seen in.
 */
const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: { does: { to: ["duty"], description: "what they do", inverse: "who does it" } },
});
const duty = defineNode("duty", {
  fields: z.object({ label: z.string() }),
  plural: "Duties",
  edges: { in: { to: ["week"], description: "the week it falls in" } },
});
const week = defineNode("week", { fields: z.object({ label: z.string() }), plural: "Weeks" });
const schema = createSchema([person, duty, week]);
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "w1", kind: "week", label: "This week" },
        { id: "ana", kind: "person", label: "Ana" },
        { id: "bo", kind: "person", label: "Bo" },
        { id: "m", kind: "duty", label: "Morning" },
        { id: "e", kind: "duty", label: "Evening" },
        { id: "n", kind: "duty", label: "Night" },
      ] as never,
      edges: [
        { kind: "does", from: "ana", to: "m" },
        { kind: "does", from: "ana", to: "e" },
        { kind: "does", from: "bo", to: "n" },
        { kind: "in", from: "m", to: "w1" },
      ],
    },
  });
const Rota: ViewComponent<typeof schema> = ({ nodes }) => <div data-testid="rota-lens">{nodes?.length ?? 0} duties</div>;
const views = () => createViews(schema).register("duty", { cardinality: "many", fidelity: "full" }, Rota, { title: "The rota" });
const draw = (path: string) => {
  const context: PageContext<typeof schema> = { store: store(), views: views() };
  return renderToStaticMarkup(<PagesApp context={context} initialPath={path} />);
};

describe("the map of kinds", () => {
  it("derives every declared relation with its words and its live count", () => {
    const map = kindMap(store());
    expect(map.kinds.map((entry) => `${entry.plural} ${entry.count}`)).toEqual(["People 2", "Duties 3", "Weeks 1"]);
    expect(map.relations).toEqual([
      { edgeKind: "does", from: "person", to: "duty", description: "what they do", inverse: "who does it", count: 3 },
      { edgeKind: "in", from: "duty", to: "week", description: "the week it falls in", count: 1 },
    ]);
  });

  it("draws the map at /map, one line per relation, in the declaration's words — and the home offers the way to it in one line", () => {
    const html = draw("/map");
    expect(html).toContain('data-testid="kind-map"');
    expect(html.match(/data-testid="relation"/g)).toHaveLength(2);
    expect(html).toContain("What they do");
    expect(html).toContain("from the other end, who does it");
    // The count opens the far kind's list narrowed to the ones that have it.
    expect(html).toContain('href="/duties?with=does"');
    expect(html).toContain('data-graview-relation="does"');
    /*
     * The home used to carry the whole list under the pictures, and read as
     * a readme for it. It is a gallery now: the relations are one line that
     * says how many there are and opens the map.
     */
    const home = draw("/");
    expect(home).not.toContain('data-testid="kind-map"');
    expect(home).toContain('data-testid="map-link"');
    expect(home).toContain("How it fits together · 2 relations");
    expect(home).toContain(">Map<");
  });

  it("says on a kind's page what it relates to, and groups the list by a relation from the address", () => {
    const plain = draw("/duties");
    expect(plain).toContain('data-testid="kind-relations"');
    expect(plain).toContain('href="/people"');
    expect(plain).toContain('href="/weeks"');
    expect(plain).toContain('data-testid="arrange-group"');
    const grouped = draw("/duties?by=does");
    expect(grouped).toContain('data-grouped="does"');
    expect(grouped.match(/data-testid="list-group"/g)).toHaveLength(2);
    expect(grouped.indexOf("Ana")).toBeLessThan(grouped.indexOf("Bo"));
    // Night falls under Bo; a duty nobody does would fall under "No does", last.
    expect(grouped).toContain("Night");
  });

  it("narrows the list by a relation to one node, and by having the relation at all", () => {
    const anas = draw("/duties?does=ana");
    expect(anas).toContain('data-testid="list-filter-note"');
    expect(anas).toContain("Morning");
    expect(anas).toContain("Evening");
    expect(anas).not.toContain("Night");
    const inAWeek = draw("/duties?with=in");
    expect(inAWeek).toContain("Morning");
    expect(inAWeek).not.toContain("Evening");
    expect(inAWeek).not.toContain("Night");
    expect(draw("/duties?does=nobody")).toContain("None of them.");
  });

  it("links a record the other way round, and says where it is seen", () => {
    const ana = draw("/people/ana");
    expect(ana).toContain('data-testid="related-all"');
    expect(ana).toContain('href="/duties?does=ana"');
    const morning = draw("/duties/m");
    expect(morning).toContain('href="/people?does=m"');
    expect(morning).toContain('data-testid="seen-in"');
    expect(morning).toContain('href="/places/the-rota"');
    expect(morning).toContain('href="/#view=the-rota"');
    expect(ana).not.toContain('data-testid="seen-in"');
  });
});
