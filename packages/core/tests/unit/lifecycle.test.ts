import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineApp,
  defineNode,
  evaluate,
  Graph,
  isCurrent,
  type Violation,
} from "../../src/index.js";
import { checkApp } from "../../src/check.js";

/**
 * The horizon: a kind declares when its nodes stop being current, and every
 * derived surface — counts, judgement — aggregates over "now" by default,
 * with the past one deliberate step away rather than gone.
 */

const agreement = defineNode("agreement", {
  fields: z.object({ label: z.string(), status: z.enum(["active", "lapsed", "superseded"]) }),
  plural: "Agreements",
  lifecycle: { field: "status", retired: ["lapsed", "superseded"] },
});

const pass = defineNode("pass", {
  fields: z.object({ label: z.string(), until: z.string().optional() }),
  plural: "Passes",
  lifecycle: { field: "until", retired: "date" },
});

const note = defineNode("note", { fields: z.object({ label: z.string() }) });

const schema = createSchema([agreement, pass, note]);

describe("isCurrent", () => {
  it("treats a kind with no lifecycle as current for ever", () => {
    expect(isCurrent(schema.tryDefinition("note"), { id: "n", kind: "note", label: "x" })).toBe(true);
    expect(isCurrent(undefined, { id: "n", kind: "ghost" })).toBe(true);
  });

  it("retires the listed values and nothing else", () => {
    const def = schema.tryDefinition("agreement");
    expect(isCurrent(def, { id: "a", kind: "agreement", status: "active" })).toBe(true);
    expect(isCurrent(def, { id: "a", kind: "agreement", status: "lapsed" })).toBe(false);
    expect(isCurrent(def, { id: "a", kind: "agreement", status: "superseded" })).toBe(false);
  });

  it('reads "date" as a half-open expiry, pinned by the injected today', () => {
    const def = schema.tryDefinition("pass");
    const node = (until?: string) => ({ id: "p", kind: "pass", until });
    // The `until` day itself is the first day out of force — effectivity's convention.
    expect(isCurrent(def, node("2026-09-01"), "2026-09-01")).toBe(true);
    expect(isCurrent(def, node("2026-08-31"), "2026-09-01")).toBe(false);
    expect(isCurrent(def, node("2027-01-01"), "2026-09-01")).toBe(true);
    // No date means no expiry.
    expect(isCurrent(def, node(undefined), "2026-09-01")).toBe(true);
    expect(isCurrent(def, node(""), "2026-09-01")).toBe(true);
  });
});

describe("the horizon applies to judgement", () => {
  const bound = bindSchema(schema);
  const flag = (name: string, judgesPast?: boolean) =>
    bound.defineInvariant(name, {
      scope: { kind: "agreement" },
      ...(judgesPast === undefined ? {} : { judgesPast }),
      evaluate: ({ subject }): Violation[] => [
        {
          invariant: name,
          subjectId: subject.id,
          label: name,
          message: "flagged",
          nodeIds: [subject.id],
          repairs: [],
        },
      ],
    });

  const graph = () =>
    Graph.from(schema, {
      nodes: [
        { id: "now", kind: "agreement", label: "current", status: "active" },
        { id: "then", kind: "agreement", label: "old", status: "lapsed" },
      ],
      edges: [],
    });

  it("does not judge retired subjects by default", () => {
    const violations = evaluate(graph(), [flag("always")]);
    expect(violations.map((v) => v.subjectId)).toEqual(["now"]);
  });

  it("judges them when the invariant opts into the past", () => {
    const violations = evaluate(graph(), [flag("audit", true)]);
    expect(violations.map((v) => v.subjectId).sort()).toEqual(["now", "then"]);
  });

  it("pins the clock for date lifecycles through options.today", () => {
    const expiring = bindSchema(schema).defineInvariant("pass-check", {
      scope: { kind: "pass" },
      evaluate: ({ subject }): Violation[] => [
        { invariant: "pass-check", subjectId: subject.id, label: "p", message: "m", nodeIds: [subject.id], repairs: [] },
      ],
    });
    const g = Graph.from(schema, {
      nodes: [{ id: "p1", kind: "pass", label: "gate", until: "2026-06-01" }],
      edges: [],
    });
    expect(evaluate(g, [expiring], { today: "2026-05-01" })).toHaveLength(1);
    expect(evaluate(g, [expiring], { today: "2026-07-01" })).toHaveLength(0);
  });
});

describe("identical violations collapse", () => {
  it("reports one problem when two identical rule nodes say the same thing", () => {
    const bound = bindSchema(schema);
    const shout = bound.defineInvariant("shout", {
      scope: { kind: "agreement" },
      evaluate: ({ subject }): Violation[] => [
        {
          invariant: "shout",
          subjectId: subject.id,
          label: "shout",
          message: "the same sentence",
          nodeIds: ["now"],
          repairs: [],
        },
      ],
    });
    const g = Graph.from(schema, {
      nodes: [
        { id: "now", kind: "agreement", label: "a", status: "active" },
        { id: "also", kind: "agreement", label: "b", status: "active" },
      ],
      edges: [],
    });
    // Two subjects, one claim about one node set: a reader sees one problem.
    expect(evaluate(g, [shout])).toHaveLength(1);
  });
});

describe("graview check knows about lifecycles", () => {
  const findings = (definition: ReturnType<typeof defineNode>) => {
    const app = defineApp({
      name: "test",
      schema: createSchema([definition]),
      mutations: [],
      invariants: [],
    });
    return checkApp(app).findings.map((f) => `${f.severity}:${f.code}`);
  };

  it("errors when the lifecycle reads a field the kind does not have", () => {
    const broken = defineNode("thing", {
      fields: z.object({ label: z.string() }),
      lifecycle: { field: "status", retired: ["done"] },
    });
    expect(findings(broken)).toContain("error:lifecycle-missing-field");
  });

  it("errors when nothing can ever retire", () => {
    const stuck = defineNode("thing", {
      fields: z.object({ label: z.string(), status: z.string() }),
      lifecycle: { field: "status", retired: [] },
    });
    expect(findings(stuck)).toContain("error:lifecycle-never-retires");
  });

  it("accepts a well-formed declaration", () => {
    const fine = defineNode("thing", {
      fields: z.object({ label: z.string(), status: z.string() }),
      lifecycle: { field: "status", retired: ["done"] },
    });
    expect(findings(fine).filter((f) => f.includes("lifecycle"))).toEqual([]);
  });
});
