import type { z } from "zod";
import type { Graph } from "../graph/graph.js";
import { GraphError } from "../graph/graph.js";
import type { Primitive } from "../graph/primitives.js";
import { TrackedReader } from "../graph/tracked.js";
import { edgeId, type GraphEdge } from "../graph/types.js";
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
  readonly writes: readonly string[];
  readonly intent: string;
}

/** Whether an act takes the framework's `id` argument: it creates, and has no `id` of its own. */
export function takesAnId(definition: Pick<AnyMutationDefinition, "creates" | "input">): boolean {
  if (!definition.creates?.length) return false;
  const shape = (definition.input as { shape?: Record<string, unknown> }).shape;
  return shape === undefined || !("id" in shape);
}

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

function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
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
  const parsed = definition.input.safeParse(
    requested === undefined ? rawArgs : withoutId(rawArgs as Record<string, unknown>),
  );
  if (!parsed.success) {
    throw new GraphError(
      `Invalid arguments for mutation "${definition.name}"`,
      parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; "),
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
      if (!node) throw new GraphError(`Cannot remove missing node "${id}"`);
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
      if (!node) throw new GraphError(`Cannot patch missing node "${id}"`);
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        const current = (node as Record<string, unknown>)[key];
        if (JSON.stringify(current) === JSON.stringify(value)) continue;
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

  definition.apply(context, args);

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

  const intent =
    definition.describe?.(args, reader) ??
    `${definition.name}(${Object.entries(args)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ")})`;

  return {
    primitives,
    reads: reader.reads(),
    writes: [...writes],
    intent,
  };
}
