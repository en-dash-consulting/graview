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

  /*
   * AS THE ACT SETS IT (the review before 0.1.27): the record's label is
   * read off what the act would write, so a field left to its default, a
   * literal "$$" that writes one "$", and a value worked out by an
   * expression each say what the record will be called, never "—".
   */
  const SET = {
    format: "graview-document",
    formatVersion: 1,
    name: "Funds",
    kinds: {
      fund: {
        label: "{title} ({stage})",
        fields: { title: { type: "string", required: true }, stage: { type: "enum", options: ["idea", "open"], default: "idea" } },
      },
    },
    acts: {
      "add-fund": { title: "Add a fund", args: { title: { type: "string", required: true } }, effects: [{ create: "fund", set: { title: "$title" } }] },
      "add-five": { title: "Add the five", effects: [{ create: "fund", set: { title: "$$5 fund" } }] },
      "add-named": { title: "Add a named fund", args: { base: { type: "string", required: true } }, effects: [{ create: "fund", set: { title: { expr: "base + ' fund'" } } }] },
    },
  };
  const set = compileDocument(SET);
  if (!set.ok) throw new Error(`the document compiles: ${JSON.stringify(set.findings.filter((f) => f.severity === "error"))}`);
  const funds = set.app as GraviewApp<AnySchema>;
  const fundStore = new Store<AnySchema>({ schema: funds.schema, mutations: (funds.mutations ?? []) as never, snapshot: { nodes: [], edges: [] } });
  const logged = (name: string, args: Record<string, unknown>) => fundStore.apply({ name, args }).ops[0]!.intent;

  it("says a field the act leaves to its default by the default", () => {
    expect(logged("add-fund", { title: "Rainy day" })).toBe("Add a fund: Rainy day (idea)");
  });

  it("says a literal $$ as the one $ it writes", () => {
    expect(logged("add-five", {})).toBe("Add the five: $5 fund (idea)");
  });

  it("says a value worked out by an expression as worked out", () => {
    expect(logged("add-named", { base: "Holiday" })).toBe("Add a named fund: Holiday fund (idea)");
  });
});
