import { readFileSync } from "node:fs";
import { Store, type AnySchema, type GraviewApp, type Principal } from "@graview/core";
import { placeNamesOf } from "@graview/core/navigate";
import { placesOf } from "@graview/core/seat";
import { compileDocument } from "@graview/core/check";
import { declaredViews } from "@graview/primitives";
import { createViews, layerViews, type ReactViewRegistry } from "@graview/react";
import { registerWorkerView } from "@graview/guest/host/views";
import { describe, expect, it } from "vitest";
import { runWorkerViewHeadless, type HeadlessDescribed } from "../packages/guest/src/headless/index.js";
import { nodeIsolate } from "../packages/guest/src/headless/node.js";
import { judgeDestination, listsOf, placeVocabulary } from "../packages/guest/src/host/links.js";
import { guestPlacesOf } from "../packages/guest/src/host/links-words.js";

/**
 * A KEPT HOME VIEW REACHES A LENS BY ITS SLUG ON EVERY PATH (HQ
 * bug-describe-place-on-a-kept-view-reports-lens-places-as-missing-while-the-draft-check-accepts-them,
 * 2026-10-28, LifeLogics Estimates).
 *
 * A home view linked by `data-place` to the app's lenses. The draft check
 * accepted the links; once the view was kept, describing the home said each
 * one went nowhere, "Its places: home, overview" — the lenses missing —
 * which is what the one vocabulary says when every place it was handed came
 * without a kind and was passed over. Each path a kept view's places go
 * through is held here to the same names: the declaration's
 * (`placeNamesOf`), the headless run a describer and the draft check both
 * use (handed the places with their kinds, or without them and the app),
 * and the live host's, read from the registry the embed builds — the
 * declared lenses with the host's kept view layered over or registered on
 * them.
 */
const compiled = compileDocument(JSON.parse(readFileSync(new URL("../packages/core/tests/document/fixtures/beatles.gdd.json", import.meta.url), "utf8")));
if (!compiled.ok) throw new Error("the Beatles fixture compiles");
const app = compiled.app as GraviewApp<AnySchema>;
const schema = app.schema as AnySchema;
const seed = JSON.parse(readFileSync(new URL("../packages/core/tests/document/fixtures/beatles.seed.json", import.meta.url), "utf8"));
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

const LENS = "songs-by-writer";
const home = { name: "front", title: "Front", attach: "home", cardinality: "many" as const };
const source = `graview.onProps(() => graview.render(graview.html\`<nav><a data-place="${LENS}">Songs by writer</a><a data-place="releases-by-year">Releases</a></nav>\`));`;

const describeHome = async (more: { places?: readonly unknown[]; app?: GraviewApp<AnySchema> }): Promise<HeadlessDescribed> => {
  const result = await runWorkerViewHeadless({
    store: new Store<AnySchema>({ schema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: seed }),
    principal: owner,
    run: nodeIsolate(),
    manifest: home,
    source,
    // Kept: the host lists it among its views, so a name none of the places is would be said as certain.
    views: [home],
    press: `a[data-place="${LENS}"]`,
    ...(more as object),
  });
  if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
  return result;
};

const liveVocabulary = (registry: ReactViewRegistry<AnySchema>) => placeVocabulary(schema, registry.places(), { ...(registry.arrangement?.() ? { pages: registry.arrangement() } : {}) });
const definition = { manifest: home, worker: { script: "/* the view */" } };

describe("a kept home view's link to a lens", () => {
  it("is a place of the app by the declaration's names", () => {
    expect(placeNamesOf(app, { views: [home] }).map((name) => name.as)).toContain(LENS);
  });

  it("is said to open the lens by the headless run a describer uses, handed the places as placesOf lists them", async () => {
    const described = await describeHome({ places: placesOf(app, { views: [home] }) });
    expect(described.description.problems).toEqual([]);
    expect(described.pressed?.opens).toEqual({ place: LENS });
  });

  it("is said the same handed the places without their kinds and the app, and is refused by name, never said missing, without the app", async () => {
    const kindless = placesOf(app, { views: [home] }).map(({ slug, title }) => ({ slug, title }));
    const described = await describeHome({ places: kindless, app });
    expect(described.description.problems).toEqual([]);
    expect(described.pressed?.opens).toEqual({ place: LENS });
    await expect(describeHome({ places: kindless })).rejects.toThrow(new RegExp(`"${LENS}"`));
  });

  it("goes to the lens on the live host, whose places are the embed's registry with the kept view registered on it or layered over it", () => {
    const registered = registerWorkerView(declaredViews(app), definition);
    const layered = layerViews(declaredViews(app), registerWorkerView(createViews(schema), definition));
    for (const registry of [registered, layered]) {
      const vocabulary = liveVocabulary(registry);
      expect(guestPlacesOf(vocabulary).map((place) => place.as)).toContain(LENS);
      expect(judgeDestination({ place: LENS }, { sees: () => false, places: vocabulary, lists: listsOf(schema), schema })).toEqual({ ok: true, arrival: { place: LENS } });
      // The live host and the declaration name the same places.
      expect(vocabulary.map((one) => one.as)).toEqual(placeNamesOf(app).map((one) => one.as));
    }
  });
});
