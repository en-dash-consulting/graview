import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Store, type AnyGraphNode, type AnySchema, type GraviewApp, type GraphReader, type Principal } from "../../src/index.js";
import {
  compileBlocks,
  compileDocument,
  editDocument,
  evaluateExpr,
  ExprBudgetError,
  fieldSpecsOf,
  NodeSet,
  parseExpr,
  parseTemplate,
  printExpr,
  resolveBlocks,
  shapesOfSchema,
  type CompiledDocument,
} from "../../src/document/index.js";

/**
 * FR-101. A WALK FROM EVERY MEMBER OF A SET. `out(S, 'edge')` and
 * `in(S, 'edge')` walk a relation from each record of a set and give the
 * records they reach once each, in the order first reached; `out('edge')`
 * still walks from the record itself. Sets meet with `&`, join with `|` and
 * part with `-`. With them, LifeLogics' coverage meter — package → includes
 * → offers → answers → what the client needs — is one declared figure:
 *
 *   count(out(out('includes'), 'answers') & out(first(all('party') where role == 'client'), 'needs'))
 *
 * read from the graph a seat may see, so a hidden offer answers nothing and
 * a hidden need is not counted; and still costed: a walk is as dear as the
 * set it walks from, and a walk read under a budget stops inside it.
 */
const fixtures = new URL("./fixtures/", import.meta.url);
const lifelogics = JSON.parse(readFileSync(new URL("lifelogics.gdd.json", fixtures), "utf8"));
const seed = JSON.parse(readFileSync(new URL("lifelogics.seed.json", fixtures), "utf8"));

function compiled(document: unknown = lifelogics): CompiledDocument {
  const result = compileDocument(document, { today: () => "2026-10-05" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings.filter((f) => f.severity === "error"), null, 2)}`);
  return result;
}
const storeOf = (app: GraviewApp, snapshot: unknown = seed) => new Store<AnySchema>({ schema: app.schema as AnySchema, mutations: app.mutations ?? [], policy: app.policy!, snapshot: snapshot as never });

const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };

function on(source: string, subject: string | null, options: { readonly principal?: Principal; readonly document?: unknown; readonly budget?: number } = {}) {
  const { app, kinds } = compiled(options.document);
  const graph = storeOf(app).seenBy(options.principal ?? owner).graph as unknown as GraphReader;
  return evaluateExpr(parseExpr(source), { graph, subject: subject ? (graph.getNode(subject) as AnyGraphNode) : null, kinds, today: "2026-10-05", ...(options.budget ? { budget: options.budget } : {}) });
}
const ids = (value: unknown) => (value as NodeSet).nodes.map((node) => node.id);

const COVERAGE = "count(out(out('includes'), 'answers') & out(first(all('party') where role == 'client'), 'needs'))";

describe("out() and in() walk from every member of a set", () => {
  it("out(S, 'answers') gives each record reached once, in the order first reached", () => {
    expect(ids(on("out(out('includes'), 'answers')", "pkg-whole"))).toEqual(["note-ai", "note-pilot", "note-slow", "note-tests"]);
  });

  it("in(S, 'answers') walks back from every member", () => {
    expect(ids(on("in(all('signal') where type == 'pain', 'answers')", null))).toEqual(["offer-analysis", "offer-suite"]);
  });

  it("out('includes') from the record itself walks as it always has", () => {
    expect(ids(on("out('includes')", "pkg-start"))).toEqual(["offer-workshop", "offer-analysis"]);
  });

  it("walks from one record, or from nothing, as from a set of one or of none", () => {
    expect(ids(on("out(first(all('party') where role == 'client'), 'needs')", null))).toHaveLength(5);
    expect(ids(on("out(first(all('party') where role == 'nobody'), 'needs')", null))).toEqual([]);
  });

  it("refuses a walk from a value that is not records, in words", () => {
    expect(() => on("out(3, 'answers')", null)).toThrow(/needs a set of records/);
  });
});

describe("sets meet, join and part", () => {
  it("& keeps what is in both, | what is in either once, - what is in the first and not the second", () => {
    expect(ids(on("out('answers') & out(first(all('party') where role == 'client'), 'needs')", "offer-workshop"))).toEqual(["note-ai", "note-pilot"]);
    expect(ids(on("out(all('offer') where stage == 'start', 'serves') | out(all('offer'), 'serves')", null))).toEqual(["people-eng", "people-lead"]);
    expect(ids(on("all('signal') - out(first(all('party') where role == 'client'), 'needs')", null))).toEqual(["note-size"]);
  });

  it("- between numbers still subtracts, and & and | are not and and or", () => {
    expect(on("10 - 4", null)).toBe(6);
    expect(() => on("true & false", null)).toThrow(/needs a set of records/);
  });

  it("prints back to the same tree, and binds tighter than a comparison", () => {
    for (const source of ["count(a & b | c - d) > 2", "(a | b) & c", "a - (b - c)", "count(out(out('includes'), 'answers')) == 4"]) {
      const tree = parseExpr(source);
      expect(parseExpr(printExpr(tree))).toEqual(tree);
    }
    expect(printExpr(parseExpr("count(a | b) > 1"))).toBe("count(a | b) > 1");
  });

  it("a | inside a template's brackets is a join, not the formatter's bar", () => {
    const [part] = parseTemplate("{count(out('answers') | out('serves'))}");
    expect(part!.format).toBeUndefined();
    expect(printExpr(part!.expr!)).toBe("count(out('answers') | out('serves'))");
    const [formatted] = parseTemplate("{count(out('answers') | out('serves')) | words}");
    expect(formatted!.format).toBe("words");
  });
});

describe("LifeLogics' coverage meter is one declared figure", () => {
  const card = lifelogics.views.package.card as readonly Record<string, unknown>[];
  const meter = card.find((block) => block["figure"] === COVERAGE);

  function drawn(principal: Principal, id: string, document: unknown = lifelogics) {
    const { app, kinds } = compiled(document);
    const seen = storeOf(app).seenBy(principal);
    const schema = seen.schema as AnySchema;
    const graph = seen.graph as unknown as GraphReader;
    const node = graph.getNode(id) as AnyGraphNode;
    return resolveBlocks(compileBlocks([meter]), { node, graph, schema, kinds: kinds ?? shapesOfSchema(schema), fields: fieldSpecsOf(schema, "package"), today: "2026-10-05" })[0];
  }

  it("is declared on the package's card as one expression", () => {
    expect(meter).toBeDefined();
  });

  it("says, for each package, how many of the client's needs its offers answer, counted once each", () => {
    expect(drawn(owner, "pkg-start")).toEqual({ t: "number", text: "3", label: "of the 5 things they need, answered" });
    expect(drawn(owner, "pkg-whole")).toEqual({ t: "number", text: "4", label: "of the 5 things they need, answered" });
    expect(drawn(owner, "pkg-later")).toEqual({ t: "number", text: "0", label: "of the 5 things they need, answered" });
  });

  /*
   * A SEAT THAT SEES LESS. This partner sees the parties and the packages,
   * the offers aimed at them (an `own` sight: the workshop and the suite)
   * and the notes about them (the slow releases): every step of the walk is
   * taken in the graph the seat is served.
   */
  const narrowed = structuredClone(lifelogics);
  narrowed.policy.sees = [
    { roles: ["owner"], kinds: ["party", "stakeholder", "signal", "offer", "package", "question"] },
    { roles: ["partner"], kinds: ["party", "stakeholder", "package", "question"] },
    { roles: ["partner"], kinds: ["offer", "signal"], own: true },
  ];
  const engineers: Principal = { kind: "human", id: "people-eng", roles: ["partner"] };

  it("a hidden offer answers nothing for a seat that cannot see it, and a hidden need is not counted", () => {
    expect(ids(on("out('includes')", "pkg-whole", { principal: engineers, document: narrowed }))).toEqual(["offer-workshop", "offer-suite"]);
    // The workshop's answers and the suite's flaky tests are notes this seat may not see: only the slow releases are reached.
    expect(ids(on("out(out('includes'), 'answers')", "pkg-whole", { principal: engineers, document: narrowed }))).toEqual(["note-slow"]);
    expect(on("count(out(first(all('party') where role == 'client'), 'needs'))", null, { principal: engineers, document: narrowed })).toBe(1);
    expect(drawn(engineers, "pkg-whole", narrowed)).toEqual({ t: "number", text: "1", label: "of the 1 things they need, answered" });
    // The owner, on the same document, is told of all of it.
    expect(drawn(owner, "pkg-whole", narrowed)).toEqual({ t: "number", text: "4", label: "of the 5 things they need, answered" });
  });
});

describe("a walk is still costed", () => {
  it("a walk is as dear as the set it walks from: out(all('offer'), 'answers') in a per-record field is linear, and passes", () => {
    const doc = structuredClone(lifelogics);
    doc.kinds.package.computed.reach = { expr: "count(out(out('includes'), 'answers'))" };
    doc.kinds.signal.computed = { heard: { expr: "count(in(all('offer'), 'answers'))" } };
    expect(compiled(doc).findings.filter((f) => f.code === "computed-cost")).toEqual([]);
  });

  it("a walk chain whose work grows with the cube of the graph is refused at check time", () => {
    const doc = structuredClone(lifelogics);
    doc.kinds.offer.computed.crowd = { expr: "count(out(all('offer') where count(out(all('signal') where count(all('package')) > 0, 'concerns')) > 0, 'answers'))" };
    const result = compileDocument(doc);
    expect(result.ok).toBe(false);
    expect(result.findings.filter((f) => f.code === "computed-cost" && f.severity === "error").map((f) => f.path)).toEqual(["kinds.offer.computed.crowd"]);
  });

  it("at run time a walk over more than its budget stops, as a sentence", () => {
    const nodes = [...seed.nodes, ...Array.from({ length: 2000 }, (_, i) => ({ id: `offer-x${i}`, kind: "offer", name: `X${i}`, stage: "later", mode: "build", list: 1, unit: "fixed", units: 1 }))];
    const edges = [...seed.edges, ...Array.from({ length: 2000 }, (_, i) => ({ id: `x${i}`, kind: "answers", from: `offer-x${i}`, to: "note-slow" }))];
    const { app, kinds } = compiled();
    const store = storeOf(app, { nodes, edges });
    expect(() => evaluateExpr(parseExpr("count(out(all('offer'), 'answers'))"), { graph: store.graph as never, subject: null, kinds, budget: 1_000 })).toThrow(ExprBudgetError);
  });
});

describe("the checker and the edits read a walk from a set", () => {
  it("a walk names a relation the document declares, and the check says when it does not", () => {
    const doc = structuredClone(lifelogics);
    doc.views.package.card.push({ figure: "count(out(out('includes'), 'answered'))" });
    expect(compileDocument(doc).findings.filter((f) => f.code === "view-edge").map((f) => f.message)).toEqual(['"answered" is not a relation any kind declares']);
  });

  it("a list walking from a set is held to the kinds it reaches", () => {
    const doc = structuredClone(lifelogics);
    doc.views.package.page.push({ list: "out(out('includes'), 'answers')", sort: "standing" });
    expect(compileDocument(doc).findings.filter((f) => f.code === "view-name").map((f) => f.message)).toEqual(['signal has no field or relation called "standing"']);
  });

  it("renaming a relation rewrites it where a walk from a set names it", () => {
    const result = editDocument(lifelogics, [{ op: "rename-relation", kind: "offer", relation: "answers", to: "addresses" }]);
    if (!result.ok) throw new Error(JSON.stringify(result.findings));
    const card = (result.document.views as Record<string, { card: Record<string, unknown>[] }>)["package"]!.card;
    expect(card.at(-1)!["figure"]).toBe("count(out(out('includes'), 'addresses') & out(first(all('party') where role == 'client'), 'needs'))");
  });
});
