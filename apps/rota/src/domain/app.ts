import { defineApp, readerSettings, Store, UNSET, type Primitive, type StoreOptions } from "@graview/core";
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
 * and a version with the migrations that carry a roster stored before it
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
  version: 3,
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
    {
      from: 2,
      to: 3,
      title: "Where a shift happens is a location",
      /*
       * A roster stored when "where" was a string on each shift: every
       * distinct string becomes one location, each shift is held at its
       * own, and the string comes off the shift — so ten shifts that said
       * "The hall" are ten lines to one hall.
       */
      apply: (snapshot) => {
        const places = new Map<string, string>();
        const steps: Primitive[] = [];
        for (const node of snapshot.nodes) {
          const place = (node as { place?: unknown }).place;
          if (node.kind !== "shift" || typeof place !== "string" || place.length === 0) continue;
          let id = places.get(place);
          if (!id) {
            id = `loc-${place.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
            places.set(place, id);
            steps.push({ op: "add-node", node: { id, kind: "location", label: place } });
          }
          steps.push({ op: "add-edge", edge: { kind: "held-at", from: node.id, to: id } });
          steps.push({ op: "patch-node", id: node.id, before: { place }, after: { place: UNSET } });
        }
        return steps;
      },
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
