import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { describePlace } from "../../src/describe.js";
import { coverageUnlinkedWords, Store, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";

/**
 * A COVERAGE WITH NOTHING TO CROSS SAYS SO (2026-10-15, The Beatles).
 *
 * "Songs by genre" — songs against genres through `inGenre` — with no genre
 * yet drew every song as a plain list with no columns, which read as the
 * answer. With no columns, or with columns and not one link between them,
 * it says what is missing and what to do, and lists no rows.
 */
const document = JSON.parse(readFileSync(new URL("./fixtures/beatles.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/beatles.seed.json", import.meta.url), "utf8"));
const compiled = compileDocument(document, { today: () => "2026-10-15" });
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const storeOf = (snapshot: unknown) => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: snapshot as never });
const said = (store: Store<AnySchema>, slug: string) => {
  const result = describePlace(store, owner, slug, { app, width: 1440, today: "2026-10-15" });
  if (!result.ok) throw new Error(result.error);
  return result.description.text;
};

describe("a coverage with nothing to cross", () => {
  it("with no columns, says there are none yet and lists no row", () => {
    const text = said(storeOf(seed), "songs-by-genre");
    expect(text).toContain("No genres yet: link songs to genres.");
    expect(text).not.toContain("Song 001");
  });

  it("with columns and not one link, says nothing is linked yet and lists no row", () => {
    const withGenres = { nodes: [...seed.nodes, { id: "genre-rock", kind: "genre", name: "Rock" }, { id: "genre-pop", kind: "genre", name: "Pop" }], edges: seed.edges };
    const text = said(storeOf(withGenres), "songs-by-genre");
    expect(text).toContain("No song is linked to a genre yet: link songs to genres.");
    expect(text).not.toContain("Song 001");
  });

  it("draws the grid as soon as one link is made", () => {
    const linked = { nodes: [...seed.nodes, { id: "genre-rock", kind: "genre", name: "Rock" }], edges: [...seed.edges, { id: "e-g", kind: "inGenre", from: "song-001", to: "genre-rock" }] };
    expect(said(storeOf(linked), "songs-by-genre")).toContain("Song 001: Rock");
  });

  it("says it in the same words for the lens, of one kind against itself as well", () => {
    expect(coverageUnlinkedWords(app.schema, { rows: "song", columns: "genre" }, { rows: 40, columns: 0, cells: 0 })).toBe("No genres yet: link songs to genres.");
    expect(coverageUnlinkedWords(app.schema, { rows: "song", columns: "song" }, { rows: 40, columns: 40, cells: 0 })).toBe("No song is linked to another yet: link songs to each other.");
    expect(coverageUnlinkedWords(app.schema, { rows: "song", columns: "genre" }, { rows: 40, columns: 3, cells: 1 })).toBeUndefined();
    expect(coverageUnlinkedWords(app.schema, { rows: "song", columns: "genre" }, { rows: 0, columns: 0, cells: 0 })).toBeUndefined();
  });
});
