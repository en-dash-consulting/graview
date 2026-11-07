import { readFileSync } from "node:fs";
import { compileDocument } from "@graview/core/check";
import { profilePersonId, Store, type AnySchema, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { deriveAffordances } from "../../src/derive.js";

/**
 * TAKING BACK A PROFILE'S VOTE (Roadmap f-viewer-state-and-me-framework). A
 * vote cast as Mia is Mia's: she is offered taking it back, already filled in,
 * and the account with no profile is not offered what `permits` would refuse.
 */
const board = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error("the board compiles");
const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };
const mia: Principal = { ...ann, profile: { id: "prf_mia", name: "Mia" } };
const leo: Principal = { ...ann, profile: { id: "prf_leo", name: "Leo" } };
const person = profilePersonId("p_ann", { id: "prf_mia" });
const voted = () => {
  const store = new Store<AnySchema>({ schema: compiled.app.schema, mutations: compiled.app.mutations as never, policy: compiled.app.policy!, snapshot: { nodes: [{ id: "p_ann", kind: "member", name: "Ann" }, { id: "idea:picnic", kind: "idea", title: "A picnic" }], edges: [] } as never });
  store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: mia });
  return store;
};
const takeBack = (store: Store<AnySchema>, principal: Principal) => {
  const derived = deriveAffordances(store as never, ["idea:picnic"], { principal } as never) as unknown as { affordances: readonly { readonly mutation: string; readonly args: Record<string, unknown>; readonly open: readonly unknown[] }[] };
  return derived.affordances.filter((one) => one.mutation === "take-back");
};

describe("take back a vote", () => {
  it("is not offered to the account or another profile, on a vote only a profile cast", () => {
    const store = voted();
    expect(store.permits({ name: "take-back", args: { id: "idea:picnic", votedBy: person } }, ann).ok).toBe(false);
    expect(takeBack(store, ann)).toEqual([]);
    expect(takeBack(store, leo)).toEqual([]);
  });

  it("is offered to the profile that cast it", () => {
    const store = voted();
    const offered = takeBack(store, mia);
    expect(offered).toHaveLength(1);
    expect(Object.values(offered[0]!.args)).toContain(person);
  });
});
