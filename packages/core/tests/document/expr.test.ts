import { Graph, createSchema, defineNode, z } from "../../src/index.js";
import { describe, expect, it } from "vitest";
import { ExprBudgetError, ExprEvalError, ExprSyntaxError, NodeSet, evaluateExpr, parseExpr, type KindShape } from "../../src/document/index.js";

const schema = createSchema([
  defineNode("task", { fields: z.object({ title: z.string(), done: z.boolean().optional(), hours: z.number().optional(), due: z.string().optional(), tags: z.array(z.string()).optional() }), edges: { for: { to: ["project"], cardinality: "one" } } }),
  defineNode("project", { fields: z.object({ name: z.string(), budget: z.number().optional() }) }),
] as const);

function world() {
  const graph = Graph.from(schema as never, {
    nodes: [
      { id: "p", kind: "project", name: "Kitchen", budget: 10 },
      { id: "a", kind: "task", title: "Tiles", done: true, hours: 4, due: "2026-10-01", tags: ["buy"] },
      { id: "b", kind: "task", title: "Paint", done: false, hours: 3, due: "2026-10-09" },
      { id: "c", kind: "task", title: "Lights", hours: 5 },
    ],
    edges: ["a", "b", "c"].map((id) => ({ kind: "for", from: id, to: "p" })),
  } as never);
  const kinds = new Map<string, KindShape>([
    ["task", { fields: new Set(["title", "done", "hours", "due", "tags"]), edges: new Map([["for", "one"]]) }],
    ["project", { fields: new Set(["name", "budget"]), edges: new Map() }],
  ]);
  return { graph, kinds };
}

const at = (source: string, subjectId: string | null = "a", budget?: number) => {
  const { graph, kinds } = world();
  return evaluateExpr(parseExpr(source), { graph: graph as never, subject: subjectId ? graph.getNode(subjectId)! : null, kinds, today: "2026-10-02", now: "2026-10-02T12:00:00Z", ...(budget ? { budget } : {}) });
};

describe("the rule language", () => {
  it.each([
    ["1 + 2 * 3", 7],
    ["(1 + 2) * 3", 9],
    ["10 % 4", 2],
    ["-hours", -4],
    ["'a' + 'b'", "ab"],
    ["title == 'Tiles'", true],
    ["done and hours > 3", true],
    ["not done or hours < 1", false],
    ["!done", false],
    ["hours >= 4 && hours <= 4", true],
    ["'buy' in tags", true],
    ["2 in [1, 2, 3]", true],
    ["for.name", "Kitchen"],
    ["for.budget - 3", 7],
    ["count(in('for'))", 0],
    ["missing == null", "error"],
  ])("%s", (source, expected) => {
    if (expected === "error") expect(() => at(source)).toThrow(ExprEvalError);
    else expect(at(source)).toEqual(expected);
  });

  it("sets: out, in, all, where, count, exists, every, some, sum, min, max", () => {
    expect(at("count(in('for'))", "p")).toBe(3);
    expect(at("count(in('for') where done == true)", "p")).toBe(1);
    expect(at("exists(in('for') where hours > 4)", "p")).toBe(true);
    expect(at("every(in('for'), present(hours))", "p")).toBe(true);
    expect(at("some(in('for'), title == 'Paint')", "p")).toBe(true);
    expect(at("sum(in('for'), 'hours')", "p")).toBe(12);
    expect(at("min(in('for'), 'hours')", "p")).toBe(3);
    expect(at("max(all('task'), 'hours')", null)).toBe(5);
    expect(at("sum(in('for') where not present(done), 'hours') <= budget", "p")).toBe(true);
    expect(at("count(out('for'))", "a")).toBe(1);
    expect(at("all('task') where done == false", null)).toBeInstanceOf(NodeSet);
  });

  it("nothing propagates through arithmetic and is never true", () => {
    expect(at("hours + 1", "c")).toBe(6);
    expect(at("done", "c")).toBeNull();
    expect(at("done == null", "c")).toBe(true);
    expect(at("due < '2026-12-01'", "c")).toBe(false);
    expect(at("min(all('project') where name == 'Nope', 'budget')", null)).toBeNull();
    expect(at("hours / 0")).toBeNull();
  });

  it("words and dates", () => {
    expect(at("len(title)")).toBe(5);
    expect(at("contains(title, 'til')")).toBe(true);
    expect(at("startsWith(title, 'Ti')")).toBe(true);
    expect(at("lower(title)")).toBe("tiles");
    expect(at("today()")).toBe("2026-10-02");
    expect(at("days(today(), due)", "b")).toBe(7);
    expect(at("due < today()")).toBe(true);
    expect(at("hours(now(), '2026-10-02T15:00:00Z')")).toBe(3);
    expect(at("date('2026-10-02T23:00:00Z')")).toBe("2026-10-02");
    expect(at("if(done, 'yes', 'no')")).toBe("yes");
  });

  it("type mistakes are sentences", () => {
    expect(() => at("title * 2")).toThrow(/needs numbers/);
    expect(() => at("count(title)")).toThrow(/needs a set of records/);
    expect(() => at("hours and done")).toThrow(/must be true or false/);
    expect(() => at("nope()")).toThrow(/not a function the rule language knows/);
    expect(() => at("title", null)).toThrow(/means nothing in a rule over the whole graph/);
  });

  it("syntax errors carry a place", () => {
    for (const bad of ["1 +", "(1", "a ==== b", "'open", "a @ b", "[1, 2", "f(1,"]) {
      try {
        parseExpr(bad);
        throw new Error(`parsed: ${bad}`);
      } catch (e) {
        expect(e).toBeInstanceOf(ExprSyntaxError);
        expect((e as ExprSyntaxError).at).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("deep nesting is refused, not a stack overflow", () => {
    expect(() => parseExpr("(".repeat(200) + "1" + ")".repeat(200))).toThrow(/nests too deeply/);
    expect(() => parseExpr("!".repeat(200) + "true")).toThrow(/nests too deeply/);
  });

  it("an evaluation that would look at too much stops at its budget", () => {
    expect(() => at("count(all('task') where count(all('task') where count(all('task')) > 0) > 0)", null, 20)).toThrow(ExprBudgetError);
  });

  it("10,000 random expressions all terminate inside the budget", () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    const atoms = ["1", "0", "-3", "'x'", "true", "null", "title", "hours", "done", "for", "for.name", "today()", "[1,2]", "in('for')", "all('task')", "out('for')"];
    const unary = ["!", "-", "not "];
    const binary = [" + ", " - ", " * ", " / ", " == ", " != ", " < ", " and ", " or ", " in ", " where "];
    const fns = ["count", "exists", "present", "len", "lower", "date", "sum", "every", "some", "if"];
    const gen = (depth: number): string => {
      const r = rand(depth > 4 ? 1 : 5);
      if (r === 0) return atoms[rand(atoms.length)]!;
      if (r === 1) return unary[rand(unary.length)]! + gen(depth + 1);
      if (r === 2) return `(${gen(depth + 1)}${binary[rand(binary.length)]!}${gen(depth + 1)})`;
      const fn = fns[rand(fns.length)]!;
      const n = fn === "if" ? 3 : fn === "sum" || fn === "every" || fn === "some" ? 2 : 1;
      return `${fn}(${Array.from({ length: n }, () => gen(depth + 1)).join(", ")})`;
    };
    const { graph, kinds } = world();
    for (let i = 0; i < 10_000; i++) {
      const source = gen(0);
      let expr;
      try {
        expr = parseExpr(source);
      } catch (e) {
        expect(e).toBeInstanceOf(ExprSyntaxError);
        continue;
      }
      try {
        evaluateExpr(expr, { graph: graph as never, subject: graph.getNode(["a", "b", "c", "p"][i % 4]!)!, kinds, budget: 2000, today: "2026-10-02" });
      } catch (e) {
        expect(e).toBeInstanceOf(ExprEvalError);
      }
    }
  });
});

describe("forgiving where it costs nothing", () => {
  it("sum, min and max take the field quoted or bare", () => {
    expect(at("sum(in('for'), hours)", "p")).toBe(12);
    expect(at("max(in('for'), hours)", "p")).toBe(5);
  });
});
