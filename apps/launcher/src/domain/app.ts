import { defineApp, readerSettings, Store, type StoreOptions } from "@graview/core";
import { launcherInvariants } from "./invariants.js";
import { launcherMutations } from "./mutations.js";
import { launcherSchema, type LauncherSchema } from "./schema.js";
import { surveySnapshot } from "./survey.js";

/**
 * The desk, declared the way it asks every other app to declare itself —
 * which means `graview check` checks it too, and it can fail its own rules.
 */
export const launcherApp = defineApp({
  name: "launcher",
  schema: launcherSchema,
  mutations: launcherMutations,
  invariants: launcherInvariants,
  /** What belongs to the reader: how big the words are, and whether things move. */
  settings: readerSettings(),
  lenses: [
    {
      name: "coverage",
      binds: "entities",
      requiredRoles: ["rows", "columns", "link"],
      bindings: {
        rows: { kind: "capability" },
        columns: { kind: "app" },
        link: { edge: "uses" },
      },
    },
  ],
});

export type LauncherStore = Store<LauncherSchema>;

export function createLauncherStore(
  showing?: string,
  options: Partial<StoreOptions<LauncherSchema>> = {},
): LauncherStore {
  return new Store<LauncherSchema>({
    schema: launcherSchema,
    mutations: launcherMutations,
    invariants: launcherInvariants,
    snapshot: surveySnapshot(showing) as never,
    ...options,
  });
}

export default launcherApp;
