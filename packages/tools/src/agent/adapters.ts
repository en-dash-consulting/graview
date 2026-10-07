import type { AnySchema, GraphDiff, NodeOfSchema } from "@graview/core";
import type { ToolAnnotations, ToolRuntime } from "./tools.js";

/** The shape an MCP server expects from `tools/list`. */
export interface McpTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  /** What the tool does, as MCP directories ask: read-only, destructive, idempotent, open-world (FR-10). */
  readonly annotations?: ToolAnnotations;
}

export interface McpContent {
  readonly type: "text";
  readonly text: string;
}

export interface McpToolResult {
  readonly content: readonly McpContent[];
  /** A refusal's reason beside its sentence (FR-119), for a client that branches rather than reads. */
  readonly structuredContent?: { readonly reason: string; readonly error: string; readonly wouldNeed?: readonly string[] };
  readonly isError?: boolean;
}

/**
 * Exposes the runtime to an external agent (Claude Code, Cursor) over MCP.
 *
 * This is a TRANSPORT, not a second implementation: it renames fields and
 * stringifies results, and that is all it does. The moment it starts making
 * decisions the two agent surfaces have begun to diverge.
 */
export function createMcpAdapter<S extends AnySchema>(runtime: ToolRuntime<S>) {
  return {
    /** The surface's fingerprint, for a host that cannot push `tools/list_changed`. */
    surfaceHash: runtime.hash,

    listTools(): McpTool[] {
      return runtime.definitions.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      }));
    },

    async callTool(
      name: string,
      args: Record<string, unknown> = {},
    ): Promise<McpToolResult> {
      const result = await runtime.call(name, args);
      if (!result.ok) {
        return {
          content: [{ type: "text", text: result.error }],
          ...(result.reason ? { structuredContent: { reason: result.reason, error: result.error, ...(result.wouldNeed ? { wouldNeed: result.wouldNeed } : {}) } } : {}),
          isError: true,
        };
      }
      return {
        content: [
          { type: "text", text: JSON.stringify({ data: result.data, diff: result.diff }, null, 2) },
        ],
      };
    },
  };
}

export interface InAppAgent<S extends AnySchema> {
  readonly tools: ToolRuntime<S>["definitions"];
  run(name: string, args?: Record<string, unknown>): Promise<unknown>;
  /** Watch every change, whoever caused it. */
  watch(listener: (diff: GraphDiff<NodeOfSchema<S>>) => void): () => void;
}

/**
 * The same runtime, driven from a surface inside the interface.
 *
 * Both adapters emit the same diff stream, which is the whole point: a human
 * edit and an agent edit are indistinguishable downstream, so the renderer
 * highlights an agent's work with exactly the code that highlights yours.
 */
export function createInAppAdapter<S extends AnySchema>(
  runtime: ToolRuntime<S>,
): InAppAgent<S> {
  return {
    tools: runtime.definitions,
    async run(name, args = {}) {
      const result = await runtime.call(name, args);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    watch(listener) {
      return runtime.onDiff(listener);
    },
  };
}
