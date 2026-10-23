import { bindSchema, createSchema, defineApp, defineNode, PUBLISH, Store, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/**
 * A PUBLISHER IS OFFERED "PUBLISH" (Roadmap f-publishing-lifecycle). An
 * agent acting for a person who may publish is given the act as a tool,
 * one acting for a person who may not is not, and the surface a stateless
 * host derives from the app alone is the one the runtime gives.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-note", {
  title: "Add a note",
  creates: ["note"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "n"), kind: "note", label: args.label } as never);
  },
});
const app = defineApp({
  name: "notes",
  schema,
  mutations: [add],
  policy: { roles: ["editor", "writer"], grants: [{ roles: ["editor", "writer"], mutations: "*" }] },
  publishing: { mode: "on-publish", working: ["editor", "writer"], publishers: ["editor"] },
});
const forEditor: Principal = { kind: "agent", id: "claude", onBehalfOf: { kind: "human", id: "eve", roles: ["editor"] } };
const forWriter: Principal = { kind: "agent", id: "claude", onBehalfOf: { kind: "human", id: "wes", roles: ["writer"] } };
const store = () => new Store({ schema, mutations: [add], policy: app.policy!, publishing: app.publishing! });

describe("an agent in an app that publishes", () => {
  it("is given publish when it acts for a publisher, and not otherwise", () => {
    expect(createToolRuntime(store(), { author: forEditor }).definitions.map((tool) => tool.act)).toContain(PUBLISH);
    expect(createToolRuntime(store(), { author: forWriter }).definitions.map((tool) => tool.act)).not.toContain(PUBLISH);
  });

  it("is given the surface a host derives from the app alone", () => {
    for (const seat of [forEditor, forWriter]) expect(toolDefinitions(app, seat).hash).toBe(createToolRuntime(store(), { author: seat }).hash);
  });
});
