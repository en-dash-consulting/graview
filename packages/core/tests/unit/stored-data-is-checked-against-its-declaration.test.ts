import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createSchema,
  defineInvariant,
  defineNode,
  GRAPH_FINDING_CODES,
  repairPlan,
  RuleBudgetError,
  Store,
  validateGraph,
  type GraphFinding,
  type GraphSnapshot,
} from "../../src/index.js";

/**
 * FR-21. A declaration changes; what was stored under the old one stays.
 * `validateGraph` says what no longer fits, by code and id, and
 * `repairPlan` turns the findings into one ordinary batch somebody makes
 * and somebody can take back.
 */
const person = defineNode("person", {
  fields: z.object({ label: z.string(), email: z.string().email().optional(), role: z.enum(["chair", "member"]).default("member") }),
  edges: { knows: { to: ["person"] } },
  plural: "People",
});
const team = defineNode("team", { fields: z.object({ label: z.string(), size: z.number() }), plural: "Teams" });
const schema = createSchema([person, team]);
const app = { schema, invariants: [] };

const clean: GraphSnapshot = {
  nodes: [
    { id: "p1", kind: "person", label: "Ada", role: "chair" },
    { id: "p2", kind: "person", label: "Grace", role: "member" },
    { id: "t1", kind: "team", label: "Rota", size: 2 },
  ],
  edges: [{ kind: "knows", from: "p1", to: "p2" }],
};

const codes = (findings: readonly GraphFinding[]) => findings.map((f) => `${f.code} ${f.id}${f.detail ? ` ${f.detail}` : ""}`);

describe("validateGraph", () => {
  it("a clean graph validates with zero findings", () => {
    expect(validateGraph(app, clean)).toEqual([]);
  });

  it("node-shape: a field that does not fit is found by its record and its field, never its value", () => {
    const found = validateGraph(app, { nodes: [{ id: "p1", kind: "person", label: "Ada", email: "not-an-address", role: "chair" }], edges: [] });
    expect(codes(found)).toEqual(["node-shape p1 email"]);
    expect(found[0]!.message).not.toContain("not-an-address");
    expect(found[0]!.message).toContain("Ada");
  });

  it("kind-unknown: a record of a kind the declaration no longer has", () => {
    const found = validateGraph(app, { nodes: [...clean.nodes, { id: "v1", kind: "vehicle", label: "Van" }], edges: clean.edges });
    expect(codes(found)).toEqual(["kind-unknown v1"]);
  });

  it("edge-dangling: a link to a record that is not there", () => {
    const found = validateGraph(app, { nodes: clean.nodes, edges: [...clean.edges, { kind: "knows", from: "p1", to: "p9" }] });
    expect(codes(found)).toEqual(["edge-dangling knows:p1->p9"]);
  });

  it("edge-disallowed: a link the declaration does not allow between those kinds", () => {
    const found = validateGraph(app, { nodes: clean.nodes, edges: [...clean.edges, { kind: "knows", from: "p1", to: "t1" }] });
    expect(codes(found)).toEqual(["edge-disallowed knows:p1->t1"]);
  });

  it("rule-error: a rule that threw rather than judged, by its subject and its name", () => {
    const unjudged = defineInvariant<typeof schema, "team">("team-has-a-chair", {
      scope: { kind: "team" },
      evaluate: () => {
        throw new TypeError("no such field");
      },
    });
    const found = validateGraph({ schema, invariants: [unjudged] }, clean);
    expect(codes(found)).toEqual(["rule-error t1 team-has-a-chair"]);
    expect(found[0]!.repair).toBeUndefined();
  });

  it("rule-budget: a rule that would have read more than its budget", () => {
    const greedy = defineInvariant<typeof schema>("reads-everything", {
      scope: "graph",
      evaluate: () => {
        throw new RuleBudgetError("this rule looks at too much of the graph");
      },
    });
    const found = validateGraph({ schema, invariants: [greedy] }, clean);
    expect(codes(found)).toEqual(["rule-budget reads-everything reads-everything"]);
  });

  it("a rule that judged and found a violation is not a stored-data finding", () => {
    const judged = defineInvariant<typeof schema, "team">("team-is-small", {
      scope: { kind: "team" },
      evaluate: ({ subject }) => [{ invariant: "team-is-small", subjectId: subject.id, label: "Small", message: "Too big", nodeIds: [subject.id], repairs: [] }],
    });
    expect(validateGraph({ schema, invariants: [judged] }, clean)).toEqual([]);
  });

  it("reads the snapshot as it is: nothing is parsed into it, stripped or defaulted", () => {
    const stored = { nodes: [{ id: "p1", kind: "person", label: "Ada", email: 7 }], edges: [] };
    const before = JSON.stringify(stored);
    validateGraph(app, stored as never);
    expect(JSON.stringify(stored)).toBe(before);
  });

  it("names every code it can produce, and each code here is seeded by a test above", () => {
    expect([...GRAPH_FINDING_CODES].sort()).toEqual(
      ["edge-dangling", "edge-disallowed", "kind-unknown", "node-shape", "rule-budget", "rule-error"],
    );
  });
});

describe("repairPlan", () => {
  const broken: GraphSnapshot = {
    nodes: [
      // email does not fit and is optional: cleared.
      { id: "p1", kind: "person", label: "Ada", email: "not-an-address", role: "chair" },
      // role does not fit and has a default: coerced to it.
      { id: "p2", kind: "person", label: "Grace", role: "treasurer" },
      // size is required with no default: the record cannot be made to fit, and goes with its links.
      { id: "t1", kind: "team", label: "Rota", size: "two" },
      // a kind the app no longer has: removed, with its links.
      { id: "v1", kind: "vehicle", label: "Van" },
    ],
    edges: [
      { kind: "knows", from: "p1", to: "p2" },
      { kind: "knows", from: "p2", to: "t1" },
      { kind: "drives", from: "p1", to: "v1" },
    ],
  };

  it("drops, clears and coerces, and says so counted", () => {
    const findings = validateGraph(app, broken);
    expect(codes(findings)).toEqual([
      "kind-unknown v1",
      "node-shape p1 email",
      "node-shape p2 role",
      "node-shape t1 size",
      "edge-disallowed knows:p2->t1",
    ]);
    expect(findings.map((f) => f.repair?.action)).toEqual(["drop", "clear", "coerce", "drop", "drop"]);
    const plan = repairPlan(findings);
    expect(plan.said).toEqual([
      "1 record of a kind this app no longer has would be removed, with their links",
      "1 field that no longer fits would be cleared",
      "1 required field would be set to its default",
      "1 record that cannot be made to fit would be removed, with their links",
      "1 link this app no longer allows would be removed",
    ]);
    // Links first, then fields, then records: its inverse puts records back before their links.
    expect(plan.primitives.map((p) => p.op)).toEqual(["remove-edge", "remove-edge", "patch-node", "patch-node", "remove-node", "remove-node"]);
  });

  it("applies through the store as one ordinary, attributed batch, leaves a clean graph, and undoes cleanly", () => {
    // The store holds what was stored as it is; the declaration changed after it was written.
    const stored = broken;
    const store = new Store({ schema, mutations: [], snapshot: stored as never, validate: false });
    const before = JSON.stringify(store.snapshot());

    const findings = store.findings();
    expect(findings.length).toBeGreaterThan(0);
    const result = store.applyPrimitives(repairPlan(findings).primitives, {
      author: { kind: "human", id: "nick" },
      intent: "Repair what no longer fits",
    });
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]!.author).toEqual({ kind: "human", id: "nick" });
    expect(result.ops[0]!.intent).toBe("Repair what no longer fits");
    expect(store.log.all()).toHaveLength(1);
    expect(store.findings()).toEqual([]);
    expect(store.graph.getNode("p2")).toMatchObject({ role: "member" });
    expect(store.graph.getNode("p1")).not.toHaveProperty("email");
    expect(store.graph.has("t1")).toBe(false);

    store.undo(result.batch, { author: { kind: "human", id: "nick" } });
    expect(JSON.stringify(sorted(store.snapshot()))).toBe(JSON.stringify(sorted(JSON.parse(before))));
    expect(codes(store.findings())).toEqual(codes(findings));
  });

  it("a default declared beside the schema (`defaults`) coerces a required field; one that does not fit itself leaves the record to go", () => {
    const shift = defineNode("shift", {
      fields: z.object({ label: z.string(), state: z.enum(["open", "taken"]) }),
      defaults: { state: "open" },
    });
    const odd = defineNode("odd", { fields: z.object({ label: z.string(), state: z.enum(["open", "taken"]) }), defaults: { state: "never" } });
    const beside = { schema: createSchema([shift, odd]) };
    const found = validateGraph(beside, {
      nodes: [
        { id: "s1", kind: "shift", label: "Monday", state: "maybe" },
        { id: "o1", kind: "odd", label: "Tuesday", state: "maybe" },
      ],
      edges: [],
    });
    expect(found.map((f) => [f.id, f.detail, f.repair?.action])).toEqual([
      ["o1", "state", "drop"],
      ["s1", "state", "coerce"],
    ]);
    expect(repairPlan(found).said).toContain("1 required field would be set to its default");
    // A field the schema can empty is still cleared, not set: the smallest fix.
    expect(validateGraph({ schema: createSchema([defineNode("note", { fields: z.object({ label: z.string(), mood: z.enum(["calm"]).optional() }), defaults: { mood: "calm" } })]) }, { nodes: [{ id: "n1", kind: "note", label: "N", mood: "wild" }], edges: [] })[0]!.repair!.action).toBe("clear");
  });

  it("a plan of no findings is no change", () => {
    const store = new Store({ schema, mutations: [], snapshot: clean as never });
    const plan = repairPlan(store.findings());
    expect(plan.primitives).toEqual([]);
    expect(plan.said).toEqual(["Everything fits its declaration; there is nothing to repair."]);
    const result = store.applyPrimitives(plan.primitives, { intent: "Repair" });
    expect(result.ops).toEqual([]);
    expect(store.log.all()).toHaveLength(0);
  });
});

function sorted(snapshot: GraphSnapshot) {
  const keyed = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)));
  return {
    nodes: [...snapshot.nodes].map(keyed).sort((a, b) => ((a.id as string) < (b.id as string) ? -1 : 1)),
    edges: [...snapshot.edges].map((e) => `${e.kind} ${e.from} ${e.to}`).sort(),
  };
}
