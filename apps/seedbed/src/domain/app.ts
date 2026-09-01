import { defineApp, Store, type StoreOptions } from "@graview/core";
import { seedbedBrand } from "./brand.js";
import { seedbedInvariants } from "./invariants.js";
import { seedbedMutations } from "./mutations.js";
import { seedbedSchema, type SeedbedSchema } from "./schema.js";

/**
 * The whole app — and deliberately NO data. The declaration is complete and
 * checkable; the graph starts at zero, because rendering zero honestly is
 * what this example exists to hold the framework to.
 */
export const seedbedApp = defineApp({
  name: "seedbed",
  schema: seedbedSchema,
  mutations: seedbedMutations,
  invariants: seedbedInvariants,
  brand: seedbedBrand,
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
    ...options,
  });
}

export default seedbedApp;
