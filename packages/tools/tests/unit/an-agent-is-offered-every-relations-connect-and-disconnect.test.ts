import { describe, expect, it } from "vitest";
import { z } from "zod";
import { bindSchema, createSchema, defineNode, Store, type Policy, type Principal } from "@graview/core";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/**
 * AN AGENT IS OFFERED EVERY RELATION'S CONNECT AND DISCONNECT (Roadmap
 * f-relation-acts-derived): a relation no act makes or breaks is given
 * `connect-<kind>-<relation>` and `disconnect-<kind>-<relation>`, and the
 * agent's tools are the store's acts, so a seat that may make the kind the
 * relation leaves is offered both — with the store's titles, the relation's
 * words and its hints — and a seat that may not, neither.
 */
const day = defineNode("day", { fields: z.object({ label: z.string() }), plural: "Days" });
const moment = defineNode("moment", {
  fields: z.object({ label: z.string() }),
  plural: "Moments",
  edges: { takenOn: { to: ["day"], cardinality: "one", description: "the day it was taken", inverse: "moments that day" } },
});
const schema = createSchema([day, moment]);
const { defineMutation } = bindSchema(schema);
const addMoment = defineMutation("add-moment", {
  title: "Add a moment",
  description: "Keep a moment.",
  creates: ["moment"],
  input: z.object({ label: z.string() }),
  apply(ctx, args) {
    ctx.addNode({ id: ctx.freshId(args.label, "moment"), kind: "moment", label: args.label });
  },
});
const policy: Policy = { roles: ["writer", "reader"], grants: [{ roles: ["writer"], mutations: ["add-moment"] }] };
const app = { schema, mutations: [addMoment], policy };
const writer: Principal = { kind: "agent", roles: ["writer"] };
const reader: Principal = { kind: "agent", roles: ["reader"] };

describe("an agent's tools", () => {
  it("carry a relation's derived connect and disconnect for a seat that may make the kind it leaves", () => {
    const tools = toolDefinitions(app as never, writer).definitions;
    const connect = tools.find((tool) => tool.name === "connect-moment-taken-on");
    const disconnect = tools.find((tool) => tool.name === "disconnect-moment-taken-on");
    expect(connect).toMatchObject({ title: "Set the day", mutating: true, annotations: { idempotentHint: true } });
    expect(connect?.description).toContain("the day it was taken");
    expect(connect?.inputSchema).toMatchObject({ required: ["id", "to"] });
    expect(disconnect).toMatchObject({ title: "Clear the day", annotations: { destructiveHint: true } });
  });

  it("leave them out for a seat that may not", () => {
    const names = toolDefinitions(app as never, reader).definitions.map((tool) => tool.name);
    expect(names).not.toContain("connect-moment-taken-on");
    expect(names).not.toContain("disconnect-moment-taken-on");
  });

  it("are the runtime's, which links two records with no act the app wrote", async () => {
    const store = new Store({
      schema,
      mutations: [addMoment],
      policy,
      snapshot: { nodes: [{ id: "moment:pier", kind: "moment", label: "The pier" }, { id: "day:one", kind: "day", label: "Day one" }], edges: [] },
    });
    const runtime = createToolRuntime(store, { author: writer });
    expect(runtime.definitions.map((tool) => tool.name)).toContain("connect-moment-taken-on");
    await runtime.call("connect-moment-taken-on", { id: "moment:pier", to: "day:one" });
    expect(store.graph.out("moment:pier", "takenOn").map((node) => node.id)).toEqual(["day:one"]);
  });
});
