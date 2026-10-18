import type { Store as AnyStore } from "@graview/core";
import { deriveAffordances } from "@graview/tools";
import { describe, expect, it } from "vitest";
import { createStore as discography } from "../apps/discography/src/domain/app.js";
import discographySeed from "../apps/discography/src/data/seed.json";
import { createStore as gauntlet } from "../apps/gauntlet/src/domain/app.js";
import gauntletSeed from "../apps/gauntlet/src/data/seed.json";
import { createRotaStore } from "../apps/rota/src/domain/app.js";
import rotaExample from "../apps/rota/src/data/example.json";

/**
 * AN ACT OFFERED WHOLE IS ONE ITS INPUT ACCEPTS (the eleventh walk).
 *
 * A shelter's "Room in the kennel" selected a kennel and the animals in
 * it, and the strip offered "Align the status of "Run E05" with the other
 * 2" — the kennel's edit told an animal's status, refused on press. The
 * watch hears a refusal by the policy, never one by the act's own input, so
 * nothing in the chain would have said it. Held here over every example,
 * on every problem's records and a few of every kind together: an act
 * offered with nothing left to ask is one its input accepts as it stands.
 */
const apps: { name: string; store: AnyStore<never> }[] = [
  { name: "gauntlet", store: gauntlet({ snapshot: gauntletSeed as never }) as never },
  { name: "discography", store: discography({ snapshot: discographySeed as never }) as never },
  { name: "rota", store: createRotaStore({ snapshot: rotaExample as never }) as never },
];

describe("an act offered with every argument filled", () => {
  for (const { name, store } of apps) {
    it(`in ${name}, is accepted by its act's input, on a problem's records and on a mixed selection`, () => {
      const kinds = store.schema.kinds as readonly string[];
      const selections = [
        ...store.violations().slice(0, 20).map((violation) => violation.nodeIds),
        ...kinds.map((kind) => store.graph.nodesOfKind(kind as never).slice(0, 3).map((node) => node.id)),
        kinds.flatMap((kind) => store.graph.nodesOfKind(kind as never).slice(0, 2).map((node) => node.id)),
      ].filter((selection) => selection.length > 0);
      expect(selections.length).toBeGreaterThan(0);
      const mutations = new Map(store.allMutations().map((mutation) => [mutation.name, mutation]));
      const wrong: string[] = [];
      for (const selection of selections) {
        for (const affordance of deriveAffordances(store, selection).affordances) {
          if (affordance.open.length > 0 || affordance.batch) continue;
          const mutation = mutations.get(affordance.mutation);
          if (mutation && !mutation.input.safeParse(affordance.args).success) wrong.push(`${affordance.label} (${affordance.mutation})`);
        }
      }
      expect(wrong).toEqual([]);
    });
  }
});
