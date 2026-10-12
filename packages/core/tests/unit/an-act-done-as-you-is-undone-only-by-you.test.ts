import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { PermissionDeniedError, Store, type AnySchema, type Principal } from "../../src/index.js";

/**
 * AN ACT DONE AS YOU IS UNDONE ONLY BY YOU (the review before 0.1.27). An
 * undo is judged as the act it takes back, asked again for whoever undoes
 * it — and "Vote for it" says `$me`, so everybody may run it. Bo could take
 * back Ann's vote by undoing it, which the board's own grant ("a vote is
 * taken back only by whoever cast it") refuses him directly. An op whose
 * act wrote its author's own record where its call never named it is the
 * author's to take back; the system's, too.
 */
const board = JSON.parse(readFileSync(new URL("../document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const app = compiled.app;

const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };
const bo: Principal = { kind: "human", id: "p_bo", roles: ["member"] };
const storeOf = () =>
  new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    policy: app.policy!,
    snapshot: { nodes: [{ id: "p_ann", kind: "member", name: "Ann" }, { id: "p_bo", kind: "member", name: "Bo" }, { id: "idea:picnic", kind: "idea", title: "A picnic" }] as never, edges: [] },
  });
const votes = (store: Store<AnySchema>) => store.graph.out("idea:picnic", "votedBy").map((node) => node.id);

describe("undoing an act done as you", () => {
  it("is refused to anybody else, with a sentence", () => {
    const store = storeOf();
    const cast = store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: ann });
    expect(() => store.undo(cast.batch, { author: bo })).toThrow(PermissionDeniedError);
    try {
      store.undo(cast.batch, { author: bo });
    } catch (error) {
      expect((error as PermissionDeniedError).refusal.message).toBe("Not permitted to undo \"Vote for it: A picnic\": it was done as somebody else.");
    }
    expect(votes(store)).toEqual(["p_ann"]);
  });

  it("is the person's own, and their agent's", () => {
    const store = storeOf();
    const cast = store.apply({ name: "vote-for", args: { id: "idea:picnic" } }, { author: ann });
    store.undo(cast.batch, { author: { kind: "agent", id: "helper", onBehalfOf: ann } });
    expect(votes(store)).toEqual([]);
  });

  it("leaves an act that names its records as it was: anybody who may run it may undo it", () => {
    const store = storeOf();
    const added = store.apply({ name: "add-idea", args: { title: "A hike" } }, { author: ann });
    store.undo(added.batch, { author: bo });
    expect(store.graph.allNodes().some((node) => node.kind === "idea" && (node as { title?: string }).title === "A hike")).toBe(false);
  });
});
