import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, nodeRef, Store } from "../../src/index.js";

/**
 * `permits` ANSWERS AS `apply` WOULD. A declared agent's `may` narrowed only
 * `apply`: the chat asked `permits`, was told yes, offered "take Kerosene
 * off the single" as the starter seat — which may only add — and the press
 * met "starter may not take-off here".
 */
const song = defineNode("song", { fields: z.object({ label: z.string() }), edges: { on: { to: ["song"] } } });
const schema = createSchema([song]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-song", {
  title: "Add a song",
  creates: ["song"],
  input: z.object({ label: z.string() }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "song"), kind: "song", label: args.label } as never),
});
const takeOff = defineMutation("take-off", {
  title: "Take it off",
  subject: { kinds: ["song"], arg: "id" },
  severs: ["on"],
  input: z.object({ id: nodeRef(["song"]), from: nodeRef(["song"]) }),
  apply: (ctx, args) => ctx.removeEdge({ kind: "on", from: args.id, to: args.from }),
});

describe("permits, for a declared agent", () => {
  const store = () =>
    new Store({
      schema,
      mutations: [add, takeOff],
      invariants: [],
      intelligence: [{ name: "starter", kind: "graph", description: "Seeds.", may: ["add-song"] }],
      snapshot: { nodes: [{ id: "a", kind: "song", label: "A" }, { id: "b", kind: "song", label: "B" }] as never, edges: [{ kind: "on", from: "a", to: "b" }] },
    });
  const starter = { kind: "agent" as const, id: "starter" };

  it("refuses what the agent was not declared able to do, in apply's words", () => {
    const verdict = store().permits({ name: "take-off", args: { id: "a", from: "b" } }, starter);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    // The act by its title (W-143), as the button says it.
    expect(verdict.refusal.message).toContain("starter may not “Take it off” here");
  });

  it("allows what it was declared able to do, and leaves a person alone", () => {
    expect(store().permits({ name: "add-song", args: { label: "C" } }, starter).ok).toBe(true);
    expect(store().permits({ name: "take-off", args: { id: "a", from: "b" } }).ok).toBe(true);
  });
});
