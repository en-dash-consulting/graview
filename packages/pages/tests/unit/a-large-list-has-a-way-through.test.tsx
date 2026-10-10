import { createSchema, defineNode, isoDate, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LARGE_LIST, ListPage, PagesApp } from "../../src/index.js";

/**
 * A LARGE LIST HAS A WAY THROUGH IT, AND A DESIGN DRAWS WITH THE SAME LIST.
 *
 * Nick, on Discography's 479 albums: an eyebrow, "479 of 479 shown.", a
 * page Find again, and a bare column of names — nothing to scan by and no
 * way to jump. A large list opens in a meaningful order (newest first where
 * the kind says when it starts, else by name) and says so on its line; it
 * is one line a record, and an index of its years or its letters jumps to
 * each. A design hands `ListPage` its own row and how the list opens, and
 * the head and the line are the framework's.
 */
const album = defineNode("album", {
  fields: z.object({ label: z.string(), released: isoDate.optional() }),
  plural: "Albums",
  label: (node) => node.label,
  fieldRoles: { start: "released" },
});
const artist = defineNode("artist", { fields: z.object({ label: z.string() }), plural: "Artists", label: (node) => node.label });
const schema = createSchema([album, artist]);
const names = ["Arc", "Blue Hour", "Cold Water", "Dust", "Echo"];
const store = () =>
  new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        ...Array.from({ length: LARGE_LIST + 5 }, (_, at) => ({ id: `a${at}`, kind: "album", label: `${names[at % 5]} ${at}`, released: `${2000 + (at % 6)}-05-01` })),
        ...Array.from({ length: LARGE_LIST }, (_, at) => ({ id: `r${at}`, kind: "artist", label: `${names[at % 5]} Band ${at}` })),
        { id: "solo", kind: "artist", label: "Zed" },
      ] as never,
      edges: [],
    },
  });
const draw = (path: string) => renderToStaticMarkup(<PagesApp context={{ store: store() }} initialPath={path} />);

describe("a large list", () => {
  it("opens newest first where the kind says when it starts, says so on its line, and jumps by year", () => {
    const html = draw("/albums");
    expect(html).toMatch(/data-testid="arrange-sort"[^>]*value="released"[^>]*aria-label="Sorted by released, latest first"/);
    expect(html).toContain('data-sectioned="year"');
    const index = /data-testid="list-index"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
    expect([...index.matchAll(/>(\d{4})</g)].map((match) => match[1])).toEqual(["2005", "2004", "2003", "2002", "2001", "2000"]);
    expect(html.match(/data-testid="list-section"/g)).toHaveLength(6);
    // Its own address says nothing; the order is the list's, and the address taken off is still a choice.
    expect(html).not.toContain("479 of");
  });

  it("opens by name where the kind says no start, and jumps by letter", () => {
    const html = draw("/artists");
    // A kind with nothing but a name to sort by offers no "Sort": its order is its names.
    expect(html).toContain('data-sectioned="letter"');
    const index = /data-testid="list-index"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
    expect([...index.matchAll(/>([A-Z])</g)].map((match) => match[1])).toEqual(["A", "B", "C", "D", "E", "Z"]);
  });

  it("keeps the address's own order when it says one, and has no index when grouped", () => {
    expect(draw("/albums?sort=label")).toContain('data-sectioned="letter"');
    expect(draw("/albums?group=released:year")).not.toContain('data-testid="list-index"');
  });
});

describe("a design's list", () => {
  it("draws the framework's head and line around the design's own rows, bare inside the design's main", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/artists"]}>
        <Routes>
          <Route
            path="/artists"
            element={
              <ListPage
                context={{ store: store(), framed: true, barAbove: true }}
                kind="artist"
                bare
                opening={{ sort: { by: "label", direction: "desc" } }}
                row={(node, facts) => <span data-testid="own-row">{facts.label}</span>}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(html).not.toContain("<main");
    expect(html.match(/data-testid="own-row"/g)).toHaveLength(LARGE_LIST + 1);
    expect(html.indexOf(">Zed<")).toBeLessThan(html.indexOf(">Arc Band 0<"));
    expect(html).toContain('data-testid="arrange-count"');
    // No second Find under the bar's.
    expect(html).not.toContain('data-testid="arrange-query"');
  });
});
