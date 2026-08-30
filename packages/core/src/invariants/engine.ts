import type { Graph } from "../graph/graph.js";
import type { AnySchema, KindOfSchema, NodeOfKind, NodeOfSchema } from "../schema/schema.js";
import type {
  EvaluateOptions,
  InvariantContext,
  InvariantDefinition,
  InvariantEvalArgs,
  Violation,
} from "./types.js";

export class UnregisteredInvariantError extends Error {
  constructor(
    readonly invariant: string,
    readonly nodeId: string,
  ) {
    super(
      `No invariant registered under "${invariant}" (required by node "${nodeId}")`,
    );
    this.name = "UnregisteredInvariantError";
  }
}

export function defineInvariant<
  S extends AnySchema,
  K extends KindOfSchema<S>,
>(
  name: string,
  spec: {
    readonly scope: { readonly kind: K; readonly match?: (node: NodeOfKind<S, K>) => boolean };
    readonly label?: string;
    readonly description?: string;
    readonly repairs?: readonly string[];
    readonly evaluate: (args: InvariantEvalArgs<S, NodeOfKind<S, K>>) => Violation[];
  },
): InvariantDefinition<S>;
export function defineInvariant<S extends AnySchema>(
  name: string,
  spec: {
    readonly scope: "graph";
    readonly label?: string;
    readonly description?: string;
    readonly repairs?: readonly string[];
    readonly evaluate: (args: InvariantEvalArgs<S, undefined>) => Violation[];
  },
): InvariantDefinition<S>;
export function defineInvariant<S extends AnySchema>(
  name: string,
  spec: {
    readonly scope: unknown;
    readonly label?: string;
    readonly description?: string;
    readonly repairs?: readonly string[];
    readonly evaluate: (args: never) => Violation[];
  },
): InvariantDefinition<S> {
  return { ...spec, name } as InvariantDefinition<S>;
}

/**
 * Pure evaluation: same graph and context in, same violations out. Nothing
 * here reads the clock, a random source, or the DOM — which is what lets the
 * whole tier run headlessly in CI.
 */
export function evaluate<S extends AnySchema>(
  graph: Graph<S>,
  invariants: readonly InvariantDefinition<S>[],
  options: EvaluateOptions<S> = {},
): Violation[] {
  const context: InvariantContext = options.context ?? {};
  const onUnregistered = options.onUnregistered ?? "skip";
  const registered = new Set(invariants.map((i) => i.name));
  const violations: Violation[] = [];

  for (const invariant of invariants) {
    if (invariant.scope !== "graph") continue;
    violations.push(
      ...invariant.evaluate({ graph, subject: undefined as never, context }),
    );
  }

  const scoped = invariants.filter((i) => i.scope !== "graph");
  const byKind = new Map<string, InvariantDefinition<S>[]>();
  for (const invariant of scoped) {
    const kind = (invariant.scope as { kind: string }).kind;
    const list = byKind.get(kind);
    if (list) list.push(invariant);
    else byKind.set(kind, [invariant]);
  }

  for (const node of graph.allNodes()) {
    const definition = graph.schema.tryDefinition(node.kind);
    const required = definition?.requiresInvariant?.(node as never) ?? null;

    if (options.subjectFilter && !options.subjectFilter(node, context)) continue;

    if (required !== null && !registered.has(required)) {
      if (onUnregistered === "throw") {
        throw new UnregisteredInvariantError(required, node.id);
      }
      continue;
    }

    for (const invariant of byKind.get(node.kind) ?? []) {
      const match = (invariant.scope as { match?: (n: NodeOfSchema<S>) => boolean }).match;
      if (match && !match(node)) continue;
      violations.push(
        ...invariant.evaluate({ graph, subject: node as never, context }),
      );
    }
  }

  return violations;
}

/** Violations that implicate any of the given node ids. */
export function violationsTouching(
  violations: readonly Violation[],
  nodeIds: readonly string[],
): Violation[] {
  const wanted = new Set(nodeIds);
  return violations.filter(
    (v) => v.nodeIds.some((id) => wanted.has(id)) || (v.subjectId !== undefined && wanted.has(v.subjectId)),
  );
}
