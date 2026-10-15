import { LEFT_ALONE } from "../graph/archived.js";
import type { Primitive } from "../graph/primitives.js";
import type { MutationCall } from "../mutations/types.js";
import { labelOf, pluralOf } from "../schema/define-node.js";
import type { AnySchema } from "../schema/schema.js";
import { undoneIn } from "./log.js";
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

/** WHO A SUGGESTION IS, whoever made it and on whatever basis: its calls, in order, each its act and arguments, keys in order. */
export const suggestionKey = (calls: readonly MutationCall[]): string =>
  JSON.stringify(
    calls.map((call) => [call.name, call.args]),
    (_, value) => (value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort()) : value),
  );

/**
 * THE OP THAT DECLINED THESE CALLS — the whole suggestion, or any one of
 * them on its own — or undefined: a live undo of a suggestion, or of a
 * change made with a lineage (an actor's confident change a person took
 * back). "Do not make this again."
 */
export function declinedIn(ops: readonly Operation[], calls: readonly MutationCall[]): Operation | undefined {
  const declines = declinesIn(ops);
  return [calls, ...calls.map((call) => [call])].map((asked) => declines.get(suggestionKey(asked))).find(Boolean);
}

/** Every decline in a log, keyed by the whole suggestion and by each of its calls alone (`suggestionKey`). */
export function declinesIn(ops: readonly Operation[]): ReadonlyMap<string, Operation> {
  const undone = undoneIn(ops);
  const byId = new Map(ops.map((op) => [op.id, op]));
  const declines = new Map<string, Operation>();
  for (const op of ops) {
    const target = op.undoes !== undefined && !undone.has(op.id) && !op.withheld ? byId.get(op.undoes) : undefined;
    const calls = target?.suggests ?? (target?.mutation && (target.lineage || op.undoneLineage) ? [target.mutation] : []);
    if (calls.length > 0) for (const key of [calls, ...calls.map((call) => [call])]) declines.set(suggestionKey(key), op);
  }
  return declines;
}

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
