import {
  mutationToolSchema,
  type AnySchema,
  type GraphDiff,
  type JsonSchema,
  type NodeOfSchema,
  type Principal,
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
      /**
       * The nodes this call LOOKED AT.
       *
       * A diff can only ever show what changed, and an agent that reassigns
       * one run after reading the whole week is doing something different
       * from one that reassigns it after reading nothing. The runtime is the
       * only place that knows, so it says so — and an interface can then draw
       * attention as well as change.
       */
      readonly reads?: readonly string[];
    }
  | { readonly ok: false; readonly error: string };

export interface ToolRuntimeOptions<S extends AnySchema> {
  /**
   * Who this seat acts as. A principal is an author with roles, so the seat's
   * attribution and its authorisation are the same fact — there is no way to
   * write as one participant and be permitted as another.
   */
  readonly author?: Principal;
  /**
   * Options for the seat's own deriveAffordances calls. A FUNCTION is read
   * fresh on every call — which is how a person's pins, toggled in the
   * menu after this runtime was built, still reach the agent's tool list.
   * The strip, the pointer menu and the seat must never disagree about
   * the same acts.
   */
  readonly derive?: DeriveOptions<S> | (() => DeriveOptions<S>);
  /** Refuse every mutating tool. Useful for a read-only agent seat. */
  readonly readOnly?: boolean;
}

const READ_TOOLS: readonly ToolDefinition[] = [
  {
    name: "get_graph",
    description:
      "Read the whole graph: every node with its fields, and every edge. Start here when you need the shape of the domain rather than one thing in it.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    mutating: false,
  },
  {
    name: "get_node",
    description:
      "Read one node, its edges, and the violations that implicate it. Use this to check a thing before you change it.",
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
      "List every invariant violation the graph currently has, with the repairs that would resolve each one. Read this before proposing work: a rule that is already broken is more urgent than anything you could add.",
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
      "Ask what can legally be done with a selection, ranked. Prefer these over composing a mutation by hand: they are derived from the schema, the invariants and the shape of the graph, so they cannot name an action that does not exist.",
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
      "Try a mutation without applying it: get back the diff it would produce and any invariant it would break. Do this when you are unsure, rather than applying and undoing.",
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
  /**
   * The nodes a settled read-only call looked at. Absent while running, and
   * absent for a mutating call — a change already reports its own reads
   * through the op log, and reporting them twice would double-count.
   */
  readonly reads?: readonly string[];
}

export interface ToolRuntime<S extends AnySchema> {
  readonly definitions: readonly ToolDefinition[];
  /**
   * Who this seat writes as.
   *
   * Exposed because a read has to be attributed to the SAME participant the
   * writes are, or one agent looking at the graph and then changing it reads
   * as two people editing at once.
   */
  readonly author?: ToolRuntimeOptions<S>["author"];
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
  /*
   * Only what this seat MAY do.
   *
   * The narrowing is the store's, not the runtime's: a seat holding a
   * principal gets tools for what that principal can run, and there is no
   * second list to keep in step with the policy. A seat that then calls a
   * mutation it was not given still hits the store's refusal, because the
   * schema is a convenience and the enforcement is elsewhere.
   */
  const mutationTools: ToolDefinition[] = store
    .permittedMutations(options.author ?? { kind: "agent" })
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
        /*
         * A tool this seat may not use EXISTS, and saying "unknown" would be
         * a lie an agent then reasons from — it would conclude the capability
         * is missing and go looking for a workaround. The same honesty the
         * interface owes a person: it is there, you may not use it, here is
         * who can.
         */
        const withheld = store.allMutations().find((mutation) => mutation.name === name);
        if (withheld) {
          const verdict = store.permits(
            { name, args },
            options.author ?? { kind: "agent" },
          );
          if (!verdict.ok) return { ok: false, error: verdict.refusal.message };
        }
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
        case "get_graph": {
          const snapshot = store.graph.snapshot();
          return {
            ok: true,
            data: snapshot,
            reads: snapshot.nodes.map((node) => node.id),
          };
        }

        case "get_node": {
          const id = String(args["id"] ?? "");
          const node = store.graph.getNode(id);
          if (!node) return { ok: false, error: `No node "${id}".` };
          const out = store.graph.outEdges(id);
          const inbound = store.graph.inEdges(id);
          return {
            ok: true,
            data: {
              node,
              out,
              in: inbound,
              violations: store
                .violations()
                .filter((violation) => violation.nodeIds.includes(id)),
            },
            // Asking about a node is asking about its neighbourhood: the
            // answer names them, so looking at it looked at them.
            reads: [id, ...out.map((edge) => edge.to), ...inbound.map((edge) => edge.from)],
          };
        }

        case "get_violations":
          {
            const violations = store.violations(
              args["context"] as Record<string, unknown> | undefined,
            );
            return {
              ok: true,
              data: violations,
              reads: [...new Set(violations.flatMap((violation) => violation.nodeIds))],
            };
          }

        case "get_affordances": {
          const selection = (args["selection"] as string[]) ?? [];
          const derived = deriveAffordances(store, selection, {
            ...(typeof options.derive === "function" ? options.derive() : options.derive),
            // The seat asks as ITSELF, so what it is offered is what it may
            // do — and what it may not is stated rather than hidden, which
            // is how an agent learns a capability exists that it lacks.
            ...(options.author ? { principal: options.author } : {}),
            ...(args["context"]
              ? { context: args["context"] as Record<string, unknown> }
              : {}),
          });
          return { ok: true, data: derived, reads: selection };
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
    ...(options.author ? { author: options.author } : {}),

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
            ? {
                ...started,
                phase: "ok",
                ...(!mutating && result.reads ? { reads: result.reads } : {}),
              }
            : { ...started, phase: "failed", error: result.error },
        );
        return result;
      };
      return settle(await run(name, args));
    },
  };
}

export { applyAffordance };
