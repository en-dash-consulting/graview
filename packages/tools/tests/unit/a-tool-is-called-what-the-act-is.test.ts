import { bindSchema, createSchema, defineNode, Store, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, deriveAffordances } from "../../src/index.js";

/*
 * A TOOL IS CALLED WHAT THE ACT IS CALLED: its title, else its name in
 * words as every surface says it. The model was offered "MarkDone" for the
 * act the strip and the seat say "Mark done".
 */
const note = defineNode("note", { fields: z.object({ label: z.string(), done: z.boolean().optional(), pinned: z.boolean().optional() }) });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const markDone = defineMutation("markDone", { subject: { kinds: ["note"], arg: "id" }, input: z.object({ id: z.string() }), apply(ctx, args) { ctx.patchNode(args.id, { done: true }); } });
const pin = defineMutation("pin_it", { title: "Pin to the top", subject: { kinds: ["note"], arg: "id" }, input: z.object({ id: z.string() }), apply(ctx, args) { ctx.patchNode(args.id, { pinned: true }); } });
const store = new Store<AnySchema>({ schema: schema as AnySchema, mutations: [markDone, pin] as never, snapshot: { nodes: [{ id: "n1", kind: "note", label: "Milk" }], edges: [] } as never });

describe("a tool's title", () => {
  it("is the act's name in words, as the surfaces say it, when the act has no title", () => {
    const { definitions } = createToolRuntime(store, { author: { kind: "agent" } });
    expect(definitions.find((tool) => tool.name === "markDone")?.title).toBe("Mark done");
  });

  it("is the act's own title when it has one, the same words the actions strip offers", () => {
    const { definitions } = createToolRuntime(store, { author: { kind: "agent" } });
    const offered = deriveAffordances(store, ["n1"]).affordances.map((affordance) => affordance.label);
    for (const act of ["markDone", "pin_it"]) {
      const title = definitions.find((tool) => tool.name === act)?.title;
      expect(offered, act).toContain(title);
    }
  });
});
