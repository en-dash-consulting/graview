import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { placesOf } from "@graview/core/seat";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { runWorkerViewHeadless, type RunWorkerViewHeadlessOptions } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";

/**
 * A PLACE HANDED WITHOUT ITS KIND IS READ FROM THE APP, OR REFUSED BY NAME
 * (Roadmap headless-view-check-drops-places-without-a-kind, 2026-10-28).
 *
 * Graview Cloud handed the headless check `{ slug, title }` for each of an
 * app's places, and every declared lens a view linked to was said to be no
 * place of the app: the run read places through the one vocabulary, which
 * takes a place over a kind and passed over each one without a word. A
 * place with no kind is now given the kind the app's own places say — the
 * declaration's when the host hands `app`, the kinds' lists and the views'
 * places otherwise — and a slug that is none of them is refused, by name.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("beatles.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the Beatles fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("beatles.seed.json", fixtures), "utf8"));
const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
/* The places as a host that dropped each one's kind hands them. */
const kindless = placesOf(app).map(({ slug, title }) => ({ slug, title }));

const run = (links: readonly string[], more: Partial<RunWorkerViewHeadlessOptions<AnySchema>>) =>
  runWorkerViewHeadless({
    store: store(),
    principal: owner,
    run: nodeIsolate(),
    manifest: { name: "home", title: "Home", attach: "home", cardinality: "many" },
    source: `graview.onProps(() => graview.render(graview.html\`<nav>${links.map((place) => `<a data-place="${place}">${place}</a>`).join("")}</nav>\`));`,
    views: [],
    ...more,
  });

const problems = async (links: readonly string[], more: Partial<RunWorkerViewHeadlessOptions<AnySchema>>) => {
  const result = await run(links, more);
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result.description.problems.map((problem) => problem.says);
};

describe("a place handed without its kind", () => {
  it("is read from the app's own places when the app is handed, so every declared lens is a place", async () => {
    expect(await problems(["songs-by-writer", "Songs by writer", "releases-by-year"], { places: kindless, app })).toEqual([]);
  });

  it("is read from the kinds' lists without the app, and the home and the Scene stay over no kind", async () => {
    const lists = placesOf(app).filter((place) => place.kind === null || place.address === `/${place.slug}`).map(({ slug, title }) => ({ slug, title }));
    expect(lists.length).toBeGreaterThan(2);
    expect(await problems(["home"], { places: lists })).toEqual([]);
  });

  it("is refused by its slug when nothing the run holds says its kind, rather than dropped and every link to it said missing", async () => {
    await expect(run(["songs-by-writer"], { places: kindless })).rejects.toThrow(/the places .*"songs-by-writer".* without their kinds, and no kind's list or view the run holds is at those slugs/);
    await expect(run([], { places: [{ slug: "no-such-place", title: "No such place" }], app })).rejects.toThrow(/"no-such-place" without its kind, and the app declares no place by that slug/);
  });

  it("is unchanged when it carries its kind, as `placesOf` lists it", async () => {
    expect(await problems(["songs-by-writer"], { places: placesOf(app) })).toEqual([]);
  });
});
