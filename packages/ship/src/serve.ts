import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  foldPresence,
  PRESENCE_TTL_MS,
  Store,
  type AnySchema,
  type GraviewApp,
  type MutationCall,
  type Operation,
  type PersistenceAdapter,
  type Presence,
  type Principal,
} from "@graview/core";
import { exportBundle } from "./export.js";
import { health } from "./health.js";
import { openStore, type OpenedStore } from "./open-store.js";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * THE STORE, BEHIND HTTP — and the op log is the wire.
 *
 * Two server-side adapters existed and nothing showed either, so the
 * strongest thing this platform can say to somebody self-hosting — "where
 * is my data" answered with a folder you can open — was a capability the
 * launcher asserted rather than a capability anybody had seen.
 *
 * What is deliberately NOT here: a second way to change the graph. A client
 * sends CALLS, not primitives; the server applies them through an ordinary
 * `Store` under the principal the request carries, so the policy judges
 * them exactly as it judges them in a browser, the invariants run, and the
 * op that comes back is the same shape the browser would have made. A
 * client that could post primitives would be a client that could write past
 * every rule the app declares.
 *
 * The whole protocol is four routes:
 *
 *   GET  /graview/state        the graph, the log and the stored version
 *   POST /graview/ops          calls in, the ops they produced out — or `undo`, batches to take back
 *   GET  /graview/since?seq=N  the ops appended after N — everyone else's
 *   GET  /graview/health       ship's own report, plus where the data is
 *
 * And two for WHO IS HERE, which is not the op log and never touches it:
 *
 *   POST /graview/here         say where you are; answers with who else is, and the ops since `seq`
 *   GET  /graview/who          who is here right now
 *   POST /graview/leave        say you have gone
 *
 * Presence lives in a map inside this closure with a time to live — not in
 * the store, not in the adapter, not in the log. A tab that dies without a
 * word is gone after three missed heartbeats.
 *
 * Polling rather than a socket, on purpose: a demo whose point is "your data
 * is in this folder" should not also be a demonstration of connection
 * lifecycles, and a poll is a thing a person can reproduce with `curl`.
 */

/**
 * THE WIRE, AS A CONTRACT. Every route `serveStore` answers, in one place a
 * test pins and a README repeats: what a host in front of this — Graview
 * Cloud, or anybody's — must keep answering for `openRemote`, `graview mcp
 * --remote-url` and `graview apply --remote-url` to work unchanged. What a
 * host adds (who a bearer token is, which tenant, how much) goes in
 * `seatOf` and around these routes, never inside them.
 */
export const WIRE = [
  { method: "GET", path: "/graview/state", says: "the graph, the log and the stored version" },
  { method: "POST", path: "/graview/ops", says: "calls in, the ops they produced out — or `undo`, batches to take back; 409 with the policy's sentence when refused" },
  { method: "GET", path: "/graview/since", says: "the ops appended after ?seq=N — everyone else's" },
  { method: "GET", path: "/graview/health", says: "ship's own report, plus where the data is" },
  { method: "GET", path: "/graview/export", says: "the whole store as one bundle, the way out" },
  { method: "POST", path: "/graview/here", says: "say where you are; answers with who else is, and the ops since `seq`" },
  { method: "GET", path: "/graview/who", says: "who is here right now" },
  { method: "POST", path: "/graview/leave", says: "say you have gone" },
] as const;

/** The headers a request carries its seat in. A host's `seatOf` may read others; these are what the framework's clients send. */
export const SEAT_HEADERS = { seat: "x-graview-seat", roles: "x-graview-roles" } as const;

export interface ServeOptions<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  /** Where the graph lives. The file adapter by default — see `createFileAdapter`. */
  readonly adapter: PersistenceAdapter<string>;
  /** What to put in an empty store on first start. */
  readonly seed?: GraphSnapshot;
  readonly scope?: string;
  readonly port?: number;
  /**
   * Who a request is, from its own headers.
   *
   * Not an authentication system — this is a demo server, and pretending
   * otherwise would be worse than saying so. It reads `x-graview-seat` and
   * `x-graview-roles` and hands the result to the store, which is enough to
   * show the thing worth showing: the SAME policy refusing the same act on
   * the server that refuses it in the browser.
   */
  readonly seatOf?: (request: IncomingMessage) => Principal;
  /** Where the data is, for the health report to say out loud. */
  readonly where?: string;
  /** How long a presence stands after its last word. Three heartbeats by default. */
  readonly presenceTtlMs?: number;
}

export interface ServedStore<S extends AnySchema> {
  readonly store: Store<S>;
  readonly opened: OpenedStore<S>;
  readonly server: Server;
  readonly port: number;
  readonly url: string;
  close(): Promise<void>;
}

const SEAT = (request: IncomingMessage): Principal => {
  const id = header(request, "x-graview-seat");
  const roles = header(request, "x-graview-roles");
  return {
    kind: "human",
    ...(id ? { id } : {}),
    ...(roles ? { roles: roles.split(",").filter(Boolean) } : {}),
  };
};

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export async function serveStore<S extends AnySchema>(options: ServeOptions<S>): Promise<ServedStore<S>> {
  const scope = options.scope ?? options.app.name;
  const seatOf = options.seatOf ?? SEAT;
  /*
   * The migration runs HERE, once, against the stored graph — which is the
   * whole reason a server is the honest place for it. A browser that
   * migrates its own copy migrates it once per browser; a server that
   * migrates the roster migrates the roster.
   */
  const opened = await openStore({
    app: options.app,
    adapter: options.adapter,
    scope,
    ...(options.seed ? { seed: options.seed } : {}),
  });
  const store = opened.store;

  /*
   * WHO IS HERE. Keyed by participant, named by the seat the request
   * carries — a poster cannot claim to be somebody else's seat — and
   * stamped with the server's clock, so expiry does not depend on two
   * browsers agreeing what time it is.
   */
  const ttl = options.presenceTtlMs ?? PRESENCE_TTL_MS;
  let here = new Map<string, Presence>();
  const alive = (): Presence[] => {
    here = foldPresence(here, [], Date.now(), ttl);
    return [...here.values()];
  };
  const arrive = (told: Presence, seat: Principal): Presence => {
    const session = told.participant.split(":").slice(2).join(":");
    const participant = seat.id ? `${seat.kind}:${seat.id}:${session}` : told.participant;
    const presence: Presence = { ...told, participant, at: new Date().toISOString() };
    here = foldPresence(here, [presence], Date.now(), ttl);
    return presence;
  };
  const since = (seq: number): Operation[] => store.log.all().filter((op) => op.seq > seq);

  const server = createServer((request, response) => {
    void handle(request, response).catch((error: unknown) => {
      send(response, 500, { error: error instanceof Error ? error.message : String(error) });
    });
  });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    // A browser on another origin is the ordinary case for an embed.
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "content-type, authorization, x-graview-seat, x-graview-roles");
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    const url = new URL(request.url ?? "/", "http://localhost");

    if (url.pathname === "/graview/state") {
      send(response, 200, {
        version: options.app.version ?? 1,
        snapshot: store.snapshot(),
        log: store.log.all(),
        migrated: opened.migrated.map((op) => op.intent),
      });
      return;
    }

    if (url.pathname === "/graview/since") {
      const seq = Number(url.searchParams.get("seq") ?? "-1");
      send(response, 200, { ops: since(seq) });
      return;
    }

    if (url.pathname === "/graview/who") {
      send(response, 200, { who: alive() });
      return;
    }

    if (url.pathname === "/graview/here" && request.method === "POST") {
      const body = (await read(request)) as { presence?: Presence; seq?: number };
      if (!body.presence || typeof body.presence.participant !== "string" || typeof body.presence.stop !== "string") {
        send(response, 400, { error: "A presence is a participant and a stop." });
        return;
      }
      const mine = arrive(body.presence, seatOf(request));
      // Folded into the poll: the heartbeat carries back everybody else AND
      // the ops since, so being here costs no round trip of its own.
      send(response, 200, {
        who: alive().filter((presence) => presence.participant !== mine.participant),
        ...(typeof body.seq === "number" ? { ops: since(body.seq) } : {}),
      });
      return;
    }

    if (url.pathname === "/graview/leave" && request.method === "POST") {
      const body = (await read(request)) as { participant?: string };
      if (typeof body.participant === "string") {
        here = new Map(here);
        here.delete(body.participant);
      }
      send(response, 200, { who: alive() });
      return;
    }

    if (url.pathname === "/graview/health") {
      send(response, 200, {
        ...health(store as never, options.app as never),
        // Said by the adapter where it knows, because it is the only thing
        // that does; `where` is for a caller with a better name for it.
        where: options.where ?? (options.adapter as { root?: string }).root ?? scope,
        adapter: options.adapter.name,
      });
      return;
    }

    if (url.pathname === "/graview/export") {
      send(response, 200, exportBundle(store as never, options.app as never));
      return;
    }

    if (url.pathname === "/graview/ops" && request.method === "POST") {
      const body = (await read(request)) as {
        calls?: readonly MutationCall[];
        /** Batches to take back instead — judged like any change, as the seat that asks. */
        undo?: readonly string[];
        intent?: string;
        batch?: string;
      };
      const calls = body.calls ?? [];
      const seat = seatOf(request);
      try {
        /*
         * Through the STORE, under the requester's own seat. The policy
         * refuses here exactly what it refuses in the browser — and the
         * refusal comes back with the policy's own sentence rather than a
         * bare 403, because that sentence is the product.
         */
        const result = body.undo
          ? store.undo(body.undo, { author: seat, ...(body.intent ? { intent: body.intent } : {}) })
          : store.applyAll(calls, {
              author: seat,
              ...(body.intent ? { intent: body.intent } : {}),
              ...(body.batch ? { batch: body.batch } : {}),
            });
        await opened.flush();
        send(response, 200, { ops: result.ops, batch: result.batch });
      } catch (error) {
        send(response, 409, {
          error: error instanceof Error ? error.message : String(error),
          refused: true,
        });
      }
      return;
    }

    send(response, 404, { error: `Nothing at ${url.pathname}` });
  }

  const port = await listen(server, options.port ?? 0);
  return {
    store,
    opened,
    server,
    port,
    url: `http://localhost:${port}`,
    async close() {
      await opened.flush();
      opened.close();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}

function send(response: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(text) });
  response.end(text);
}

async function read(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length === 0 ? {} : JSON.parse(text);
}

function listen(server: Server, port: number): Promise<number> {
  return new Promise((ready, fail) => {
    server.once("error", fail);
    server.listen(port, () => {
      const address = server.address();
      ready(typeof address === "object" && address !== null ? address.port : port);
    });
  });
}

export type { Operation };
