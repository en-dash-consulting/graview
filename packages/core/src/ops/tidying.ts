import { LEFT_ALONE } from "../graph/archived.js";
import type { Primitive } from "../graph/primitives.js";
import type { MutationCall } from "../mutations/types.js";
import { labelOf, pluralOf } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import type { Author, Operation } from "./types.js";

/*
 * THE APP'S OWN ACTOR, HELD TO WHAT PEOPLE SAID.
 *
 * A background actor — "Graview, tidying" — links and prunes records on its
 * own: what it is sure of it applies, with lineage; what it is not sure of
 * it suggests, and the suggestion waits for a person (`suggest`, on
 * `@graview/core/tidying`). A
 * person can say "leave this one alone" of a record, a declaration can say
 * a kind or a relation is never tidied, and a person can decline a
 * suggestion. The store holds the actor to all three, here, whatever path
 * its change takes. The framework records, draws and explains; what to
 * link or prune is the actor's to judge. Everything here is on the page
 * the store is, so it is kept to what the store holds the actor to; the
 * suggestions waiting are `suggestions.ts`'s and Activity's digest is
 * `digest.ts`'s, both fetched with `@graview/core/tidying`.
 */

type NodeLike = { readonly id: string; readonly kind: string } & Record<string, unknown>;
type Reads = { getNode(id: string): unknown };

/**
 * WHETHER AN AUTHOR IS THE APP'S OWN ACTOR: a `system` or `agent` author
 * that says `automated: true`. A person never is, whatever they say.
 */
export function isAutomated(author: Pick<Author, "kind" | "automated"> | undefined): boolean {
  return author?.automated === true && author.kind !== "human" && author.kind !== "rule";
}

/** Whether a record, as read, carries the leave-alone mark. */
export const leftAlone = (node: unknown): boolean => (node as Record<string, unknown> | undefined)?.[LEFT_ALONE] === true;

/**
 * WHETHER A PERSON SAID TO LEAVE THIS RECORD ALONE: the mark
 * `leave-alone-<kind>` sets and `allow-tidying-<kind>` clears. Read off a
 * store or a graph; a record that is not there is not left alone.
 */
export const isLeftAlone = (from: { readonly graph: Reads } | Reads, id: string): boolean => leftAlone(("graph" in from ? from.graph : from).getNode(id));

/** What the declaration says the actor may do to a kind's records, or to one relation of it, on its own. */
export function tidyingOf(schema: AnySchema, kind: string, relation?: string): "never" | "no-links" | undefined {
  const definition = schema.tryDefinition(kind) as { readonly tidying?: "never" | "no-links"; readonly edges?: Record<string, { readonly tidying?: "never" }> } | undefined;
  return relation === undefined ? definition?.tidying : definition?.edges?.[relation]?.tidying;
}

/**
 * WHAT THE APP KNOWS OF ITS ACTS, for reading what a call means rather than
 * how it was spelled (`meaningKey`): the act a name says, however it is
 * spelled, and whether a record is there. A store hands its own.
 */
export interface ActMeanings {
  readonly act: (name: string) =>
    | {
        readonly derived?: { readonly act: string; readonly relation?: string };
        readonly connects?: readonly string[];
        readonly creates?: readonly unknown[];
        readonly subject?: { readonly arg: string };
      }
    | undefined;
  readonly has: (id: string) => boolean;
}

/**
 * A DECLINE A CHECKPOINT KEPT (`Epoch.declines`): the op that said it — the
 * undo, or the unlink — gone to the archive since, as who said it and when.
 */
export interface KeptDecline {
  readonly id: string;
  readonly at: string;
  readonly author: Author;
  readonly undoes?: string;
}

/** A decline: the op in the log that said it, or what a checkpoint kept of one archived since. */
export type Decline = Operation | KeptDecline;

/**
 * WHAT A PERSON DECLINED, JUDGED OFF THE PAGE. Which ops decline what, and
 * what a call means, are `./declines.ts`'s, taught to the store when
 * `@graview/core/tidying` is loaded — as every host that runs the app's
 * own actor does (`dream`, `suggest`, a workflow, `@graview/ship`'s
 * server) — so a page, where the actor never runs, carries none of it.
 * Shared through the global registry, so two copies of this module agree.
 */
export interface DeclinesHeld {
  /** The decline that answers these calls, or undefined (`declinedIn`). */
  declined?: (ops: readonly Operation[], calls: readonly MutationCall[], meanings: ActMeanings | undefined, kept: Readonly<Record<string, KeptDecline>> | undefined) => Decline | undefined;
  /** What a checkpoint keeps of a log's declines (`Epoch.declines`). */
  kept?: (ops: readonly Operation[], meanings: ActMeanings | undefined, kept: Readonly<Record<string, KeptDecline>> | undefined) => Record<string, KeptDecline>;
}
export const DECLINES: DeclinesHeld = ((globalThis as Record<symbol, DeclinesHeld | undefined>)[Symbol.for("@graview/core:declines")] ??= {});

/**
 * WHY THE APP'S OWN ACTOR MAY NOT MAKE THESE PRIMITIVES, in a sentence, or
 * undefined when it may: a record a person said to leave alone, a kind the
 * declaration says is never tidied (or never linked), a relation it says is
 * never made or broken on its own. `declaration: false` asks only about
 * what a person said — a suggestion may name a kind the actor may not
 * change on its own, since a person decides it.
 */
export function tidyingRefusal(schema: AnySchema, graph: Reads, primitives: readonly Primitive[], who: string, options: { readonly declaration?: boolean } = {}): string | undefined {
  const declaration = options.declaration !== false;
  const may = (what: string, why: string) => `${who} may not ${what}: ${why}.`;
  for (const primitive of primitives) {
    const edge = "edge" in primitive ? primitive.edge : undefined;
    // The records it touches, as they stand: a new one as it would be made.
    const nodes = (edge ? [edge.from, edge.to] : ["id" in primitive ? primitive.id : (primitive as { node: NodeLike }).node.id]).map((id) => (graph.getNode(id) ?? ("node" in primitive ? primitive.node : undefined)) as NodeLike | undefined);
    for (const node of nodes) {
      if (!node) continue;
      if (leftAlone(node)) return may(`change “${labelOf(schema.tryDefinition(node.kind) as never, node)}”`, "a person said to leave it alone");
      if (!declaration) continue;
      const said = tidyingOf(schema, node.kind);
      if (said === "never") return may(`change ${pluralOf(schema, node.kind)} on its own`, "the app says they are never tidied");
      if (edge && said === "no-links") return may(`link or unlink ${pluralOf(schema, node.kind)} on its own`, "the app says they are never linked automatically");
    }
    if (edge && declaration && nodes[0] && tidyingOf(schema, nodes[0].kind, edge.kind) === "never") {
      return may(`${primitive.op === "add-edge" ? "make" : "break"} a “${edge.kind}” link on its own`, "the app says that relation is never tidied");
    }
  }
  return undefined;
}
