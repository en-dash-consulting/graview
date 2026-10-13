import { type Store as AnyStore } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createStore as discography } from "../apps/discography/src/domain/app.js";
import discographySeed from "../apps/discography/src/data/seed.json";
import { createStore as gauntlet } from "../apps/gauntlet/src/domain/app.js";
import gauntletSeed from "../apps/gauntlet/src/data/seed.json";
import { createRotaStore } from "../apps/rota/src/domain/app.js";
import rotaExample from "../apps/rota/src/data/example.json";

/**
 * A DOOR FOR EVERYBODY IS NOT A KEY TO EVERY RECORD (the ninth walk, W-201).
 *
 * The derived acts — a kind's edit, remove, archive, bring-back and merge —
 * ride the declared acts that make or write the kind. The beekeeping co-op
 * said "Anybody may join", and so a novice member could remove her mentor
 * from the co-op, and somebody with no role at all edit, archive or merge
 * any member they could see. The class the eighth walk named
 * (`permitted-what-was-never-granted`) had no check over the examples'
 * seats; this is it for what everybody is granted. Over every example with
 * a policy, as a seat with no role of its own, on a record of every kind
 * it may see and did not make: a derived act is permitted only where a
 * grant to everybody names it, or says `*`.
 */
const apps: { name: string; store: AnyStore<never> }[] = [
  { name: "gauntlet", store: gauntlet({ snapshot: gauntletSeed as never }) as never },
  { name: "discography", store: discography({ snapshot: discographySeed as never }) as never },
  { name: "rota", store: createRotaStore({ snapshot: rotaExample as never }) as never },
];

describe("a record somebody else made", () => {
  for (const { name, store } of apps) {
    it(`in ${name}, is changed or taken out by a seat with no role only where everybody is granted the act itself`, () => {
      const policy = store.policy;
      if (!policy) return;
      const seat = { kind: "human" as const, id: "walk9-passer-by", roles: [] };
      const named = (act: string) => policy.grants.some((grant) => grant.roles === "*" && (grant.mutations === "*" || grant.mutations.includes(act)));
      const seen = store.seenBy(seat);
      const wrong: string[] = [];
      let asked = 0;
      for (const mutation of store.allMutations().filter((one) => one.derived)) {
        const kind = mutation.derived!.kind;
        const archived = mutation.derived!.act === "unarchive" ? { archived: true as const } : {};
        const record = seen.graph.nodesOfKind(kind as never, archived)[0];
        if (!record) continue;
        asked += 1;
        const args = mutation.derived!.act === "merge" ? { id: record.id, into: record.id } : { id: record.id };
        if (store.permits({ name: mutation.name, args }, seat).ok && !named(mutation.name)) wrong.push(`${mutation.name} · ${record.id}`);
      }
      expect(asked).toBeGreaterThan(0);
      expect(wrong).toEqual([]);
    });
  }
});
