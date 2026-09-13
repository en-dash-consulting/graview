import { defineApp, Store, type StoreOptions } from "@graview/core";
import { thingsBrand } from "./brand.js";
import { todoInstallation } from "./installation.js";
import { todoInvariants } from "./invariants.js";
import { todoMutations } from "./mutations.js";
import { todoPolicy } from "./policy.js";
import { todoSchema, type TodoSchema } from "./schema.js";

/** The domain's acts and the installation's, which are acts like any other. */
export const todoActs = [...todoMutations, ...todoInstallation.mutations] as typeof todoMutations;

/**
 * The whole app, in one object.
 *
 * `graview check` reads exactly this, and so does the docs generator. An app
 * whose entire surface is declared is an app a build can verify and an agent
 * can read — which is the claim the framework rests on, and the reason this
 * file has no logic in it.
 */
export const todoApp = defineApp({
  name: "todo",
  schema: todoSchema,
  mutations: todoActs,
  invariants: todoInvariants,
  /*
   * WHO MAY DO WHAT, declared once and enforced by the store.
   *
   * Not a UI concern with a UI copy of the rules: the strip, the pages, the
   * agent's tool list and the seat all narrow from this, and an act nobody
   * may run is stated with the policy's own sentence rather than hidden.
   */
  policy: todoPolicy,
  /*
   * The installation's kinds are a MODULE drawn only for those who keep it.
   * A member never meets a district of people, a record page for one, or an
   * act on one — not refused, absent.
   */
  modules: todoInstallation.modules,
  brand: thingsBrand,
  lenses: [
    {
      /*
       * The timeline, written for a household's week, reused here unchanged.
       *
       * This app says only which of ITS fields are `start` and `end` — the
       * lens has never heard of a task. That reuse is the framework's central
       * claim, and it is worth seeing in the smallest app rather than only in
       * the ones built to prove it.
       */
      name: "timeline",
      requiredRoles: ["start", "end"],
      bindings: { task: { start: "plannedAt", end: "plannedUntil", column: "day" } },
    },
  ],
});

export type TodoStore = Store<TodoSchema>;

export function createTodoStore(options: Partial<StoreOptions<TodoSchema>> = {}): TodoStore {
  return new Store<TodoSchema>({
    schema: todoSchema,
    mutations: todoActs,
    invariants: todoInvariants,
    policy: todoPolicy,
    modules: todoInstallation.modules,
    ...options,
  });
}

export default todoApp;
