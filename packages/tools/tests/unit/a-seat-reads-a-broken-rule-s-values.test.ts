import { Store, type AnySchema, type GraviewApp, type Violation } from "@graview/core";
import { compileDocument } from "@graview/core/check";
import { describe, expect, it } from "vitest";
import { createToolRuntime } from "../../src/index.js";

/**
 * A SEAT READS A BROKEN RULE'S VALUES (FR-159).
 *
 * 0.1.20 drew a rule's shape on the framework's own surfaces, and authors
 * shortened their titles to let it speak. A connector's chat is handed a
 * problem's message, and read "A wedding planner on Small: Margin above
 * target" with no values. The seat's tools fetch the words before their
 * first answer, so a judgment says what it found in the message a model
 * reads, and the parts a page draws the line with stay off the answer.
 */
const DOCUMENT = {
  format: "graview-document",
  formatVersion: 1,
  name: "Pricing",
  kinds: {
    scenario: {
      fields: { name: { type: "string" }, margin: { type: "number", format: "percent" }, target: { type: "number", format: "percent" } },
      label: "{name}",
    },
  },
  rules: {
    "margin-above-target": { title: "Margin above target", over: "scenario", require: "margin >= target" },
  },
};

const SEED = {
  nodes: [
    { id: "s1", kind: "scenario", name: "A wedding planner on Small", margin: 0.31, target: 0.4 },
  ],
  edges: [],
};

function opened() {
  const result = compileDocument(DOCUMENT, { today: () => "2026-10-10" });
  if (!result.ok) throw new Error(JSON.stringify(result.findings.filter((finding) => finding.severity === "error")));
  const app = result.app as GraviewApp<AnySchema>;
  return new Store<AnySchema>({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], snapshot: structuredClone(SEED) as never });
}

describe("a seat reads a broken rule's values", () => {
  it("in the message get_violations answers, though the rule wrote only a title", async () => {
    const store = opened();
    const tools = createToolRuntime(store);
    const result = await tools.call("get_violations", {});
    expect(result.ok).toBe(true);
    const [violation] = (result as { data: Violation[] }).data;
    expect(violation!.message).toBe("A wedding planner on Small: Margin above target — margin 31% < target 40%");
    // A model reads words: the parts a page draws the line with stay off the answer.
    expect(violation).not.toHaveProperty("line");
  });

  it("in the violations get_node answers about the record", async () => {
    const store = opened();
    const result = await createToolRuntime(store).call("get_node", { id: "s1" });
    const { violations } = (result as { data: { violations: Violation[] } }).data;
    expect(violations.map((violation) => violation.message)).toEqual(["A wedding planner on Small: Margin above target — margin 31% < target 40%"]);
  });

  it("and in the store's own judgments after, for a host that reads store.violations()", async () => {
    const store = opened();
    await createToolRuntime(store).call("get_violations", {});
    const [violation] = store.violations();
    expect(violation!.line?.text).toBe("margin 31% < target 40%");
    expect(violation!.message).toContain("margin 31% < target 40%");
  });
});
