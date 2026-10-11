import type { RemoteAck, RemoteChange, RemoteSystem, RemoteWrite } from "./types.js";

/**
 * A REMOTE THAT SPEAKS MCP — the tools another system already serves, called
 * by name, as the sync's transport.
 *
 * Three pieces, each usable alone. `mcpClient` calls a streamable-HTTP MCP
 * endpoint (a session, JSON or an event stream back with the reply read by
 * its request's id, one retry when the server forgot the session) and only the tools it was allowed. `mcpDoor` is
 * the narrow way a page reaches it: a server route that holds the token,
 * answers only its own origin's JSON, and passes only the allowed tools —
 * and `doorClient` is the page's side of it. `mcpRemote` turns calls into a
 * `RemoteSystem` the engine runs.
 *
 * Nothing here imports a `node:` builtin: the client runs in Node or a page,
 * and the door takes any request and response shaped like Node's.
 */

/** Calls one tool by name and resolves to what it answered: its text, parsed as JSON when it is JSON. */
export type ToolCall = (name: string, args: Record<string, unknown>) => Promise<unknown>;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * THE TOOLS A SYNC MAY CALL, and the sentence for one it may not. A sync
 * needs a handful of a server's tools; every other one stays out of reach,
 * whoever asks.
 */
export function allowTools(names: Iterable<string>): (name: string) => string | undefined {
  const allowed = [...new Set(names)];
  return (name) =>
    allowed.includes(name) ? undefined : `${name} is not a tool this sync uses (it uses ${allowed.join(", ")}).`;
}

export interface McpClientOptions {
  /** The server's MCP endpoint. */
  readonly url: string;
  /** The tools this client may call; any other is refused before it is sent. */
  readonly allow: Iterable<string>;
  /** Headers each request carries — a token read when it is needed, never handed to a page. */
  readonly headers?: () => Record<string, string> | Promise<Record<string, string>>;
  readonly fetch?: Fetch;
  /** Who is calling, as `initialize` says it. */
  readonly clientInfo?: { readonly name: string; readonly version: string };
}

interface RpcAnswer {
  readonly id?: unknown;
  readonly result?: { readonly content?: readonly { readonly type: string; readonly text?: string }[]; readonly isError?: boolean };
  readonly error?: { readonly message?: string };
}

/**
 * The `data` of each event in an event stream, as the SSE spec reads it: an
 * event ends at a blank line, its `data:` lines join with a newline, one
 * space after the colon is dropped, and a line starting `:` is a comment.
 */
function streamEvents(text: string): string[] {
  const events: string[] = [];
  let data: string[] | undefined;
  for (const line of `${text}\n\n`.split(/\r\n|\r|\n/)) {
    if (line === "") {
      if (data) events.push(data.join("\n"));
      data = undefined;
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === 0 || (colon === -1 ? line : line.slice(0, colon)) !== "data") continue;
    const value = colon === -1 ? "" : line.slice(colon + 1);
    (data ??= []).push(value.startsWith(" ") ? value.slice(1) : value);
  }
  return events;
}

/**
 * THE REPLY TO THIS REQUEST, chosen by its JSON-RPC id: a stream may carry
 * notifications and the server's own requests before or after it, and a
 * JSON body may be a batch. Undefined when nothing in the answer is it.
 */
async function readAnswer(response: Response, id: number): Promise<RpcAnswer | undefined> {
  const text = await response.text();
  const bodies = response.headers.get("content-type")?.includes("text/event-stream") ? streamEvents(text) : [text];
  for (const body of bodies) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      continue;
    }
    for (const message of Array.isArray(parsed) ? parsed : [parsed]) {
      if (message && typeof message === "object" && (message as RpcAnswer).id === id && ("result" in message || "error" in message)) return message as RpcAnswer;
    }
  }
  return undefined;
}

/** Calls an MCP server's tools over streamable HTTP. */
export function mcpClient(options: McpClientOptions): ToolCall {
  const send = options.fetch ?? ((input, init) => fetch(input, init));
  const refuse = allowTools(options.allow);
  let session: string | undefined;
  let opening: Promise<string | undefined> | undefined;
  let id = 0;

  const headers = async (extra: Record<string, string> = {}): Promise<Record<string, string>> => ({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...(await options.headers?.()),
    ...(session ? { "mcp-session-id": session } : {}),
    ...extra,
  });

  const open = async (): Promise<string | undefined> => {
    const init = await send(options.url, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++id,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: options.clientInfo ?? { name: "graview-sync", version: "1" } },
      }),
    });
    if (!init.ok) throw new Error(`The MCP server answered ${init.status} when the sync introduced itself.`);
    const opened = init.headers.get("mcp-session-id") ?? undefined;
    await init.text();
    await send(options.url, {
      method: "POST",
      headers: await headers(opened ? { "mcp-session-id": opened } : {}),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    return opened;
  };

  const call = async (name: string, args: Record<string, unknown>, retry: boolean): Promise<unknown> => {
    const refusal = refuse(name);
    if (refusal) throw new Error(refusal);
    if (session === undefined) session = await (opening ??= open().finally(() => (opening = undefined)));
    const asked = ++id;
    const response = await send(options.url, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ jsonrpc: "2.0", id: asked, method: "tools/call", params: { name, arguments: args } }),
    });
    if ((response.status === 404 || response.status === 400) && retry && session !== undefined) {
      // The server restarted and forgot the session: open another, once.
      session = undefined;
      await response.text();
      return call(name, args, false);
    }
    if (!response.ok) throw new Error(`The MCP server answered ${response.status} to ${name}.`);
    const answer = await readAnswer(response, asked);
    if (!answer) throw new Error(`The MCP server sent no reply to ${name}.`);
    if (answer.error) throw new Error(answer.error.message ?? `The MCP server refused ${name}.`);
    const text = answer.result?.content?.find((part) => part.type === "text")?.text ?? "";
    if (answer.result?.isError) throw new Error(text || `${name} failed.`);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  };

  return (name, args) => call(name, args, true);
}

/** The headers a door reads, as Node's `IncomingMessage` has them. */
export type DoorHeaders = Readonly<Record<string, string | readonly string[] | undefined>>;

/**
 * WHETHER A HOST IS THIS MACHINE AS A PAGE NAMES IT: `localhost`, a
 * `*.localhost` name or an IP address — or one of `hosts`, the names the
 * server was told it answers to. A page on a name of its own that it
 * rebinds to this machine sends its own name as the Host, and the browser
 * agrees with it about the origin; the name is what gives it away.
 */
export function ownHost(host: string | undefined, hosts: Iterable<string> = []): boolean {
  if (host === undefined) return true;
  let name: string;
  try {
    name = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (name === "localhost" || name.endsWith(".localhost") || /^\d{1,3}(\.\d{1,3}){3}$/.test(name) || name.startsWith("[")) return true;
  for (const allowed of hosts) if (allowed.toLowerCase() === name) return true;
  return false;
}

/**
 * WHETHER A REQUEST CAME FROM THIS SERVER'S OWN PAGES: no `Sec-Fetch-Site`
 * other than same-origin (or none, for curl), an `Origin`, when there is
 * one, naming this host, and a host that is this machine (`ownHost`). A page
 * on another origin can fire a request at a local server; it cannot make the
 * browser say it came from here. Every door answers this the same way: the
 * dev server's doors (`@graview/ship/dev`) ask this too.
 */
export function sameOrigin(headers: DoorHeaders, hosts?: Iterable<string>): boolean {
  const site = headers["sec-fetch-site"];
  if (typeof site === "string" && site !== "same-origin" && site !== "none") return false;
  const host = headers["host"];
  if (!ownHost(typeof host === "string" ? host : undefined, hosts)) return false;
  const origin = headers["origin"];
  if (typeof origin !== "string") return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** A request and a response, as Node's `http` (and Vite's and Connect's middleware) hands them. */
export interface DoorRequest {
  readonly method?: string;
  readonly url?: string;
  readonly headers: DoorHeaders;
  on(event: "data", listener: (chunk: unknown) => void): unknown;
  on(event: "end", listener: () => void): unknown;
}
export interface DoorResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body: string): unknown;
}

export interface McpDoorOptions {
  /** Where the door answers. Default `/graview/mcp`. */
  readonly path?: string;
  /** What reaches the server — usually an `mcpClient` holding the token. */
  readonly call: ToolCall;
  /** The tools a page may ask for through the door. */
  readonly allow: Iterable<string>;
  /** Host names the server answers to besides this machine's own (`ownHost`). */
  readonly hosts?: Iterable<string>;
  /** The most a request may send, in bytes. Default 1 MB. */
  readonly limit?: number;
}

/**
 * THE DOOR A PAGE REACHES A TOOL SERVER THROUGH, as server middleware.
 *
 * The page never holds the token and never names the endpoint: it posts
 * `{ name, arguments }` here and gets `{ ok, result | error }` back. What
 * passes is as narrow as the sync needs — a POST, `application/json`, from
 * this server's own origin, naming an allowed tool — and every refusal says
 * which of those it was.
 */
export function mcpDoor(options: McpDoorOptions): (request: DoorRequest, response: DoorResponse, next: () => void) => void {
  const path = options.path ?? "/graview/mcp";
  const refuse = allowTools(options.allow);
  const hosts = options.hosts ? [...options.hosts] : undefined;
  const limit = options.limit ?? 1_000_000;
  const answer = (response: DoorResponse, status: number, body: unknown) => {
    response.statusCode = status;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(body));
  };
  return (request, response, next) => {
    if ((request.url ?? "").split("?")[0] !== path) return next();
    if (request.method !== "POST") return answer(response, 405, { ok: false, error: "Refused: the door takes a POST." });
    if (!sameOrigin(request.headers, hosts)) return answer(response, 403, { ok: false, error: "Refused: not from this page's own origin." });
    const type = request.headers["content-type"];
    // The media type itself: one a page on another site may send unasked (`text/plain; x=application/json`) is not JSON.
    if (typeof type !== "string" || type.split(";")[0]!.trim().toLowerCase() !== "application/json") {
      return answer(response, 415, { ok: false, error: "Refused: send application/json." });
    }
    const decoder = new TextDecoder();
    let text = "";
    let size = 0;
    let over = false;
    request.on("data", (chunk) => {
      if (over) return;
      const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : (chunk as Uint8Array);
      size += bytes.byteLength;
      if (size > limit) {
        over = true;
        return answer(response, 413, { ok: false, error: `Refused: more than ${limit} bytes.` });
      }
      text += decoder.decode(bytes, { stream: true });
    });
    request.on("end", () => {
      if (over) return;
      text += decoder.decode();
      void (async () => {
        let asked: { name?: unknown; arguments?: unknown };
        try {
          asked = JSON.parse(text || "{}") as typeof asked;
        } catch {
          return answer(response, 400, { ok: false, error: "Refused: the body is not JSON." });
        }
        if (typeof asked.name !== "string") return answer(response, 400, { ok: false, error: "Refused: name the tool." });
        const refusal = refuse(asked.name);
        if (refusal) return answer(response, 403, { ok: false, error: `Refused: ${refusal}` });
        try {
          const args = asked.arguments && typeof asked.arguments === "object" ? (asked.arguments as Record<string, unknown>) : {};
          answer(response, 200, { ok: true, result: await options.call(asked.name, args) });
        } catch (error) {
          answer(response, 200, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
    });
  };
}

/** The page's side of an `mcpDoor`: the same calls, posted to the door on this page's own origin. */
export function doorClient(options: { readonly path?: string; readonly base?: string; readonly fetch?: Fetch } = {}): ToolCall {
  const send = options.fetch ?? ((input, init) => fetch(input, init));
  const at = `${options.base ?? ""}${options.path ?? "/graview/mcp"}`;
  return async (name, args) => {
    const response = await send(at, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, arguments: args }) });
    const body = (await response.json().catch(() => ({ ok: false, error: `The door answered ${response.status}.` }))) as {
      ok?: boolean;
      result?: unknown;
      error?: string;
    };
    if (!body.ok) throw new Error(body.error ?? `The door refused ${name}.`);
    return body.result;
  };
}

export interface McpRemoteOptions {
  /** Names the remote. */
  readonly name: string;
  /** How a call reaches the tools: `mcpClient` in Node, `doorClient` in a page. */
  readonly call: ToolCall;
  /** Everything that changed since `cursor`, read with the tools. */
  pull(call: ToolCall, cursor?: string): Promise<{ readonly changes: readonly RemoteChange[]; readonly cursor: string }>;
  /**
   * One write, made with the tools, and the version it produced. Whatever it
   * throws is that write's refusal, in its own words; the rest still go.
   */
  push(call: ToolCall, write: RemoteWrite): Promise<{ readonly id: string; readonly version: string }>;
}

/** A `RemoteSystem` over a tool server: one write at a time, each refused alone. */
export function mcpRemote(options: McpRemoteOptions): RemoteSystem {
  return {
    name: options.name,
    pull: (cursor) => options.pull(options.call, cursor),
    async push(writes) {
      const acks: RemoteAck[] = [];
      for (const write of writes) {
        try {
          acks.push({ localId: write.localId, ...(await options.push(options.call, write)) });
        } catch (error) {
          acks.push({ localId: write.localId, id: write.id ?? "", version: "", error: error instanceof Error ? error.message : String(error) });
        }
      }
      return acks;
    },
  };
}
