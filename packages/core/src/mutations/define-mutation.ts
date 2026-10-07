import { InvalidArguments } from "./words.js";
import type { z } from "zod";
import type { Graph } from "../graph/graph.js";
import { GraphError, MissingRecordError } from "../graph/graph.js";
import type { Primitive } from "../graph/primitives.js";
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

/** "does not take "colour"; it takes "id", "quote"" — the one sentence for an argument an act does not take. */
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

/**
 * Runs a mutation against the graph WITHOUT applying it, returning the
 * primitives it would emit plus the causal read set. Applying is the op
 * log's job — keeping the two apart is what makes preview-as-diff free.
 */
/** Where a refusal thrown by an act's own body carries the ids it had read: see `compileMutation`. */
export const READ_BEFORE_REFUSING = Symbol("graview.readBeforeRefusing");

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
     * THE GRAPH THE SENTENCE IS WORDED FROM (FR-55): the author's view, so a
     * record the author may not see is named only by what the author wrote
     * — the id as given — exactly as one that does not exist. Absent, the
     * graph the act runs on.
     */
    readonly describeWith?: GraphReader<NodeOfSchema<S>>;
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
   * declare, so `set-quote { id, quote, colour }` set the quote and said
   * nothing of the colour; the framework holds the act to its shape here,
   * at the one boundary every call crosses, so no product changes its
   * input. An argument given as `undefined` is no argument. Said with those
   * it does take — a caller that misspelt one learns the spelling.
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

  const reader = new TrackedReader<NodeOfSchema<S>>(graph);
  const primitives: Primitive[] = [];
  const minted = new Set<string>();

  const context: MutationContext<S> = {
    graph: reader,
    schema: graph.schema,
    emit(primitive) {
      primitives.push(primitive);
    },
    addNode(node) {
      primitives.push({ op: "add-node", node });
    },
    removeNode(id) {
      const node = reader.getNode(id);
      if (!node) throw new MissingRecordError(id, `Cannot remove missing node "${id}"`);
      const touching = new Map<string, GraphEdge>();
      for (const edge of graph.outEdges(id)) touching.set(edgeId(edge), edge);
      for (const edge of graph.inEdges(id)) touching.set(edgeId(edge), edge);
      for (const edge of touching.values()) {
        reader.getNode(edge.from);
        reader.getNode(edge.to);
        primitives.push({ op: "remove-edge", edge });
      }
      primitives.push({ op: "remove-node", node });
    },
    patchNode(id, fields) {
      const node = reader.getNode(id);
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
    addEdge(edge) {
      primitives.push({ op: "add-edge", edge });
    },
    removeEdge(edge) {
      primitives.push({ op: "remove-edge", edge });
    },
    setSingleSource(kind, to, from) {
      for (const edge of graph.inEdges(to, kind)) {
        reader.getNode(edge.from);
        if (edge.from === from) continue;
        primitives.push({ op: "remove-edge", edge });
      }
      if (!graph.inEdges(to, kind).some((e) => e.from === from)) {
        primitives.push({ op: "add-edge", edge: { kind, from, to } });
      }
    },
    freshId(label, prefix) {
      if (requested !== undefined && !minted.has(requested)) {
        if (reader.has(requested)) {
          throw new GraphError(
            `Id "${requested}" is already taken`,
            `"${definition.name}" was asked to make a node with that id, and the graph has one. Pick another, or leave id out and let the act mint one.`,
          );
        }
        minted.add(requested);
        return requested;
      }
      const base = prefix ? `${prefix}:${slug(label)}` : slug(label);
      if (!reader.has(base) && !minted.has(base)) {
        minted.add(base);
        return base;
      }
      let n = 2;
      while (reader.has(`${base}-${n}`) || minted.has(`${base}-${n}`)) n++;
      const id = `${base}-${n}`;
      minted.add(id);
      return id;
    },
  };

  try {
    definition.apply(context, args);
  } catch (error) {
    // What it had read when it refused, so a store can tell whether its sentence may name what its caller may not see (FR-55).
    if (error !== null && typeof error === "object") Object.defineProperty(error, READ_BEFORE_REFUSING, { value: reader.reads(), configurable: true });
    throw error;
  }

  const writes = new Set<string>();
  for (const primitive of primitives) {
    switch (primitive.op) {
      case "add-node":
      case "remove-node":
        writes.add(primitive.node.id);
        break;
      case "patch-node":
        writes.add(primitive.id);
        break;
      case "add-edge":
      case "remove-edge":
        writes.add(primitive.edge.from);
        writes.add(primitive.edge.to);
        break;
    }
  }

  // Its own reader, so what the sentence read is known apart from what the act read (FR-55).
  const wording = new TrackedReader<NodeOfSchema<S>>(options.describeWith ?? graph);
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
  };
}
