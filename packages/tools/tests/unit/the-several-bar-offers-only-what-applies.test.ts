import { readFileSync } from "node:fs";
import { compileDocument } from "@graview/core/check";
import { Store, type AnySchema, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { actOnSeveral, actsForSeveral, createToolRuntime } from "../../src/index.js";

/*
 * THE SEVERAL BAR OFFERS AN ACT ONLY FOR RECORDS IT CAN APPLY TO. "Take back
 * a vote" was offered over every chosen idea, whoever held the link, and a
 * seat with no vote on them was refused each in the graph's own key — a
 * relation, two ids and the NUL between them. An act is now offered only
 * where the rehearsal `actOnSeveral` runs would apply it to at least one
 * chosen record, it counts only those, and an edge removal on a record that
 * lacks the link is refused in words.
 */
const board = JSON.parse(readFileSync(new URL("../../../core/tests/document/fixtures/idea-board.gdd.json", import.meta.url), "utf8"));
const compiled = compileDocument(board);
if (!compiled.ok) throw new Error("the board compiles");
const fresh = (edges: readonly unknown[] = []) =>
  new Store<AnySchema>({
    schema: compiled.app.schema,
    mutations: compiled.app.mutations as never,
    policy: compiled.app.policy!,
    snapshot: {
      nodes: [
        { id: "p_ann", kind: "member", name: "Ann" },
        { id: "p_bo", kind: "member", name: "Bo" },
        { id: "idea:a", kind: "idea", title: "A picnic" },
        { id: "idea:b", kind: "idea", title: "A hike" },
      ],
      edges,
    } as never,
  });
const ann: Principal = { kind: "human", id: "p_ann", roles: ["member"] };
const bo: Principal = { kind: "human", id: "p_bo", roles: ["member"] };
const ideas = ["idea:a", "idea:b"];
const takeBack = (store: Store<AnySchema>, seat: Principal) => actsForSeveral(store, ideas, { principal: seat }).acts.find((act) => act.mutation === "take-back");
// What a person or an agent reads must hold no NUL-joined key and no record's id.
const inWords = (message: string) => {
  expect(message).not.toMatch(/\0/);
  expect(message).not.toMatch(/p_ann|p_bo|idea:a|idea:b|votedBy/);
};

describe("the several bar", () => {
  it("does not offer taking back a vote to a seat that cast none on the chosen records", () => {
    const store = fresh([{ kind: "votedBy", from: "idea:a", to: "p_ann" }, { kind: "votedBy", from: "idea:b", to: "p_ann" }]);
    expect(takeBack(store, bo)).toBeUndefined();
  });

  it("offers it where the seat voted on some of them, and counts only those", () => {
    const store = fresh([{ kind: "votedBy", from: "idea:a", to: "p_ann" }]);
    const act = takeBack(store, ann);
    expect(act?.applies).toEqual(["idea:a"]);
  });

  it("offers an act every chosen record can take with every one counted", () => {
    const act = actsForSeveral(fresh(), ideas, { principal: bo }).acts.find((one) => one.mutation === "vote-for");
    expect(act?.applies).toEqual(ideas);
  });

  it("takes back the votes the seat holds and refuses the rest in words", () => {
    const store = fresh([{ kind: "votedBy", from: "idea:a", to: "p_ann" }]);
    const act = takeBack(store, ann)!;
    const outcome = actOnSeveral(store, { mutation: act.mutation, subject: act.subject, args: act.args }, ideas, { author: ann });
    expect(outcome.applied).toEqual(["idea:a"]);
    expect(outcome.refused.map((one) => one.id)).toEqual(["idea:b"]);
    for (const one of outcome.refused) inWords(one.message);
  });
});

describe("an edge removal on a record that lacks the edge", () => {
  it("is refused in words by the store, and by the agent's tool", async () => {
    const store = fresh();
    const refused = (() => {
      try {
        store.apply({ name: "take-back", args: { id: "idea:a", ...takeBackArgs(store) } }, { author: ann });
      } catch (error) {
        return (error as Error).message;
      }
      return undefined;
    })();
    expect(refused).toBeDefined();
    inWords(refused!);
    const runtime = createToolRuntime(store, { author: ann });
    const tool = runtime.definitions.find((one) => one.name.includes("take"))!;
    const answer = JSON.stringify(await runtime.call(tool.name, { id: "A picnic", ...takeBackArgs(store) }));
    expect(answer).not.toMatch(/\\u0000|p_ann|idea:a/);
  });
});

/** The far end the act asks for, by whatever name the shorthand gives it: the seat's own record. */
function takeBackArgs(store: Store<AnySchema>): Record<string, string> {
  const act = store.allMutations().find((one) => one.name === "take-back")!;
  const shape = (act.input as unknown as { shape: Record<string, unknown> }).shape;
  const far = Object.keys(shape).find((key) => key !== act.subject!.arg)!;
  return { [far]: "p_ann" };
}
