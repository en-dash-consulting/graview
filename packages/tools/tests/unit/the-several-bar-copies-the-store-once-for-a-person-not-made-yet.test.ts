import { compileDocument } from "@graview/core/check";
import { Store, type AnySchema, type Principal } from "@graview/core";
import { describe, expect, it, vi } from "vitest";
import { actsForSeveral } from "../../src/index.js";

/*
 * THE SEVERAL BAR COPIES THE STORE ONCE FOR A PERSON NOT MADE YET. A
 * profile whose person `apply` would make first is judged on a copy of the
 * store with that person made (`wouldDo`). The copy is made once for a look
 * at the chosen records — every act over every one of them — and kept while
 * the store's `version` stands: one copy per recompute, not one per act.
 */
const made = compileDocument({
  format: "graview-document",
  formatVersion: 1,
  name: "Rocks",
  roles: ["family"],
  kinds: {
    explorer: { noun: "explorer", plural: "explorers", people: true, fields: { name: { type: "string", required: true } } },
    rock: { noun: "rock", plural: "rocks", fields: { title: { type: "string", required: true }, signed: { type: "string" } }, edges: { foundBy: { to: ["explorer"], description: "who", inverse: "what" } } },
  },
  acts: {
    "find-rock": { title: "I found it", on: "rock", effects: [{ connect: "foundBy", from: "$subject", to: "$me" }] },
    sign: { title: "Sign it", on: "rock", effects: [{ set: { signed: "$me" } }] },
    polish: { title: "Polish", on: "rock", effects: [{ set: { title: "Polished" } }] },
  },
  policy: { grants: [{ roles: "*", mutations: "*" }], sees: [{ roles: ["family"], kinds: ["explorer", "rock"] }] },
} as never);
if (!made.ok) throw new Error(JSON.stringify(made.findings));
const rocks = () =>
  new Store<AnySchema>({
    schema: made.app.schema,
    mutations: made.app.mutations as never,
    policy: made.app.policy!,
    snapshot: { nodes: [{ id: "user:nick", kind: "explorer", name: "Nick" }, ...[1, 2, 3, 4].map((at) => ({ id: `rock:${at}`, kind: "rock", title: `Rock ${at}` }))], edges: [] } as never,
  });
const mia: Principal = { kind: "human", id: "user:nick", roles: ["family"], profile: { id: "prf_mia", name: "Mia" } };
const chosen = ["rock:1", "rock:2", "rock:3", "rock:4"];

describe("the several bar for a profile whose person is not made yet", () => {
  it("copies the store once per recompute, shared by every act, and again only once it changes", () => {
    const store = rocks();
    const copies = vi.spyOn(store as unknown as { rehearsal(): unknown }, "rehearsal");
    const { acts } = actsForSeveral(store, chosen, { principal: mia });
    const doneAsMia = acts.filter((act) => act.mutation === "find-rock" || act.mutation === "sign");
    expect(doneAsMia.map((act) => act.applies)).toEqual([chosen, chosen]);
    expect(copies).toHaveBeenCalledTimes(1);
    // Asked of the store directly with nothing changed, the copy is the same one.
    store.wouldDo([{ name: "sign", args: { id: "rock:1" } }], mia);
    expect(copies).toHaveBeenCalledTimes(1);
    store.apply({ name: "polish", args: { id: "rock:1" } }, { author: { kind: "human", id: "user:other", roles: ["family"] } });
    actsForSeveral(store, chosen, { principal: mia });
    expect(copies).toHaveBeenCalledTimes(2);
  });
});
