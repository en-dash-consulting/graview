import { readFileSync } from "node:fs";
import { Store, type AnySchema, type Principal } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createToolRuntime, deriveAffordances } from "../../src/index.js";

/**
 * AN OWN-END ACT IS OFFERED ON YOUR OWN END (Roadmap f-own-end-grants).
 * "Take back a vote" on an idea severs a link to a member, and a grant that
 * holds it to the principal's own end refuses every other member's. The
 * strip and the seat narrow with the store: on an idea Ann voted for it is
 * offered with Ann already chosen, and on one only Bo voted for it is not
 * offered at all, rather than a picker of other people's votes that every
 * press refuses.
 */
const board = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings));
const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };

function boardStore() {
  const app = compiled.ok ? compiled.app : undefined!;
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    snapshot: {
      nodes: [
        { id: "p_ann", kind: "member", name: "Ann" },
        { id: "p_bo", kind: "member", name: "Bo" },
        { id: "idea:picnic", kind: "idea", title: "A picnic" },
        { id: "idea:quiz", kind: "idea", title: "A quiz" },
      ] as never,
      edges: [
        { kind: "votedBy", from: "idea:picnic", to: "p_ann" },
        { kind: "votedBy", from: "idea:picnic", to: "p_bo" },
        { kind: "votedBy", from: "idea:quiz", to: "p_bo" },
      ],
    },
  });
}
const takeBack = (store: Store<AnySchema>, selection: string[]) => {
  const derived = deriveAffordances(store, selection, { principal: ann });
  return {
    offered: derived.affordances.filter((affordance) => affordance.mutation === "take-back"),
    withheld: derived.withheld.filter((affordance) => affordance.mutation === "take-back"),
  };
};

describe("an act held to your own end of a link", () => {
  it("is offered on an idea you voted for, with you already chosen", () => {
    const { offered } = takeBack(boardStore(), ["idea:picnic"]);
    expect(offered).toHaveLength(1);
    expect(offered[0]!.args).toMatchObject({ id: "idea:picnic", to: "p_ann" });
    expect(offered[0]!.open.map((parameter) => parameter.name)).not.toContain("to");
  });

  it("is neither offered nor refused on an idea only somebody else voted for", () => {
    const { offered, withheld } = takeBack(boardStore(), ["idea:quiz"]);
    expect(offered).toEqual([]);
    expect(withheld).toEqual([]);
  });

  it("is refused to the seat's tool on another member's vote, and runs on its own", async () => {
    const store = boardStore();
    const tools = createToolRuntime(store, { author: ann });
    expect(tools.definitions.map((tool) => tool.name)).toContain("take-back");
    const theirs = await tools.call("take-back", { id: "idea:quiz", to: "p_bo" });
    expect(theirs.ok).toBe(false);
    expect(store.graph.out("idea:quiz", "votedBy").map((node) => node.id)).toEqual(["p_bo"]);
    const mine = await tools.call("take-back", { id: "idea:picnic", to: "p_ann" });
    expect(mine.ok).toBe(true);
    expect(store.graph.out("idea:picnic", "votedBy").map((node) => node.id)).toEqual(["p_bo"]);
  });
});
