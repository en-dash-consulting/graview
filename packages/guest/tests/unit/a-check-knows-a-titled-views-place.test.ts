import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { describePlace } from "@graview/core/describe";
import { placesOf } from "@graview/core/seat";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import type { WorkerViewManifest } from "../../src/host/manifest.js";
import { runWorkerViewHeadless, type HeadlessDescribed, type RunWorkerViewHeadlessOptions } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";

/**
 * A HEADLESS CHECK KNOWS A TITLED VIEW'S PLACE (Roadmap f-check-view-places).
 *
 * Threat Watch, on Graview Cloud, keeps a view of many titled "Live
 * threats", whose place is `/places/live-threats`; its home linked there
 * with `<a data-place="live-threats">`, the link worked on the page, and
 * `propose_view`'s check said "It names the place "live-threats", which this
 * app does not have" — a false warning that teaches a chat to stop writing
 * `data-place`. The check was handed the document's places and never the
 * views the host keeps. Handed them (`views`), it finds each titled view's
 * place by the slug the router gives it; a name that is nothing is still
 * said to go nowhere; and left without them, it says what it does not know
 * rather than that the place is not there.
 */
const fixtures = new URL("../../../core/tests/document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("beatles.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the Beatles fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const seed = JSON.parse(readFileSync(new URL("beatles.seed.json", fixtures), "utf8"));
const store = () => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

/** A view the host keeps: titled, of many songs — its place is `/places/live-songs`. */
const live: WorkerViewManifest = { name: "live", title: "Live songs", attach: "song", cardinality: "many" };
const homeManifest: WorkerViewManifest = { name: "home", title: "Home", attach: "home", cardinality: "many" };
const linking = (links: readonly string[], going?: string) =>
  `graview.onProps(() => { graview.render(graview.html\`<nav>${links.map((place) => `<a data-place="${place}">${place}</a>`).join("")}</nav>\`);${going ? ` graview.navigate(${JSON.stringify(going)});` : ""} });`;

const run = async (given: Partial<RunWorkerViewHeadlessOptions<AnySchema>> & Pick<RunWorkerViewHeadlessOptions<AnySchema>, "source">): Promise<HeadlessDescribed> => {
  const result = await runWorkerViewHeadless({ store: store(), principal: owner, run: nodeIsolate(), manifest: homeManifest, places: placesOf(app), ...given });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result;
};
const problems = async (given: Parameters<typeof run>[0]) => (await run(given)).description.problems.map((problem) => problem.says);

describe("a headless check handed the views the host keeps", () => {
  it("does not flag a data-place naming a titled view's place, by its slug or its title", async () => {
    expect(await problems({ source: linking(["live-songs", "Live songs"]), views: [live] })).toEqual([]);
  });

  it("does not flag a navigate to a titled view's place, and a press on its link opens it", async () => {
    expect(await problems({ source: linking([], "live-songs"), views: [live] })).toEqual([]);
    const pressed = await run({ source: linking(["live-songs"]), views: [live], press: 'a[data-place="live-songs"]' });
    expect(pressed.pressed?.opens).toEqual({ place: "live-songs" });
    expect(pressed.pressed?.lost).toBeUndefined();
  });

  it("still flags a data-place naming nothing, as certainly going nowhere, with the view's place among those it names", async () => {
    const [said, ...rest] = await problems({ source: linking(["songs-by-hue"]), views: [live] });
    expect(rest).toEqual([]);
    expect(said).toContain('It names the place "songs-by-hue", which this app does not have.');
    expect(said).toContain('"live-songs" (Live songs)');
    expect(said).not.toContain("not handed the views");
  });

  it("knows a titled view's own place, and passes over a view of one record and one with no title", async () => {
    expect(await problems({ manifest: live, source: linking(["live-songs"]), views: [] })).toEqual([]);
    const untitled: WorkerViewManifest = { name: "plain", attach: "song", cardinality: "many" };
    const ofOne: WorkerViewManifest = { name: "sheet", title: "Song sheet", attach: "song", cardinality: "one" };
    const said = await problems({ source: linking(["plain", "song-sheet"]), views: [untitled, ofOne] });
    expect(said).toHaveLength(2);
  });
});

describe("a headless check not handed the views the host keeps", () => {
  it("says a name none of its places is as a doubt, not as no place of the app", async () => {
    const [said] = await problems({ source: linking(["live-songs"]) });
    expect(said).toContain('It names the place "live-songs", which is none of the places this run was told of.');
    expect(said).toContain("This run was not handed the views the host keeps, so a titled view's place is not among these: if it names one, the link goes there.");
    expect(said).not.toContain("this app does not have");
    const [went] = await problems({ source: linking([], "live-songs") });
    expect(went).not.toContain("is no place of this app");
    expect(went).toContain("not handed the views");
  });
});

describe("describePlace of the view's place, with what the view drew", () => {
  it("says the place a headless run drew, as a view's place", async () => {
    const drawn = await run({ manifest: live, source: `graview.onProps(() => graview.render(graview.html\`<h1>Live songs</h1><p>On stage tonight</p>\`));`, views: [] });
    const described = describePlace(store(), owner, "live-songs", { app, views: [{ ...live, flows: true, parts: drawn.description.parts }] });
    if (!described.ok) throw new Error(described.error);
    expect(described.description.drawnBy).toBe("view:live");
    expect(described.description.place.address).toBe("/places/live-songs");
    expect(described.description.text).toMatch(/\[the view "Live songs", flowing with the page\]\n {2}# Live songs\n {2}On stage tonight/);
  });
});
