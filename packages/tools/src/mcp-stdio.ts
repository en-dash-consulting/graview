import type { McpTool, McpToolResult } from "./agent/adapters.js";

/**
 * MCP OVER STDIO, without a dependency.
 *
 * The protocol an editor's agent speaks to a local tool server is small:
 * JSON-RPC 2.0, one message per line, five methods that matter. Writing
 * them out is shorter than the SDK's install notes, keeps `graview mcp` a
 * command any project already has the dependencies for, and — the point —
 * leaves the adapter as the ONLY thing that decides anything. This file
 * moves bytes; `createMcpAdapter` renames fields; the runtime is where the
 * tools live. Three layers, none of which can disagree about a tool.
 */

export interface McpAdapterLike {
  listTools(): McpTool[];
  callTool(name: string, args?: Record<string, unknown>): Promise<McpToolResult>;
}

export interface StdioMcpOptions {
  readonly adapter: McpAdapterLike;
  readonly name: string;
  readonly version: string;
  /** What a client shows its model on connecting: how to work here, in a paragraph. */
  readonly instructions?: string;
  readonly input: AsyncIterable<string | Uint8Array>;
  readonly output: { write(chunk: string): unknown };
  /** Told about each request as it settles — a host's log, on stderr. */
  readonly onRequest?: (method: string, ok: boolean) => void;
}

interface JsonRpcRequest {
  readonly jsonrpc?: string;
  readonly id?: number | string | null;
  readonly method?: string;
  readonly params?: Record<string, unknown>;
}

/** The newest protocol revision this speaks; a client asking for an older one gets its own back. */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const PARSE_ERROR = -32700;

/**
 * Serves until the input ends. Requests are answered IN ORDER, one at a
 * time: a mutation lands before the read that follows it looks, which is
 * the ordering an agent assumes when it acts and then checks.
 */
export async function serveMcpStdio(options: StdioMcpOptions): Promise<void> {
  const send = (message: unknown) => options.output.write(`${JSON.stringify(message)}\n`);
  const reply = (id: JsonRpcRequest["id"], result: unknown) => send({ jsonrpc: "2.0", id: id ?? null, result });
  const fail = (id: JsonRpcRequest["id"], code: number, message: string) =>
    send({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

  const handle = async (request: JsonRpcRequest): Promise<void> => {
    const { id, method, params = {} } = request;
    const notification = id === undefined;
    const settle = (ok: boolean) => options.onRequest?.(method ?? "?", ok);
    switch (method) {
      case "initialize": {
        const asked = typeof params["protocolVersion"] === "string" ? (params["protocolVersion"] as string) : MCP_PROTOCOL_VERSION;
        reply(id, {
          protocolVersion: asked <= MCP_PROTOCOL_VERSION ? asked : MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: options.name, version: options.version },
          ...(options.instructions ? { instructions: options.instructions } : {}),
        });
        return settle(true);
      }
      case "notifications/initialized":
      case "notifications/cancelled":
      case "notifications/roots/list_changed":
        return;
      case "ping":
        if (!notification) reply(id, {});
        return settle(true);
      case "tools/list":
        reply(id, { tools: options.adapter.listTools() });
        return settle(true);
      case "tools/call": {
        const name = params["name"];
        if (typeof name !== "string") {
          fail(id, INVALID_PARAMS, "tools/call needs a tool name.");
          return settle(false);
        }
        const args = (params["arguments"] ?? {}) as Record<string, unknown>;
        const result = await options.adapter.callTool(name, args);
        reply(id, result);
        return settle(result.isError !== true);
      }
      default:
        if (notification) return;
        fail(id, METHOD_NOT_FOUND, `Method not found: ${method ?? "(none)"}`);
        return settle(false);
    }
  };

  let pending = "";
  for await (const chunk of options.input) {
    pending += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    let newline = pending.indexOf("\n");
    while (newline !== -1) {
      const line = pending.slice(0, newline).trim();
      pending = pending.slice(newline + 1);
      newline = pending.indexOf("\n");
      if (line.length === 0) continue;
      let request: JsonRpcRequest;
      try {
        request = JSON.parse(line) as JsonRpcRequest;
      } catch {
        fail(null, PARSE_ERROR, "That line was not JSON.");
        continue;
      }
      // A batch is answered message by message, in order.
      for (const one of Array.isArray(request) ? (request as JsonRpcRequest[]) : [request]) await handle(one);
    }
  }
}
