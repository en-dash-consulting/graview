import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { placesOf } from "@graview/core/seat";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { judgeDestination, listsOf } from "../../src/host/links.js";
import { guestPlacesOf, placeNamed, placesSaid } from "../../src/host/links-words.js";
import { runWorkerViewHeadless, type HeadlessResult } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";

/**
 * A VIEW'S PLACES ARE KNOWN BY SLUG AND BY TITLE, AND NAMED WHEN ONE IS NOT
 * THERE (2026-10-15, The Beatles).
 *
 * A home view linked `data-place="songs-by-writer"`, a lens the app has,
 * and the check said the place did not exist and listed the app's places as
 * "undefined, undefined, …": its host handed the places as an app lists
 * them (`placesOf`: a `slug`), and the check read a guest's `as`. Either
 * shape is read now; a place is found by its slug or its title; and a place
 * that is not there is said with the ones that are, by slug and title.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("beatles.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the Beatles fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("beatles.seed.json", fixtures), "utf8"));
const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

const home = (links: readonly string[]): Promise<HeadlessResult> =>
  runWorkerViewHeadless({
    store: store(),
    principal: owner,
    run: nodeIsolate(),
    manifest: { name: "home", title: "Home", attach: "home", cardinality: "many" },
    source: `graview.onProps(() => graview.render(graview.html\`<nav>${links.map((place) => `<a data-place="${place}">${place}</a>`).join("")}</nav>\`));`,
    // As a host lists them: `placesOf`, a slug each, as Graview Cloud hands them.
    places: placesOf(app),
    // And the views it keeps, none here: a place none of these is, is then certainly no place of the app.
    views: [],
  });

const problems = async (links: readonly string[]) => {
  const result = await home(links);
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result.description.problems.map((problem) => problem.says);
};

describe("a view's places", () => {
  it("finds a lens by its slug, and by its title, handed the places as an app lists them", async () => {
    expect(await problems(["songs-by-writer", "Songs by writer", "songs by WRITER", "releases-by-year"])).toEqual([]);
  });

  it("names the places there are, by slug and title, when it links to one that is not", async () => {
    const [said] = await problems(["songs-by-hue"]);
    expect(said).toContain('the place "songs-by-hue", which this app does not have');
    expect(said).toContain('"songs-by-writer" (Songs by writer)');
    expect(said).not.toContain("undefined");
  });

  it("reads a guest's places and an app's alike, and passes over one with no word to go by", () => {
    expect(guestPlacesOf([{ as: "the-board", title: "The board", kind: "task" }, { slug: "songs-by-genre", title: "Songs by genre", kind: "song" }, { title: "Nowhere" }])).toEqual([
      { as: "the-board", title: "The board", kind: "task" },
      { as: "songs-by-genre", title: "Songs by genre", kind: "song" },
    ]);
    expect(placesSaid([{ as: "songs-by-genre", title: "Songs by genre" }, { as: "home", title: "home" }])).toBe(' Its places: "songs-by-genre" (Songs by genre), "home".');
    expect(placeNamed([{ as: "songs-by-genre", title: "Songs by genre" }], "Songs By Genre")?.as).toBe("songs-by-genre");
  });

  it("goes, live, to the place a title names, at its slug", () => {
    const places = guestPlacesOf(placesOf(app));
    const went = judgeDestination({ place: "Songs by writer" }, { sees: () => false, places, lists: listsOf(app.schema as AnySchema), schema: app.schema as AnySchema });
    expect(went).toEqual({ ok: true, arrival: { place: "songs-by-writer" } });
  });
});
