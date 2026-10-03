import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { AnySchema, Operation } from "@graview/core";
import { createStoreHandler, SEAT_HEADERS, seatFromHeaders, WIRE, type StoreHandler, type StoreHandlerOptions } from "./handler.js";
import { LIVE_PATH } from "./live.js";
import { acceptSocket, type ServerSocket } from "./websocket.js";

/**
 * THE STORE, BEHIND NODE'S HTTP — a thin wrapper and nothing more (FR-09).
 *
 * Every route lives in `createStoreHandler` (`./handler.ts`), one function
 * from a `Request` to a `Response` that any runtime can call. This module
 * only turns Node's `IncomingMessage` into a `Request`, the `Response` back
 * into bytes on the socket, and listens. `graview serve` is this.
 *
 * And the live wire (FR-05): an upgrade to `LIVE_PATH` goes to the
 * handler's `connect`, over the small RFC 6455 server in `./websocket.ts`.
 */

export { SEAT_HEADERS, seatFromHeaders, WIRE };

export interface ServeOptions<S extends AnySchema> extends StoreHandlerOptions<S> {
  readonly port?: number;
  /** The address to listen on. Every interface when absent. */
  readonly host?: string;
}

export interface ServedStore<S extends AnySchema> extends Omit<StoreHandler<S>, "close"> {
  readonly server: Server;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

export async function serveStore<S extends AnySchema>(options: ServeOptions<S>): Promise<ServedStore<S>> {
  const { port: wanted, host, ...rest } = options;
  const handler = await createStoreHandler(rest);

  const server = createServer((incoming, outgoing) => {
    void requestOf(incoming)
      .then(handler.handle)
      .then((response) => write(outgoing, response))
      .catch((error: unknown) => {
        const text = JSON.stringify({ error: error instanceof Error ? error.message : String(error) });
        if (!outgoing.headersSent) outgoing.writeHead(500, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
        outgoing.end(text);
      });
  });

  /*
   * THE LIVE WIRE (FR-05). The seat is read from the upgrade before it is
   * answered: a store that cannot say who is asking refuses with the same
   * 401 its routes do, and never switches protocols.
   */
  server.on("upgrade", (incoming: IncomingMessage, stream: Duplex, head: Buffer) => {
    stream.on("error", () => {});
    const path = new URL(incoming.url ?? "/", "http://localhost").pathname;
    const key = incoming.headers["sec-websocket-key"];
    if (path !== LIVE_PATH || typeof key !== "string" || String(incoming.headers.upgrade).toLowerCase() !== "websocket") {
      stream.end("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
      return;
    }
    let socket: ServerSocket | undefined;
    void requestOf(incoming)
      .then((request) => handler.connect(request, { send: (text) => socket?.send(text), close: (code, reason) => socket?.close(code, reason) }))
      .then(async (answered) => {
        if (answered instanceof Response) {
          const body = Buffer.from(await answered.arrayBuffer());
          stream.end(`HTTP/1.1 ${answered.status} Refused\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body.toString("utf8")}`);
          return;
        }
        socket = acceptSocket(stream, key, head, { message: (text) => answered.receive(text), close: () => answered.close() });
      })
      .catch(() => stream.destroy());
  });

  const port = await listen(server, wanted ?? 0, host);
  return {
    store: handler.store,
    opened: handler.opened,
    handle: handler.handle,
    connect: handler.connect,
    server,
    port,
    url: `http://localhost:${port}`,
    async close() {
      await handler.close();
      // An open socket is a connection `close` would otherwise wait for.
      server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}

/** Node's request as the `Request` every other runtime hands a handler. */
async function requestOf(incoming: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one);
  }
  const method = incoming.method ?? "GET";
  const chunks: Buffer[] = [];
  if (method !== "GET" && method !== "HEAD") for await (const chunk of incoming) chunks.push(chunk as Buffer);
  return new Request(new URL(incoming.url ?? "/", "http://localhost"), {
    method,
    headers,
    ...(chunks.length > 0 ? { body: Buffer.concat(chunks) } : {}),
  });
}

async function write(outgoing: ServerResponse, response: Response): Promise<void> {
  const body = Buffer.from(await response.arrayBuffer());
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  if (response.status !== 204) headers["content-length"] = String(body.length);
  outgoing.writeHead(response.status, headers);
  outgoing.end(body);
}

function listen(server: Server, port: number, host?: string): Promise<number> {
  return new Promise((ready, fail) => {
    server.once("error", fail);
    server.listen(port, host, () => {
      const address = server.address();
      ready(typeof address === "object" && address !== null ? address.port : port);
    });
  });
}

export type { Operation };
