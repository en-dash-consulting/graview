import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, defaultProviders, deriveAffordances } from "../../src/index.js";

/**
 * THE STRIP AND AN AGENT ASK AS A FORM DOES (Roadmap
 * f-forms-same-order-everywhere). An act written in TypeScript declares its
 * arguments in whatever order its `z.object` has them; the strip asked them
 * one by one in that order, and an agent's tool listed them so, the name a
 * threat must be given after its aliases and its score.
 */
const threat = defineNode("threat", {
  fields: z.object({ aliases: z.string().optional(), cvss: z.number().optional(), name: z.string(), severity: z.enum(["critical", "low"]) }),
  label: (node) => node.name,
});
const schema = createSchema([threat]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-threat", {
  title: "Add a threat",
  creates: ["threat"],
  input: z.object({ aliases: z.string().optional(), cvss: z.number().optional(), severity: z.enum(["critical", "low"]), name: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.name, "threat"), kind: "threat", name: args.name, severity: args.severity });
  },
});
const store = () => new Store({ schema, mutations: [add], invariants: [] });

describe("an act written in TypeScript", () => {
  it("is asked in the strip for the name first, then what it must be given", () => {
    const set = deriveAffordances(store(), [], { providers: defaultProviders(), kindSelection: ["threat"] });
    const adding = set.affordances.find((one) => one.mutation === "add-threat");
    expect(adding?.open.map((parameter) => parameter.name).slice(0, 2)).toEqual(["name", "severity"]);
  });

  it("is offered to an agent with its properties in the same order", () => {
    const runtime = createToolRuntime(store());
    const tool = runtime.definitions.find((one) => one.act === "add-threat");
    expect(Object.keys((tool?.inputSchema["properties"] ?? {}) as object).slice(0, 4)).toEqual(["name", "severity", "aliases", "cvss"]);
  });
});
