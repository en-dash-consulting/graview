import { defineApp, Store, type StoreOptions, readerSettings } from "@graview/core";
import { seedbedBrand } from "./brand.js";
import { seedbedInvariants } from "./invariants.js";
import { seedbedMutations } from "./mutations.js";
import { seedbedSchema, type SeedbedSchema } from "./schema.js";

/**
 * The whole app, and no data of its own: the declaration is complete and
 * checkable. The standalone garden opens on the example garden
 * (`domain/example.ts`, the one the chapters grow into); "Start empty" and
 * `?empty=1` open it at zero, which rendering honestly is still what this
 * example holds the framework to.
 */
export const seedbedApp = defineApp({
  name: "seedbed",
  schema: seedbedSchema,
  mutations: seedbedMutations,
  invariants: seedbedInvariants,
  brand: seedbedBrand,
  /** What belongs to the reader: how big the words are, and whether things move. */
  settings: readerSettings(),
  /*
   * THE SEASON, through the framework's own calendar lens.
   *
   * A planting is a span — sown in March, brought in in July — which is the
   * shape a garden is actually planned around and the one thing the week
   * grid cannot draw. Declared here as well as registered, so `graview
   * check` reads the binding the way it reads every other starter's, and so
   * the desk can see that the calendar has a second user: a lens proven by
   * one app is a lens that may only fit the app it was written beside.
   */
  lenses: [
    {
      name: "calendar",
      requiredRoles: ["start"],
      bindings: { planting: { start: "sown", end: "harvested", label: "label" } },
    },
    {
      /*
       * WHO TENDS WHAT — the coverage grid, which chapter ten binds and the
       * base declaration had never said out loud. Declared here as well,
       * because the desk reads declarations: a lens the garden genuinely
       * uses but does not declare shows up as "only one app uses this",
       * which is the rule being right about the wrong thing.
       */
      name: "coverage",
      binds: "entities",
      requiredRoles: ["rows", "columns", "link"],
      bindings: { rows: { kind: "plot" }, columns: { kind: "gardener" }, link: { edge: "tended-by" } },
    },
  ],
  /*
   * The intelligence, declared. The starter provider proposes from the
   * schema alone (no key, no model); a real model plugs the same seam with
   * one completion function. Both may only call what is listed — the
   * allowlist graview check verifies and a host can meter.
   */
  intelligence: [
    {
      name: "starter",
      kind: "graph",
      description: "Proposes first data and open repairs from the declaration alone.",
      may: ["add-gardener", "add-plot", "sow", "tend", "adopt-rule"],
    },
    {
      name: "model",
      kind: "llm",
      description: "A vendor model behind one completion function, when a key exists.",
      may: ["add-gardener", "add-plot", "sow", "tend", "adopt-rule"],
    },
  ],
});

export type SeedbedStore = Store<SeedbedSchema>;

export function createSeedbedStore(
  options: Partial<StoreOptions<SeedbedSchema>> = {},
): SeedbedStore {
  return new Store<SeedbedSchema>({
    schema: seedbedSchema,
    mutations: seedbedMutations,
    invariants: seedbedInvariants,
    /* The allowlist above is enforced here, not only where a tool runtime
       happens to be: every path into the store is the same wall. */
    intelligence: seedbedApp.intelligence ?? [],
    ...options,
  });
}

export default seedbedApp;
