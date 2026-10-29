import { bindSchema, createSchema, defineNode, nodeRef, Store, type Author, type Principal } from "@graview/core";
import { suggest, voteSuggestion } from "@graview/core/tidying";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { whileAway } from "../../src/tidy.js";

/**
 * WHILE AWAY SAYS HOW MANY AGREE WITH ONE THAT WAITS (Roadmap
 * f-votes-shared-seat): `whileAway` counts the most people whose vote
 * stands for a waiting suggestion (`agreed`) and says it, "3 readers agree
 * with one that waits" — people's votes, not a visitor's advisory one.
 */
const task = defineNode("task", { fields: z.object({ label: z.string() }), edges: { "waits-for": { to: ["task"], description: "what has to happen first" } } });
const schema = createSchema([task]);
const { defineMutation } = bindSchema(schema);
const waitFor = defineMutation("wait-for", {
  title: "This has to happen first",
  subject: { kinds: ["task"], arg: "taskId" },
  connects: ["waits-for"],
  input: z.object({ taskId: nodeRef(["task"]), blockerId: nodeRef(["task"]) }),
  apply(ctx, args) {
    ctx.addEdge({ kind: "waits-for", from: args.taskId, to: args.blockerId });
  },
});
const actor: Author = { kind: "system", id: "tidying", name: "Graview, tidying", automated: true };
const reader = (id: string): Principal => ({ kind: "human", id, roles: ["reader"] });

describe("while away", () => {
  it("says how many readers agree with the waiting suggestion most agree with", () => {
    const store = new Store({
      schema,
      mutations: [waitFor],
      policy: { roles: ["keeper", "reader"], grants: [{ roles: ["keeper"], mutations: "*" }] },
      votes: { advisory: "visitors" },
      snapshot: { nodes: ["piano", "keys", "van"].map((id) => ({ id, kind: "task", label: id })) as never, edges: [] },
    });
    const since = store.log.length;
    const one = suggest(store, [{ name: "wait-for", args: { taskId: "keys", blockerId: "piano" } }], { author: actor, lineage: { basis: "One goes first", confidence: 0.4 } })!;
    const two = suggest(store, [{ name: "wait-for", args: { taskId: "van", blockerId: "piano" } }], { author: actor, lineage: { basis: "One goes first", confidence: 0.4 } })!;
    expect(whileAway(store, { seq: since })).toMatchObject({ agreed: 0, said: "2 suggestions waiting" });
    for (const id of ["ann", "bo", "cy"]) voteSuggestion(store, one.id, "for", { author: reader(id) });
    voteSuggestion(store, two.id, "for", { author: reader("ann") });
    // A visitor's advisory vote is not a reader agreeing.
    voteSuggestion(store, two.id, "for", { author: { kind: "human", id: "anonymous", roles: ["reader"], shared: true, visitorKey: "x" } });
    expect(whileAway(store, { seq: since })).toMatchObject({ agreed: 3, said: "2 suggestions waiting · 3 readers agree with one that waits" });
  });
});
