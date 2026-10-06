import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSchema, defineNode, deriveMutations, Graph, Store, z, type AnyGraphNode, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { checkApp, describeApp, compileDocument } from "../../src/check.js";
import { computedValues } from "../../src/blocks.js";
import {
  evaluateExpr,
  ExprBudgetError,
  ExprEvalError,
  FUNCTIONS,
  parseExpr,
  parseTemplate,
  printExpr,
  renderTemplate,
  shapesOfSchema,
  toDocument,
  type CompiledDocument,
} from "../../src/document/index.js";

/**
 * FR-83. The language computes what pages need, still total and budgeted.
 *
 * LifeLogics draws its proposal in code: a package's price is the sum of
 * list × units over its offers, less the client's discount; the package it
 * leads with is the recommended one, else the top by standing and price;
 * an offer's card says how many of the things heard it answers, in words.
 * Each of those is one declared expression here, over a document shaped
 * like LifeLogics' (fixtures/proposal.gdd.json).
 */
const proposal = JSON.parse(readFileSync(new URL("./fixtures/proposal.gdd.json", import.meta.url), "utf8"));

const NODES = [
  { id: "party:open-set", kind: "party", name: "Open Set", role: "prime" },
  { id: "party:acme", kind: "party", name: "Acme", role: "client", discount: 20 },
  ...["Slow handoffs", "No one owns the data", "Wants a pilot", "Board asks for AI", "Team of forty"].map((name, i) => ({ id: `note:${i + 1}`, kind: "note", name, type: i === 4 ? "fact" : "pain" })),
  { id: "offer:workshop", kind: "offer", name: "Workshop", list: 10_000, units: 1 },
  { id: "offer:build", kind: "offer", name: "Build", list: 20_000, units: 3 },
  { id: "offer:advice", kind: "offer", name: "Advice", list: 5_000, units: 6 },
  { id: "package:small", kind: "package", name: "Start small", standing: 3 },
  { id: "package:whole", kind: "package", name: "The whole thing", standing: 5 },
  { id: "package:middle", kind: "package", name: "The middle", standing: 5 },
];
const EDGES = [
  ...["note:1", "note:2", "note:3"].map((to) => ({ kind: "answers", from: "offer:workshop", to })),
  { kind: "answers", from: "offer:build", to: "note:4" },
  { kind: "includes", from: "package:small", to: "offer:workshop" },
  ...["offer:workshop", "offer:build", "offer:advice"].map((to) => ({ kind: "includes", from: "package:whole", to })),
  ...["offer:workshop", "offer:build"].map((to) => ({ kind: "includes", from: "package:middle", to })),
];

function compiled(document: unknown = proposal): CompiledDocument {
  const result = compileDocument(document, { today: () => "2026-10-05" });
  if (!result.ok) throw new Error(`the document compiles: ${JSON.stringify(result.findings, null, 2)}`);
  return result;
}

function storeOf(app: GraviewApp, nodes: readonly Record<string, unknown>[] = NODES) {
  return new Store<AnySchema>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    // The links between the records given: a test that leaves a record out leaves its links out too.
    snapshot: { nodes: nodes as never, edges: EDGES.filter((edge) => nodes.some((n) => n.id === edge.from) && nodes.some((n) => n.id === edge.to)) as never },
  });
}

const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const partner: Principal = { kind: "human", id: "u:partner", roles: ["partner"] };

/** Evaluate one expression on one record of the proposal, as the system sees it. */
function on(source: string, subject: string | null, nodes: readonly Record<string, unknown>[] = NODES, budget?: number) {
  const { app, kinds } = compiled();
  const store = storeOf(app, nodes);
  return evaluateExpr(parseExpr(source), { graph: store.graph as never, subject: subject ? (store.graph.getNode(subject) as AnyGraphNode) : null, kinds, today: "2026-10-05", ...(budget ? { budget } : {}) });
}
const idOf = (value: unknown) => (value && typeof value === "object" && "id" in value ? (value as { id: string }).id : value);
const idsOf = (value: unknown) => (value as { nodes: readonly { id: string }[] }).nodes.map((node) => node.id);

describe("sum, min and max take an expression per member", () => {
  it("sum(out('includes'), list * units) adds each offer's list times its units", () => {
    expect(on("sum(out('includes'), list * units)", "package:whole")).toBe(10_000 + 60_000 + 30_000);
  });

  it("min and max read the same per-member expression", () => {
    expect(on("min(out('includes'), list * units)", "package:whole")).toBe(10_000);
    expect(on("max(out('includes'), list * units)", "package:whole")).toBe(60_000);
  });

  it("a bare field and a quoted one still name a field, as before", () => {
    expect(on("sum(out('includes'), list)", "package:whole")).toBe(35_000);
    expect(on("sum(out('includes'), 'list')", "package:whole")).toBe(35_000);
  });

  it("a member whose expression is nothing is left out, and a word is a sentence, not a sum", () => {
    expect(on("sum(all('party'), discount)", null)).toBe(20);
    expect(() => on("sum(out('includes'), name)", "package:whole")).toThrow(ExprEvalError);
  });
});

describe("first and sort pick a record", () => {
  it("sort(S, key, 'desc') orders a set by the key each member gives, and 'asc' the other way", () => {
    expect(idsOf(on("sort(out('includes'), list * units, 'desc')", "package:whole"))).toEqual(["offer:build", "offer:advice", "offer:workshop"]);
    expect(idsOf(on("sort(out('includes'), list * units, 'asc')", "package:whole"))).toEqual(["offer:workshop", "offer:advice", "offer:build"]);
    expect(idsOf(on("sort(out('includes'), list * units)", "package:whole"))).toEqual(["offer:workshop", "offer:advice", "offer:build"]);
  });

  it("a list key sorts by its first value, then its second", () => {
    expect(idsOf(on("sort(all('package'), [standing, sum(out('includes'), list * units)], 'desc')", null))).toEqual(["package:whole", "package:middle", "package:small"]);
  });

  it("first(S) is the set's first record, and nothing when it is empty", () => {
    expect(idOf(on("first(sort(out('includes'), list, 'desc'))", "package:whole"))).toBe("offer:build");
    expect(on("first(out('includes') where list > 1000000)", "package:whole")).toBeNull();
    expect(on("first(sort(out('includes'), list, 'desc')).name", "package:whole")).toBe("Build");
  });

  it("either(a, b) is the first that is something", () => {
    expect(on("either(null, 2, 3)", null)).toBe(2);
    expect(on("either(first(all('party') where role == 'client').discount, 0)", null)).toBe(20);
  });

  it("nothing sorts last, whichever way", () => {
    const nodes = [...NODES.filter((node) => node.kind !== "package"), { id: "package:a", kind: "package", name: "A" }, { id: "package:b", kind: "package", name: "B", standing: 1 }];
    expect(idsOf(on("sort(all('package'), standing, 'desc')", null, nodes))).toEqual(["package:b", "package:a"]);
    expect(idsOf(on("sort(all('package'), standing, 'asc')", null, nodes))).toEqual(["package:b", "package:a"]);
  });

  it("a direction is 'asc' or 'desc', and keys that cannot be compared are a sentence", () => {
    expect(() => on("sort(all('package'), standing, 'up')", null)).toThrow(/'asc' or 'desc'/);
    expect(() => on("sort(all('note'), if(type == 'fact', 1, 'one'))", null)).toThrow(ExprEvalError);
  });

  it("the language knows the new functions, and prints them back", () => {
    for (const fn of ["first", "sort", "either"]) expect(FUNCTIONS).toContain(fn);
    const source = "first(sort(all('package'), [standing, net], 'desc'))";
    expect(printExpr(parseExpr(source))).toBe(source);
  });
});

describe("a computed field is declared once and read like a stored one", () => {
  it("package net is Σ list·units over includes, less the client party's discount — one declared expression", () => {
    expect(on("net", "package:whole")).toBe(80_000);
    expect(on("net", "package:middle")).toBe(56_000);
    expect(on("net", "package:small")).toBe(8_000);
  });

  it("the package we lead with is the recommended one, else the top by standing then net — one declared expression", () => {
    expect(idOf(on("lead", "party:acme"))).toBe("package:whole");
    const recommended = NODES.map((node) => (node.id === "package:small" ? { ...node, recommended: true } : node));
    expect(idOf(on("lead", "party:acme", recommended))).toBe("package:small");
    expect(on("lead.name", "party:acme", recommended)).toBe("Start small");
  });

  it("is read through a relation, in a sum and as a sort key", () => {
    expect(on("sum(all('package'), net)", null)).toBe(144_000);
    expect(idsOf(on("sort(all('package'), net, 'desc')", null))).toEqual(["package:whole", "package:middle", "package:small"]);
    expect(on("sum(in('includes'), net)", "offer:build")).toBe(136_000);
  });

  it("is read in a template", () => {
    const { app, kinds } = compiled();
    const store = storeOf(app);
    const said = renderTemplate(parseTemplate("{name} costs {net | money} after the discount"), { node: store.graph.getNode("package:whole") as AnyGraphNode, kinds, graph: store.graph as never, today: "2026-10-05" });
    expect(said).toBe("The whole thing costs 80,000 after the discount");
  });

  it("is judged by a rule like a stored field", () => {
    const { app } = compiled();
    const free = [...NODES.filter((node) => node.kind !== "offer"), ...NODES.filter((node) => node.kind === "offer").map((node) => ({ ...node, list: 0 }))];
    const violations = storeOf(app, free).violations();
    expect(violations.map((violation) => violation.message).sort()).toEqual([
      "Start small costs nothing after the discount",
      "The middle costs nothing after the discount",
      "The whole thing costs nothing after the discount",
    ]);
    expect(storeOf(app).violations()).toEqual([]);
  });

  it("computedValues says every computed field of a record, plainly, and a record as its id and name", () => {
    const { app } = compiled();
    const store = storeOf(app);
    expect(computedValues(app.schema, store.graph as never, store.graph.getNode("package:whole") as AnyGraphNode).values).toEqual({ net: 80_000 });
    expect(computedValues(app.schema, store.graph as never, store.graph.getNode("party:acme") as AnyGraphNode).values).toEqual({ lead: { id: "package:whole", kind: "package", label: "The whole thing" } });
  });

  it("is never stored: the graph's records carry only what was written", () => {
    const { app } = compiled();
    const store = storeOf(app);
    expect(store.graph.getNode("package:whole")).not.toHaveProperty("net");
  });
});

describe("a computed field is not writable", () => {
  it("no derived edit offers it, and the act tools do not take it", () => {
    const { app } = compiled();
    const edit = deriveMutations(app.schema, app.mutations ?? []).find((m) => m.name === "edit-package");
    expect(edit).toBeDefined();
    expect(JSON.stringify(edit!.input)).not.toContain('"net"');
    expect(Object.keys((edit!.input as unknown as { shape: Record<string, unknown> }).shape)).not.toContain("net");
  });

  it("an act that sets one is a finding that says it is worked out", () => {
    const result = compileDocument({ ...proposal, acts: { "price-it": { on: "package", sets: { net: 5 } } } });
    expect(result.ok).toBe(false);
    const finding = result.findings.find((f) => f.code === "computed-written");
    expect(finding?.path).toBe("acts.price-it.set.net");
    expect(finding?.message).toMatch(/worked out/);
  });

  it("a computed field that shares a name with a field or a relation is a finding", () => {
    const clash = structuredClone(proposal);
    clash.kinds.offer.computed = { list: "units", answers: "1" };
    const result = compileDocument(clash);
    expect(result.ok).toBe(false);
    expect(result.findings.filter((f) => f.code === "computed-clash").map((f) => f.path).sort()).toEqual(["kinds.offer.computed.answers", "kinds.offer.computed.list"]);
  });
});

describe("computed fields that read each other", () => {
  it("may: one computed field is read by another", () => {
    const chained = structuredClone(proposal);
    chained.kinds.offer.computed = { total: "list * units", doubled: "total * 2" };
    const { app, kinds } = compiled(chained);
    const store = storeOf(app);
    expect(evaluateExpr(parseExpr("doubled"), { graph: store.graph as never, subject: store.graph.getNode("offer:build") as AnyGraphNode, kinds })).toBe(120_000);
  });

  it("a cycle is a check finding that names it", () => {
    const cycled = structuredClone(proposal);
    cycled.kinds.offer.computed = { a: "b + 1", b: "c + 1", c: "a + 1" };
    const result = compileDocument(cycled);
    expect(result.ok).toBe(false);
    const cycle = result.findings.find((f) => f.code === "computed-cycle");
    expect(cycle?.path).toMatch(/^kinds\.offer\.computed\./);
    expect(cycle?.message).toMatch(/a → b → c → a|b → c → a → b|c → a → b → c/);
  });

  it("a cycle the check cannot see, across kinds, stops as a sentence when it is read", () => {
    const shapes = shapesOfSchema(createSchema([
      defineNode("left", { fields: z.object({ name: z.string() }), edges: { to: { to: ["right"], cardinality: "one" } }, computed: { loop: "to.loop" } }),
      defineNode("right", { fields: z.object({ name: z.string() }), edges: { back: { to: ["left"], cardinality: "one" } }, computed: { loop: "back.loop" } }),
    ]));
    const schema = createSchema([
      defineNode("left", { fields: z.object({ name: z.string() }), edges: { to: { to: ["right"], cardinality: "one" } } }),
      defineNode("right", { fields: z.object({ name: z.string() }), edges: { back: { to: ["left"], cardinality: "one" } } }),
    ]);
    const graph = Graph.from(schema as never, { nodes: [{ id: "l", kind: "left", name: "L" }, { id: "r", kind: "right", name: "R" }], edges: [{ kind: "to", from: "l", to: "r" }, { kind: "back", from: "r", to: "l" }] } as never);
    expect(() => evaluateExpr(parseExpr("loop"), { graph: graph as never, subject: graph.getNode("l") as never, kinds: shapes })).toThrow(/depends on itself/);
  });
});

describe("templates say numbers and lists in words", () => {
  const say = (template: string, subject: string) => {
    const { app, kinds } = compiled();
    const store = storeOf(app);
    return renderTemplate(parseTemplate(template), { node: store.graph.getNode(subject) as AnyGraphNode, kinds, graph: store.graph as never, today: "2026-10-05" });
  };

  it("an offer's card says 'Answers N of the things we heard' in words", () => {
    const card = proposal.views.offer.card[1].text as string;
    expect(say(card, "offer:workshop")).toBe("Answers three of the five things we heard");
    expect(say(card, "offer:advice")).toBe("Answers zero of the five things we heard");
  });

  it("words spells whole numbers to ninety-nine, and leaves the rest as figures", () => {
    const words = (n: number) => renderTemplate(parseTemplate("{n | words}"), { node: null, kinds: new Map(), bindings: { n } });
    expect([0, 1, 7, 12, 20, 21, 45, 99].map(words)).toEqual(["zero", "one", "seven", "twelve", "twenty", "twenty-one", "forty-five", "ninety-nine"]);
    expect([100, 1234, 2.5, -3].map(words)).toEqual(["100", "1,234", "2.5", "-3"]);
  });

  it("and joins a set or a list: 'A, B and C'", () => {
    expect(say("Answered by {in('answers') | and}", "note:1")).toBe("Answered by Workshop");
    expect(say("{out('includes') | and}", "package:middle")).toBe("Workshop and Build");
    expect(say("{out('includes') | and}", "package:whole")).toBe("Workshop, Build and Advice");
    expect(renderTemplate(parseTemplate("{['tea'] | and}"), { node: null, kinds: new Map() })).toBe("tea");
  });

  it("plural says the noun for the count: one offer, three offers, and an irregular plural when given", () => {
    const plural = (n: number, args: string) => renderTemplate(parseTemplate(`{n | words} {n | plural: ${args}}`), { node: null, kinds: new Map(), bindings: { n } });
    expect(plural(1, "'offer'")).toBe("one offer");
    expect(plural(3, "'offer'")).toBe("three offers");
    expect(plural(0, "'offer'")).toBe("zero offers");
    expect(plural(2, "'party'")).toBe("two parties");
    expect(plural(2, "'box'")).toBe("two boxes");
    expect(plural(2, "'person', 'people'")).toBe("two people");
    expect(plural(1, "'person', 'people'")).toBe("one person");
    expect(say("{count(out('includes')) | words} {count(out('includes')) | plural: 'offer'}: {out('includes') | and}", "package:middle")).toBe("two offers: Workshop and Build");
  });

  it("a filter it does not know, or plural without its noun, is a finding", () => {
    expect(() => parseTemplate("{n | plurals: 'x'}")).toThrow(/not a formatter/);
    expect(() => parseTemplate("{n | plural}")).toThrow(/plural: 'offer'/);
    expect(() => parseTemplate("{n | words: 'x'}")).toThrow(/takes nothing/);
  });

  it("a bar inside a quoted word or an `or` is not a filter", () => {
    expect(renderTemplate(parseTemplate("{'a|b'}"), { node: null, kinds: new Map() })).toBe("a|b");
    expect(renderTemplate(parseTemplate("{false || true}"), { node: null, kinds: new Map() })).toBe("true");
  });
});

describe("the cost check still refuses unbounded work", () => {
  it("a sweep read once per member of a sweep is a warning: the package we lead with sweeps parties for each package", () => {
    const cost = compiled().findings.filter((f) => f.code === "computed-cost");
    expect(cost.map((f) => [f.path, f.severity])).toEqual([["kinds.party.computed.lead", "warning"]]);
  });

  it("a computed field whose work grows with the cube of the graph is refused at check time", () => {
    const greedy = structuredClone(proposal);
    greedy.kinds.offer.computed = { total: "list * units", crowd: "sum(all('offer'), count(all('note') where count(all('package')) > 0))" };
    const result = compileDocument(greedy);
    expect(result.ok).toBe(false);
    const finding = result.findings.find((f) => f.code === "computed-cost" && f.severity === "error");
    expect(finding?.path).toBe("kinds.offer.computed.crowd");
  });

  it("…and so is one that reaches that cost through another computed field", () => {
    const greedy = structuredClone(proposal);
    greedy.kinds.note.computed = { heard: "count(all('package') where count(all('offer')) > 0)" };
    greedy.kinds.offer.computed = { total: "list * units", crowd: "sum(all('note'), heard)" };
    const result = compileDocument(greedy);
    expect(result.ok).toBe(false);
    expect(result.findings.filter((f) => f.code === "computed-cost" && f.severity === "error").map((f) => f.path)).toEqual(["kinds.offer.computed.crowd"]);
  });

  it("at run time a computed field that reads too much stops within its budget, as a sentence", () => {
    const nodes = [...NODES, ...Array.from({ length: 3000 }, (_, i) => ({ id: `offer:x${i}`, kind: "offer", name: `X${i}`, list: 1, units: 1 }))];
    const many = [...EDGES, ...Array.from({ length: 3000 }, (_, i) => ({ kind: "includes", from: "package:whole", to: `offer:x${i}` }))];
    const { app, kinds } = compiled();
    const store = new Store<AnySchema>({ schema: app.schema, mutations: [], invariants: [], snapshot: { nodes: nodes as never, edges: many as never } });
    const started = Date.now();
    expect(() => evaluateExpr(parseExpr("net"), { graph: store.graph as never, subject: store.graph.getNode("package:whole") as AnyGraphNode, kinds, budget: 2_000 })).toThrow(ExprBudgetError);
    const read = computedValues(app.schema, store.graph as never, store.graph.getNode("package:whole") as AnyGraphNode, { budget: 2_000 });
    expect(read.values).toEqual({});
    expect(read.refused["net"]).toMatch(/too much of the graph/);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("a computed field read inside a template spends the template's budget, not a fresh one", () => {
    const { app, kinds } = compiled();
    const nodes = [...NODES, ...Array.from({ length: 600 }, (_, i) => ({ id: `party:p${i}`, kind: "party", name: `P${i}`, role: "prime" }))];
    const store = storeOf(app, nodes);
    // A template has 500 steps; the discount's sweep of 600 parties cannot fit, so the part says "—".
    expect(renderTemplate(parseTemplate("{net}"), { node: store.graph.getNode("package:whole") as AnyGraphNode, kinds, graph: store.graph as never })).toBe("—");
  });
});

describe("a computed value served to a seat reads only what that seat may see (FR-55)", () => {
  it("the partner, who may not see parties, is served the price before any discount — never the client's discount", () => {
    const { app } = compiled();
    const store = storeOf(app);
    const asPartner = store.seenBy(partner);
    const asOwner = store.seenBy(owner);
    const whole = (seen: Store<AnySchema>) => computedValues(seen.schema, seen.graph as never, seen.graph.getNode("package:whole") as AnyGraphNode).values["net"];
    expect(whole(asOwner)).toBe(80_000);
    expect(whole(asPartner)).toBe(100_000);
  });

  it("a computed record the seat may not see is never named to it", () => {
    const compiledDoc = structuredClone(proposal);
    // The partner may see notes but not offers: an offer is the computed value's record.
    compiledDoc.kinds.note.computed = { firstAnswer: "first(in('answers'))" };
    compiledDoc.policy.sees = [
      { roles: ["owner"], kinds: ["party", "note", "offer", "package"] },
      { roles: ["partner"], kinds: ["note"] },
    ];
    const { app } = compiled(compiledDoc);
    const store = storeOf(app);
    const read = (seen: Store<AnySchema>) => computedValues(seen.schema, seen.graph as never, seen.graph.getNode("note:1") as AnyGraphNode).values["firstAnswer"];
    expect(read(store.seenBy(owner))).toEqual({ id: "offer:workshop", kind: "offer", label: "Workshop" });
    expect(read(store.seenBy(partner))).toBeNull();
  });
});

describe("computed fields in describe and check", () => {
  it("describe lists each computed field as worked out and read-only, with its expression", () => {
    const { app } = compiled();
    const said = describeApp(app);
    expect(said).toContain("## Worked out");
    expect(said).toMatch(/package · net \(After the discount\), read-only: sum\(out\('includes'\), list \* units\)/);
  });
});

describe("the TypeScript declaration says the same", () => {
  const offer = defineNode("offer", { fields: z.object({ name: z.string(), list: z.number(), units: z.number() }), computed: { total: "list * units" } });
  const pkg = defineNode("package", {
    fields: z.object({ name: z.string() }),
    edges: { includes: { to: ["offer"] } },
    computed: { gross: { expr: "sum(out('includes'), total)", label: "At list" } },
  });
  const app: GraviewApp = { name: "Declared", schema: createSchema([offer, pkg]) };

  it("defineNode({ computed }) is read by every expression, through shapesOfSchema", () => {
    const graph = Graph.from(app.schema as never, {
      nodes: [{ id: "o", kind: "offer", name: "O", list: 3, units: 4 }, { id: "p", kind: "package", name: "P" }],
      edges: [{ kind: "includes", from: "p", to: "o" }],
    } as never);
    expect(evaluateExpr(parseExpr("gross"), { graph: graph as never, subject: graph.getNode("p") as never, kinds: shapesOfSchema(app.schema) })).toBe(12);
  });

  it("graview check judges a declared computed field as it judges a document's", () => {
    const broken: GraviewApp = {
      name: "Broken",
      schema: createSchema([
        defineNode("offer", { fields: z.object({ name: z.string() }), computed: { a: "b", b: "a", c: "nope + 1", d: "count(" } }),
      ]),
    };
    const codes = checkApp(broken).findings.map((f) => `${f.code} ${f.where}`);
    expect(codes).toContain("computed-cycle defineNode(\"offer\").computed.a");
    expect(codes).toContain("computed-name defineNode(\"offer\").computed.c");
    expect(codes).toContain("expression defineNode(\"offer\").computed.d");
    expect(checkApp(app).findings.filter((f) => f.code.startsWith("computed"))).toEqual([]);
  });

  it("toDocument writes a declared kind's computed fields as data", () => {
    const { document } = toDocument(app);
    expect(document.kinds["package"]?.computed).toEqual({ gross: { expr: "sum(out('includes'), total)", label: "At list" } });
    expect(document.kinds["offer"]?.computed).toEqual({ total: "list * units" });
  });
});
