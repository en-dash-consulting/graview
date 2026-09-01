import type { z } from "zod";
import type { Primitive } from "../graph/primitives.js";
import type { GraphEdge, GraphReader } from "../graph/types.js";
import type { AnySchema, KindOfSchema, NodeOfSchema } from "../schema/schema.js";

/**
 * What a mutation is handed. Reads go through a tracked reader so the op log
 * records causality; writes go out as primitives so every op has an inverse.
 */
export interface MutationContext<S extends AnySchema> {
  readonly graph: GraphReader<NodeOfSchema<S>>;
  readonly schema: S;
  addNode(node: NodeOfSchema<S>): void;
  /** Removes a node together with every edge touching it. */
  removeNode(id: string): void;
  patchNode(id: string, fields: Record<string, unknown>): void;
  addEdge(edge: GraphEdge): void;
  removeEdge(edge: GraphEdge): void;
  /** Replaces every `kind` edge arriving at `to` with one from `from`. */
  setSingleSource(kind: string, to: string, from: string): void;
  /** A deterministic, collision-free id derived from a label. */
  freshId(label: string, prefix?: string): string;
  /** Raw escape hatch — prefer the helpers above. */
  emit(primitive: Primitive): void;
}

export interface MutationDefinitionSpec<S extends AnySchema, I extends z.ZodType> {
  readonly input: I;
  /** Short human title, e.g. "Reassign run". */
  readonly title?: string;
  readonly description?: string;
  /**
   * Node kinds this mutation acts on, and the argument the subject binds to.
   * This is the seam that makes affordances derivable: given a selection of
   * `duty` nodes, every mutation whose subject accepts `duty` is legal.
   */
  readonly subject?: {
    readonly kinds: readonly KindOfSchema<S>[] | "*";
    readonly arg: string;
  };
  /**
   * True when applying this loses something a person made — a node removed,
   * work dropped, an edge severed for good. The interface lists these after
   * everything else and marks them; an agent seat inherits the same order.
   * Absent means safe, which is the common case and the safe default to get
   * wrong: an unmarked destructive mutation is merely unranked, a marked
   * safe one is merely over-cautious.
   */
  readonly destructive?: boolean;
  /**
   * Node kinds this mutation brings into existence.
   *
   * The other half of the affordance seam. `subject` answers "what can I do
   * WITH this thing"; `creates` answers the question an empty kind card
   * poses — "how does the first one get here". Declared rather than
   * inferred, because what `apply` adds is not statically knowable, and the
   * empty state is exactly where a wrong guess would strand someone.
   */
  readonly creates?: readonly KindOfSchema<S>[];
  /** One-line description of a concrete application, for previews and logs. */
  readonly describe?: (args: z.infer<I>, graph: GraphReader<NodeOfSchema<S>>) => string;
  readonly apply: (context: MutationContext<S>, args: z.infer<I>) => void;
}

export interface MutationDefinition<
  S extends AnySchema = AnySchema,
  Name extends string = string,
  I extends z.ZodType = z.ZodType,
> extends MutationDefinitionSpec<S, I> {
  readonly name: Name;
}

export type AnyMutationDefinition<S extends AnySchema = AnySchema> =
  MutationDefinition<S, string, z.ZodType>;

/** A concrete, ready-to-apply mutation: a name plus validated arguments. */
export interface MutationCall<Name extends string = string> {
  readonly name: Name;
  readonly args: Record<string, unknown>;
}
