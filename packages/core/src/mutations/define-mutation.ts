import { InvalidArguments } from "./invalid-arguments.js";
import type { z } from "zod";
import { ARCHIVED, isArchived } from "../graph/archived.js";
import type { Graph } from "../graph/graph.js";
import { GraphError, MissingRecordError } from "../graph/graph.js";
import { writesOf, type Primitive } from "../graph/primitives.js";
import { TrackedReader } from "../graph/tracked.js";
import { edgeId, type GraphEdge, type GraphReader } from "../graph/types.js";
import type { AnySchema, NodeOfSchema } from "../schema/schema.js";
import type {
  AnyMutationDefinition,
  MutationContext,
  MutationDefinition,
  MutationDefinitionSpec,
} from "./types.js";

export function defineMutation<
  S extends AnySchema,
  const Name extends string,
  I extends z.ZodType,
>(
  name: Name,
  spec: MutationDefinitionSpec<S, I>,
): MutationDefinition<S, Name, I> {
  return { ...spec, name };
}

export interface CompiledMutation {
  readonly primitives: readonly Primitive[];
  /** Node ids the mutation looked at while computing its writes. */
  readonly reads: readonly string[];
  /** Node ids its `describe` read to word its sentence, when it has one (FR-55). */
  readonly described?: readonly string[];
  readonly writes: readonly string[];
  readonly intent: string;
  /** The record a merge kept, when the act merged one into it (FR-173): the op says so. */
  readonly mergedInto?: string;
}

/** Whether an act takes the framework's `id` argument: it creates, and has no `id` of its own. */
export function takesAnId(definition: { readonly creates?: readonly string[] | undefined; readonly input: unknown }): boolean {
  if (!definition.creates?.length) return false;
  const shape = (definition.input as { shape?: Record<string, unknown> }).shape;
  return shape === undefined || !("id" in shape);
}

/**
 * THE ARGUMENTS AN ACT TAKES, WHEN THE FRAMEWORK HOLDS IT TO THEM (FR-121):
 * the keys of a plain `z.object` input — which zod would strip silently —
 * and, on an act that creates, the `id` of the record it makes. Undefined
 * for an input its author said otherwise of: `z.strictObject` refuses by
 * itself, and `z.looseObject` or a `catchall` keeps what it is not told
 * about, on purpose; and for an input that is not an object's shape.
 */
export function argumentsTaken(definition: { readonly creates?: readonly string[] | undefined; readonly input: unknown }): readonly string[] | undefined {
  const input = definition.input as { readonly shape?: Record<string, unknown>; readonly _zod?: { readonly def?: { readonly type?: string; readonly catchall?: unknown } } };
  const def = input._zod?.def;
  if (def?.type !== "object" || def.catchall !== undefined || !input.shape) return undefined;
  const keys = Object.keys(input.shape);
  return takesAnId(definition) ? [...keys, "id"] : keys;
}

/** "does not take "color"; it takes "id", "quote"" — the one sentence for an argument an act does not take. */
const doesNotTake = (stray: readonly string[], takes: readonly string[]): string =>
  `does not take ${stray.map((key) => `"${key}"`).join(", ")}; it takes ${takes.length > 0 ? takes.map((key) => `"${key}"`).join(", ") : "nothing"}`;

function requestedId(rawArgs: unknown): string | undefined {
  if (typeof rawArgs !== "object" || rawArgs === null) return undefined;
  const id = (rawArgs as Record<string, unknown>)["id"];
  if (id === undefined) return undefined;
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new GraphError("An id must be a non-empty string", `Got ${JSON.stringify(id)}.`);
  }
  return id;
}

function withoutId(args: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = args;
  return rest;
}

/**
 * An id from a name: the name's own letters, folded and hyphenated.
 *
 * It kept ASCII and dropped everything else, so "Zoë Lamarré" became
 * `artist:zo-lamarr` — an address that is neither her name nor anybody's —
 * and a name in any script without Latin letters became `item`. Accents are
 * folded the way search folds them (`zoe-lamarre`, the id a person would
 * guess), and a letter with no Latin form is kept as the letter it is.
 */
export function slug(label: string): string {
  return (
    label
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

/** An id from `base` no guess collides with: a random suffix, drawn again (never seen to be) while anything holds it. */
function unguessable(base: string, held: (id: string) => boolean): string {
  let id;
  do id = `${base}-${Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, "0")}`;
  while (held(id));
  return id;
}

/**
 * Runs a mutation against the graph WITHOUT applying it, returning the
 * primitives it would emit plus the causal read set. Applying is the op
 * log's job — keeping the two apart is what makes preview-as-diff free.
 */
export function compileMutation<S extends AnySchema>(
  graph: Graph<S>,
  definition: AnyMutationDefinition<S>,
  rawArgs: unknown,
  options: {
    /**
     * A field written with the value it already holds is kept in the patch
     * when this says so (FR-55): a seat that writes a value the store holds
     * in words it may not see has written its own words, and an act that
     * wrote nothing would tell it the guess was the hidden value.
     */
    readonly keepUnchanged?: (value: unknown) => boolean;
    /**
     * THE GRAPH THE ACT READS (FR-55): its author's view. Its body, its
     * guard, its refusal and its sentence read only what the author may
     * see, so a record kept from the author is to the act exactly what one
     * that does not exist is — not counted, quoted or copied, and no answer
     * differs for it. What it writes lands on the whole graph, and the
     * framework's bookkeeping reads the whole graph: a removed record's
     * links and fields, a patch's prior values, a single source's other
     * links, an id already taken. Absent, the graph itself.
     */
    readonly seen?: GraphReader<NodeOfSchema<S>>;
    /** The id of the seat the act is run by — the person, for an agent acting for one: the act's `ctx.me`. */
    readonly me?: string | undefined;
    /**
     * WHETHER THE SEAT SEES EVERY RECORD OF A KIND (FR-55), or, asked of no
     * kind, of every kind. Ids are unique across the whole store, so an id
     * minted or asked for where a record the seat may not see could hold it
     * would say that record is there: for a kind it does not see in full a
     * minted id carries a suffix no guess collides with, and a seat that
     * does not see everything may not ask for an id at all — refused alike,
     * whether or not anybody holds it. Absent, the seat sees everything.
     */
    readonly seesInFull?: (kind?: string) => boolean;
  } = {},
): CompiledMutation {
  /*
   * THE ID A CALLER BROUGHT. An act that creates a kind takes an optional
   * `id` the framework adds beside its own arguments (see `takesAnId`):
   * lifted here, before the declaration's own schema parses the rest, so a
   * strict input is not asked about an argument it never declared. It goes
   * to the first node `freshId` mints, and an id already in the graph is a
   * refusal — a seed being synced, or an agent that will name this node in
   * its next call, needs exactly the id it asked for or an honest no.
   */
  const requested = takesAnId(definition) ? requestedId(rawArgs) : undefined;
  const given = requested === undefined ? rawArgs : withoutId(rawArgs as Record<string, unknown>);
  /*
   * AN ARGUMENT THE ACT DOES NOT TAKE IS REFUSED, by every act (FR-121; a
   * derived edit since FR-110). A plain `z.object` strips what it does not
   * declare, so `set-quote { id, quote, color }` set the quote and said
   * nothing of the color; the framework holds the act to its shape here,
   * at the one boundary every call crosses, so no product changes its
   * input. An argument given as `undefined` is no argument. Said with those
   * it does take — a caller that misspelled one learns the spelling.
   */
  const taken = argumentsTaken(definition);
  if (taken && typeof given === "object" && given !== null && !Array.isArray(given)) {
    const stray = Object.keys(given).filter((key) => !taken.includes(key) && (given as Record<string, unknown>)[key] !== undefined);
    if (stray.length > 0) throw new InvalidArguments(definition.name, [{ path: [], message: doesNotTake(stray, taken) }]);
  }
  const parsed = definition.input.safeParse(given);
  if (!parsed.success) {
    // A strict input's own refusal of an argument (a derived edit's), said the same way.
    const takes = Object.keys((definition.input as { shape?: Record<string, unknown> }).shape ?? {});
    throw new InvalidArguments(
      definition.name,
      parsed.error.issues.map((issue) =>
        issue.code === "unrecognized_keys" && takes.length > 0 ? { ...issue, message: doesNotTake(issue.keys, takes) } : issue,
      ),
    );
  }
  const args = parsed.data as Record<string, unknown>;

  const reader = new TrackedReader<NodeOfSchema<S>>(options.seen ?? graph);
  const primitives: Primitive[] = [];
  const minted = new Set<string>();
  // An id any record holds, seen or not: a minted id never lands on one.
  const held = (id: string) => reader.has(id) || graph.has(id) || minted.has(id);
  let mergedInto: string | undefined;
  /** Every link touching a record, each once, taken off; what it reached is read. */
  const unlink = (id: string): Set<GraphEdge> => {
    const touching = new Set([...graph.outEdges(id), ...graph.inEdges(id)]);
    for (const edge of touching) {
      reader.getNode(edge.from);
      reader.getNode(edge.to);
      primitives.push({ op: "remove-edge", edge });
    }
    return touching;
  };

  const context: MutationContext<S> = {
    graph: reader,
    schema: graph.schema,
    me: options.me,
    emit(primitive) {
      primitives.push(primitive);
    },
    addNode(node) {
      primitives.push({ op: "add-node", node });
    },
    removeNode(id) {
      const node = reader.getNode(id) && graph.getNode(id);
      if (!node) throw new MissingRecordError(id, `Cannot remove missing node "${id}"`);
      unlink(id);
      primitives.push({ op: "remove-node", node });
    },
    patchNode(id, fields) {
      const node = reader.getNode(id) && graph.getNode(id);
      if (!node) throw new MissingRecordError(id, `Cannot patch missing node "${id}"`);
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        const current = (node as Record<string, unknown>)[key];
        if (JSON.stringify(current) === JSON.stringify(value) && !options.keepUnchanged?.(value)) continue;
        before[key] = current;
        after[key] = value;
      }
      if (Object.keys(after).length === 0) return;
      primitives.push({ op: "patch-node", id, before, after });
    },
    // The archived mark is a patch like any other (FR-173): nothing when it is already so.
    archiveNode: (id) => context.patchNode(id, { [ARCHIVED]: true }),
    unarchiveNode: (id) => context.patchNode(id, { [ARCHIVED]: undefined }),
    mergeNode(gone, into) {
      const kept = reader.getNode(into) && graph.getNode(into);
      if (!kept) throw new MissingRecordError(into, `Cannot merge into missing node "${into}"`);
      if (gone === into || isArchived(kept)) throw new GraphError(gone === into ? "Cannot merge a record into itself" : "Cannot merge into an archived record");
      // THE KEPT ONE TAKES THE LINKS, but never a link to itself or one it has; then the duplicate is archived.
      const has = new Set([...graph.outEdges(into), ...graph.inEdges(into)].map(edgeId));
      for (const edge of unlink(gone)) {
        const next = { kind: edge.kind, from: edge.from === gone ? into : edge.from, to: edge.to === gone ? into : edge.to };
        if (next.from !== next.to && !has.has(edgeId(next))) has.add(edgeId(next)), primitives.push({ op: "add-edge", edge: next });
      }
      context.archiveNode(gone);
      mergedInto = into;
    },
    addEdge(edge) {
      primitives.push({ op: "add-edge", edge });
    },
    removeEdge(edge) {
      primitives.push({ op: "remove-edge", edge });
    },
    setSingleSource(kind, to, from) {
      /*
       * The new link first, then the old ones it replaces (FR-55): a link the
       * seat may not see is no part of the op it is served, and what remains
       * reads — primitives, writes and their order — as it would had there
       * been no such link.
       */
      if (!graph.inEdges(to, kind).some((e) => e.from === from)) {
        primitives.push({ op: "add-edge", edge: { kind, from, to } });
      }
      for (const edge of graph.inEdges(to, kind)) {
        reader.getNode(edge.from);
        if (edge.from === from) continue;
        primitives.push({ op: "remove-edge", edge });
      }
    },
    freshId(label, prefix) {
      if (requested !== undefined && !minted.has(requested)) {
        // Asked the same whether a record the seat may not see holds it or nothing does (FR-55).
        if (options.seesInFull && !options.seesInFull()) {
          throw new GraphError(`"${definition.name}" makes its own id here`, "Leave id out: the answer says the id it made.");
        }
        if (held(requested)) {
          throw new GraphError(
            `Id "${requested}" is already taken`,
            `"${definition.name}" was asked to make a node with that id, and the graph has one. Pick another, or leave id out and let the act mint one.`,
          );
        }
        minted.add(requested);
        return requested;
      }
      const base = prefix ? `${prefix}:${slug(label)}` : slug(label);
      /*
       * AN ID THAT SAYS NOTHING OF WHAT THE SEAT MAY NOT SEE (FR-55). Stepping
       * past what it sees is the seat's own to know; stepping past a hidden
       * record would tell it one is there ("Green" made `room:green-2` with
       * no room:green in sight). Where a kind may hold records the seat does
       * not see, its ids are the seat's own — `room:green.person-gus`: a
       * slug never holds a dot, so no other seat's label mints one — and
       * the seat steps only past those it sees. Where a step would land on
       * a hidden record anyway (an id somebody asked for), and for a seat
       * that is nobody, the suffix is one no guess collides with.
       */
      const seen = (one: string) => (options.seen ? options.seen.has(one) : graph.has(one)) || minted.has(one);
      const limited = options.seesInFull !== undefined && !options.seesInFull(prefix);
      if (limited && options.me === undefined) {
        const id = unguessable(base, held);
        minted.add(id);
        return id;
      }
      const own = limited ? `${base}.${slug(options.me!)}` : base;
      let id = own;
      for (let n = 2; seen(id); n++) id = `${own}-${n}`;
      if (held(id)) id = unguessable(own, held);
      minted.add(id);
      return id;
    },
  };

  definition.apply(context, args);

  const writes = new Set(primitives.flatMap(writesOf));

  // Its own reader, so what the sentence read is known apart from what the act read (FR-55).
  const wording = new TrackedReader<NodeOfSchema<S>>(options.seen ?? graph);
  const intent =
    definition.describe?.(args, wording) ??
    `${definition.name}(${Object.entries(args)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ")})`;

  return {
    primitives,
    reads: [...new Set([...reader.reads(), ...wording.reads()])],
    ...(definition.describe ? { described: wording.reads() } : {}),
    writes: [...writes],
    intent,
    ...(mergedInto !== undefined ? { mergedInto } : {}),
  };
}
