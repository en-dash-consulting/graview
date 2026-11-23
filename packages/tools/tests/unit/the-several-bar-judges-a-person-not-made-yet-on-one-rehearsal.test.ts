import { readFileSync } from "node:fs";
import { compileDocument } from "@graview/core/check";
import { PermissionDeniedError, Store, type AnySchema, type MutationCall, type Principal } from "@graview/core";
import { describe, expect, it, vi } from "vitest";
import { actsForSeveral } from "../../src/index.js";

/*
 * THE SEVERAL BAR JUDGES A PERSON NOT MADE YET ON ONE REHEARSAL. A profile
 * whose person `apply` would make first, under a policy with an own-end
 * grant, is judged by `permits` as `apply` judges it: with the person made,
 * since what the grant reads of a link's far end is that person. That used
 * to be one copy of the store for every call — every chosen record, for
 * every act, on every recompute — so two thousand chosen ideas were
 * thousands of copies. The copy is now the one `wouldDo` already keeps
 * while the store's `version` stands: one per recompute, the same verdicts.
 */
// Its own policy: anybody adds, votes and champions, and takes back a vote only from their own end (`ownEnd`).
const board = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));

const ideas = (count: number) =>
  new Store<AnySchema>({
    schema: compiled.app.schema,
    mutations: compiled.app.mutations as never,
    policy: compiled.app.policy!,
    snapshot: {
      nodes: [{ id: "p_ann", kind: "member", name: "Ann" }, { id: "p_bo", kind: "member", name: "Bo" }, ...Array.from({ length: count }, (_, at) => ({ id: `idea:${at}`, kind: "idea", title: `Idea ${at}` }))],
      edges: Array.from({ length: count }, (_, at) => at).filter((at) => at % 3 === 0).map((at) => ({ kind: "votedBy", from: `idea:${at}`, to: at % 2 === 0 ? "p_ann" : "p_bo" })),
    } as never,
  });

/** A profile of an account with no member here: the person `apply` makes on its first act. */
const mia: Principal = { kind: "human", id: "user:cy", roles: ["member"], profile: { id: "prf_mia", name: "Mia" } };
/** A member who is here already: no person to make, nothing to rehearse. */
const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };

const chosenOf = (store: Store<AnySchema>) => (store.graph.nodesOfKind("idea") as readonly { readonly id: string }[]).map((idea) => idea.id);
const copiesOf = (store: Store<AnySchema>) => vi.spyOn(store as unknown as { rehearsal(): unknown }, "rehearsal");

describe("the several bar for a profile whose person is not made yet, under an own-end grant", () => {
  it("copies the store once per recompute, not once per chosen record, and again only once it changes", () => {
    const store = ideas(30);
    const copies = copiesOf(store);
    const { acts } = actsForSeveral(store, chosenOf(store), { principal: mia });
    expect(acts.length).toBeGreaterThan(0);
    expect(copies).toHaveBeenCalledTimes(1);
    store.apply({ name: "champion", args: { id: "idea:1" } }, { author: ann });
    actsForSeveral(store, chosenOf(store), { principal: mia });
    expect(copies).toHaveBeenCalledTimes(2);
  });

  it("offers and withholds what it did when each call was rehearsed on a copy of its own", () => {
    const store = ideas(30);
    const chosen = chosenOf(store);
    const { acts, withheld } = actsForSeveral(store, chosen, { principal: mia });
    expect(acts.map((act) => [act.label, act.applies.length])).toEqual(EXPECTED_ACTS);
    expect(withheld).toEqual(EXPECTED_WITHHELD);
    // Each call's verdict is the one a rehearsal of that call alone gives: refused where it is refused for who may, else what the grants say.
    const calls: MutationCall[] = chosen.flatMap((id) => [
      { name: "vote-for", args: { id } },
      { name: "champion", args: { id } },
      { name: "take-back", args: { id, to: "p_ann" } },
      { name: "take-back", args: { id, to: "p_bo" } },
    ]);
    for (const call of calls) {
      let rehearsed: { readonly ok: true } | { readonly ok: false; readonly message: string } = { ok: true };
      try {
        store.previewAll([call], { author: mia });
      } catch (error) {
        if (error instanceof PermissionDeniedError) rehearsed = { ok: false, message: error.refusal.message };
      }
      const verdict = store.permits(call, mia);
      expect(verdict.ok ? { ok: true } : { ok: false, message: verdict.refusal.message }, JSON.stringify(call)).toEqual(rehearsed);
    }
  });

  it("judges two thousand chosen ideas within the time it takes for a member who is here already", () => {
    const time = (seat: Principal) => {
      const store = ideas(2000);
      const chosen = chosenOf(store);
      const started = performance.now();
      const { acts } = actsForSeveral(store, chosen, { principal: seat });
      const ms = performance.now() - started;
      expect(acts.length).toBeGreaterThan(0);
      return ms;
    };
    time(ann);
    time(mia);
    // Taken turn about, the best of each kept, so a machine busy with other tests slows both alike.
    let plain = Infinity;
    let made = Infinity;
    for (let run = 0; run < 3; run += 1) {
      plain = Math.min(plain, time(ann));
      made = Math.min(made, time(mia));
    }
    // Measured here: 7.2 s against 114 ms (63 times) with a copy per call, 110 ms against 104 ms with the one. Three times leaves a shared runner its noise.
    expect(made / plain, `${made.toFixed(0)} ms for the profile, ${plain.toFixed(0)} ms for the member`).toBeLessThan(MOST_TIMES);
  });
});

const MOST_TIMES = 3;
/* What the bar said for this seat over thirty ideas before the copy was shared: the same now. */
const EXPECTED_ACTS: readonly (readonly [string, number])[] = [
  ["Champion it", 30],
  ["Vote for it", 30],
];
const EXPECTED_WITHHELD: readonly unknown[] = [
  { label: "Archive the idea", message: "Not permitted: “Archive the idea” on an idea — only on what you made; no role can." },
  { label: "Leave this one alone", message: "Not permitted: “Leave this one alone” on an idea — only on what you made; no role can." },
  { label: "Remove the idea", message: "Not permitted: “Remove the idea” on an idea — only on what you made; no role can." },
  { label: "Take back a vote", message: "Not permitted: “Take back a vote” on an idea — only on your own end of the link. A vote is taken back only by whoever cast it." },
];
