import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blockContextFor, compileBlocks, resolveBlocks, type ResolvedList } from "../../src/blocks.js";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A LIST SHOWS MORE PAST A PAGE, AND GROUPS BY A LINKED RECORD
 * (2026-10-15, The Beatles).
 *
 * A list held at most 100 records, and a `limit` past 100 was refused: 158
 * songs had to be split by name into two lists. A list now holds up to its
 * limit (1 000 at most), draws a page of 100, and keeps the rest for "Show
 * N more". And a list grouped only by a choice field: songs by genre, where
 * a genre is a record, could not be said. `group: "inGenre"` (or
 * `"out('inGenre')"`, `"in('writtenBy')"`) puts a heading per linked record.
 */
const base = JSON.parse(readFileSync(new URL("./fixtures/beatles.gdd.json", import.meta.url), "utf8"));
const seed = JSON.parse(readFileSync(new URL("./fixtures/beatles.seed.json", import.meta.url), "utf8"));

function home(blocks: unknown[], snapshot: unknown = seed) {
  const document = { ...structuredClone(base), views: { home: blocks } };
  const compiled = compileDocument(document, { today: () => "2026-10-15" });
  if (!compiled.ok) return { errors: compiled.findings.filter((f) => f.severity === "error").map((f) => [f.code, f.path] as const), lists: [] as ResolvedList[] };
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: snapshot as never });
  const ctx = blockContextFor(store, null, null);
  const lists = resolveBlocks(compileBlocks(blocks), ctx).filter((block) => block.t === "list") as unknown as ResolvedList[];
  return { errors: [] as (readonly [string, string])[], lists };
}

describe("a list past a page", () => {
  it("draws 100 of 158 songs first and holds the other 58 for Show more", () => {
    const [list] = home([{ list: "all('song')", sort: "name", as: "row" }]).lists;
    expect(list!.members).toHaveLength(100);
    expect(list!.rest).toHaveLength(58);
    expect(list!.rest![0]!.id).toBe("song-101");
    expect(list!.more).toBe(58);
  });

  it("takes a limit past 100, and keeps to it", () => {
    const { errors, lists } = home([{ list: "all('song')", sort: "name", limit: 120 }]);
    expect(errors).toEqual([]);
    expect(lists[0]!.members).toHaveLength(100);
    expect(lists[0]!.rest).toHaveLength(20);
    expect(home([{ list: "all('song')", limit: 1001 }]).errors).toEqual([["list-limit", "views.home.0.limit"]]);
  });

  it("holds nothing back under a page", () => {
    const [list] = home([{ list: "all('release')" }]).lists;
    expect(list!.members).toHaveLength(18);
    expect(list!.rest).toBeUndefined();
    expect(list!.more).toBe(0);
  });
});

describe("a list grouped by a linked record", () => {
  const groups = (list: ResolvedList) => (list.everyGroup ?? list.groups ?? []).map((group) => [group.heading, group.members.length]);

  it("puts a heading per writer, in the order of their names, over every song listed", () => {
    const { errors, lists } = home([{ list: "all('song')", sort: "name", group: "writtenBy" }]);
    expect(errors).toEqual([]);
    expect(groups(lists[0]!)).toEqual([["Harrison", 40], ["Lennon", 39], ["McCartney", 40], ["Starkey", 39]]);
  });

  it("is written the way a walk is too, either way: out('inGenre'), in('writtenBy')", () => {
    const linked = { nodes: [...seed.nodes, { id: "genre-rock", kind: "genre", name: "Rock" }, { id: "genre-pop", kind: "genre", name: "Pop" }], edges: [...seed.edges, { id: "g1", kind: "inGenre", from: "song-001", to: "genre-rock" }, { id: "g2", kind: "inGenre", from: "song-001", to: "genre-pop" }, { id: "g3", kind: "inGenre", from: "song-002", to: "genre-pop" }] };
    const [songs] = home([{ list: "all('song')", sort: "name", limit: 3, group: { by: "out('inGenre')" } }], linked).lists;
    expect(groups(songs!)).toEqual([["Pop", 2], ["Rock", 1], ["No genre", 1]]);
    const [writers] = home([{ list: "all('writer')", group: "in('writtenBy')" }]).lists;
    expect(writers!.groups!.length).toBeGreaterThan(1);
  });

  it("says No genre over every song while no song has one", () => {
    const [list] = home([{ list: "all('song')", limit: 10, group: "inGenre" }]).lists;
    expect(groups(list!)).toEqual([["No genre", 10]]);
  });

  it("is refused by its path when it names neither a choice nor a relation of the kind listed", () => {
    expect(home([{ list: "all('song')", group: "hue" }]).errors).toEqual([["list-group", "views.home.0.group"]]);
    expect(home([{ list: "all('song')", group: "inEra" }]).errors).toEqual([["list-group", "views.home.0.group"]]);
  });
});
