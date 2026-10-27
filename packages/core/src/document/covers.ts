import type { AnyGraphNode, GraphReader } from "../graph/types.js";

/*
 * A COVERAGE RULE: "each candidate is linked, through its stances, to every
 * issue" (Roadmap f-rule-covers-every). Written in the rule language it is
 * `every(all('issue'), …)` for every candidate, and the checker rightly
 * says `rule-cost` of it: the evaluator would walk every issue for every
 * candidate. Declared as a shape instead —
 *
 *   { "over": "candidate", "covers": { "every": "issue", "through": "stances", "via": "issue" } }
 *
 * — the store judges it in one pass over the record's links: the set of
 * far records it reaches, held against the kind's live records, never
 * through the expression evaluator, so there is nothing to cost. Each far
 * record the near one does not reach is one problem naming both.
 */

/** As a rule declares it: the kind it must reach, the relation it walks from its subject, and the relation from there when the first stops short. */
export interface CoverSpec {
  readonly every: string;
  readonly through: string;
  readonly via?: string | undefined;
}

/** One step of the walk: a relation, walked out from the declaring kind or in from the far one. */
export interface CoverStep {
  readonly relation: string;
  /** `true`: the relation is declared on the kind the step leaves (`out`); `false`: on the kind it reaches (`in`). */
  readonly out: boolean;
}

/** A coverage rule resolved against the declaration: each step knows its direction, so judging it reads nothing but links. */
export interface CoverPlan {
  readonly every: string;
  readonly through: CoverStep;
  readonly via?: CoverStep;
}

/** What a relation is declared as, wherever a declaration is read: the kinds it leaves and the kinds it reaches. */
export interface RelationEnds {
  readonly from: readonly string[];
  readonly to: readonly string[] | "*";
}

/** Why a coverage rule could not be resolved: which key, and the sentence, in the person's voice. */
export interface CoverProblem {
  readonly key: "through" | "via" | "every";
  readonly message: string;
  readonly fix?: string;
}

const reaches = (ends: RelationEnds, kind: string): boolean => ends.to === "*" || ends.to.includes(kind);

/**
 * Which way a step walks: from `near`, out along a relation `near`
 * declares, or in along one declared toward it. The kinds it lands on
 * come back with it, so the next step can be resolved from them.
 */
function resolveStep(relation: string, near: readonly string[], relationOf: (name: string) => RelationEnds | undefined): { readonly step: CoverStep; readonly far: readonly string[] | "*" } | undefined {
  const ends = relationOf(relation);
  if (!ends) return undefined;
  if (near.some((kind) => ends.from.includes(kind))) return { step: { relation, out: true }, far: ends.to };
  if (near.some((kind) => reaches(ends, kind))) return { step: { relation, out: false }, far: ends.from };
  return undefined;
}

/**
 * Resolve a coverage rule against the declaration's relations, or say why
 * it cannot be: `through` must leave the rule's kind (or point at it), and
 * the walk must end on `every`'s kind — through `via` when it is given.
 */
export function resolveCovers(over: string, spec: CoverSpec, relationOf: (name: string) => RelationEnds | undefined, isKind: (name: string) => boolean): { readonly plan: CoverPlan } | { readonly problem: CoverProblem } {
  if (!isKind(spec.every)) return { problem: { key: "every", message: `"${spec.every}" is not a kind this document declares` } };
  const through = resolveStep(spec.through, [over], relationOf);
  if (!through) {
    const ends = relationOf(spec.through);
    return {
      problem: {
        key: "through",
        message: ends ? `"${spec.through}" is a relation of ${ends.from.join(", ")}, not of ${over}, so a ${over} cannot be followed through it` : `"${spec.through}" is not a relation any kind declares`,
        fix: ends ? `name a relation ${over} declares, or one that points at ${over}` : undefined,
      },
    };
  }
  const landed = through.far === "*" ? "*" : through.far;
  if (!spec.via) {
    if (landed === "*" || landed.includes(spec.every)) return { plan: { every: spec.every, through: through.step } };
    return {
      problem: {
        key: "through",
        message: `"${spec.through}" reaches ${landed.join(", ")}, not ${spec.every}`,
        fix: `add "via": the relation from ${landed.join(" or ")} to ${spec.every}, or name a relation that reaches ${spec.every}`,
      },
    };
  }
  /*
   * `via` leaves the kinds `through` landed on and reaches `every`. Where
   * `through` reaches any kind at all ("*"), it is read from the other end:
   * the relation `every` declares or is pointed at by, which from the
   * middle is walked the other way.
   */
  const nearVia = landed === "*" ? [spec.every] : landed;
  const via = resolveStep(spec.via, nearVia, relationOf);
  if (!via) {
    const ends = relationOf(spec.via);
    return {
      problem: {
        key: "via",
        message: ends ? `"${spec.via}" is a relation of ${ends.from.join(", ")}, which "${spec.through}" does not reach` : `"${spec.via}" is not a relation any kind declares`,
        fix: ends ? `name a relation of ${nearVia.join(" or ")}, or one that points at it` : undefined,
      },
    };
  }
  const end = landed === "*" ? [spec.every] : via.far;
  if (end === "*" || end.includes(spec.every)) return { plan: { every: spec.every, through: through.step, via: landed === "*" ? { relation: via.step.relation, out: !via.step.out } : via.step } };
  return { problem: { key: "via", message: `"${spec.via}" reaches ${end.join(", ")}, not ${spec.every}`, fix: `name a relation that reaches ${spec.every}` } };
}

const walk = (graph: GraphReader, id: string, step: CoverStep): readonly AnyGraphNode[] => (step.out ? graph.out(id, step.relation) : graph.in(id, step.relation));

/**
 * THE RECORDS A SUBJECT DOES NOT REACH, in one pass: every record the
 * subject's links lead to through the plan, as a set, held against the
 * live records of the covered kind (an archived one counts in no rule
 * that does not ask, as `all()` holds). Linear in the subject's links.
 */
export function uncovered(graph: GraphReader, subject: AnyGraphNode, plan: CoverPlan): AnyGraphNode[] {
  const reached = new Set<string>();
  for (const mid of walk(graph, subject.id, plan.through)) {
    if (!plan.via) {
      reached.add(mid.id);
      continue;
    }
    for (const far of walk(graph, mid.id, plan.via)) reached.add(far.id);
  }
  return graph.nodesOfKind(plan.every).filter((node) => !reached.has(node.id));
}
