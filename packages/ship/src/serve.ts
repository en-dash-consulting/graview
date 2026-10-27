import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { gzipSync } from "node:zlib";
import type { Duplex } from "node:stream";
import type { AnySchema, CompactOptions, Operation } from "@graview/core";
import { ownHost, sameOrigin } from "@graview/core/sync";
import { createStoreHandler, SEAT_HEADERS, seatFromHeaders, WIRE, type AdapterStoreHandlerOptions, type StoreHandler } from "./handler.js";
import type { Compaction, OpenedStore } from "./open-store.js";
import { LIVE_PATH, LIVE_SUBPROTOCOL } from "./live.js";
import { acceptSocket, type ServerSocket } from "./websocket.js";
import { cookieOf, sameKey, tradeKey } from "./door.js";
import { SERVE_KEY } from "./seat-headers.js";

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

export interface ServeOptions<S extends AnySchema> extends AdapterStoreHandlerOptions<S> {
  readonly port?: number;
  /** The address to listen on. Every interface when absent. */
  readonly host?: string;
  /**
   * Asked first, for every request that is not the live wire: a response
   * answers it, `undefined` hands it to the store. How `graview preview`
   * serves its page and the document beside the store's own routes.
   */
  readonly answer?: (request: Request) => Response | undefined | Promise<Response | undefined>;
  /**
   * Answer only pages on this server's own origin, at a host that is this
   * machine (`sameOrigin` from `@graview/core/sync`) — the live wire too.
   * How `graview preview`, which believes the seat its own page names, keeps
   * another site's page, or one that rebinds its name here, out of that seat.
   * Off by default: a store an embed reaches is reached from other origins.
   * On, the store's answers name no origin but `allowOrigins`' to a
   * browser (no `Access-Control-Allow-Origin: *`).
   */
  readonly ownOrigin?: boolean;
  /**
   * THE OTHER PAGES `ownOrigin` LETS IN: origins (`http://localhost:5195`)
   * whose pages may use this server too — a dev server's app opened
   * against `graview serve` (`?server=…`). Each is answered with its own
   * origin in `Access-Control-Allow-Origin`, and only at a host that is
   * this machine. Nothing besides this server's own page when absent.
   */
  readonly allowOrigins?: readonly string[];
  /**
   * THIS RUN'S KEY (`SERVE_KEY`): when said, no request but health (and a
   * browser's preflight) is answered unless it carries it — in
   * `x-graview-key`, in the `graview_key` query parameter, or in the
   * cookie the address `?graview_key=<key>` is traded for (303 back to
   * the same address without it; `HttpOnly`, `SameSite=Strict`, a value
   * made from the key rather than the key). How `graview serve` on
   * loopback keeps another account on this machine, or any program that
   * sends no `Origin`, out of the seats it believes from headers. The key
   * is never written into an answer. Compared in constant time.
   */
  readonly key?: string;
  /**
   * The most bytes a request's body may carry: one that says more, or sends
   * more as it streams (chunked too), is answered 413 before any route or
   * `seatOf` is asked — read in memory before either, a body is the cost
   * of reaching the port. `MAX_BODY_BYTES` (16 MiB, a live message's
   * limit) unless said.
   */
  readonly maxBodyBytes?: number;
}

/** The largest body a request may carry unless the host says otherwise: what a live message may (`websocket.ts`). */
export const MAX_BODY_BYTES = 16 * 1024 * 1024;

export interface ServedStore<S extends AnySchema> extends Omit<StoreHandler<S>, "close" | "opened"> {
  readonly opened: OpenedStore<S>;
  /** Compacts the log behind an undo horizon (`opened.compact`), kept behind what every open socket was sent (`pins`). */
  compact(options?: CompactOptions): Promise<Compaction>;
  readonly server: Server;
  readonly port: number;
  readonly url: string;
  /**
   * Closes the store and the server, and every connection still open on
   * it: a keep-alive connection at once, a live socket after it has been
   * told the store is closing and given `grace` milliseconds (1500 unless
   * said) to go. A socket somebody else holds open — a dev server's proxy
   * keeps its half while its page is open — would otherwise keep the server,
   * and the process, from ever closing.
   */
  close(options?: { readonly grace?: number }): Promise<void>;
}

/** What a request without this run's key is told: where the key is, and nothing else. */
export const KEY_MISSING = "This store answers only a page or a program given the address graview serve printed (it carries this run's key): open that address, pass it as --remote-url, or send its key as x-graview-key.";

/** How long a live socket is given to go once it has been told the store is closing. */
const CLOSE_GRACE_MS = 1500;

export async function serveStore<S extends AnySchema>(options: ServeOptions<S>): Promise<ServedStore<S>> {
  const { port: wanted, host, answer, ownOrigin = false, allowOrigins = [], key, maxBodyBytes = MAX_BODY_BYTES, ...rest } = options;
  const handler = await createStoreHandler(rest);
  const NOT_OURS = JSON.stringify({ error: "Refused: not from this server's own page.", reason: "forbidden" });
  const NO_KEY = JSON.stringify({ error: KEY_MISSING, reason: "forbidden" });
  // What the cookie holds: made from the key, so not even the trade's own answer writes the key.
  const cookieValue = key === undefined ? undefined : createHash("sha256").update(`graview-serve-cookie:${key}`).digest("base64url");
  /*
   * The cookie is named for the port this server listens on: a browser sends
   * a cookie to every port of a host, so two stores open in one browser would
   * otherwise each overwrite the other's.
   */
  let listening = 0;
  const cookieName = () => `${SERVE_KEY.cookie}_${listening}`;
  /** Whether a request carries this run's key — always, when the store keeps none. */
  const keyed = (incoming: IncomingMessage): boolean => {
    if (key === undefined || cookieValue === undefined) return true;
    const header = incoming.headers[SERVE_KEY.header];
    if (typeof header === "string" && sameKey(header, key)) return true;
    const cookie = cookieOf(incoming, cookieName());
    if (cookie !== undefined && sameKey(cookie, cookieValue)) return true;
    const raw = incoming.url ?? "/";
    if (!raw.includes(`${SERVE_KEY.param}=`)) return false;
    const given = addressOf(incoming)?.searchParams.get(SERVE_KEY.param) ?? null;
    return given !== null && sameKey(given, key);
  };
  /** Health says whether the store is well to anybody, and a preflight carries no header a page would send: neither needs the key. */
  const open = (incoming: IncomingMessage): boolean => incoming.method === "OPTIONS" || addressOf(incoming)?.pathname === "/graview/health";
  const allowed = new Set(allowOrigins.map(originOf).filter((origin): origin is string => origin !== undefined));
  /** The origin a request's page is on, when it is one this server lets in besides its own (and at a host that is this machine). */
  const allowedOrigin = (incoming: IncomingMessage): string | undefined => {
    const origin = originOf(incoming.headers.origin);
    const at = incoming.headers.host;
    return origin !== undefined && allowed.has(origin) && ownHost(typeof at === "string" ? at : undefined) ? origin : undefined;
  };
  const refused = (incoming: IncomingMessage) => ownOrigin && !sameOrigin(incoming.headers) && allowedOrigin(incoming) === undefined;
  /*
   * WHICH PAGES MAY READ THE ANSWER. The handler says `*`, for an embed on
   * any origin; a server that keeps to its own page says none, or the one
   * allowed origin that asked, so a page elsewhere cannot read what a seat
   * it claimed was served.
   */
  const corsOf = (incoming: IncomingMessage): ((headers: Record<string, string>) => void) | undefined => {
    if (!ownOrigin) return undefined;
    const origin = allowedOrigin(incoming);
    return (headers) => {
      delete headers["access-control-allow-origin"];
      if (origin === undefined) return;
      headers["access-control-allow-origin"] = origin;
      headers["vary"] = headers["vary"] ? `${headers["vary"]}, Origin` : "Origin";
    };
  };

  const server = createServer((incoming, outgoing) => {
    if (refused(incoming)) {
      outgoing.writeHead(403, { "content-type": "application/json", "content-length": Buffer.byteLength(NOT_OURS) });
      outgoing.end(NOT_OURS);
      return;
    }
    if (key !== undefined && cookieValue !== undefined) {
      // The printed address, opened in a browser: the key traded for the cookie, and the address tidied.
      const method = incoming.method ?? "GET";
      const path = addressOf(incoming)?.pathname ?? "/";
      if ((method === "GET" || method === "HEAD") && !path.startsWith("/graview/") && tradeKey(incoming, outgoing, { param: SERVE_KEY.param, cookie: cookieName(), key, value: cookieValue })) return;
      if (!open(incoming) && !keyed(incoming)) {
        const headers: Record<string, string> = { "content-type": "application/json", "content-length": String(Buffer.byteLength(NO_KEY)), "cache-control": "no-store" };
        corsOf(incoming)?.(headers);
        outgoing.writeHead(401, headers);
        outgoing.end(NO_KEY);
        return;
      }
    }
    void requestOf(incoming, maxBodyBytes)
      .then(async (request) => (answer ? await answer(request) : undefined) ?? handler.handle(request))
      .then((response) => write(outgoing, response, takesGzip(incoming), corsOf(incoming)))
      .catch((error: unknown) => {
        if (error instanceof TooLarge) {
          // Said, and the connection closed behind it: what is still coming is not read.
          const text = JSON.stringify({ error: `A request's body is at most ${maxBodyBytes} bytes.`, reason: "limit" });
          if (!outgoing.headersSent) outgoing.writeHead(413, { "content-type": "application/json", "content-length": Buffer.byteLength(text), connection: "close" });
          outgoing.once("finish", () => incoming.socket.destroy());
          outgoing.end(text);
          return;
        }
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
  // Every upgraded stream, which the server no longer counts as its own connection to close.
  const upgraded = new Set<Duplex>();
  server.on("upgrade", (incoming: IncomingMessage, stream: Duplex, head: Buffer) => {
    stream.on("error", () => {});
    upgraded.add(stream);
    stream.once("close", () => upgraded.delete(stream));
    const path = addressOf(incoming)?.pathname;
    const key = incoming.headers["sec-websocket-key"];
    if (refused(incoming)) {
      stream.end(`HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(NOT_OURS)}\r\nConnection: close\r\n\r\n${NOT_OURS}`);
      return;
    }
    // A page's socket cannot set a header: its key rides in the query, or in the cookie its page was given.
    if (!keyed(incoming)) {
      stream.end(`HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(NO_KEY)}\r\nConnection: close\r\n\r\n${NO_KEY}`);
      return;
    }
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
        // Ship's codec by name, when the client asked for it by name (FR-44).
        const subprotocol = String(incoming.headers["sec-websocket-protocol"] ?? "").split(",").map((one) => one.trim()).includes(LIVE_SUBPROTOCOL) ? LIVE_SUBPROTOCOL : undefined;
        socket = acceptSocket(stream, key, head, { message: (text) => answered.receive(text), close: () => answered.close() }, subprotocol);
      })
      .catch(() => stream.destroy());
  });

  const port = await listen(server, wanted ?? 0, host);
  listening = port;
  return {
    // Read through: the declaration changing replaces them (FR-43).
    get store() {
      return handler.store;
    },
    get opened() {
      return handler.opened;
    },
    get protocol() {
      return handler.protocol;
    },
    handle: handler.handle,
    connect: handler.connect,
    seatFor: handler.seatFor,
    declarationChanged: handler.declarationChanged,
    announce: handler.announce,
    onCall: handler.onCall,
    hold: handler.hold,
    release: handler.release,
    pins: handler.pins,
    compact: handler.compact,
    server,
    port,
    url: `http://localhost:${port}`,
    async close({ grace = CLOSE_GRACE_MS } = {}) {
      const closed = new Promise<void>((done) => server.close(() => done()));
      // An open socket is a connection `close` would otherwise wait for: keep-alive ones go now.
      server.closeAllConnections();
      // The live sockets are told the store is closing (1001), and given the grace to go.
      await handler.close();
      for (const stream of upgraded) stream.end();
      if (upgraded.size > 0) {
        await new Promise<void>((done) => {
          const timer = setTimeout(done, grace);
          timer.unref?.();
          const check = () => {
            if (upgraded.size > 0) return;
            clearTimeout(timer);
            done();
          };
          for (const stream of upgraded) stream.once("close", () => queueMicrotask(check));
        });
        // What did not go in the grace is cut: its other end is not listening.
        for (const stream of upgraded) stream.destroy();
      }
      await closed;
    },
  };
}

/** Where a request asks, or nothing for an address no URL parses (`//[`): asked before any promise, a throw there would end the process. */
function addressOf(incoming: IncomingMessage): URL | undefined {
  try {
    return new URL(incoming.url ?? "/", "http://localhost");
  } catch {
    return undefined;
  }
}

/** A body over the limit: answered 413. */
class TooLarge extends Error {}

/** Node's request as the `Request` every other runtime hands a handler, its body no larger than `limit`. */
async function requestOf(incoming: IncomingMessage, limit = MAX_BODY_BYTES): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) continue;
    for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one);
  }
  const method = incoming.method ?? "GET";
  const body = method !== "GET" && method !== "HEAD" ? await bodyOf(incoming, limit) : undefined;
  // The run's key was asked for at the door: nothing past it — a route, a host's `answer` — is handed it.
  headers.delete(SERVE_KEY.header);
  const url = new URL(incoming.url ?? "/", "http://localhost");
  if (url.searchParams.has(SERVE_KEY.param)) url.searchParams.delete(SERVE_KEY.param);
  return new Request(url, {
    method,
    headers,
    ...(body && body.length > 0 ? { body } : {}),
  });
}

/**
 * A request's body, counted as it arrives: refused before a byte is read
 * when its declared length is over the limit, and the moment what has
 * streamed passes it — a chunked body says no length.
 */
function bodyOf(incoming: IncomingMessage, limit: number): Promise<Buffer<ArrayBuffer>> {
  const declared = Number(incoming.headers["content-length"]);
  if (Number.isFinite(declared) && declared > limit) return Promise.reject(new TooLarge());
  return new Promise((done, fail) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const stop = () => {
      incoming.off("data", data);
      incoming.off("end", end);
      incoming.off("error", error);
    };
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        stop();
        incoming.pause();
        chunks.length = 0;
        fail(new TooLarge());
        return;
      }
      chunks.push(chunk);
    };
    const end = () => {
      stop();
      done(Buffer.concat(chunks, size));
    };
    const error = (problem: Error) => {
      stop();
      fail(problem);
    };
    incoming.on("data", data);
    incoming.on("end", end);
    incoming.on("error", error);
  });
}

/** An origin as a browser names it (`http://localhost:5195`), or nothing for what is not one. */
function originOf(said: string | readonly string[] | undefined): string | undefined {
  if (typeof said !== "string" || said === "null") return undefined;
  try {
    const url = new URL(said);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

/** Whether the asker takes a gzipped answer. */
function takesGzip(incoming: IncomingMessage): boolean {
  return /\bgzip\b/.test(String(incoming.headers["accept-encoding"] ?? ""));
}

/** What is worth compressing: text a browser reads, larger than a packet. */
const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg)/;
const SMALLEST_COMPRESSED = 1024;

/*
 * SENT GZIPPED to a browser that takes it (`graview serve`, `graview
 * preview`). The page, its chunks, the document and the store's state went
 * as written — about 1.3 MB for the preview's first load where a host's
 * server sends about a third of that — and on a phone's network the bytes
 * are the wait. What is already encoded, small, or not text is sent as is.
 */
async function write(outgoing: ServerResponse, response: Response, gzip = false, cors?: (headers: Record<string, string>) => void): Promise<void> {
  const raw = Buffer.from(await response.arrayBuffer());
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  cors?.(headers);
  const compress = gzip && raw.length >= SMALLEST_COMPRESSED && !headers["content-encoding"] && COMPRESSIBLE.test(headers["content-type"] ?? "");
  const body = compress ? gzipSync(raw) : raw;
  if (compress) {
    headers["content-encoding"] = "gzip";
    headers["vary"] = headers["vary"] ? `${headers["vary"]}, Accept-Encoding` : "Accept-Encoding";
  }
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
