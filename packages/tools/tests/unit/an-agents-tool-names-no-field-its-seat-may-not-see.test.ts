import { defineApp } from "@graview/core";
import { describe, expect, it } from "vitest";
import { createToolRuntime, toolDefinitions } from "../../src/index.js";
import { coach, MUTATIONS, parent, policy, schema, world } from "../../../core/tests/support/hidden-phones.js";

/**
 * AN AGENT'S TOOL NAMES NO FIELD ITS SEAT MAY NOT SEE (Roadmap
 * f-field-sight). A parent sees a contact's name and nothing else of it, so
 * the parent's tool for "Add a contact" takes a name and no phone: a
 * schema that listed `phone` would tell the seat the field is there, and
 * offer a write the store refuses. A field the seat sees on some records —
 * its own child's phone — stays in the tool, as a form offers it there.
 * The runtime and `toolDefinitions` say the same surface without a store,
 * and field sight need not be loaded to say it.
 */
const app = defineApp({ name: "roster", schema, mutations: MUTATIONS, policy, version: 1 });
const properties = (definitions: readonly { name: string; act?: string; inputSchema: Record<string, unknown> }[], act: string) =>
  Object.keys((definitions.find((tool) => tool.act === act)?.inputSchema["properties"] ?? {}) as Record<string, unknown>);

describe("an agent's tool, for a seat whose sight keeps a field", () => {
  it("leaves out the argument that writes a field the seat is never shown", () => {
    const { definitions } = createToolRuntime(world("555 0101"), { author: parent });
    expect(properties(definitions, "add-contact")).toContain("name");
    expect(properties(definitions, "add-contact")).not.toContain("phone");
    expect(JSON.stringify(definitions.find((tool) => tool.act === "add-contact"))).not.toContain("phone");
  });

  it("keeps an argument the seat is shown on some records, and every argument for a seat that sees them all", () => {
    const { definitions } = createToolRuntime(world("555 0101"), { author: parent });
    expect(properties(definitions, "set-phone")).toContain("phone");
    expect(properties(definitions, "add-player")).toContain("phone");
    expect(properties(createToolRuntime(world("555 0101"), { author: coach }).definitions, "add-contact")).toContain("phone");
  });

  it("is the surface toolDefinitions says from the declaration alone", () => {
    const runtime = createToolRuntime(world("555 0101"), { author: parent });
    const declared = toolDefinitions(app, parent);
    expect(properties(declared.definitions, "add-contact")).not.toContain("phone");
    expect(declared.hash).toBe(runtime.hash);
  });
});
