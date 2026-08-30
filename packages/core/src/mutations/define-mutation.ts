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
  const parsed = definition.input.safeParse(rawArgs);
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
      primitives.push({ op: "add-node", node: node as never });
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
      primitives.push({ op: "remove-node", node: node as never });
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

  definition.apply(context, args as never);

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
    definition.describe?.(args as never, reader) ??
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
