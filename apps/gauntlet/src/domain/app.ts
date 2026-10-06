import { defineApp, readerSettings, Store, type StoreOptions } from "@graview/core";
import { gauntletBrand } from "./brand.js";
import { invariants } from "./invariants.js";
import { mutations } from "./mutations.js";
import { policy } from "./policy.js";
import { gauntletSchema, type GauntletSchema } from "./schema.js";

/**
 * The whole surface, in one object, and no React in this directory: `graview
 * check` reads it in Node, and so does the test that holds every awkward
 * shape in place (`tests/the-awkward-shapes.test.ts`).
 */
export const gauntletApp = defineApp({
  name: "Programme",
  schema: gauntletSchema,
  mutations,
  invariants,
  policy,
  brand: gauntletBrand,
  settings: readerSettings(),
  /*
   * TWO PICTURES, DECLARED AND DRAWN (FR-79): each titled, so each is a
   * place the framework draws from these lines; the UI registers neither.
   * The timetable is declared last, so it is what the talks' district draws
   * when an address names no picture.
   */
  lenses: [
    /* What the talks are about, at real size: thousands of rows, forty-eight columns (W-122). */
    {
      name: "coverage",
      title: "What the talks are about",
      bindings: { rows: { kind: "talk" }, columns: { kind: "topic" }, link: { edge: "about" } },
    },
    /*
     * A CALENDAR OVER TWO KINDS: talks and workshops, each by its own start
     * (W-144). It opens on the week of the latest edition — two hundred
     * talks in three days — and looks out over the ten years.
     */
    {
      name: "calendar",
      title: "The timetable",
      bindings: { talk: { start: "startsAt" }, workshop: { start: "startsAt" } },
      options: { today: "2026-09-28", range: "week", horizon: { years: 10, title: "Ten editions" } },
    },
  ],
});

export type GauntletStore = Store<GauntletSchema>;

export function createStore(options: Partial<StoreOptions<GauntletSchema>> = {}): GauntletStore {
  return new Store<GauntletSchema>({ schema: gauntletSchema, mutations, invariants, policy, ...options });
}

export default gauntletApp;
