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
  /**
   * The id of the seat this act is run by — the person, for an agent acting
   * for one; their record of the people kind, where they have one. What a
   * document act's `$me` reads. Undefined for a seat with no id.
   */
  readonly me?: string | undefined;
  addNode(node: NodeOfSchema<S>): void;
  /** Removes a node together with every edge touching it. */
  removeNode(id: string): void;
  patchNode(id: string, fields: Record<string, unknown>): void;
  /**
   * Sets a record aside (FR-173): its fields, links and history kept, and
   * it out of lists, the Scene, counts, computed fields and rules. Nothing
   * when it is archived already.
   */
  archiveNode(id: string): void;
  /** Brings an archived record back. Nothing when it is not archived. */
  unarchiveNode(id: string): void;
  /**
   * Merges two records that are one thing (FR-173): the kept one (`into`)
   * takes the duplicate's links, and the duplicate is archived, its op
   * saying `mergedInto`. Undone as one, like any act.
   */
  mergeNode(duplicate: string, into: string): void;
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
   * True when running this twice with the same arguments changes nothing
   * the first run did not: setting a status, writing a field, removing a
   * record. Read by an agent seat as MCP's `idempotentHint`, so a model may
   * retry it safely. Absent means not known to be, which is the safe
   * reading — an act that makes a record makes another each time.
   */
  readonly idempotent?: boolean;
  /**
   * Node kinds this mutation brings into existence.
   *
   * The other half of the affordance seam. `subject` answers "what can I do
   * WITH this thing"; `creates` answers the question an empty kind card
   * poses — "how does the first one get here". Declared rather than
   * inferred, because what `apply` adds is not statically knowable, and the
   * empty state is exactly where a wrong guess would strand someone.
   *
   * An act that declares this also takes an optional `id` argument the
   * framework adds: the id of the node it makes, when the caller has one —
   * a seed being synced, an agent that will refer to the node in its next
   * call. `freshId` hands it out first; an id already in the graph is
   * refused by name rather than quietly suffixed.
   */
  readonly creates?: readonly KindOfSchema<S>[];
  /**
   * Edge kinds this mutation makes, and edge kinds it breaks.
   *
   * The seam that lets a LINE offer its own actions: select the drawn edge
   * and every mutation that declares its kind derives an offer, endpoints
   * prefilled by matching argument kinds. Declared, like `creates`, because
   * what `apply` does to edges is not statically knowable.
   */
  readonly connects?: readonly string[];
  readonly severs?: readonly string[];
  /**
   * How this act reads from the OTHER end of the tie.
   *
   * An act that declares what it connects or severs is offered from either
   * endpoint — standing on a person, "take this one off the run" is the
   * natural thing to say. The button there was labeled with `title`, which
   * is written from the subject's side: "Hand it to someone", offered on the
   * person, reads as handing the PERSON to someone.
   *
   * Declared rather than derived, for the reason `connects` is: an edge's
   * `inverse` gives the relation's two readings but not the verb, and a
   * guessed verb on a control that changes the graph is the wrong place to
   * be nearly right. `graview check` warns `act-without-far-end-reading`
   * when an act is offerable from an end it has no words for, naming that
   * end — the same warning shape as `edge-without-inverse`.
   */
  readonly fromTheOtherEnd?: string;
  /**
   * Fields of the SUBJECT this mutation writes.
   *
   * The declared answer to "what changes this field", which the in-place
   * edit and the derived edit act both read. Without it the framework
   * guesses from names — an input argument called exactly like a field
   * writes that field — which is right for `rename(label)` and blind to
   * `finish()` setting `done`. Declared, the guess is replaced rather than
   * added to: a mutation that says what it writes is believed about it, and
   * only about it.
   */
  readonly writes?: readonly string[];
  /**
   * Fields of records OTHER than the subject this mutation writes, by kind:
   * a document act's `setsOther` (FR-115), or a `set` on the record at an
   * end of a link it makes. Not the subject's, so not in `writes`; but a
   * field another act sets is not one a derived edit offers freely
   * (`fieldWriters` counts these).
   */
  readonly writesOther?: Readonly<Record<string, readonly string[]>>;
  /**
   * Fields of its subject this act does not take because another act
   * writes them, by field: the acts that do. A derived edit carries it, so
   * an edit given `whatToDo` is refused with "whatToDo is set by
   * set-verdict" rather than only the arguments it takes.
   */
  readonly writtenBy?: Readonly<Record<string, readonly string[]>>;
  /**
   * Fields of the SUBJECT this mutation sets to a fixed value, whatever it
   * is told: `mark-fixed` sets `status` to `"fixed"`. A named step, read as
   * one — a status board offers it as the move to that value's column
   * (FR-108). A document's act has it worked out from its `sets`; a
   * mutation written in TypeScript says it, as it says `writes`.
   */
  readonly sets?: Readonly<Record<string, string | number | boolean>>;
  /**
   * Node KINDS this mutation's own logic reads — what `apply` and
   * `describe` look at in the graph beyond the records it is handed.
   *
   * Declared, like `writes`, because a TypeScript body cannot be read
   * without running it. `graview check` warns when a role that may run the
   * act may not see a kind it reads (`act-reads-hidden-kind`, FR-105): run
   * by that seat, the act reads under its sight and judges as though there
   * were none of them. A document's act needs no such list — its condition,
   * its refusal and its effects are read for it.
   */
  readonly reads?: readonly string[];
  /**
   * The app saying "this is the act of this product". A pinned mutation
   * ranks above its unpinned peers wherever actions are offered — never
   * above a rule's repairs, never out of the destructive tail — and sits
   * in the menu's head section. A person's own pins, made from the menu,
   * outrank the app's.
   */
  readonly pinned?: boolean;
  /** One-line description of a concrete application, for previews and logs. */
  describe?(args: z.infer<I>, graph: GraphReader<NodeOfSchema<S>>): string;
  apply(context: MutationContext<S>, args: z.infer<I>): void;
}

export interface MutationDefinition<
  S extends AnySchema = AnySchema,
  Name extends string = string,
  I extends z.ZodType = z.ZodType,
> extends MutationDefinitionSpec<S, I> {
  readonly name: Name;
  /**
   * Set by the framework on a mutation it derived rather than an app
   * declared: the per-kind edit act, or the per-kind remove act. An edit's
   * permission resolves through the declared acts that already write or
   * create the kind; a remove's through the acts that create it — who may
   * bring a thing into being may take it out — so a policy needs no second
   * list for either.
   */
  readonly derived?: { readonly kind: string; readonly act: DerivedAct; readonly relation?: string };
}

/** The acts the framework gives every kind: edit and remove, and archive, unarchive and merge (FR-173); and every relation of a kind, connect and disconnect (`relation` names it). */
export type DerivedAct = "edit" | "remove" | "archive" | "unarchive" | "merge" | "leave-alone" | "allow-tidying" | "skip" | "detach" | "split" | "connect" | "disconnect";

export type AnyMutationDefinition<S extends AnySchema = AnySchema> =
  MutationDefinition<S, string, z.ZodType>;

/** A concrete, ready-to-apply mutation: a name plus validated arguments. */
export interface MutationCall<Name extends string = string> {
  readonly name: Name;
  readonly args: Record<string, unknown>;
  /**
   * The id a client minted on its own for the record this call makes, when
   * it applied the call first (Roadmap f-1-0-client-ids): a hint, never a
   * demand. The store makes the record under it when it is free, and mints
   * as ever when it is not — and a later call of the same change naming it
   * then names the record the store made. An `id` argument is the demand.
   */
  readonly mintedHint?: string;
}
