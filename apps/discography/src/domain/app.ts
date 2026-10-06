import { defineApp, readerSettings, Store, type StoreOptions } from "@graview/core";
import { discographyBrand } from "./brand.js";
import { invariants } from "./invariants.js";
import { mutations } from "./mutations.js";
import { policy } from "./policy.js";
import { discographySchema, type DiscographySchema } from "./schema.js";

/**
 * The whole surface, in one object. `graview check` reads this; so do the
 * docs generator, the tool surface, the pages face and the scene. Keep React
 * out of this directory and the declaration stays inspectable by a build, a
 * CLI and an agent.
 */
export const discographyApp = defineApp({
  name: "Discography",
  schema: discographySchema,
  mutations,
  invariants,
  policy,
  /*
   * VERSION 2: a song not yet out is "unreleased", not a "demo" — a demo is
   * a recording, and an unreleased song may be finished and mastered.
   */
  version: 2,
  migrations: [
    {
      from: 1,
      to: 2,
      title: "a demo is an unreleased song",
      apply: (snapshot) =>
        snapshot.nodes
          .filter((node) => node.kind === "song" && (node as { status?: string }).status === "demo")
          .map((node) => ({ op: "patch-node" as const, id: node.id, before: { status: "demo" }, after: { status: "unreleased" } })),
    },
  ],
  brand: discographyBrand,
  /*
   * What belongs to the READER rather than to this installation: how big
   * the words are, and whether things move. The profile pane on the bar
   * draws exactly what is declared here, and the shell has already carried
   * the answer to the root element — every surface is sized in `rem`, so
   * one answer resizes the picture, the panes and the pages together.
   */
  settings: readerSettings(),
  lenses: [
    /* What each song is about: songs down the side, themes across — a place the framework draws from this line (FR-79). */
    { name: "coverage", title: "What the songs are about", bindings: { rows: { kind: "song" }, columns: { kind: "theme" }, link: { edge: "about" } } },
    /*
     * The releases, on the calendar, across the whole career: it opens where
     * the catalogue starts (the first release is October 1997) and looks out
     * thirty years, to the last. Eight years from 2023 showed a career that
     * had barely begun and four empty years to come.
     */
    {
      name: "calendar",
      title: "The releases",
      bindings: { album: { start: "released" } },
      options: { today: "1997-01-01", range: "years", horizon: { years: 30, title: "The career" } },
    },
    {
      name: "tracklist",
      binds: "entities",
      requiredRoles: ["entries", "order"],
      bindings: { entries: { edge: "tracks" }, order: { kind: "song" } },
      provenBy: "tests/lens-reuse.test.ts",
    },
  ],
  /*
   * The intelligence, declared. The starter provider proposes first data
   * from the schema alone (no key, no model); a real model plugs the same
   * seam with one completion function. Both may only call what is listed.
   */
  intelligence: [
    {
      name: "starter",
      kind: "graph",
      description: "Proposes first data and open repairs from the declaration alone.",
      may: ["add-song", "add-album", "add-artist", "add-theme", "add-era", "put-on", "credit", "feature", "produce", "tag", "span", "unfeature", "take-off"],
    },
  ],
});

export type DiscographyStore = Store<DiscographySchema>;

export function createStore(options: Partial<StoreOptions<DiscographySchema>> = {}): DiscographyStore {
  return new Store<DiscographySchema>({ schema: discographySchema, mutations, invariants, policy, intelligence: discographyApp.intelligence ?? [], ...options });
}

export default discographyApp;
