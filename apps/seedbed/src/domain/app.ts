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
