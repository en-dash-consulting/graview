import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A CREATING ACT IS LOGGED BY WHAT IT MADE. The line the log keeps for a
 * document act with no subject took the first string argument the caller
 * sent, so the Graview Roadmap's history said "Add a feature: framework"
 * for a feature whose layer happened to come first. It now names the
 * record the act creates, by that kind's own label.
 */
const ROADMAP = {
  format: "graview-document",
  formatVersion: 1,
  name: "Roadmap",
  kinds: {
    feature: {
      label: "{name}",
      fields: { name: { type: "string", required: true }, layer: { type: "enum", options: ["framework", "cloud"] } },
    },
  },
  acts: {
    "add-feature": {
      title: "Add a feature",
      args: { layer: { type: "enum", options: ["framework", "cloud"] }, name: { type: "string", required: true } },
      effects: [{ create: "feature", set: { layer: "$layer", name: "$name" } }],
    },
  },
};

describe("a creating act's line in the log", () => {
  const compiled = compileDocument(ROADMAP);
  if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: { nodes: [], edges: [] } });
  const said = (name: string, input: Record<string, unknown>) => app.mutations!.find((m) => m.name === name)!.describe!(input as never, store.graph as never);

  it("names the record it made, whatever order the arguments came in", () => {
    expect(said("add-feature", { layer: "framework", name: "A sight can reach what links to you" })).toBe("Add a feature: A sight can reach what links to you");
  });
});
