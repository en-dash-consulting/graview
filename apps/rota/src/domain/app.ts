import { defineApp, readerSettings, Store, type StoreOptions } from "@graview/core";
import { rotaBrand } from "./brand.js";
import { rotaInstallation } from "./installation.js";
import { rotaInvariants } from "./invariants.js";
import { rotaMutations } from "./mutations.js";
import { rotaPolicy } from "./policy.js";
import { rotaSchema, type RotaSchema } from "./schema.js";

/** The domain's acts and the installation's, which are acts like any other. */
export const rotaActs = [...rotaMutations, ...rotaInstallation.mutations] as typeof rotaMutations;

/**
 * The whole app, in one object — and this one is the product-grade example,
 * so it carries everything a deployment does: a policy with three roles, an
 * installation, a brand with a kit, two lenses, the reader's own settings,
 * and a version with the migration that carries a roster stored before it
 * forward.
 */
export const rotaApp = defineApp({
  name: "rota",
  schema: rotaSchema,
  mutations: rotaActs,
  invariants: rotaInvariants,
  policy: rotaPolicy,
  modules: rotaInstallation.modules,
  settings: readerSettings(),
  brand: rotaBrand,
  lenses: [
    {
      /*
       * WHO IS COVERING WHAT, as a grid. The coverage lens was written for a
       * requirements matrix; pointed at volunteers and shifts it says, in a
       * picture, which shift nobody has taken — which is the one question a
       * roster is for. It has never heard of a shift.
       */
      name: "coverage",
      binds: "entities",
      requiredRoles: ["rows", "columns", "link"],
      bindings: {
        rows: { kind: "shift" },
        columns: { kind: "volunteer" },
        link: { edge: "covered-by" },
      },
    },
    {
      /* The week, from the household's own timeline: minutes of a day in
         named columns, answered with this app's own fields. */
      name: "timeline",
      requiredRoles: ["start", "end"],
      bindings: { shift: { start: "from", end: "until", column: "day" } },
    },
    {
      /* And the month, over the dates the shifts actually fall on. */
      name: "calendar",
      requiredRoles: ["start"],
      bindings: { shift: { start: "on", label: "label" } },
    },
  ],
  /*
   * A ROSTER THAT WAS STORED BEFORE THE RULE EXISTED still opens.
   *
   * Version 2 adopted the second rule — nobody over what they said they
   * could do — as a node, because a rule is data here. A browser holding a
   * version-1 roster runs this once, as a logged, attributed, invertible
   * operation, and is then at 2 like everybody else. Op-log-native on
   * purpose: a migration answers in the same primitives every other change
   * speaks.
   */
  version: 2,
  migrations: [
    {
      from: 1,
      to: 2,
      title: "The roster adopts a limit",
      apply: (snapshot) =>
        snapshot.nodes.some(
          (node) =>
            node.kind === "rule" &&
            (node as { spec?: { type?: string } }).spec?.type === "nobody-over-their-limit",
        )
          ? []
          : [
              {
                op: "add-node" as const,
                node: {
                  id: "rule-limit",
                  kind: "rule",
                  label: "Nobody over what they said they could do",
                  spec: { type: "nobody-over-their-limit" },
                },
              },
            ],
    },
  ],
});

export type RotaStore = Store<RotaSchema>;

export function createRotaStore(options: Partial<StoreOptions<RotaSchema>> = {}): RotaStore {
  return new Store<RotaSchema>({
    schema: rotaSchema,
    mutations: rotaActs,
    invariants: rotaInvariants,
    policy: rotaPolicy,
    modules: rotaInstallation.modules,
    ...options,
  });
}

export default rotaApp;
