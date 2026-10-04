import { bindSchema, createSchema, defineApp, defineNode, type AnySchema, type GraviewApp } from "@graview/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { createStudio, declarationToGraph, graphToDeclaration, migrationBetween, sourceChanges } from "../../src/index.js";

/**
 * THE STUDIO'S READERS TAKE A TYPED APP AS IT IS. They took
 * `GraviewApp<AnySchema>`, which a typed app could not be passed as, so the
 * studio itself — and every host — crossed with `as unknown as`. A typed
 * app now widens to it, and none of them needs the cast.
 */
const plot = defineNode("plot", { fields: z.object({ label: z.string() }) });
const schema = createSchema([plot]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-plot", {
  title: "Add a plot",
  creates: ["plot"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "plot"), kind: "plot", label: args.label });
  },
});
const garden = defineApp({ name: "garden", schema, mutations: [add], version: 1 });

describe("a typed app opens in the studio", () => {
  it("is taken by every reader without a cast", () => {
    expectTypeOf(garden).toMatchTypeOf<GraviewApp<AnySchema>>();
    const seed = declarationToGraph(garden);
    const declared = graphToDeclaration(seed, { base: garden, name: garden.name });
    expect(declared.name).toBe("garden");
    expect(migrationBetween(garden, declared)).toBeNull();
    expect(sourceChanges(seed, seed, garden)).toBeTruthy();
    expect(createStudio(garden).base).toBe(garden);
  });
});
