import { describe, expect, it } from "vitest";
import { compileDocument } from "../../src/check.js";
import { Store, type AnySchema, type GraviewApp } from "../../src/index.js";

/**
 * A PROPOSAL TO ADD A RECORD NAMES IT BY ITS LABEL, THEN THE REST (FR-169).
 * On Graview Cloud's staging, "add a new revenue stream for Graview Cloud
 * SaaS" was offered as "Add a revenue stream: nascent": the line took the
 * first string it was handed, the person read "nascent" as the title, and
 * the model agreed. A creating act's line names the new record by its
 * kind's label, then what else it was given, in parentheses, in the
 * declaration's own words.
 */
const CLOUD = {
  format: "graview-document",
  formatVersion: 1,
  name: "Graview Cloud",
  kinds: {
    "revenue-stream": {
      noun: "revenue stream",
      fields: {
        maturity: { type: "enum", options: ["nascent", "growing", "mature"] },
        name: { type: "string", required: true },
        price: { type: "number", format: "money" },
        hosted: { type: "boolean", label: "Hosted by us" },
        notes: { type: "text" },
      },
    },
    plan: {
      label: "{name} ({tier})",
      fields: { name: { type: "string", required: true }, tier: { type: "enum", options: ["free", "team"] }, seats: { type: "integer" } },
    },
  },
  acts: {
    // The act the studio derives for a new kind: `creates`, every field asked.
    "add-revenue-stream": { title: "Add a revenue stream", creates: "revenue-stream" },
    // The same, said as effects, its arguments in another order.
    "open-revenue-stream": {
      title: "Open a revenue stream",
      args: { stage: { type: "enum", options: ["nascent", "growing", "mature"] }, called: { type: "string", required: true } },
      effects: [{ create: "revenue-stream", set: { maturity: "$stage", name: "$called" } }],
    },
    "add-plan": { title: "Add a plan", creates: "plan" },
  },
  brand: { currency: "USD" },
};

describe("a proposal to add a record", () => {
  const compiled = compileDocument(CLOUD);
  if (!compiled.ok) throw new Error(`the document compiles: ${JSON.stringify(compiled.findings.filter((f) => f.severity === "error"))}`);
  const app = compiled.app as GraviewApp<AnySchema>;
  const store = new Store<AnySchema>({ schema: app.schema, mutations: (app.mutations ?? []) as never, snapshot: { nodes: [], edges: [] } });
  const said = (name: string, input: Record<string, unknown>) => app.mutations!.find((m) => m.name === name)!.describe!(input as never, store.graph as never);

  it("names it by its label, then the rest: the act derived for a kind", () => {
    expect(said("add-revenue-stream", { maturity: "nascent", name: "Graview Cloud SaaS" })).toBe("Add a revenue stream: Graview Cloud SaaS (nascent)");
  });

  it("names it by its label, then the rest: an act that says its effects, whatever its arguments are called", () => {
    expect(said("open-revenue-stream", { stage: "nascent", called: "Graview Cloud SaaS" })).toBe("Open a revenue stream: Graview Cloud SaaS (nascent)");
  });

  it("says each of the rest as a record would: money as money, a yes by the field's words, and never a long text", () => {
    expect(
      said("add-revenue-stream", {
        name: "Graview Cloud SaaS",
        maturity: "growing",
        price: 49,
        hosted: true,
        notes: "Billed monthly per workspace, with a free tier for anybody trying it out first",
      }),
    ).toBe("Add a revenue stream: Graview Cloud SaaS (growing, $49, Hosted by us)");
    expect(said("add-revenue-stream", { name: "Graview Cloud SaaS", hosted: false })).toBe("Add a revenue stream: Graview Cloud SaaS");
  });

  it("does not say again what its label already says", () => {
    expect(said("add-plan", { name: "Team", tier: "team", seats: 5 })).toBe("Add a plan: Team (team) (5)");
  });

  it("is the line the log keeps once it is applied", () => {
    const op = store.apply({ name: "add-revenue-stream", args: { maturity: "nascent", name: "Graview Cloud SaaS" } }).ops[0]!;
    expect(op.intent).toBe("Add a revenue stream: Graview Cloud SaaS (nascent)");
  });
});
