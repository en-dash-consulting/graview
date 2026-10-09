/*
 * From the barrel on purpose, unlike the document's other files: imported
 * from the engine's own file, the rules made the engine a chunk of its own
 * on a hosted page, half a kilobyte more up front (docs/hosted-page.md).
 */
import { defineInvariant, RuleBudgetError, type AnyGraphNode, type AnySchema, type GraphReader, type InvariantDefinition, type Violation } from "../index.js";

import { evaluateExpr, ExprBudgetError, ExprEvalError, type KindShape } from "./expr/evaluate.js";
import { parseExpr } from "./expr/parse.js";
import { renderTemplate } from "./template.js";
import { parseTemplate } from "./template-parse.js";
import { parsedComputed } from "./computed.js";

/**
 * What every kind of a COMPILED schema holds, for the rule language to read
 * names against: its fields, and its relations with their cardinality (a
 * relation of one reads as that record, a relation of many as a set), and
 * its computed fields, parsed (FR-83). The
 * document compiler builds the same from a document; this reads it from any
 * declaration, TypeScript or document alike.
 */
export function shapesOfSchema(schema: AnySchema): Map<string, KindShape> {
  const shapes = new Map<string, KindShape>();
  for (const kind of schema.kinds as readonly string[]) {
    const definition = schema.tryDefinition(kind) as ({ fields?: { shape?: Record<string, unknown> }; edges?: Record<string, { cardinality?: "one" | "many" }> } & Parameters<typeof parsedComputed>[0]) | undefined;
    const computed = parsedComputed(definition);
    shapes.set(kind, {
      fields: new Set(Object.keys(definition?.fields?.shape ?? {})),
      edges: new Map(Object.entries(definition?.edges ?? {}).map(([name, edge]) => [name, edge.cardinality ?? "many"])),
      ...(computed ? { computed } : {}),
    });
  }
  return shapes;
}

const SHAPES = new WeakMap<object, Map<string, KindShape>>();
/** The shapes of the schema a graph was made with, read once per schema. */
function shapesOf(graph: GraphReader): Map<string, KindShape> {
  const schema = (graph as { readonly schema?: AnySchema }).schema;
  if (!schema) throw new Error("a rule judged in words needs its kinds: pass them, or judge a Graph, which carries its schema");
  let shapes = SHAPES.get(schema);
  if (!shapes) SHAPES.set(schema, (shapes = shapesOfSchema(schema)));
  return shapes;
}

/** A rule whose judgment is written in the rule language rather than as a function. */
export interface ExpressionRuleSpec {
  /** The kind it judges, one violation per record; or the whole graph, at most one. */
  readonly over: string | "graph";
  /** What must hold. */
  readonly require: string;
  /** Only the records for which this holds are judged. */
  readonly when?: string;
  /** The sentence a violation says, as a template over the record: "{name} is booked but has no quote". */
  readonly says?: string;
  readonly title?: string;
  readonly description?: string;
  /** Acts that put it right, by name; each is offered with the subject as its `id`. */
  readonly repairs?: readonly string[];
  readonly judgesPast?: boolean;
}

/**
 * A RULE THAT SAYS WHAT MUST HOLD, AND IS JUDGED (FR-07). The studio and a
 * checkout write a rule's judgment in the rule language instead of a
 * function the studio cannot see; this makes it the invariant the engine
 * runs. A syntax error is thrown here, when the rule is made — never later,
 * while judging. Out of budget is `over-budget`; any other mistake while
 * judging is `could-not-judge`; both name the rule and its subject.
 */
export function expressionRule(
  name: string,
  spec: ExpressionRuleSpec,
  /** What each kind holds. Absent: read from the schema of the graph being judged, once per schema. */
  kinds?: ReadonlyMap<string, KindShape>,
  options: { readonly today?: () => string } = {},
): InvariantDefinition {
  const require = parseExpr(spec.require);
  const when = spec.when ? parseExpr(spec.when) : undefined;
  const says = spec.says ? parseTemplate(spec.says) : undefined;
  const title = spec.title ?? name.replace(/-/g, " ");
  const today = options.today ?? (() => new Date().toISOString().slice(0, 10));
  const judge = (graph: GraphReader, subject: AnyGraphNode | null): Violation[] => {
    const shapes = (kinds ?? shapesOf(graph)) as Map<string, KindShape>;
    const ctx = { graph, subject, kinds: shapes, today: today() };
    try {
      if (when && evaluateExpr(when, ctx) !== true) return [];
      if (evaluateExpr(require, ctx) === true) return [];
    } catch (error) {
      if (error instanceof ExprBudgetError) throw new RuleBudgetError(error.sentence);
      if (error instanceof ExprEvalError) throw new Error(error.sentence);
      throw error;
    }
    return [
      {
        invariant: name,
        ...(subject ? { subjectId: subject.id } : {}),
        label: title,
        message: says ? renderTemplate(says, { node: subject, kinds: shapes, graph, today: today() }) : title,
        nodeIds: subject ? [subject.id] : [],
        repairs: (spec.repairs ?? []).map((mutation) => ({ mutation, label: mutation.replace(/-/g, " "), args: subject ? { id: subject.id } : {} })),
      },
    ];
  };
  const common = {
    label: title,
    judgment: { require: spec.require, ...(spec.when ? { when: spec.when } : {}), ...(spec.says ? { says: spec.says } : {}) },
    ...(spec.description ? { description: spec.description } : {}),
    ...(spec.repairs && spec.repairs.length > 0 ? { repairs: [...spec.repairs] } : {}),
    ...(spec.judgesPast ? { judgesPast: true } : {}),
  };
  return (
    spec.over === "graph"
      ? defineInvariant(name, { scope: "graph", ...common, evaluate: ({ graph }: { graph: unknown }) => judge(graph as GraphReader, null) } as never)
      : defineInvariant(name, { scope: { kind: spec.over }, ...common, evaluate: ({ graph, subject }: { graph: unknown; subject: unknown }) => judge(graph as GraphReader, subject as AnyGraphNode) } as never)
  ) as InvariantDefinition;
}
