import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, Store, type Principal } from "@graview/core";
import { createToolRuntime } from "../../src/index.js";

/**
 * AN AGENT NAMES A RELATION'S ACT AS THE RELATION IS SPELLED. A relation
 * `partOf` gives `connect-threat-part-of`; an agent that read the
 * relation's name called `connect-threat-partOf` and was told the tool was
 * unknown. The runtime reads that spelling as the act, and a name that only
 * nearly says one is refused with it: "Did you mean …?" (Threat Watch).
 */
const threat = defineNode("threat", {
  fields: z.object({ label: z.string() }),
  plural: "Threats",
  edges: { partOf: { to: ["threat"], cardinality: "one", description: "The family it belongs to." } },
});
const schema = createSchema([threat]);
const { defineMutation } = bindSchema(schema);
const addThreat = defineMutation("add-threat", {
  title: "Add a threat",
  creates: ["threat"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "threat"), kind: "threat", label: args.label });
  },
});
const agent: Principal = { kind: "agent", roles: [] };
const runtimeOf = () => {
  const store = new Store({
    schema,
    mutations: [addThreat],
    snapshot: { nodes: [{ id: "t1", kind: "threat", label: "Lumma stealer" }, { id: "t2", kind: "threat", label: "Infostealers" }], edges: [] },
  });
  return { store, runtime: createToolRuntime(store, { author: agent }) };
};

describe("an agent's relation act", () => {
  it("connect-threat-partOf runs connect-threat-part-of", async () => {
    const { store, runtime } = runtimeOf();
    const result = await runtime.call("connect-threat-partOf", { id: "t1", to: "t2" });
    expect(result.ok).toBe(true);
    expect(store.graph.out("t1", "partOf").map((node) => node.id)).toEqual(["t2"]);
  });

  it("is offered in the relation's own words: Set the family it belongs to", () => {
    const { runtime } = runtimeOf();
    expect(runtime.definitions.find((tool) => tool.name === "connect-threat-part-of")?.title).toBe("Set the family it belongs to");
  });

  it("a name that nearly says it is refused with the act it nearly says", async () => {
    const { store, runtime } = runtimeOf();
    const result = await runtime.call("connect-threat-partof-it", { id: "t1", to: "t2" });
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain('Did you mean "connect-threat-part-of"?');
    expect(store.graph.out("t1", "partOf")).toEqual([]);
  });
});
