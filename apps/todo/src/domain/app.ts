import { defineApp, readerSettings, Store, type StoreOptions } from "@graview/core";
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
  /*
   * What belongs to the READER rather than to the installation: how big the
   * words are, and whether things move. The profile pane draws exactly
   * these, and the shell has already carried the answer to the root
   * element — no component here hears about either.
   */
  settings: readerSettings(),
  brand: thingsBrand,
  /*
   * THREE PICTURES, DECLARED AND DRAWN (FR-79). Each lens here has a title,
   * so it is a place — a pill on the bar, a drive-in from altitude, a page
   * at /pages/places/<name> — and the framework draws it from these lines
   * alone: the UI registers none of them. The week is declared last, so it
   * is what the tasks' district draws when an address names no picture.
   */
  lenses: [
    {
      /*
       * WHO MAY DO WHAT, as a picture of the people. The reach lens reads
       * the policy the store refuses with — the same function, not a second
       * copy — and draws what each role reaches. A member never sees it,
       * because a member never sees the people.
       */
      name: "reach",
      title: "Who may do what",
      on: "user",
    },
    {
      /*
       * The calendar, over the same tasks, answering the other question.
       *
       * The week is minutes of a day in named columns and cannot say "due
       * on the 14th of next month". The day it opens on is the one the
       * example is written around, so a harness photographs the same month
       * twice; a product would leave `today` out and open on the real one.
       */
      name: "calendar",
      title: "The month",
      bindings: { task: { start: "due", done: "done" } },
      options: { range: "month", today: "2026-09-01" },
    },
    {
      /*
       * The timeline, written for a household's week, reused here unchanged.
       *
       * This app says only which of ITS fields are `start` and `end` — the
       * lens has never heard of a task. That reuse is the framework's central
       * claim, and it is worth seeing in the smallest app rather than only in
       * the ones built to prove it. Its columns are the values `day` takes.
       */
      name: "timeline",
      title: "The week",
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
