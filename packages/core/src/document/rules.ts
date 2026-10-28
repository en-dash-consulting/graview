/*
 * From the barrel on purpose, unlike the document's other files: imported
 * from the engine's own file, the rules made the engine a chunk of its own
 * on a hosted page, half a kilobyte more up front (docs/hosted-page.md).
 */
import { defineInvariant, RuleBudgetError, type AnyGraphNode, type AnySchema, type GraphReader, type InvariantDefinition, type Violation } from "../index.js";

import { evaluateExpr, ExprBudgetError, ExprEvalError, GRAPH_FACTS, unreadSaid, type KindShape, type UnreadLink } from "./expr/evaluate.js";
import { parseExpr } from "./expr/parse.js";
import { renderTemplate } from "./template.js";
import { isoToday } from "../days.js";
import { parseTemplate } from "./template-parse.js";
import { parsedComputed } from "./computed.js";
import { linkedRelations, type LinkedReader } from "../schema/linked.js";
import { resolveCovers, uncovered, type CoverPlan, type CoverSpec } from "./covers.js";

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
    // A relation to another app's kinds is a field the link is kept in, marked with the relation (FR-171).
    const linked = linkedRelations(definition);
    shapes.set(kind, {
      fields: new Set(Object.keys(definition?.fields?.shape ?? {})),
      edges: new Map(Object.entries(definition?.edges ?? {}).map(([name, edge]) => [name, edge.cardinality ?? "many"])),
      ...(computed ? { computed } : {}),
      ...(linked.size > 0 ? { linked } : {}),
    });
  }
  // And the whole graph's facts, which `fact('<name>')` reads: no record is of this shape.
  const facts = parsedComputed(schema);
  if (facts) shapes.set(GRAPH_FACTS, { computed: facts } as KindShape);
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
  const today = options.today ?? isoToday;
  // The store's day when it hands one (pinned, or ticked: FR-176), else the clock.
  const judge = (graph: GraphReader, subject: AnyGraphNode | null, day = today(), linked?: LinkedReader): Violation[] => {
    const shapes = (kinds ?? shapesOf(graph)) as Map<string, KindShape>;
    // A link to another app that could not be read (FR-171): a rule that does not hold without it cannot be judged, and says why.
    const unread: UnreadLink[] = [];
    const ctx = { graph, subject, kinds: shapes, today: day, ...(linked ? { linked } : {}), onUnread: (u: UnreadLink) => unread.push(u) };
    try {
      if (when && evaluateExpr(when, ctx) !== true) return [];
      if (evaluateExpr(require, ctx) === true) return [];
      if (unread.length > 0) throw new ExprEvalError(`it reads ${unreadSaid(unread[0]!)}`, 0);
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
        message: says ? renderTemplate(says, { node: subject, kinds: shapes, graph, today: day }) : title,
        nodeIds: subject ? [subject.id] : [],
        repairs: (spec.repairs ?? []).map((mutation) => ({ mutation, label: mutation.replace(/-/g, " "), args: subject ? { id: subject.id } : {} })),
      },
    ];
  };
  const common = {
    label: title,
    // What its line is said from (`@graview/core/lines`): data, so judging it carries no words.
    shape: { over: spec.over, require, when, says, ...(kinds ? { kinds } : {}), today },
    judgment: { require: spec.require, ...(spec.when ? { when: spec.when } : {}), ...(spec.says ? { says: spec.says } : {}) },
    ...(spec.description ? { description: spec.description } : {}),
    ...(spec.repairs && spec.repairs.length > 0 ? { repairs: [...spec.repairs] } : {}),
    ...(spec.judgesPast ? { judgesPast: true } : {}),
  };
  return (
    spec.over === "graph"
      ? defineInvariant(name, { scope: "graph", ...common, evaluate: ({ graph, today: day, context }: { graph: unknown; today?: string; context?: { linked?: LinkedReader } }) => judge(graph as GraphReader, null, day, context?.linked) } as never)
      : defineInvariant(name, { scope: { kind: spec.over }, ...common, evaluate: ({ graph, subject, today: day, context }: { graph: unknown; subject: unknown; today?: string; context?: { linked?: LinkedReader } }) => judge(graph as GraphReader, subject as AnyGraphNode, day, context?.linked) } as never)
  ) as InvariantDefinition;
}

/** A coverage rule, as a TypeScript declaration writes one: each record of `over` reaches every record of `covers.every` through its links. */
export interface CoverageRuleSpec {
  /** The kind whose records are each held to the coverage. */
  readonly over: string;
  /** The kind every record must reach, the relation walked from the record, and the relation from there when the first stops short. */
  readonly covers: CoverSpec;
  /** Only the records for which this holds are judged. */
  readonly when?: string;
  /** The sentence each missing pair says: "{candidate} has no stance on {issue}" — either record by its kind's name, the subject's fields bare. */
  readonly says?: string;
  readonly title?: string;
  readonly description?: string;
  readonly repairs?: readonly string[];
  readonly judgesPast?: boolean;
}

const PLANS = new WeakMap<object, Map<string, CoverPlan | string>>();

/**
 * A RULE THAT EACH RECORD IS LINKED TO EVERY RECORD OF A KIND (Roadmap
 * f-rule-covers-every), the TypeScript twin of a document's `covers`.
 * Written in the rule language — `every(all('issue'), …)` for every
 * candidate — the checker says `rule-cost` of it; declared as a walk it is
 * judged in one pass over the record's links, never through the evaluator,
 * and each far record the subject does not reach is one problem naming
 * both. The walk's directions are read from the schema of the graph being
 * judged, once per schema; a relation that does not reach the kind is
 * `could-not-judge`, in the words `graview check` would have said.
 */
export function coverageRule(name: string, spec: CoverageRuleSpec, options: { readonly today?: () => string } = {}): InvariantDefinition {
  const when = spec.when ? parseExpr(spec.when) : undefined;
  const says = spec.says ? parseTemplate(spec.says) : undefined;
  const title = spec.title ?? name.replace(/-/g, " ");
  const today = options.today ?? isoToday;
  const planOf = (graph: GraphReader): CoverPlan => {
    const schema = (graph as { readonly schema?: AnySchema }).schema;
    if (!schema) throw new Error("a coverage rule needs the graph's kinds: judge a Graph, which carries its schema");
    let plans = PLANS.get(schema);
    if (!plans) PLANS.set(schema, (plans = new Map()));
    let plan = plans.get(name);
    if (plan === undefined) {
      const resolved = resolveCovers(spec.over, spec.covers, (relation) => schema.edge(relation), (kind) => schema.tryDefinition(kind) !== undefined);
      plan = "plan" in resolved ? resolved.plan : `its "${resolved.problem.key}" cannot be followed: ${resolved.problem.message}`;
      plans.set(name, plan);
    }
    if (typeof plan === "string") throw new Error(plan);
    return plan;
  };
  const judge = (graph: GraphReader, subject: AnyGraphNode, day = today()): Violation[] => {
    const shapes = shapesOf(graph);
    const ctx = { graph, subject, kinds: shapes, today: day };
    try {
      if (when && evaluateExpr(when, ctx) !== true) return [];
    } catch (error) {
      if (error instanceof ExprBudgetError) throw new RuleBudgetError(error.sentence);
      if (error instanceof ExprEvalError) throw new Error(error.sentence);
      throw error;
    }
    const label = (node: AnyGraphNode): string => {
      const definition = (graph as { readonly schema?: AnySchema }).schema?.tryDefinition(node.kind) as { label?: (n: AnyGraphNode) => string } | undefined;
      return definition?.label?.(node) ?? node.id;
    };
    return uncovered(graph, subject, planOf(graph)).map((far) => ({
      invariant: name,
      subjectId: subject.id,
      label: title,
      message: says ? renderTemplate(says, { node: subject, kinds: shapes, graph, today: day, bindings: { [subject.kind]: subject, [far.kind]: far } }) : `${label(subject)}: ${title} — ${label(far)}`,
      nodeIds: [subject.id, far.id],
      repairs: (spec.repairs ?? []).map((mutation) => ({ mutation, label: mutation.replace(/-/g, " "), args: { id: subject.id } })),
    }));
  };
  return defineInvariant(name, {
    scope: { kind: spec.over },
    label: title,
    // What its line is said from (`@graview/core/lines`), once the graph's schema has resolved the walk; `covers` as declared until then.
    shape: { over: spec.over, covers: { every: spec.covers.every, through: { relation: spec.covers.through, out: true }, ...(spec.covers.via ? { via: { relation: spec.covers.via, out: true } } : {}) }, when, says, today },
    judgment: { covers: spec.covers, ...(spec.when ? { when: spec.when } : {}), ...(spec.says ? { says: spec.says } : {}) },
    ...(spec.description ? { description: spec.description } : {}),
    ...(spec.repairs && spec.repairs.length > 0 ? { repairs: [...spec.repairs] } : {}),
    ...(spec.judgesPast ? { judgesPast: true } : {}),
    evaluate: ({ graph, subject, today: day }: { graph: unknown; subject: unknown; today?: string }) => judge(graph as GraphReader, subject as AnyGraphNode, day),
  } as never) as InvariantDefinition;
}
