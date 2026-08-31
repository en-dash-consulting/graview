import { defineApp, Store, type StoreOptions } from "@graview/core";
import { thingsBrand } from "./brand.js";
import { todoInvariants } from "./invariants.js";
import { todoMutations } from "./mutations.js";
import { todoSchema, type TodoSchema } from "./schema.js";

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
  mutations: todoMutations,
  invariants: todoInvariants,
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
    mutations: todoMutations,
    invariants: todoInvariants,
    ...options,
  });
}

export default todoApp;
