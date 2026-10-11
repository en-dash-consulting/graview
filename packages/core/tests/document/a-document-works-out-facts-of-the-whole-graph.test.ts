import { describe, expect, it } from "vitest";
import { compileDocument, describeApp } from "../../src/check.js";
import { factNames, factValues } from "../../src/blocks.js";
import { describePlace } from "../../src/describe.js";
import { appFrom, compileDocumentWithoutCheck, serializeCompiled } from "../../src/document/index.js";
import { createSchema, defineNode, Store, z, type AnySchema, type GraviewApp, type Principal } from "../../src/index.js";
import { checkApp } from "../../src/check.js";

/**
 * A DOCUMENT CAN DECLARE COMPUTED FACTS OF THE WHOLE GRAPH. n-dx decided
 * "the whole product map is proposed" in its own face with
 * `every(n => n.proposed)`, because `computed` was per kind only and the
 * scene, the pages and an agent could not say the same thing. A document's
 * top-level `computed` is a name and a rule-language expression with no
 * record as its subject, read anywhere the language is as `fact('<name>')`
 * — a block, a template, a rule, a kind's computed field — worked out over
 * the reader's own graph under the language's budget, and judged by
 * `graview check` as a computed field is.
 */
const base = {
  format: "graview-document",
  formatVersion: 1,
  name: "Product map",
  roles: ["owner", "guest"],
  kinds: {
    area: {
      fields: { title: { type: "string", required: true }, proposed: { type: "boolean" } },
    },
    capability: {
      fields: { title: { type: "string", required: true }, proposed: { type: "boolean" } },
      edges: { under: { to: ["area"], cardinality: "one", description: "the area it sits in", inverse: "the capabilities in it" } },
      computed: { mapReady: "fact('mapProposed')" },
    },
  },
  computed: {
    mapProposed: { expr: "every(all('area') | all('capability'), proposed == true)", label: "The map is proposed" },
    capabilities: "count(all('capability'))",
  },
  rules: {
    "map-is-real": { over: "graph", require: "not fact('mapProposed')", says: "The product map is proposed, not yet real" },
  },
  policy: {
    grants: [{ roles: "*", mutations: "*" }],
    sees: [
      { roles: ["owner"], kinds: ["area", "capability"] },
      { roles: ["guest"], kinds: ["area"] },
    ],
  },
  views: {
    home: [
      { headline: "The map" },
      { when: "fact('mapProposed')", show: [{ text: "The product map is proposed, not yet real: {fact('capabilities')} capabilities." }] },
    ],
  },
} as const;
const doc = (patch: Record<string, unknown> = {}) => ({ ...structuredClone(base), ...patch }) as unknown as Record<string, unknown>;

const compiled = compileDocument(doc());
if (!compiled.ok) throw new Error(JSON.stringify(compiled.findings.filter((f) => f.severity === "error")));
const app = compiled.app as GraviewApp<AnySchema>;
const store = (proposed: boolean) =>
  new Store<AnySchema>({
    schema: app.schema as AnySchema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    policy: app.policy!,
    snapshot: {
      nodes: [
        { id: "a", kind: "area", title: "Work", proposed: true },
        { id: "c1", kind: "capability", title: "Plan", proposed },
        { id: "c2", kind: "capability", title: "Ship", proposed: true },
      ],
      edges: [{ kind: "under", from: "c1", to: "a" }, { kind: "under", from: "c2", to: "a" }],
    } as never,
  });
const owner: Principal = { kind: "human", id: "u:owner", roles: ["owner"] };
const guest: Principal = { kind: "human", id: "u:guest", roles: ["guest"] };

describe("a fact of the whole graph", () => {
  it("is worked out over the reader's graph: what a seat may not see adds nothing to it", () => {
    const proposed = store(true);
    expect(factValues(proposed.schema, proposed.seenBy(owner).graph as never).values).toEqual({ mapProposed: true, capabilities: 2 });
    // A guest sees no capability: two are none to the guest.
    expect(factValues(proposed.schema, proposed.seenBy(guest).graph as never).values).toEqual({ mapProposed: true, capabilities: 0 });
    const real = store(false);
    expect(factValues(real.schema, real.graph as never).values["mapProposed"]).toBe(false);
  });

  it("is named with its words, in the order declared", () => {
    expect(factNames(app.schema)).toEqual([
      { name: "mapProposed", label: "The map is proposed" },
      { name: "capabilities", label: "Capabilities" },
    ]);
  });

  it("is read by a block as fact('<name>'): the home says it, in the words and the counts of the seat", () => {
    const said = (principal: Principal, proposed: boolean) => {
      const result = describePlace(store(proposed), principal, "home", { app });
      if (!result.ok) throw new Error(result.error);
      return result.description;
    };
    expect(said(owner, true).text).toContain("The product map is proposed, not yet real: 2 capabilities.");
    expect(said(guest, true).text).toContain("The product map is proposed, not yet real: 0 capabilities.");
    expect(said(owner, false).text).not.toContain("The product map is proposed");
  });

  it("is said beside the home to an agent, worked out for its seat, whether or not a block says it", () => {
    const result = describePlace(store(true), owner, "home", { app });
    if (!result.ok) throw new Error(result.error);
    expect(result.description.facts).toEqual([
      { name: "mapProposed", label: "The map is proposed", value: "yes" },
      { name: "capabilities", label: "Capabilities", value: "2" },
    ]);
    expect(result.description.text).toContain("- The map is proposed (mapProposed): yes");
    const record = describePlace(store(true), owner, "c1", { app });
    if (!record.ok) throw new Error(record.error);
    expect(record.description.facts).toBeUndefined();
  });

  it("is read by a rule over the graph and by a kind's computed field", () => {
    expect(store(true).violations().map((violation) => violation.message)).toEqual(["The product map is proposed, not yet real"]);
    expect(store(false).violations()).toEqual([]);
  });

  it("is listed by describe, with its expression, as read-only", () => {
    const said = describeApp(app);
    expect(said).toContain("Facts of the whole graph: read as fact('<name>') in any expression");
    expect(said).toContain("fact('mapProposed') (The map is proposed): every(all('area') | all('capability'), proposed == true)");
  });

  it("travels in a compiled app a host hands its page", () => {
    const handed = appFrom(JSON.parse(JSON.stringify(serializeCompiled(compiled as never))));
    if (!handed.ok) throw new Error("refused");
    const page = new Store<AnySchema>({ schema: handed.app.schema as AnySchema, mutations: [], snapshot: { nodes: [{ id: "a", kind: "area", title: "Work", proposed: true }], edges: [] } as never });
    expect(factValues(page.schema, page.graph as never).values).toEqual({ mapProposed: true, capabilities: 0 });
  });

  it("is refused where it is read, with a sentence, when it spends its budget", () => {
    const greedy = compileDocumentWithoutCheck(doc({ computed: { pairs: "count(all('area') where count(all('capability') where count(all('area')) > 0) > 0)" } }));
    if (!greedy.ok) throw new Error("refused");
    const big = new Store<AnySchema>({
      schema: greedy.app.schema as AnySchema,
      mutations: [],
      snapshot: { nodes: [...Array.from({ length: 40 }, (_, i) => ({ id: `a${i}`, kind: "area", title: `A${i}` })), ...Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, kind: "capability", title: `C${i}` }))], edges: [] } as never,
    });
    const worked = factValues(big.schema, big.graph as never, { budget: 2_000 });
    expect(worked.values).toEqual({});
    expect(worked.refused["pairs"]).toContain("too much of the graph");
  });
});

describe("graview check, of a document's facts", () => {
  const codes = (patch: Record<string, unknown>) => {
    const result = compileDocument(doc(patch));
    return result.findings.filter((f) => f.severity !== "note").map((f) => `${f.severity}:${f.code}:${f.path}`);
  };

  it("refuses a bare name, which no record is there to read", () => {
    expect(codes({ computed: { odd: "proposed" } })).toContain("error:computed-name:computed.odd");
  });

  it("refuses an expression that does not parse, a kind or a relation nobody declares", () => {
    const said = codes({ computed: { broken: "count(all('area'", stray: "count(all('nobody'))", walked: "count(in(all('area'), 'nowhere'))" } });
    expect(said).toContain("error:expression:computed.broken");
    expect(said).toContain("error:computed-kind:computed.stray");
    expect(said).toContain("error:computed-edge:computed.walked");
  });

  it("refuses fact('<name>') naming no fact, wherever it is read: a block, a rule, a kind's computed field, another fact", () => {
    const said = codes({
      computed: { a: "fact('nope')" },
      rules: { r: { over: "graph", require: "fact('gone')" } },
      views: { home: [{ when: "fact('missing')", show: [{ text: "x" }] }] },
    });
    expect(said).toContain("error:fact-unknown:computed.a");
    expect(said).toContain("error:fact-unknown:rules.r.require");
    expect(said).toContain("error:fact-unknown:views.home.0.when");
    expect(said).toContain("error:fact-unknown:kinds.capability.computed.mapReady");
  });

  it("warns at work that grows with the square of the graph, and refuses the cube", () => {
    expect(codes({ computed: { pairs: "count(all('area') where count(all('capability')) > 0)" } })).toContain("warning:computed-cost:computed.pairs");
    expect(codes({ computed: { cube: "count(all('area') where count(all('capability') where count(all('area')) > 0) > 0)" } })).toContain("error:computed-cost:computed.cube");
  });

  it("holds a TypeScript app's facts — createSchema(kinds, computed) — to the same words", () => {
    const area = defineNode("area", { fields: z.object({ title: z.string(), proposed: z.boolean() }) });
    const ts = { name: "ts", schema: createSchema([area], { mapProposed: "every(all('area'), proposed)", stray: "proposed" }), mutations: [] };
    const found = checkApp(ts as never).findings.map((f) => `${f.code}:${f.where}`);
    expect(found).toContain("computed-name:createSchema(…).computed.stray");
    expect(found.filter((one) => one.includes("mapProposed"))).toEqual([]);
  });
});
