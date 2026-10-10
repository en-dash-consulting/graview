/**
 * `@graview/core/lines` — A RULE SAID AS ITS SHAPE, fetched by what draws one.
 *
 * A rule written in the rule language carries its parsed judgment
 * (`InvariantDefinition.shape`); this says it in the declaration's words —
 * "margin ≥ target margin, when plan's price > $0" — and says what a record
 * that breaks it holds: "A club on Team — margin 44% < target margin 50%".
 * Its own entry because the words are needed only where a rule is drawn:
 * a page that judges rules on its first load does not carry them, and the
 * problems' rows, the problems page and the seat fetch them as they draw.
 */
import type { AnySchema } from "./schema/schema.js";
import type { GraphReader } from "./graph/types.js";
import type { InvariantDefinition, RuleShapeSource, Violation } from "./invariants/types.js";
import type { RuleLine } from "./invariants/line.js";
import type { KindShape } from "./document/expr/evaluate.js";
import { brokenLineOf, formatsSaid, ruleLineOf, type LineWords } from "./document/rule-line.js";
import { shapesOfSchema } from "./document/rules.js";
import { judgedWith } from "./invariants/engine.js";

export { brokenLineOf, ruleLineOf } from "./document/rule-line.js";
export { problemWords, ruleLineWords, ruleSpacing, ruleSpoken, ruleText } from "./invariants/line.js";
export type { LineWords, LinedRule } from "./document/rule-line.js";

/** A document field's declared format: a margin a percent, a price money in its unit, a date a day. */
function formatsOf(declared: NonNullable<RuleShapeSource["declared"]>): NonNullable<LineWords["formatOf"]> {
  return (kind, field) => {
    const spec = declared[kind]?.fields?.[field];
    const format = spec?.format ?? (spec?.type === "date" ? "date" : undefined);
    return format || spec?.unit ? { ...(format ? { format } : {}), ...(spec?.unit ? { unit: spec.unit } : {}) } : undefined;
  };
}

function wordsOf(shape: RuleShapeSource, schema: AnySchema): LineWords {
  return {
    schema,
    said: formatsSaid(shape.says),
    ...(shape.declared ? { formatOf: formatsOf(shape.declared) } : {}),
    ...(shape.money ? { money: shape.money } : {}),
  };
}

/** A rule's line from its declaration, or nothing for a rule that is a function. */
export function ruleLine(invariant: Pick<InvariantDefinition, "shape">, schema: AnySchema): RuleLine | undefined {
  return invariant.shape ? ruleLineOf(invariant.shape, wordsOf(invariant.shape, schema)) : undefined;
}

const SHAPES = new WeakMap<object, Map<string, KindShape>>();

/**
 * THE PROBLEMS, EACH WITH ITS LINE where its rule has a shape: the record's
 * values, the comparison turned the way it stands. A rule that wrote no
 * sentence of its own (`says`) says the same in its `message`, after its
 * title — "A club on Team: Margin above target — margin 44% < target
 * margin 50%" — so a host, a chat or a model that reads only the message
 * reads the values too (FR-159); a rule's own sentence is left as its
 * author wrote it. A violation of a rule that is a function, or one that
 * could not be judged, is handed back as it came. Never throws: a line that
 * cannot be worked out is left off.
 *
 * Loading this entry hands it to the engine too (`evaluate`), so every
 * judgment after carries its lines without asking.
 */
export function withLines<V extends Violation>(
  source: { readonly graph: GraphReader; readonly schema: AnySchema; allInvariants(): readonly Pick<InvariantDefinition, "name" | "shape">[]; today?(): string | undefined },
  violations: readonly V[],
): V[] {
  const rules = new Map(source.allInvariants().map((rule) => [rule.name, rule]));
  return violations.map((violation) => {
    const shape = rules.get(violation.invariant)?.shape;
    if (!shape || violation.line || (violation.status && violation.status !== "violated")) return violation;
    const subject = violation.subjectId ? source.graph.getNode(violation.subjectId) : undefined;
    if (shape.over !== "graph" && !subject) return violation;
    let kinds = shape.kinds;
    if (!kinds) {
      kinds = SHAPES.get(source.schema);
      if (!kinds) SHAPES.set(source.schema, (kinds = shapesOfSchema(source.schema)));
    }
    try {
      const today = shape.today?.() ?? source.today?.() ?? new Date().toISOString().slice(0, 10);
      const line = brokenLineOf(shape, wordsOf(shape, source.schema), { graph: source.graph, subject: subject ?? null, kinds, today });
      return { ...violation, line, ...(shape.says ? {} : { message: `${violation.message} — ${line.text}` }) };
    } catch {
      return violation;
    }
  });
}

/**
 * EVERY JUDGMENT FROM NOW ON CARRIES ITS LINES (FR-159): `evaluate`, and so
 * `store.violations()` and every surface over it, hands back each broken
 * rule's line and says its values in its message where the rule wrote no
 * sentence of its own. Loading this entry does it already; a server that
 * judges with nothing else of this entry calls it, so a bundler that drops
 * an import nothing names cannot leave the words out. `@graview/ship`'s
 * store handler and a seat's tools do.
 */
export function judgeWithLines(): void {
  judgedWith((graph, invariants, violations) => withLines({ graph, schema: graph.schema, allInvariants: () => invariants }, violations));
}

judgeWithLines();
