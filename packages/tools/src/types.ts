import type { AnySchema, NodeOfSchema, Refusal, Store, Violation } from "@graview/core";

/** Which provider contributed an action. Ranking reads this. */
export type ProviderName = "invariant" | "structure" | "schema" | "lens" | "llm";

/** An argument the action still needs, and what would satisfy it. */
import type { ArgShape } from "@graview/core";

export interface OpenParameter {
  readonly name: string;
  /** Node kinds this argument accepts, when it names a node. */
  readonly kinds?: readonly string[];
  /** Ids the framework already knows would fit, so the UI can offer them. */
  readonly candidates?: readonly string[];
  /**
   * What sort of answer it wants, read off the mutation's own schema.
   *
   * Without this an interface can only offer candidate ids, so every action
   * needing a name, a date or a time was a dead end that looked live —
   * "Rename · needs label" opened a list of nothing. The declaration always
   * knew `label` was a non-empty string; nobody had asked it.
   */
  readonly shape?: ArgShape;
}

/**
 * A legal thing to do with the current selection.
 *
 * Nobody authored these per selection. Each one is a typed mutation the
 * providers below found by looking at the schema, the invariants and the
 * shape of the graph — which is why a useful suggestion can appear that no
 * rule was written to produce.
 */
export interface Affordance {
  readonly id: string;
  readonly label: string;
  readonly provider: ProviderName;
  /** The mutation this would run. Every action is a typed mutation. */
  readonly mutation: string;
  /** Arguments already determined. */
  readonly args: Readonly<Record<string, unknown>>;
  /** Arguments the person or agent still has to choose. */
  readonly open: readonly OpenParameter[];
  /** Several calls when the action applies across a whole selection. */
  readonly batch?: readonly Readonly<Record<string, unknown>>[];
  /** Higher sorts first. */
  readonly score: number;
  /** The observation that produced it, in the interface's own words. */
  readonly why: string;
  /** Nodes this acts on, for highlighting across planes. */
  readonly nodeIds: readonly string[];
}

/** Something true about the selection that no rule was written to notice. */
export interface Observation {
  readonly id: string;
  readonly text: string;
  readonly nodeIds: readonly string[];
}

export interface DeriveContext<S extends AnySchema> {
  readonly store: Store<S>;
  readonly selection: readonly string[];
  readonly nodes: readonly NodeOfSchema<S>[];
  /** Current violations, evaluated once and shared by every provider. */
  readonly violations: readonly Violation[];
  readonly context: Readonly<Record<string, unknown>>;
}

export interface AffordanceProvider<S extends AnySchema> {
  readonly name: ProviderName;
  derive(context: DeriveContext<S>): {
    affordances?: readonly Affordance[];
    observations?: readonly Observation[];
  };
}

/** An action that exists, that this principal may not take, and why. */
export interface WithheldAffordance extends Affordance {
  readonly refusal: Refusal;
}

export interface AffordanceSet {
  readonly affordances: readonly Affordance[];
  /**
   * Actions withheld by permission. Stated rather than hidden: an interface
   * shows them disabled with the reason, and an agent is told a capability
   * exists that it may not use, which is not the same as it not existing.
   */
  readonly withheld: readonly WithheldAffordance[];
  readonly observations: readonly Observation[];
  /** Milliseconds spent deriving, so a caller can see it stays cheap. */
  readonly ms: number;
}
