import { BIND_PERSON, createSchema, defineApp, defineNode, Store, z, type AnySchema } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";

/**
 * A TOOL LIST KEEPS TO NAMES THE FRAMEWORK KEEPS. An app's act under a name
 * the framework keeps for an act of its own is never offered as a tool, and
 * the list worked out without a store says the same as the runtime's.
 */
const participant = defineNode("participant", { people: true, label: (n: any) => n.name, fields: z.object({ name: z.string() }) } as never);
const schema = createSchema([participant]);
const declared = { name: BIND_PERSON, title: "Mine", input: z.object({}), apply: () => [] };
const app = defineApp({ name: "reserved", schema, mutations: [declared] as never });

describe("a tool list", () => {
  it("offers no declared act under a name the framework keeps, as the runtime does", () => {
    const listed = toolDefinitions(app as never);
    expect(listed.definitions.map((one) => one.name).filter((name) => /^bind[-_]person$/i.test(name))).toEqual([]);
    const runtime = createToolRuntime(new Store<AnySchema>({ schema, mutations: [declared] as never, snapshot: { nodes: [], edges: [] } } as never));
    expect(listed.hash).toBe(runtime.hash);
  });
});
