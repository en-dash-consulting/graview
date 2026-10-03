import { describe, expect, it } from "vitest";
import { createSchema, defineNode, Graph, Store, z } from "../../src/index.js";
import {
  compileDocument,
  evaluateExpr,
  ExprEvalError,
  ExprSyntaxError,
  FUNCTIONS,
  parseExpr,
  printExpr,
  type KindShape,
} from "../../src/document/index.js";

/**
 * FR-07. The rule language is total: every production and function says what
 * it does with nothing (`null`), any expression at all ends inside its budget,
 * and a rule that would read too much is a finding about that rule — never a
 * hang.
 */
const schema = createSchema([
  defineNode("task", { fields: z.object({ title: z.string(), hours: z.number().optional(), due: z.string().optional(), tags: z.array(z.string()).optional() }), edges: { for: { to: ["project"], cardinality: "one" } } }),
  defineNode("project", { fields: z.object({ name: z.string() }) }),
] as const);
const kinds = new Map<string, KindShape>([
  ["task", { fields: new Set(["title", "hours", "due", "tags"]), edges: new Map([["for", "one"]]) }],
  ["project", { fields: new Set(["name"]), edges: new Map() }],
]);
const graph = Graph.from(schema as never, {
  nodes: [
    { id: "p", kind: "project", name: "Kitchen" },
    // A task with nothing set: every field read from it is null.
    { id: "n", kind: "task", title: "Nothing yet" },
    ...Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, kind: "task", title: `Task ${i}`, hours: i % 7, due: `2026-10-${String((i % 28) + 1).padStart(2, "0")}` })),
  ],
  edges: Array.from({ length: 40 }, (_, i) => ({ kind: "for", from: `t${i}`, to: "p" })),
} as never);
const on = (source: string, subject = "n", budget?: number) =>
  evaluateExpr(parseExpr(source), { graph: graph as never, subject: graph.getNode(subject)!, kinds, today: "2026-10-02", now: "2026-10-02T12:00:00Z", ...(budget ? { budget } : {}) });

describe("null propagates, and every production says what it does with it", () => {
  it.each([
    // arithmetic and the sign carry nothing through
    ["hours + 1", null], ["hours - 1", null], ["hours * 2", null], ["hours / 2", null], ["hours % 2", null], ["-hours", null],
    // a word added to nothing is nothing
    ["due + 'x'", null],
    // division by zero is nothing, not Infinity
    ["4 / 0", null], ["4 % 0", null],
    // comparisons with nothing are false; equality treats nothing as itself
    ["hours < 1", false], ["hours <= 1", false], ["hours > 1", false], ["hours >= 1", false],
    ["hours == null", true], ["hours != null", false], ["null == null", true],
    // logic reads nothing as false
    ["hours and true", false], ["hours or true", true], ["not hours", true],
    // membership in nothing is false; nothing is in a list only beside another nothing
    ["'a' in tags", false], ["hours in [1, 2]", false], ["hours in [null]", true],
    // a hop through nothing is nothing
    ["for.name", null], ["for", null],
    // a list literal keeps its nothings
    ["len([hours, 1])", 2],
  ])("%s → %j", (source, expected) => {
    expect(on(source)).toEqual(expected);
  });

  it.each([
    ["count(out('for'))", 0], ["exists(out('for'))", false], ["every(out('for'), name == 'x')", true], ["some(out('for'), name == 'x')", false],
    ["count(in('for'))", 0], ["count(all('project'))", 1],
    ["sum(all('task') where hours == null, 'hours')", 0], ["min(all('task') where hours == null, 'hours')", null], ["max(all('task') where hours == null, 'hours')", null],
    ["present(hours)", false], ["present(due)", false], ["len(due)", 0],
    ["contains(due, 'x')", false], ["contains('x', due)", false], ["startsWith(due, 'x')", false], ["startsWith('x', due)", false],
    ["lower(due)", null], ["date(due)", null], ["days(due, today())", null], ["hours(due, now())", null],
    ["if(hours, 1, 2)", 2], ["today()", "2026-10-02"], ["now()", "2026-10-02T12:00:00Z"],
  ])("%s → %j", (source, expected) => {
    expect(on(source)).toEqual(expected);
  });

  it("names every function the language knows, and a test above reaches each with nothing", () => {
    expect([...FUNCTIONS].sort()).toEqual(["all", "contains", "count", "date", "days", "every", "exists", "hours", "if", "in", "len", "lower", "max", "min", "now", "out", "present", "some", "startsWith", "sum", "today"]);
  });
});

/* A deterministic generator, so a failure names the seed that made it. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const LEAVES = ["hours", "due", "title", "tags", "for", "for.name", "1", "0", "-3", "'Kitchen'", "''", "true", "false", "null", "today()", "now()", "[1, 2]", "[]"];
const SETS = ["all('task')", "all('project')", "out('for')", "in('for')"];
function expression(next: () => number, depth: number): string {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)]!;
  if (depth <= 0 || next() < 0.2) return pick(LEAVES);
  const sub = () => expression(next, depth - 1);
  const set = (): string => (next() < 0.4 ? `(${pick(SETS)} where ${sub()})` : next() < 0.15 && depth > 2 ? `(all('task') where count(all('task') where ${sub()}) > 0)` : pick(SETS));
  switch (Math.floor(next() * 9)) {
    case 0: return `(${sub()} ${pick(["+", "-", "*", "/", "%"])} ${sub()})`;
    case 1: return `(${sub()} ${pick(["==", "!=", "<", "<=", ">", ">=", "in"])} ${sub()})`;
    case 2: return `(${sub()} ${pick(["and", "or"])} ${sub()})`;
    case 3: return `${pick(["not ", "-"])}${sub()}`;
    case 4: return `${pick(["count", "exists"])}(${set()})`;
    case 5: return `${pick(["every", "some"])}(${set()}, ${sub()})`;
    case 6: return `${pick(["sum", "min", "max"])}(${set()}, 'hours')`;
    case 7: return `${pick(["present", "len", "lower", "date"])}(${sub()})`;
    default: return `${pick(["contains", "startsWith", "days", "hours"])}(${sub()}, ${sub()})`;
  }
}

describe("any expression ends", () => {
  it("10,000 random expressions each parse and evaluate to a value or a sentence, within the budget", () => {
    const next = random(20261002);
    let budgeted = 0;
    let judged = 0;
    const started = Date.now();
    for (let i = 0; i < 10_000; i++) {
      const source = expression(next, 6);
      const subject = next() < 0.5 ? "n" : `t${Math.floor(next() * 40)}`;
      try {
        on(source, subject, 2_000);
        judged++;
      } catch (error) {
        // Only ever a sentence: a syntax error, a type mistake, or the budget — never a crash or a hang.
        if (!(error instanceof ExprSyntaxError || error instanceof ExprEvalError)) throw new Error(`seed 20261002 #${i}: ${source} threw ${String(error)}`);
        if (/too much of the graph/.test(String(error))) budgeted++;
      }
    }
    expect(judged).toBeGreaterThan(1000);
    expect(budgeted).toBeGreaterThan(0);
    // Each evaluation is bounded by its budget, so the whole sweep is quick.
    expect(Date.now() - started).toBeLessThan(30_000);
  });

  it("prints any expression it parses back to one that means the same", () => {
    const next = random(7);
    for (let i = 0; i < 2_000; i++) {
      const source = expression(next, 5);
      const printed = printExpr(parseExpr(source));
      expect(printExpr(parseExpr(printed)), source).toBe(printed);
    }
  });
});

describe("a rule that reads too much is a finding about it, never a hang", () => {
  const doc = {
    format: "graview-document",
    formatVersion: 1,
    name: "Chores",
    kinds: {
      chore: { fields: { title: { type: "string", required: true }, hours: { type: "number" } } },
    },
    rules: {
      "no-twins": { title: "No two chores share a title", over: "chore", require: "count(all('chore') where title == title) <= count(all('chore'))" },
    },
  };

  it("compiles with a warning that the rule sweeps every chore for every chore", () => {
    const compiled = compileDocument(doc);
    expect(compiled.ok).toBe(true);
    expect(compiled.findings.map((f) => f.code)).toContain("rule-cost");
  });

  it("over a big enough graph, each subject's violation says over-budget and names the rule", () => {
    const compiled = compileDocument(doc);
    if (!compiled.ok) throw new Error("did not compile");
    const store = new Store({
      schema: compiled.app.schema,
      mutations: compiled.app.mutations ?? [],
      invariants: compiled.app.invariants ?? [],
      snapshot: { nodes: Array.from({ length: 4000 }, (_, i) => ({ id: `c${i}`, kind: "chore", title: `Chore ${i % 10}` })) as never, edges: [] },
    });
    const violations = store.violations();
    expect(violations.length).toBeGreaterThan(0);
    for (const violation of violations) {
      expect(violation.status).toBe("over-budget");
      expect(violation.invariant).toBe("no-twins");
      expect(violation.message).toMatch(/^No two chores share a title could not be judged: this rule looks at too much/);
    }
  });
});

describe("the document path never evaluates a string as code", () => {
  it("no eval, no Function, no dynamic import in @graview/core/document", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = new URL("../../src/document/", import.meta.url).pathname;
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith(".ts")) files.push(path);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(|\bimport\s*\(/);
    }
  });
});
