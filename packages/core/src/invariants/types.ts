import type { GraphReader } from "../graph/types.js";
import type { AnySchema, KindOfSchema, NodeOfKind, NodeOfSchema } from "../schema/schema.js";

/**
 * A mutation that would resolve a violation. This field is the seam between
 * the invariant engine and derived affordances: it is why selecting an
 * out-of-balance set of duties can surface "rebalance" without anyone
 * writing a rule to produce that suggestion.
 */
export interface Repair {
  readonly mutation: string;
  /** Arguments already determined by the violation. */
  readonly args?: Readonly<Record<string, unknown>>;
  /** Arguments the caller still has to choose. */
  readonly missing?: readonly string[];
  readonly label: string;
}

/**
 * What a violation says about the rule that produced it. `violated` is a
 * judgement: the rule ran and the graph breaks it. The other two say the
 * rule could not answer — it threw, or it would have read more than its
 * budget — so a host counts them apart rather than matching the message.
 */
export type ViolationStatus = "violated" | "could-not-judge" | "over-budget";

export interface Violation {
  readonly invariant: string;
  /** Set by `evaluate`; a rule's own violations may leave it out and read as `violated`. */
  readonly status?: ViolationStatus;
  /** The node whose declaration produced the check, when there is one. */
  readonly subjectId?: string;
  readonly label: string;
  readonly message: string;
  /** Ids of the nodes that cause the violation, for cross-plane highlighting. */
  readonly nodeIds: readonly string[];
  readonly repairs: readonly Repair[];
}

/** Free-form evaluation context an app threads through (e.g. a week start). */
export type InvariantContext = Readonly<Record<string, unknown>>;

export interface InvariantScope<S extends AnySchema, K extends KindOfSchema<S>> {
  readonly kind: K;
  /** Narrows which nodes of the kind this invariant judges. */
  readonly match?: (node: NodeOfKind<S, K>) => boolean;
}

export interface InvariantEvalArgs<S extends AnySchema, Subject> {
  readonly graph: GraphReader<NodeOfSchema<S>>;
  readonly subject: Subject;
  readonly context: InvariantContext;
}

export interface InvariantDefinition<S extends AnySchema = AnySchema> {
  readonly name: string;
  readonly label?: string;
  readonly description?: string;
  readonly scope: { readonly kind: string; readonly match?: (node: never) => boolean } | "graph";
  /**
   * Mutation names this invariant may name as repairs. Declared statically so
   * `graview check` can catch a repair that points at a mutation nobody
   * registered, instead of discovering it when a violation fires.
   */
  readonly repairs?: readonly string[];
  /**
   * Judge retired subjects too. By default a scoped invariant sees only the
   * HORIZON — nodes current under their kind's lifecycle — because a rule
   * about last term's agreement is noise, not a violation. An invariant that
   * genuinely audits history says so here, explicitly.
   */
  readonly judgesPast?: boolean;
  readonly evaluate: (args: InvariantEvalArgs<S, never>) => Violation[];
}

export interface EvaluateOptions<S extends AnySchema = AnySchema> {
  readonly context?: InvariantContext;
  /** What to do when a node requires an invariant nobody registered. */
  readonly onUnregistered?: "skip" | "throw";
  /**
   * Pins "today" for the lifecycle horizon (YYYY-MM-DD). Without it the
   * date-retired check reads the real clock — pass this wherever determinism
   * matters (tests, replays).
   */
  readonly today?: string;
  /** Filters subject nodes before evaluation, e.g. by effectivity window. */
  readonly subjectFilter?: (
    node: NodeOfSchema<S>,
    context: InvariantContext,
  ) => boolean;
}
