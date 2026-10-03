import type { AnySchema, Principal, Store } from "@graview/core";
import { createMcpAdapter } from "./agent/adapters.js";
import { createToolRuntime, type ToolRuntimeOptions } from "./agent/tools.js";
import { answerMcp, INVALID_REQUEST, MCP_PROTOCOL_VERSION, PARSE_ERROR, type JsonRpcRequest } from "./mcp-protocol.js";

/**
 * MCP FOR REMOTE HOSTS (FR-10): Streamable HTTP, stateless, as a fetch handler.
 *
 * ChatGPT and Claude reach a server over HTTP, not stdio. This is the same
 * five methods `graview mcp` answers, behind `(Request) → Response`, so a
 * host mounts it in a Worker, Deno, Bun or a Node server with `Request` and
 * `Response` alike. Stateless: no session is issued and nothing is kept
 * between requests — each POST is judged on its own, by the principal the
 * host's auth hook says made it, and a runtime is derived for that
 * principal there and then. There is no stream to GET; a client is told so
 * with a 405, which the protocol allows.
 *
 * The auth hook is the only door. No principal, no answer — not
 * `initialize`, not `tools/list`: a stranger learns nothing about an app,
 * including what it could do.
 */
export interface McpHttpOptions<S extends AnySchema> {
  /** The store a request reads and acts on — or, given the principal and the request, the one it should. */
  readonly store: Store<S> | ((principal: Principal, request: Request) => Store<S> | Promise<Store<S>>);
  /**
   * WHO IS CALLING, from the request: a bearer token, a session cookie, a
   * signed header. Undefined or null refuses the request with a 401.
   */
  readonly authenticate: (request: Request) => Principal | null | undefined | Promise<Principal | null | undefined>;
  readonly name: string;
  readonly version: string;
  /** What a client shows its model on connecting. */
  readonly instructions?: string;
  /** Refuse every mutating tool, for every caller. */
  readonly readOnly?: boolean;
  readonly places?: ToolRuntimeOptions<S>["places"];
  readonly derive?: ToolRuntimeOptions<S>["derive"];
  /** What a refused request's `WWW-Authenticate` says, e.g. `Bearer resource_metadata="…"`. `Bearer` when unsaid. */
  readonly challenge?: string;
}

const JSON_TYPE = { "content-type": "application/json" };

const rpcError = (status: number, code: number, message: string, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code, message } }), { status, headers: { ...JSON_TYPE, ...headers } });

/** A fetch-style MCP endpoint over Streamable HTTP. */
export function createMcpHttpHandler<S extends AnySchema>(options: McpHttpOptions<S>): (request: Request) => Promise<Response> {
  const info = { name: options.name, version: options.version, ...(options.instructions ? { instructions: options.instructions } : {}) };
  return async (request) => {
    const principal = await options.authenticate(request);
    if (!principal) {
      return rpcError(401, -32001, "Not signed in: this server answers only a caller its host recognises.", {
        "www-authenticate": options.challenge ?? "Bearer",
      });
    }
    if (request.method !== "POST") {
      // Stateless: no stream to open and no session to end.
      return new Response(null, { status: 405, headers: { allow: "POST" } });
    }
    const asked = request.headers.get("mcp-protocol-version");
    if (asked !== null && !(asked <= MCP_PROTOCOL_VERSION)) {
      return rpcError(400, INVALID_REQUEST, `Unsupported MCP-Protocol-Version "${asked}"; this server speaks up to ${MCP_PROTOCOL_VERSION}.`);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return rpcError(400, PARSE_ERROR, "The body was not JSON.");
    }
    const messages = (Array.isArray(body) ? body : [body]) as JsonRpcRequest[];
    if (messages.length === 0 || messages.some((message) => typeof message !== "object" || message === null)) {
      return rpcError(400, INVALID_REQUEST, "Expected a JSON-RPC message.");
    }

    const store = typeof options.store === "function" ? await options.store(principal, request) : options.store;
    const adapter = createMcpAdapter(
      createToolRuntime(store, {
        author: principal,
        ...(options.readOnly ? { readOnly: true } : {}),
        ...(options.places ? { places: options.places } : {}),
        ...(options.derive ? { derive: options.derive } : {}),
      }),
    );
    // In order, one at a time: an act lands before the read after it looks.
    const responses: unknown[] = [];
    for (const message of messages) {
      // A response from the client (to a request this server never sends) is accepted and dropped.
      if (message.method === undefined) continue;
      const answer = await answerMcp(message, adapter, info);
      if (answer.response !== undefined) responses.push(answer.response);
    }
    if (responses.length === 0) return new Response(null, { status: 202 });
    return new Response(JSON.stringify(Array.isArray(body) ? responses : responses[0]), { status: 200, headers: JSON_TYPE });
  };
}
