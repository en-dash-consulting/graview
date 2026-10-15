import { readFileSync } from "node:fs";
import { declaredLenses, Store, type AnySchema, type GraviewApp } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, type ViewComponent } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { declaredLensView } from "../../src/declared-lenses.js";
import { buildCoverage, declaredViews } from "../../src/index.js";

/**
 * A COVERAGE WITH NOTHING TO CROSS SAYS SO, AND ONE THAT IS TOLD AN ORDER
 * DRAWS IN IT (2026-10-15, The Beatles).
 *
 * "Songs by genre" with no genre drew its songs as a list with no columns,
 * which read as the answer; now the picture says "No genres yet: link songs
 * to genres." and draws no row. "Releases by era" drew its releases in the
 * order they were written; `sort` orders the rows and `columnSort` the
 * columns.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const base = JSON.parse(readFileSync(new URL("beatles.gdd.json", fixtures), "utf8"));
const seed = JSON.parse(readFileSync(new URL("beatles.seed.json", fixtures), "utf8"));

function draw(title: string, options?: Record<string, unknown>, snapshot: unknown = seed, fidelity: "full" | "summary" | "glyph" = "full") {
  const document = structuredClone(base);
  if (options) document.lenses.find((lens: { title: string }) => lens.title === title).options = options;
  const compiled = compileDocument(document, { today: () => "2026-10-15" });
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: snapshot as never });
  const lens = declaredLenses(app).drawn.find((one) => one.title === title)!;
  const Lens = declaredLensView(lens) as ViewComponent<AnySchema>;
  return {
    app,
    store,
    lens,
    html: renderToStaticMarkup(
      <GraviewProvider store={store} views={declaredViews(app)} initialView={EMPTY_VIEW} principal={{ kind: "human", id: "u", roles: ["owner"] }}>
        <Lens cardinality="many" fidelity={fidelity} mode="fullscreen" selected={false} label={title} />
      </GraviewProvider>,
    ),
  };
}

describe("a coverage with nothing to cross", () => {
  it("says there are no columns yet, and draws no row", () => {
    const { html } = draw("Songs by genre");
    expect(html).toContain("No genres yet: link songs to genres.");
    expect(html).not.toContain("Song 001");
    expect(html).toContain("data-coverage-unlinked");
  });

  it("says nothing is linked yet where there are columns and no link, at a glance too", () => {
    const withGenres = { nodes: [...seed.nodes, { id: "genre-rock", kind: "genre", name: "Rock" }], edges: seed.edges };
    expect(draw("Songs by genre", undefined, withGenres).html).toContain("No song is linked to a genre yet: link songs to genres.");
    expect(draw("Songs by genre", undefined, withGenres, "glyph").html).toContain("nothing linked");
  });

  it("draws its grid once one song has a genre", () => {
    const linked = { nodes: [...seed.nodes, { id: "genre-rock", kind: "genre", name: "Rock" }], edges: [...seed.edges, { id: "e-g", kind: "inGenre", from: "song-001", to: "genre-rock" }] };
    expect(draw("Songs by genre", undefined, linked).html).not.toContain("data-coverage-unlinked");
  });
});

describe("a coverage told an order", () => {
  it("draws its rows by the field sort names and its columns by columnSort", () => {
    const { store, lens } = draw("Releases by era", { sort: { by: "released" }, columnSort: { by: "began", direction: "desc" } });
    const grid = buildCoverage(store.graph.allNodes(), store.graph.allEdges(), lens.options as never, store.schema);
    expect(grid.rows.slice(0, 3).map((row) => row.label)).toEqual(["Love Me Do", "Please Please Me", "With the Beatles"]);
    expect(grid.columns.map((column) => column.label)).toEqual(["After the band", "The studio years", "Beatlemania"]);
  });

  it("draws its rows in the order they were written where it is told none", () => {
    const { store, lens } = draw("Releases by era");
    const grid = buildCoverage(store.graph.allNodes(), store.graph.allEdges(), lens.options as never, store.schema);
    expect(grid.rows[0]!.label).toBe("Rubber Soul");
  });
});
