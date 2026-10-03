import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createSchema,
  defineInvariant,
  defineNode,
  evaluate,
  FRAMEWORK_VERSION,
  Graph,
  RuleBudgetError,
  type Violation,
} from "../../src/index.js";

/**
 * FR-29. A host records which framework folded a store, and tells a rule that
 * was broken from a rule that could not be judged — without matching text.
 */
describe("the framework says its own version", () => {
  it("as FRAMEWORK_VERSION, the version in core's package.json", () => {
    const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
    expect(FRAMEWORK_VERSION).toBe(version);
  });
});

const task = defineNode("task", { fields: z.object({ label: z.string() }), plural: "Tasks" });
const schema = createSchema([task]);
const graph = () => {
  const g = new Graph(schema);
  g.load({ nodes: [{ id: "t1", kind: "task", label: "Pay the deposit" }] as never, edges: [] });
  return g;
};
const broken = defineInvariant<typeof schema, "task">("never-holds", {
  label: "Never holds",
  scope: { kind: "task" },
  evaluate: ({ subject }) => [{ invariant: "never-holds", label: "Never holds", message: "It does not hold.", nodeIds: [subject.id], repairs: [] } satisfies Violation],
});
const throws = defineInvariant<typeof schema, "task">("throws", {
  label: "Reads a field that is not there",
  scope: { kind: "task" },
  evaluate: () => {
    throw new TypeError("Cannot read properties of undefined (reading 'due')");
  },
});
const tooMuch = defineInvariant<typeof schema>("too-much", {
  label: "Looks at everything",
  scope: "graph",
  evaluate: () => {
    throw new RuleBudgetError("this rule looks at too much of the graph");
  },
});

describe("rule failures are structured", () => {
  it("a rule that judges says violated", () => {
    const [violation] = evaluate(graph(), [broken]);
    expect(violation?.status).toBe("violated");
  });

  it("a rule that throws yields a violation with status could-not-judge, naming the rule and its subject, and the others still run", () => {
    const violations = evaluate(graph(), [throws, broken]);
    const unjudged = violations.find((one) => one.invariant === "throws");
    expect(unjudged?.status).toBe("could-not-judge");
    expect(unjudged?.subjectId).toBe("t1");
    expect(unjudged?.nodeIds).toEqual(["t1"]);
    expect(unjudged?.message).toMatch(/^Reads a field that is not there could not be judged/);
    expect(violations.find((one) => one.invariant === "never-holds")?.status).toBe("violated");
  });

  it("a rule over its budget says over-budget", () => {
    const [violation] = evaluate(graph(), [tooMuch]);
    expect(violation?.status).toBe("over-budget");
    expect(violation?.invariant).toBe("too-much");
  });
});
