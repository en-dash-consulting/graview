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
  /*
   * FIVE PICTURES OF ONE ROSTER, declared and drawn (FR-79) — not one of
   * them written or registered in the UI. Each has a title, so it is a
   * place; the framework draws it from these lines. The week is the last
   * over the shifts, so it is what their district draws when an address
   * names no picture.
   */
  lenses: [
    {
      /*
       * AND THE QUARTER, which is how a rota is actually planned. Nobody
       * schedules volunteers a fortnight at a time: cover is worked out a
       * season ahead. The same lens and binding as the fortnight, one grain
       * coarser — a week per cell, thirteen of them.
       */
      name: "calendar",
      title: "The quarter",
      bindings: { shift: { start: "on", label: "label" } },
      options: { range: "quarter", today: "2026-09-14" },
    },
    {
      /* The fortnight, over the dates the shifts actually fall on — opened as a list, by where they happen. */
      name: "calendar",
      title: "The fortnight",
      bindings: { shift: { start: "on", label: "label" } },
      arrangedBy: { group: "held-at" },
      options: { range: "month", today: "2026-09-14" },
    },
    {
      /* The week, from the household's own timeline: minutes of a day in
         named columns, answered with this app's own fields. */
      name: "timeline",
      title: "The week",
      bindings: { shift: { start: "from", end: "until", column: "day" } },
    },
    {
      /*
       * WHO IS COVERING WHAT, as a grid. The coverage lens was written for a
       * requirements matrix; pointed at volunteers and shifts it says, in a
       * picture, which shift nobody has taken — which is the one question a
       * roster is for. It has never heard of a shift. It stands over the
       * volunteers, whose district it is the picture of.
       */
      name: "coverage",
      title: "Who is covering what",
      on: "volunteer",
      bindings: {
        rows: { kind: "shift" },
        columns: { kind: "volunteer" },
        link: { edge: "covered-by" },
      },
    },
    /* And what each role reaches, for the seat that keeps the installation. */
    { name: "reach", title: "Who may do what", on: "user" },
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
