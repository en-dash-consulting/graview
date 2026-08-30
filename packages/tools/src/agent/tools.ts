import {
  mutationToolSchema,
  type AnySchema,
  type GraphDiff,
  type JsonSchema,
  type NodeOfSchema,
  type Store,
} from "@graview/core";
import {
  deriveAffordances,
  applyAffordance,
  type DeriveOptions,
} from "../derive.js";

export interface ToolDefinition {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  /** False for the read tools, true for anything that changes the graph. */
  readonly mutating: boolean;
}

export type ToolResult<S extends AnySchema> =
  | {
      readonly ok: true;
      readonly data: unknown;
      readonly diff?: GraphDiff<NodeOfSchema<S>>;
    }
  | { readonly ok: false; readonly error: string };

export interface ToolRuntimeOptions<S extends AnySchema> {
  readonly author?: {
    kind: "human" | "agent" | "rule";
    id?: string;
    session?: string;
  };
  readonly derive?: DeriveOptions<S>;
  /** Refuse every mutating tool. Useful for a read-only agent seat. */
  readonly readOnly?: boolean;
}

const READ_TOOLS: readonly ToolDefinition[] = [
  {
    name: "get_graph",
    description: "The whole graph: every node with its fields, and every edge.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    mutating: false,
  },
  {
    name: "get_node",
    description: "One node, its edges, and the violations that implicate it.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Node id." } },
      required: ["id"],
      additionalProperties: false,
    },
    mutating: false,
  },
  {
    name: "get_violations",
    description:
      "Every invariant violation the graph currently has, with its repairs.",
    inputSchema: {
      type: "object",
      properties: {
        context: {
          type: "object",
          description: "Evaluation context, e.g. { weekStart }.",
        },
      },
      additionalProperties: false,
    },
    mutating: false,
  },
  {
    name: "get_affordances",
    description:
      "What can legally be done with a selection, ranked. Prefer these over composing a mutation by hand: they are derived from the schema, the invariants and the shape of the graph.",
    inputSchema: {
      type: "object",
      properties: {
        selection: {
          type: "array",
          items: { type: "string" },
          description: "Node ids.",
        },
        context: { type: "object" },
      },
      required: ["selection"],
      additionalProperties: false,
    },
    mutating: false,
  },
  {
    name: "preview_mutation",
    description:
      "What a mutation would change, as a diff, plus any invariant it would break. Nothing is applied.",
    inputSchema: {
      type: "object",
      properties: {
        mutation: { type: "string" },
        args: { type: "object" },
      },
      required: ["mutation", "args"],
      additionalProperties: false,
    },
    mutating: false,
  },
  {
    name: "undo_batch",
    description:
      "Undo one batch of operations. Fails, naming the blocking operation, when a later operation read what it wrote.",
    inputSchema: {
      type: "object",
      properties: {
        batch: { type: "string" },
        include: { type: "array", items: { type: "string" } },
      },
      required: ["batch"],
      additionalProperties: false,
    },
    mutating: true,
  },
];

/**
 * One tool call, as it happens.
 *
 * The claim was that watching an agent needs no bespoke observability
 * because its edits produce the same diffs a human's do. True, and not
 * enough: a diff says what changed, never what was CONSIDERED. An agent that
 * reads six nodes and then reassigns one run appears, through diffs alone,
 * as a single unexplained write — the interface can only offer a spinner and
 * a toast. Emitting the calls themselves is what turns that into something a
 * person can follow, and read-only calls are the interesting half.
 */
export interface ToolCall {
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly mutating: boolean;
  /** `running` on the way in; `ok` or `failed` on the way out. */
  readonly phase: "running" | "ok" | "failed";
  readonly error?: string;
  readonly at: string;
}

export interface ToolRuntime<S extends AnySchema> {
  readonly definitions: readonly ToolDefinition[];
  call(name: string, args: Record<string, unknown>): Promise<ToolResult<S>>;
  /** Every applied change, whoever caused it. */
  onDiff(listener: (diff: GraphDiff<NodeOfSchema<S>>) => void): () => void;
  /** Every call, mutating or not, as it starts and as it settles. */
  onCall(listener: (call: ToolCall) => void): () => void;
}

/**
 * Tool definitions generate ONCE from the schema and are transport-agnostic.
 *
 * The MCP adapter and the in-app adapter are two thin wrappers over the same
 * runtime, so an external agent and a surface inside the interface are using
 * literally the same actions and emitting literally the same diffs. That is
 * why watching an agent work needs no bespoke observability layer.
 */
export function createToolRuntime<S extends AnySchema>(
  store: Store<S>,
  options: ToolRuntimeOptions<S> = {},
): ToolRuntime<S> {
  const mutationTools: ToolDefinition[] = store
    .allMutations()
    .map((mutation) => {
      const tool = mutationToolSchema(mutation);
      return {
        name: mutation.name,
        ...(tool.title === undefined ? {} : { title: tool.title }),
        description: tool.description,
        inputSchema: tool.inputSchema,
        mutating: true,
      };
    });

  const definitions = options.readOnly
    ? [...READ_TOOLS.filter((tool) => !tool.mutating)]
    : [...READ_TOOLS, ...mutationTools];

  /**
   * The call itself, separated from the announcing so that every exit —
   * including an early return for an unknown tool — is reported exactly once.
   */
  const run = async (
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult<S>> => {
    try {
      const definition = definitions.find((tool) => tool.name === name);
      if (!definition) {
        return {
          ok: false,
          error: `Unknown tool "${name}". Available: ${definitions.map((t) => t.name).join(", ")}`,
        };
      }
      if (definition.mutating && options.readOnly) {
        return {
          ok: false,
          error: `"${name}" changes the graph, and this seat is read-only.`,
        };
      }

      switch (name) {
        case "get_graph":
          return { ok: true, data: store.graph.snapshot() };

        case "get_node": {
          const id = String(args["id"] ?? "");
          const node = store.graph.getNode(id);
          if (!node) return { ok: false, error: `No node "${id}".` };
          return {
            ok: true,
            data: {
              node,
              out: store.graph.outEdges(id),
              in: store.graph.inEdges(id),
              violations: store
                .violations()
                .filter((violation) => violation.nodeIds.includes(id)),
            },
          };
        }

        case "get_violations":
          return {
            ok: true,
            data: store.violations(
              args["context"] as Record<string, unknown> | undefined,
            ),
          };

        case "get_affordances": {
          const selection = (args["selection"] as string[]) ?? [];
          const derived = deriveAffordances(store, selection, {
            ...options.derive,
            ...(args["context"]
              ? { context: args["context"] as Record<string, unknown> }
              : {}),
          });
          return { ok: true, data: derived };
        }

        case "preview_mutation": {
          const preview = store.preview({
            name: String(args["mutation"]),
            args: (args["args"] as Record<string, unknown>) ?? {},
          });
          return { ok: true, data: preview };
        }

        case "undo_batch": {
          const batch = String(args["batch"]);
          const include = (args["include"] as string[]) ?? [];
          const check = store.canUndo([batch, ...include]);
          if (!check.ok) return { ok: false, error: check.message };
          const result = store.undo([batch, ...include], {
            ...(options.author ? { author: options.author } : {}),
          });
          return { ok: true, data: result, diff: result.diff };
        }

        default: {
          const result = store.apply(
            { name, args },
            { ...(options.author ? { author: options.author } : {}) },
          );
          return {
            ok: true,
            data: {
              batch: result.batch,
              intent: result.intent,
              introduces: result.introduces,
              resolves: result.resolves,
            },
            diff: result.diff,
          };
        }
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const watchers = new Set<(call: ToolCall) => void>();
  const announce = (call: ToolCall) => {
    for (const watcher of watchers) watcher(call);
  };

  return {
    definitions,

    onDiff(listener) {
      return store.subscribe(listener);
    },

    onCall(listener) {
      watchers.add(listener);
      return () => watchers.delete(listener);
    },

    async call(name, args) {
      const mutating =
        definitions.find((tool) => tool.name === name)?.mutating ?? false;
      const started = { name, args, mutating, at: new Date().toISOString() };
      announce({ ...started, phase: "running" });
      const settle = <T extends ToolResult<S>>(result: T): T => {
        announce(
          result.ok
            ? { ...started, phase: "ok" }
            : { ...started, phase: "failed", error: result.error },
        );
        return result;
      };
      return settle(await run(name, args));
    },
  };
}

export { applyAffordance };
