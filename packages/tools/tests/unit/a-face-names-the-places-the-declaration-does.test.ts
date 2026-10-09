import { declaredLenses, placesOf, sceneTitle, type AnySchema, type GraviewApp, type Place } from "@graview/core";
import { describe, expect, it } from "vitest";
import { placesFromViews } from "../../src/go.js";
import { discographyApp } from "../../../../apps/discography/src/domain/app.js";
import { gauntletApp } from "../../../../apps/gauntlet/src/domain/app.js";
import { launcherApp } from "../../../../apps/launcher/src/domain/app.js";
import { rotaApp } from "../../../../apps/rota/src/domain/app.js";
import { seedbedApp } from "../../../../apps/seedbed/src/domain/app.js";
import { todoApp } from "../../../../apps/todo/src/domain/app.js";

/*
 * A SEAT HANDED A FACE'S STORE AND VIEWS NAMES THE PLACES THE DECLARATION
 * DOES (`placesOf`): the same places, called the same, at the same
 * addresses and stops, in the same order — the arrangement's — on every
 * example app. A seat that said "Scene" where the bar says the app's own
 * word, or listed the pictures in another order, was a second, drifting
 * copy of the same list.
 */
const apps: Record<string, GraviewApp<AnySchema>> = {
  todo: todoApp as never,
  seedbed: seedbedApp as never,
  rota: rotaApp as never,
  discography: discographyApp as never,
  gauntlet: gauntletApp as never,
  launcher: launcherApp as never,
};

/** What a face's view registry names: each declared lens's places, then any the app's own views register. */
function registered(app: GraviewApp<AnySchema>): Place[] {
  const out: Place[] = declaredLenses(app).drawn.flatMap((lens) => lens.kinds.map((kind) => ({ kind, title: lens.title, as: lens.as, ...(lens.across ? { across: lens.across } : {}) })));
  for (const place of app.views?.places?.() ?? []) if (!out.some((held) => held.kind === place.kind && held.as === place.as)) out.push(place);
  return out;
}

const said = (places: readonly { slug: string; title: string; kind: string | null; address: string; stop: string }[]) =>
  places.map(({ slug, title, kind, address, stop }) => ({ slug, title, kind, address, stop }));

describe("the places a face holds, on every example app", () => {
  for (const [name, app] of Object.entries(apps)) {
    it(`are ${name}'s declared places, called and addressed the same, in the same order`, () => {
      expect(said(placesFromViews(app.schema, registered(app), { scene: sceneTitle(app.pages), pages: app.pages }))).toEqual(said(placesOf(app)));
    });
  }
});
