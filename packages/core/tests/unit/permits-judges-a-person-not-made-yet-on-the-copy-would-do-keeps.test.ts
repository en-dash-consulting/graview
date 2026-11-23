import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { compileDocument } from "../../src/check.js";
import { PermissionDeniedError, Store, type AnySchema, type MutationCall, type Principal } from "../../src/index.js";

/**
 * PERMITS JUDGES A PERSON NOT MADE YET ON THE COPY `wouldDo` KEEPS. Under
 * an own-end grant, what a profile whose person is not made yet may do is
 * judged with that person made, as `apply` judges it. Each call used to be
 * rehearsed on a copy of the store of its own; the copy is now the one kept
 * while the store's `version` stands, shared with `wouldDo`, and the
 * verdicts are the ones a rehearsal of each call gives.
 */
const board = JSON.parse(readFileSync(new URL("../document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const fresh = () =>
  new Store<AnySchema>({
    schema: compiled.app.schema,
    mutations: compiled.app.mutations as never,
    policy: compiled.app.policy!,
    snapshot: {
      nodes: [{ id: "p_ann", kind: "member", name: "Ann" }, ...[1, 2, 3, 4, 5].map((at) => ({ id: `idea:${at}`, kind: "idea", title: `Idea ${at}` }))],
      edges: [{ kind: "votedBy", from: "idea:1", to: "p_ann" }],
    } as never,
  });
const mia: Principal = { kind: "human", id: "user:cy", roles: ["member"], profile: { id: "prf_mia", name: "Mia" } };
const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };

/** What a rehearsal of the call alone refuses for who may, as `permits` answered it before the copy was shared. */
function rehearsed(store: Store<AnySchema>, call: MutationCall, seat: Principal): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  try {
    store.previewAll([call], { author: seat });
  } catch (error) {
    if (error instanceof PermissionDeniedError) return { ok: false, message: error.refusal.message };
  }
  return { ok: true };
}

describe("permits for a profile whose person is not made yet, under an own-end grant", () => {
  const calls: MutationCall[] = [1, 2, 3, 4, 5].flatMap((at) => [
    { name: "vote-for", args: { id: `idea:${at}` } },
    { name: "champion", args: { id: `idea:${at}` } },
    { name: "take-back", args: { id: `idea:${at}`, to: "p_ann" } },
  ]);

  it("judges every call on one copy while the store stands, and on a new one once it changes", () => {
    const store = fresh();
    const copies = vi.spyOn(store as unknown as { rehearsal(): unknown }, "rehearsal");
    for (const call of calls) store.permits(call, mia);
    expect(copies).toHaveBeenCalledTimes(1);
    store.wouldDo(calls.slice(0, 2), mia);
    expect(copies).toHaveBeenCalledTimes(1);
    store.apply({ name: "champion", args: { id: "idea:2" } }, { author: ann });
    store.permits(calls[0]!, mia);
    expect(copies).toHaveBeenCalledTimes(2);
  });

  it("answers each call as a rehearsal of it alone does, refusing somebody else's end of a link", () => {
    const store = fresh();
    for (const call of calls) {
      const verdict = store.permits(call, mia);
      expect(verdict.ok ? { ok: true } : { ok: false, message: verdict.refusal.message }, JSON.stringify(call)).toEqual(rehearsed(store, call, mia));
    }
    expect(store.permits({ name: "take-back", args: { id: "idea:1", to: "p_ann" } }, mia)).toMatchObject({ ok: false, refusal: { message: expect.stringMatching(/only on your own end of the link/) } });
    expect(store.permits({ name: "vote-for", args: { id: "idea:1" } }, mia).ok).toBe(true);
    // Asking made nobody.
    expect((store.graph.nodesOfKind("member") as readonly { readonly id: string }[]).map((one) => one.id)).toEqual(["p_ann"]);
  });

  it("lets the person take back their own vote once they are made, as before", () => {
    const store = fresh();
    store.apply({ name: "vote-for", args: { id: "idea:3" } }, { author: mia });
    const me = store.personOf(mia)!;
    expect(store.permits({ name: "take-back", args: { id: "idea:3", to: me } }, mia).ok).toBe(true);
    expect(store.permits({ name: "take-back", args: { id: "idea:1", to: "p_ann" } }, mia).ok).toBe(false);
  });
});
