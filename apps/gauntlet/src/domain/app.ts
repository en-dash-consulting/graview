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
  lenses: [
    /*
     * A CALENDAR OVER TWO KINDS: talks and workshops, each by its own start.
     * The calendar every other app declares binds one kind (W-144).
     */
    {
      name: "calendar",
      requiredRoles: ["start"],
      bindings: { talk: { start: "startsAt" }, workshop: { start: "startsAt" } },
    },
    /* What the talks are about, at real size: thousands of rows. */
    {
      name: "coverage",
      binds: "entities",
      requiredRoles: ["rows", "columns", "link"],
      bindings: { rows: { kind: "talk" }, columns: { kind: "topic" }, link: { edge: "about" } },
    },
  ],
});

export type GauntletStore = Store<GauntletSchema>;

export function createStore(options: Partial<StoreOptions<GauntletSchema>> = {}): GauntletStore {
  return new Store<GauntletSchema>({ schema: gauntletSchema, mutations, invariants, policy, ...options });
}

export default gauntletApp;
