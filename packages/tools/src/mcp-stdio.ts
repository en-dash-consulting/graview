import { answerMcp, PARSE_ERROR, type JsonRpcRequest, type McpAdapterLike } from "./mcp-protocol.js";

/**
 * MCP OVER STDIO, without a dependency.
 *
 * The protocol an editor's agent speaks to a local tool server is small:
 * JSON-RPC 2.0, one message per line, five methods that matter. Writing
 * them out is shorter than the SDK's install notes, keeps `graview mcp` a
 * command any project already has the dependencies for, and — the point —
 * leaves the adapter as the ONLY thing that decides anything. This file
 * moves bytes; `answerMcp` answers; `createMcpAdapter` renames fields; the
 * runtime is where the tools live. None of them can disagree about a tool.
 */

export type { McpAdapterLike } from "./mcp-protocol.js";
export { MCP_PROTOCOL_VERSION } from "./mcp-protocol.js";

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

/**
 * Serves until the input ends. Requests are answered IN ORDER, one at a
 * time: a mutation lands before the read that follows it looks, which is
 * the ordering an agent assumes when it acts and then checks.
 */
export async function serveMcpStdio(options: StdioMcpOptions): Promise<void> {
  const send = (message: unknown) => options.output.write(`${JSON.stringify(message)}\n`);
  const info = { name: options.name, version: options.version, ...(options.instructions ? { instructions: options.instructions } : {}) };

  const handle = async (request: JsonRpcRequest): Promise<void> => {
    const answer = await answerMcp(request, options.adapter, info);
    if (answer.response !== undefined) send(answer.response);
    if (answer.response !== undefined || request.method === "ping") options.onRequest?.(answer.method, answer.ok);
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
        send({ jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "That line was not JSON." } });
        continue;
      }
      // A batch is answered message by message, in order.
      for (const one of Array.isArray(request) ? (request as JsonRpcRequest[]) : [request]) await handle(one);
    }
  }
}
