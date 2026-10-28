import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { placeNamesFrom, placeNamesOf } from "../../src/navigate.js";
import { placesOf } from "../../src/seat.js";
import type { AnySchema, GraviewApp, Place } from "../../src/index.js";

/**
 * A VIEW MAY NAME THE SCENE, THE HOME, A KIND'S LIST AND A TITLED PLACE —
 * AND NOTHING ELSE (FR-235, Roadmap f-view-links-to-scene).
 *
 * The headless check and the live host judged a view's `data-place` by
 * two lists: the check was handed the app's places as `placesOf` lists
 * them (the Scene and the home among them), the page judged by the
 * registry's pictures alone, so `data-place="overview"` passed the check
 * and did nothing live. One vocabulary now, built from the declaration
 * (`placeNamesOf`) and from what a face holds (`placeNamesFrom`) the same
 * way, so the two can never disagree about which names exist.
 */
const fixtures = new URL("../document/fixtures/", import.meta.url);
const compiled = compileDocument(JSON.parse(readFileSync(new URL("beatles.gdd.json", fixtures), "utf8")));
if (!compiled.ok) throw new Error("the Beatles fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const schema = app.schema as AnySchema;

/** The registry's places, as a face holds them: each declared lens, as `placesOf` lists it, over its kind. */
const registry: readonly Place[] = placesOf(app).flatMap((place) => (place.kind === null || !place.address.startsWith("/places/") ? [] : [{ kind: place.kind, title: place.title, as: place.slug, ...(place.over ? { over: place.over } : {}) }]));

describe("the names a view may send somebody to", () => {
  it("are the Scene, the home, each kind's list by its slug and each titled place by its slug, from the declaration", () => {
    const names = placeNamesOf(app);
    expect(names.find((one) => one.as === "overview")).toEqual({ as: "overview", title: "Scene", kind: null, is: "overview" });
    expect(names.find((one) => one.as === "home")).toEqual({ as: "home", title: "Home", kind: null, is: "home" });
    expect(names.find((one) => one.as === "songs")).toMatchObject({ kind: "song", is: "list" });
    expect(names.find((one) => one.as === "songs-by-writer")).toMatchObject({ kind: "song", title: "Songs by writer", is: "place" });
    // Each name once, and every one is a slug: no title, no id, no "undefined".
    expect(new Set(names.map((one) => one.as)).size).toBe(names.length);
    for (const one of names) expect(one.as).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it("are the same list from what a face holds: the schema and the registry's places", () => {
    const fromApp = placeNamesOf(app).map((one) => `${one.is}:${one.as}:${one.kind}`);
    const fromFace = placeNamesFrom(schema, registry).map((one) => `${one.is}:${one.as}:${one.kind}`);
    expect(fromFace).toEqual(fromApp);
  });

  it("call the Scene what the declaration calls it", () => {
    expect(placeNamesFrom(schema, registry, { pages: { scene: "The map" } }).find((one) => one.is === "overview")?.title).toBe("The map");
    expect(placeNamesOf({ ...app, pages: { ...(app.pages ?? {}), scene: "The map" } } as never).find((one) => one.is === "overview")?.title).toBe("The map");
  });

  it("leave out a kind the viewer is kept from, its list and every place over it, and keep the Scene and the home", () => {
    const kept = new Set(["song"]);
    const names = placeNamesFrom(schema, registry, { kept });
    expect(names.some((one) => one.kind === "song")).toBe(false);
    expect(names.some((one) => one.as === "songs")).toBe(false);
    expect(names.some((one) => one.as === "songs-by-writer")).toBe(false);
    expect(names.map((one) => one.as)).toEqual(expect.arrayContaining(["overview", "home", "releases"]));
    expect(placeNamesOf(app, { kept })).toEqual(names);
  });

  it("know a titled view the host keeps as a place, by the slug its title makes", () => {
    const names = placeNamesOf(app, { views: [{ name: "live", title: "Live songs", attach: "song", cardinality: "many" }] });
    expect(names.find((one) => one.as === "live-songs")).toMatchObject({ kind: "song", title: "Live songs", is: "place" });
  });

  it("do not let a lens titled Overview take the Scene's word", () => {
    const names = placeNamesFrom(schema, [...registry, { kind: "song", title: "Overview", as: "overview" }]);
    expect(names.filter((one) => one.as === "overview")).toEqual([{ as: "overview", title: "Scene", kind: null, is: "overview" }]);
  });
});
