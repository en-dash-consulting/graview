import type { McpTool, McpToolResult } from "./agent/adapters.js";

/**
 * THE FIVE METHODS THAT MATTER, once, for every transport.
 *
 * JSON-RPC 2.0 over stdio for an editor's agent, over Streamable HTTP for
 * a hosted app: the bytes move differently and the answers are the same.
 * This decides nothing about tools — the adapter renames fields and the
 * runtime is where the tools live.
 */
export interface McpAdapterLike {
  listTools(): McpTool[];
  callTool(name: string, args?: Record<string, unknown>): Promise<McpToolResult>;
  /** The tool surface's fingerprint, said on `tools/list` so a stateless host's client can tell the list moved. */
  readonly surfaceHash?: string;
}

export interface McpServerInfo {
  readonly name: string;
  readonly version: string;
  /** What a client shows its model on connecting: how to work here, in a paragraph. */
  readonly instructions?: string;
}

export interface JsonRpcRequest {
  readonly jsonrpc?: string;
  readonly id?: number | string | null;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
}

/** The newest protocol revision this speaks; a client asking for an older one gets its own back. */
export const MCP_PROTOCOL_VERSION = "2025-11-25";

export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;

/** Where the surface hash rides on `tools/list`. */
export const SURFACE_META = "dev.graview/surface";

export interface McpAnswer {
  /** The JSON-RPC response, absent for a notification. */
  readonly response?: unknown;
  readonly method: string;
  readonly ok: boolean;
}

/** One message in, at most one response out. */
export async function answerMcp(request: JsonRpcRequest, adapter: McpAdapterLike, info: McpServerInfo): Promise<McpAnswer> {
  const { id, method, params = {} } = request;
  const notification = id === undefined;
  const reply = (result: unknown): McpAnswer => ({ response: { jsonrpc: "2.0", id: id ?? null, result }, method: method ?? "?", ok: true });
  const fail = (code: number, message: string): McpAnswer => ({ response: { jsonrpc: "2.0", id: id ?? null, error: { code, message } }, method: method ?? "?", ok: false });
  switch (method) {
    case "initialize": {
      const asked = typeof params["protocolVersion"] === "string" ? (params["protocolVersion"] as string) : MCP_PROTOCOL_VERSION;
      return reply({
        protocolVersion: asked <= MCP_PROTOCOL_VERSION ? asked : MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: info.name, version: info.version },
        ...(info.instructions ? { instructions: info.instructions } : {}),
      });
    }
    case "notifications/initialized":
    case "notifications/cancelled":
    case "notifications/roots/list_changed":
      return { method, ok: true };
    case "ping":
      return notification ? { method, ok: true } : reply({});
    case "tools/list":
      return reply({
        tools: adapter.listTools(),
        ...(adapter.surfaceHash ? { _meta: { [SURFACE_META]: adapter.surfaceHash } } : {}),
      });
    case "tools/call": {
      const name = params["name"];
      if (typeof name !== "string") return fail(INVALID_PARAMS, "tools/call needs a tool name.");
      const args = (params["arguments"] ?? {}) as Record<string, unknown>;
      const result = await adapter.callTool(name, args);
      return { ...reply(result), ok: result.isError !== true };
    }
    default:
      if (notification) return { method: method ?? "?", ok: true };
      return fail(METHOD_NOT_FOUND, `Method not found: ${method ?? "(none)"}`);
  }
}
