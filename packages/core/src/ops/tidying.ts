import { LEFT_ALONE } from "../graph/archived.js";
import type { Primitive } from "../graph/primitives.js";
import { spellingOf } from "../mutations/act-spelling.js";
import { derivedActOf } from "../mutations/derived-names.js";
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

/** A value written out with every object's keys in order: two spellings of one set of arguments are one key. */
const sortedKey = (value: unknown): string => JSON.stringify(value, (_, inner) => (inner && typeof inner === "object" && !Array.isArray(inner) ? Object.fromEntries(Object.entries(inner).sort()) : inner));

/** WHO A SUGGESTION IS, whoever made it and on whatever basis: its calls, in order, each its act and arguments, keys in order. */
export const suggestionKey = (calls: readonly MutationCall[]): string => sortedKey(calls.map((call) => [call.name, call.args]));

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

/** The acts said of one record alone: set aside, brought back, removed, left alone, let be tidied. */
const ON_ONE = /^(archive|unarchive|remove|leave-alone|allow-tidying)$/;

/** What one call means, as what a key is written from. */
function meaningOf(call: MutationCall, meanings: ActMeanings | undefined): unknown {
  const name = spellingOf(call.name);
  const act = meanings?.act(call.name);
  const args = (call.args ?? {}) as Record<string, unknown>;
  // The act's own word on what it is; a bare name is read as one only when nothing knows the act.
  const derived: { readonly act: string; readonly relation?: string } | undefined = act ? act.derived : derivedActOf(name);
  const { id } = args;
  if (derived && typeof id === "string") {
    if (ON_ONE.test(derived.act)) return [derived.act, id];
    // A pair merged, whichever of the two went into the other.
    if (derived.act === "merge") return ["merge", ...[id, args["into"]].sort()];
    if (derived.relation) return [derived.act, derived.relation, id, args["to"]];
  }
  // A declared act that makes one relation between its subject and one other record is that link, as its relation's own act would make it.
  const subject = act?.subject?.arg ?? "id";
  const [other, more] = Object.keys(args).filter((key) => key !== subject);
  if (act?.connects?.length === 1 && other && !more && meanings!.has(args[subject] as string) && meanings!.has(args[other] as string)) return ["connect", act.connects[0], args[subject], args[other]];
  // Anything else is its act and arguments, less the id of a record it would make: minted afresh each time it is asked.
  return [name, act?.creates?.length && typeof id === "string" && !meanings!.has(id) ? { ...args, id: 0 } : args];
}

/**
 * WHAT A SUGGESTION MEANS, however its calls were spelled: a link between
 * two records by its relation, whichever act asks for it; a merge of a
 * pair, whichever way round; a record archived, removed or left alone; and
 * anything else its act, in any spelling of it, and its arguments, less the
 * minted id of a record it would make. Worked out from the calls whenever
 * it is asked, so a decline already in a log matches by it too.
 */
export const meaningKey = (calls: readonly MutationCall[], meanings?: ActMeanings): string => `≈${sortedKey(calls.map((call) => meaningOf(call, meanings)))}`;

/**
 * THE OP THAT DECLINED THESE CALLS — the whole suggestion, or any one of
 * them on its own, asked exactly as it was or meaning the same
 * (`meaningKey`) — or undefined: a live undo of a suggestion, or of a
 * change made with a lineage (an actor's confident change a person took
 * back). "Do not make this again."
 */
export function declinedIn(ops: readonly Operation[], calls: readonly MutationCall[], meanings?: ActMeanings): Operation | undefined {
  const declines = declinesIn(ops, meanings);
  return [calls, ...calls.map((call) => [call])].map((asked) => declines.get(meaningKey(asked, meanings))).find(Boolean);
}

/** Every decline in a log, keyed by what the whole suggestion means and what each of its calls alone means (`meaningKey`): calls asked exactly alike always mean the same. */
export function declinesIn(ops: readonly Operation[], meanings?: ActMeanings): ReadonlyMap<string, Operation> {
  const undone = undoneIn(ops);
  const byId = new Map(ops.map((op) => [op.id, op]));
  const declines = new Map<string, Operation>();
  for (const op of ops) {
    const target = op.undoes !== undefined && !undone.has(op.id) && !op.withheld ? byId.get(op.undoes) : undefined;
    // A suggestion its own maker took back was withdrawn, not declined: nobody said no to it (`withdrawSuggestion`).
    if (target?.suggests && target.author.kind === op.author.kind && target.author.id === op.author.id) continue;
    const calls = target?.suggests ?? (target?.mutation && (target.lineage || op.undoneLineage) ? [target.mutation] : []);
    if (calls.length > 0) for (const asked of [calls, ...calls.map((call) => [call])]) declines.set(meaningKey(asked, meanings), op);
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
