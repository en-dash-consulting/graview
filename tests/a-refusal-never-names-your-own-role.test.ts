import type { Principal, Store } from "@graview/core";
import { deriveAffordances } from "@graview/tools";
import { describe, expect, it } from "vitest";
import { createStore as discography } from "../apps/discography/src/domain/app.js";
import discographySeed from "../apps/discography/src/data/seed.json";
import { SEATS as discographySeats } from "../apps/discography/src/ui/seats.js";
import { createStore as gauntlet } from "../apps/gauntlet/src/domain/app.js";
import gauntletSeed from "../apps/gauntlet/src/data/seed.json";
import { SEATS as gauntletSeats } from "../apps/gauntlet/src/ui/seats.js";
import { createRotaStore } from "../apps/rota/src/domain/app.js";
import rotaExample from "../apps/rota/src/data/example.json";
import { SEATS as rotaSeats } from "../apps/rota/src/ui/app.js";

/**
 * A REFUSAL NEVER NAMES A ROLE THE SEAT HOLDS.
 *
 * "Not permitted: “Shortlist a car” — a manager or a shopper can", said to
 * a shopper, is a contradiction the person cannot act on: they are what the
 * sentence says can. The seventh walk met it on every car in the showroom,
 * because a self grant was asked about with its subject still unchosen.
 * Held over every example with a policy, for every seat, on the records of
 * every kind: whatever is withheld says who else could, never "you".
 */
const apps: { name: string; store: Store<never>; seats: readonly { principal: Principal }[] }[] = [
  { name: "gauntlet", store: gauntlet({ snapshot: gauntletSeed as never }) as never, seats: gauntletSeats },
  { name: "discography", store: discography({ snapshot: discographySeed as never }) as never, seats: discographySeats },
  { name: "rota", store: createRotaStore({ snapshot: rotaExample as never }) as never, seats: rotaSeats },
];

describe("what is withheld from a seat", () => {
  for (const { name, store, seats } of apps) {
    it(`in ${name}, never says the seat's own role could`, () => {
      const sample = (store.schema.kinds as readonly string[]).flatMap((kind) => store.graph.nodesOfKind(kind as never).slice(0, 3));
      expect(sample.length).toBeGreaterThan(0);
      const contradictions: string[] = [];
      for (const { principal } of seats) {
        const roles = principal.roles ?? [];
        for (const node of sample) {
          for (const one of deriveAffordances(store, [node.id], { principal }).withheld) {
            if (one.refusal.wouldNeed.some((role) => roles.includes(role))) contradictions.push(`${principal.id} on ${node.id}: ${one.refusal.message}`);
          }
        }
      }
      expect(contradictions).toEqual([]);
    });
  }
});
