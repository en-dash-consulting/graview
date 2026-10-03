import {
  foldPresence,
  PRESENCE_TTL_MS,
  refusalOf,
  type AnySchema,
  type FieldRevision,
  type GraviewApp,
  type MutationCall,
  type PersistenceAdapter,
  type Presence,
  type Principal,
  type Store,
} from "@graview/core";
import { exportBundle } from "./export.js";
import { health } from "./health.js";
import { bytesOf, conflictSentence, LIVE_PATH, type Limit, type LiveConnection, type LiveSocket } from "./live.js";
import { liveProtocol, presenceFrom, presenceSeenBy, wireOf, type LivePeer, type LiveProtocol, type LiveSocketState } from "./live-protocol.js";
import { openStore, type OpenedStore } from "./open-store.js";
import { SEAT_HEADERS } from "./seat-headers.js";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * THE STORE, BEHIND ANY RUNTIME'S FETCH — and the op log is the wire (FR-09).
 *
 * Every route is one function from a `Request` to a `Response`, which is
 * what a Cloudflare Worker, a Durable Object, Deno, Bun and a service worker
 * all call a handler. `serveStore` is a thin `node:http` wrapper around it;
 * nothing in this module reaches a `node:` builtin, so a host that runs
 * somewhere other than Node serves the same wire without a fork.
 *
 * What is deliberately NOT here: a second way to change the graph. A client
 * sends CALLS, not primitives; the handler applies them through an ordinary
 * `Store` under the principal the request carries, so the policy judges
 * them exactly as it judges them in a browser, the invariants run, and the
 * op that comes back is the same shape the browser would have made. A
 * client that could post primitives would be a client that could write past
 * every rule the app declares.
 *
 * The protocol is four routes:
 *
 *   GET  /graview/state        the graph, the log, the stored version and the modules on
 *   POST /graview/ops          calls in, the ops they produced out — or `undo`, batches to take back
 *   GET  /graview/since?seq=N  the ops appended after N — everyone else's
 *   GET  /graview/health       ship's own report, plus where the data is
 *
 * And three for WHO IS HERE, which is not the op log and never touches it:
 *
 *   POST /graview/here         say where you are; answers with who else is, and the ops since `seq`
 *   GET  /graview/who          who is here right now
 *   POST /graview/leave        say you have gone
 *
 * Presence lives in a map inside this closure with a time to live — not in
 * the store, not in the adapter, not in the log. A tab that dies without a
 * word is gone after three missed heartbeats.
 *
 * Polling is the floor, on purpose: a poll is a thing a person can
 * reproduce with `curl`, and a thing every runtime can answer. Beside it,
 * `connect` serves the live wire (FR-05, `./live.ts`) to whatever socket a
 * host hands it, and `GET /graview/live` names it on the wire. The live
 * protocol itself is `liveProtocol` (`./live-protocol.ts`), over state a
 * host may hold instead of this closure (FR-41).
 */

/**
 * THE WIRE, AS A CONTRACT. Every route the handler answers, in one place a
 * test pins and a README repeats: what a host in front of this — Graview
 * Cloud, or anybody's — must keep answering for `openRemote`, `graview mcp
 * --remote-url` and `graview apply --remote-url` to work unchanged. What a
 * host adds (who a bearer token is, which tenant, how much) goes in
 * `seatOf` and around these routes, never inside them.
 */
export const WIRE = [
  { method: "GET", path: "/graview/state", says: "the graph, the log, the stored version and the modules on" },
  { method: "POST", path: "/graview/ops", says: "calls in, the ops they produced out — or `undo`, batches to take back; a `batch` already in the log is answered with the ops it made; 409 with the policy's sentence and a `reason` when refused, 429 with `Retry-After` when the host is busy" },
  { method: "GET", path: "/graview/since", says: "the ops appended after ?seq=N — everyone else's" },
  { method: "GET", path: "/graview/health", says: "ship's own report, plus where the data is" },
  { method: "GET", path: "/graview/export", says: "the whole store as one bundle, the way out" },
  { method: "POST", path: "/graview/here", says: "say where you are; answers with who else is, and the ops since `seq`" },
  { method: "GET", path: "/graview/who", says: "who is here right now" },
  { method: "POST", path: "/graview/leave", says: "say you have gone" },
  { method: "GET", path: LIVE_PATH, says: "the live wire: a WebSocket of hello/welcome, call/undo/ack/refused/conflict/busy, ops and presence; 426 to a plain request" },
] as const;

export { presenceSeenBy, SEAT_HEADERS };

/** What every handler takes, whoever holds the store. */
interface HandlerOptions<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  /**
   * Who a request is. The host's to say — from a session, a bearer token,
   * whatever it authenticates with — and the store judges every call under
   * the principal it returns. It may answer a promise, for a host that
   * verifies a token with `crypto.subtle`.
   */
  readonly seatOf?: (request: Request) => Principal | Promise<Principal>;
  /**
   * WHAT THE CALLS CAME THROUGH (FR-52): the host's word, recorded as `via`
   * on every op a request or a socket makes — `web`, `api`, `mcp:Claude`.
   * Handed the request (the upgrade, for a socket) and the seat `seatOf`
   * said. A client's own `via` is never read: a browser could otherwise
   * record its edit as Claude's. Absent, or answering nothing, a socket's
   * calls are `web` and an HTTP request's `api` — unless the host trusts
   * the seat headers, when `SEAT_HEADERS.via` says it as they say the seat.
   */
  readonly viaOf?: (request: Request, seat: Principal) => string | undefined | Promise<string | undefined>;
  /**
   * BELIEVE THE SEAT HEADERS (`SEAT_HEADERS`) — off by default (FR-06).
   *
   * A header is a claim, and anyone who could reach a served store used to
   * claim any seat by sending one, and every remote agent was recorded as
   * a person. A store that neither trusts headers nor is given a `seatOf`
   * answers 401: it cannot say who is asking. `graview serve` turns this on
   * for a server bound to loopback only, and says so.
   */
  readonly trustSeatHeaders?: boolean;
  /** Where the data is, for the health report to say out loud. */
  readonly where?: string;
  /** How long a presence stands after its last word. Three heartbeats by default. */
  readonly presenceTtlMs?: number;
  /**
   * THE HOST'S LIMITS (FR-45, FR-46): asked of every change — a socket's
   * `call` or `undo`, a `POST /graview/ops` — before it is judged.
   * `{ retryAfter }` is BUSY: the socket says `busy`, HTTP answers 429 with
   * `Retry-After`, and the client sends the change again after the wait.
   * `{ refuse }` is a hard cap: refused with reason `limit` (413 over
   * HTTP), and the client takes the change back.
   */
  readonly limit?: Limit;
}

/** The handler opens its own store from an adapter: one declaration plus one adapter is a running deployment. */
export interface AdapterStoreHandlerOptions<S extends AnySchema> extends HandlerOptions<S> {
  /** Where the graph lives: any `PersistenceAdapter` — a file, SQLite, Durable Object storage. */
  readonly adapter: PersistenceAdapter<string>;
  readonly store?: never;
  /** What to put in an empty store on first start. */
  readonly seed?: GraphSnapshot;
  readonly scope?: string;
  /**
   * THE MODULES THIS WORKSPACE HAS ON (FR-12) — usually what it pays for.
   * Handed to `openStore`, which records a change from what the store's
   * log last said as an op; absent, the log's word stands (every module,
   * when it never said one). A module off has its acts refused and its
   * kinds kept from every route, as a sight keeps a record.
   */
  readonly enabledModules?: readonly string[];
}

/**
 * THE HANDLER OVER A STORE THE HOST ALREADY HOLDS (FR-42). A host with its
 * own durability — a ledger of snapshots in parts, epochs, quarantine and
 * restore, its own meter — opens, migrates and heals its `Store` itself,
 * and the wire is served from that instance. Closing the handler does not
 * close the store: it is the host's.
 */
export interface HeldStoreHandlerOptions<S extends AnySchema> extends HandlerOptions<S> {
  readonly store: Store<S>;
  readonly adapter?: never;
  /** Resolves once what landed is durable: a call's answer waits for it. Absent, the answer goes at once. */
  readonly flush?: () => Promise<void>;
  /** What opening the store migrated, in the migrations' own words: said in the state, as `openStore`'s would be. */
  readonly migrated?: readonly string[];
}

export type StoreHandlerOptions<S extends AnySchema> = AdapterStoreHandlerOptions<S> | HeldStoreHandlerOptions<S>;

export interface StoreHandler<S extends AnySchema> {
  readonly store: Store<S>;
  /** The open `openStore` made, when the handler opened the store from an adapter; absent over a store the host holds. */
  readonly opened?: OpenedStore<S>;
  /** Every WIRE route: a `Request` in, a `Response` out. Bound, so it can be handed on as it is. */
  readonly handle: (request: Request) => Promise<Response>;
  /**
   * THE LIVE WIRE, ON ANY SOCKET (FR-05). Hand it the upgrade `Request`
   * (the seat is read from it, as on every route) and a way to send text
   * down the socket; it answers with the connection to hand each message
   * the client sends and the close, or with the `Response` refusing it (a
   * 401 when it cannot say who is asking). A Worker attaches a
   * `WebSocketPair`'s server end here; `serveStore` attaches Node's
   * upgrade. A host that hibernates holds each socket's state itself
   * instead: `seatFor` and `protocol`.
   */
  readonly connect: (request: Request, socket: LiveSocket) => Promise<LiveConnection | Response>;
  /**
   * THE STATE A SOCKET STARTS WITH (FR-41): its seat, read by `seatOf`
   * from the upgrade, and its channel, said by `viaOf` (FR-52) — or the
   * `Response` refusing it. A hibernating host keeps it in the socket's
   * attachment and hands it, with each message, to `protocol.receive`.
   */
  readonly seatFor: (request: Request) => Promise<LiveSocketState | Response>;
  /** The live protocol over this handler's store, for a host that holds its sockets' state itself (FR-41). */
  readonly protocol: LiveProtocol<S>;
  /** Writes what is pending and lets the adapter go — or, over a store the host holds, writes what is pending and leaves the store open. */
  close(): Promise<void>;
}

const KINDS = new Set(["human", "agent", "rule", "system"]);
const list = (value: string | null) => (value ? value.split(",").filter(Boolean) : undefined);
const decoded = (value: string | null) => (value ? decodeURIComponent(value) : undefined);

/** A seat read from a request's headers — only ever when the host trusts them. */
export function seatFromHeaders(request: Request): Principal {
  const header = (name: string) => request.headers.get(name);
  const id = header(SEAT_HEADERS.seat);
  const roles = list(header(SEAT_HEADERS.roles));
  const kind = header(SEAT_HEADERS.kind);
  const name = decoded(header(SEAT_HEADERS.name));
  const forId = header(SEAT_HEADERS.for);
  const forRoles = list(header(SEAT_HEADERS.forRoles));
  const forName = decoded(header(SEAT_HEADERS.forName));
  return {
    kind: (kind && KINDS.has(kind) ? kind : "human") as Principal["kind"],
    ...(id ? { id } : {}),
    ...(roles ? { roles } : {}),
    ...(name ? { name } : {}),
    ...(forId ? { onBehalfOf: { kind: "human" as const, id: forId, ...(forRoles ? { roles: forRoles } : {}), ...(forName ? { name: forName } : {}) } } : {}),
  };
}

/** A browser on another origin is the ordinary case for an embed. */
const CORS: Readonly<Record<string, string>> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": ["content-type", "authorization", ...Object.values(SEAT_HEADERS)].join(", "),
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

function send(status: number, body: unknown, headers: Readonly<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", ...headers } });
}

async function read(request: Request): Promise<unknown> {
  const text = await request.text();
  return text.length === 0 ? {} : JSON.parse(text);
}

/** "Who is asking" refused: the reason a program reads beside the sentence (FR-46). */
const unknownSeat = (error: string): Response => send(401, { error, reason: "forbidden" });

const CANNOT_TELL = "This store cannot tell who is asking: the host gives serveStore a seatOf, or trusts the seat headers (trustSeatHeaders) on a server only it can reach.";

/**
 * Open the store and answer the wire for it. The migration runs HERE, once,
 * against the stored graph — which is the whole reason a server is the
 * honest place for it. A browser that migrates its own copy migrates it once
 * per browser; a server that migrates the roster migrates the roster.
 *
 * Or answer the wire for a store the host opened itself (FR-42): the
 * adapter form is that, over the store `openStore` hands back.
 */
export async function createStoreHandler<S extends AnySchema>(options: AdapterStoreHandlerOptions<S>): Promise<StoreHandler<S> & { readonly opened: OpenedStore<S> }>;
export async function createStoreHandler<S extends AnySchema>(options: HeldStoreHandlerOptions<S>): Promise<StoreHandler<S>>;
export async function createStoreHandler<S extends AnySchema>(options: StoreHandlerOptions<S>): Promise<StoreHandler<S>>;
export async function createStoreHandler<S extends AnySchema>(options: StoreHandlerOptions<S>): Promise<StoreHandler<S>> {
  if (options.store) return storeHandler(options);
  const scope = options.scope ?? options.app.name;
  const opened = await openStore({
    app: options.app,
    adapter: options.adapter,
    scope,
    ...(options.seed ? { seed: options.seed } : {}),
    ...(options.enabledModules ? { enabledModules: options.enabledModules } : {}),
  });
  const { adapter, seed: _seed, scope: _scope, enabledModules: _modules, ...rest } = options;
  const held = storeHandler({
    ...rest,
    store: opened.store,
    flush: opened.flush,
    migrated: opened.migrated.map((op) => op.intent),
    // Said by the adapter where it knows, because it is the only thing
    // that does; `where` is for a caller with a better name for it.
    where: options.where ?? (adapter as { root?: string }).root ?? scope,
  }, adapter.name);
  return {
    ...held,
    opened,
    async close() {
      await held.close();
      opened.close();
    },
  };
}

function storeHandler<S extends AnySchema>(options: HeldStoreHandlerOptions<S>, adapterName = "held by the host"): StoreHandler<S> {
  const { store } = options;
  const seatOf = options.seatOf ?? (options.trustSeatHeaders ? seatFromHeaders : undefined);
  const flush = async (): Promise<void> => {
    await options.flush?.();
  };
  const migrated = [...(options.migrated ?? [])];
  const wire = wireOf(store);
  const protocol = liveProtocol({ store, version: options.app.version ?? 1, migrated, flush, ...(options.limit ? { limit: options.limit } : {}) });

  /*
   * THE CHANNEL IS THE HOST'S WORD (FR-52). `viaOf` when the host gave
   * one; the via header when it trusts the seat headers; else what the
   * route is. Never the client's body or message.
   */
  const viaFor = async (request: Request, seat: Principal, otherwise: string): Promise<string> => {
    const said = options.viaOf ? await options.viaOf(request, seat) : undefined;
    if (typeof said === "string" && said.length > 0) return said;
    const header = options.trustSeatHeaders ? request.headers.get(SEAT_HEADERS.via) : null;
    return header && header.length > 0 ? header : otherwise;
  };

  /*
   * WHO IS HERE. Keyed by participant, named by the seat the request
   * carries — a poster cannot claim to be somebody else's seat — and
   * stamped with the handler's clock, so expiry does not depend on two
   * browsers agreeing what time it is.
   */
  const ttl = options.presenceTtlMs ?? PRESENCE_TTL_MS;
  let here = new Map<string, Presence>();
  const alive = (): Presence[] => {
    here = foldPresence(here, [], Date.now(), ttl);
    return [...here.values()];
  };
  const arrive = (presence: Presence): void => {
    here = foldPresence(here, [presence], Date.now(), ttl);
  };
  const forget = (participant: string): void => {
    here = new Map(here);
    here.delete(participant);
  };

  async function route(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url, "http://localhost");

    /*
     * WHO IS ASKING, OR NOTHING. Health is the only route a stranger gets:
     * it says whether the store is well, not what is in it.
     */
    if (!seatOf && url.pathname !== "/graview/health") return unknownSeat(CANNOT_TELL);
    const seat = async (): Promise<Principal> => (seatOf as NonNullable<typeof seatOf>)(request);

    if (url.pathname === LIVE_PATH) {
      return send(426, { error: `${LIVE_PATH} is a WebSocket: open one, say hello, and the store's ops come to you. A plain request polls /graview/since instead.` });
    }

    /*
     * WHAT A SEAT MAY SEE NEVER LEAVES THE STORE (FR-02). Every read below is
     * of the store as the asking seat sees it: its graph without what the
     * policy keeps from it, and its log with every op in its place and the
     * ones that touched what it may not see withheld (FR-16).
     */
    if (url.pathname === "/graview/state") {
      const seen = wire.seenFor(await seat());
      return send(200, {
        version: options.app.version ?? 1,
        snapshot: seen.snapshot(),
        log: seen.log.all(),
        migrated,
        enabledModules: wire.enabledModules(),
        ...wire.horizonOf(),
      });
    }

    if (url.pathname === "/graview/since") {
      const seq = Number(url.searchParams.get("seq") ?? "-1");
      return send(200, { ops: wire.since(await seat(), seq) });
    }

    if (url.pathname === "/graview/who") return send(200, { who: wire.whoFor(await seat(), alive()) });

    if (url.pathname === "/graview/here" && request.method === "POST") {
      const body = (await read(request)) as { presence?: Presence; seq?: number };
      if (!body.presence || typeof body.presence.participant !== "string" || typeof body.presence.stop !== "string") {
        return send(400, { error: "A presence is a participant and a stop.", reason: "invalid" });
      }
      const asking = await seat();
      const mine = presenceFrom(body.presence, asking);
      arrive(mine);
      tellWhoIsHere();
      // Folded into the poll: the heartbeat carries back everybody else AND
      // the ops since, so being here costs no round trip of its own.
      return send(200, {
        who: wire.whoFor(asking, alive().filter((presence) => presence.participant !== mine.participant)),
        ...(typeof body.seq === "number" ? { ops: wire.since(asking, body.seq) } : {}),
      });
    }

    if (url.pathname === "/graview/leave" && request.method === "POST") {
      const body = (await read(request)) as { participant?: string };
      if (typeof body.participant === "string") {
        forget(body.participant);
        tellWhoIsHere();
      }
      return send(200, { who: wire.whoFor(await seat(), alive()) });
    }

    if (url.pathname === "/graview/health") {
      return send(200, {
        ...health(store as never, options.app as never),
        where: options.where ?? options.app.name,
        adapter: adapterName,
      });
    }

    if (url.pathname === "/graview/export") return send(200, exportBundle(options.app, wire.seenFor(await seat())));

    if (url.pathname === "/graview/ops" && request.method === "POST") {
      const text = await request.text();
      const body = (text.length === 0 ? {} : JSON.parse(text)) as {
        calls?: readonly MutationCall[];
        /** Batches to take back instead — judged like any change, as the seat that asks. */
        undo?: readonly string[];
        intent?: string;
        batch?: string;
        /** The revision of each field the calls change, as the caller last saw it (FR-05). */
        base?: readonly FieldRevision[];
      };
      const calls = body.calls ?? [];
      const author = await seat();
      // What the calls came through is the host's to say, never the body's (FR-52).
      const via = await viaFor(request, author, "api");
      // A batch already in the log is a call sent again after its answer was lost: answered with what it made, as on the socket (FR-49).
      const already = wire.answered(body.batch);
      if (already.length > 0) return send(200, { ops: wire.shown(author, already), batch: body.batch });
      /*
       * THE HOST'S LIMITS, BEFORE ANYTHING IS JUDGED. Busy is 429 and the
       * change is kept to send again (FR-45); a hard cap is refused, `limit`,
       * and the change is taken back (FR-46).
       */
      const limited = options.limit
        ? await options.limit({ seat: author, via, t: body.undo ? "undo" : "call", bytes: bytesOf(text), calls: body.undo ? [] : calls })
        : undefined;
      if (limited && "refuse" in limited) return send(413, { error: limited.refuse, refused: true, reason: "limit" });
      if (limited) {
        const retryAfter = Math.max(0, Math.ceil(limited.retryAfter));
        return send(
          429,
          { error: limited.sentence ?? `The store is busy: send it again in ${retryAfter} ms.`, busy: true, retryAfter },
          { "retry-after": String(Math.ceil(retryAfter / 1000)) },
        );
      }
      /*
       * A STALE WRITE IS A CONFLICT, NOT A LOSS (FR-05). A field that moved
       * since the caller read it is refused by name — theirs and yours —
       * and nothing is written: what to do about it is the person's call.
       */
      const conflicts = body.undo ? [] : wire.conflictsOf(author, calls, body.base);
      if (conflicts.length > 0) return send(409, { error: conflictSentence(conflicts), refused: true, conflict: true, conflicts });
      try {
        /*
         * Through the STORE, under the requester's own seat. The policy
         * refuses here exactly what it refuses in the browser — and the
         * refusal comes back with the policy's own sentence rather than a
         * bare 403, because that sentence is the product.
         */
        const applying = { author, via, ...(body.intent ? { intent: body.intent } : {}), ...(body.batch ? { batch: body.batch } : {}) };
        const result = body.undo ? store.undo(body.undo, applying) : store.applyAll(calls, applying);
        await flush();
        // An act may make what its own seat may not see: that op goes back withheld, as it would on a poll.
        return send(200, { ops: wire.shown(author, result.ops), batch: result.batch });
      } catch (error) {
        const { sentence, ...why } = refusalOf(error);
        return send(409, { error: sentence, refused: true, ...why });
      }
    }

    return send(404, { error: `Nothing at ${url.pathname}`, reason: "missing" });
  }

  /*
   * THE LIVE WIRE (FR-05), with each socket's state held here, in memory:
   * the host that holds it elsewhere uses `protocol` the same way. Every op
   * that lands is pushed down every socket in seq order, none skipped —
   * each as its seat may see it — and a socket's own call is answered by
   * its `ack`, which carries that call's ops, so they reach it once.
   */
  interface Live extends LivePeer {
    /** Set while this socket's own message is being answered, so its ops go in the ack rather than a push. */
    answering: boolean;
    open: boolean;
    readonly socket: LiveSocket;
  }
  const sockets = new Set<Live>();
  const unsubscribe = store.subscribe((_diff, ops) => {
    protocol.publish(
      ops,
      [...sockets].filter((live) => !live.answering),
    );
  });
  /*
   * A socket's presence stands while the socket does; the TTL is for a
   * poller that went quiet, and a socket that went quiet is closed.
   */
  const standing = (): Presence[] => {
    const now = new Date().toISOString();
    const held: Presence[] = [];
    for (const live of sockets) {
      const presence = live.participant ? here.get(live.participant) : undefined;
      if (presence) held.push({ ...presence, at: now });
    }
    if (held.length > 0) here = foldPresence(here, held, Date.now(), ttl);
    return alive();
  };
  function tellWhoIsHere(): void {
    if (sockets.size === 0) return;
    protocol.tell(standing(), sockets);
  }

  /*
   * A page cannot set headers on a WebSocket. A store that trusts the seat
   * headers — loopback only — reads them from the upgrade's query instead,
   * under the same names; one that asks its own `seatOf` is handed the
   * request as it came.
   */
  const seatRequest = (request: Request): Request => {
    if (options.seatOf || !options.trustSeatHeaders || request.headers.has(SEAT_HEADERS.seat)) return request;
    const query = new URL(request.url, "http://localhost").searchParams;
    const headers = new Headers(request.headers);
    let found = false;
    for (const name of Object.values(SEAT_HEADERS)) {
      const value = query.get(name);
      if (value !== null) {
        headers.set(name, value);
        found = true;
      }
    }
    return found ? new Request(request.url, { headers }) : request;
  };

  async function seatFor(request: Request): Promise<LiveSocketState | Response> {
    if (!seatOf) return unknownSeat(CANNOT_TELL);
    const asked = seatRequest(request);
    try {
      const seat = await seatOf(asked);
      return protocol.open(seat, await viaFor(asked, seat, "web"));
    } catch (error) {
      return unknownSeat(error instanceof Error ? error.message : String(error));
    }
  }

  async function connect(request: Request, socket: LiveSocket): Promise<LiveConnection | Response> {
    const state = await seatFor(request);
    if (state instanceof Response) return state;
    const live: Live = {
      ...state,
      socket,
      answering: false,
      open: true,
      send: (text) => {
        if (live.open) socket.send(text);
      },
    };
    const hear = async (text: string): Promise<void> => {
      const was = live.participant;
      live.answering = true;
      let received;
      try {
        received = await protocol.receive(live, text, standing());
      } finally {
        live.answering = false;
      }
      if (live.cursor !== undefined) {
        sockets.add(live);
        // What landed while this socket's own answer waited for its flush, after its ack.
        protocol.publish([], [live]);
      }
      if (received.presence) {
        arrive(received.presence);
        tellWhoIsHere();
      } else if (received.presence === null && was) {
        forget(was);
        tellWhoIsHere();
      }
    };
    /*
     * One message at a time, in the order they came: a call waits for the
     * one before it, so an ack never overtakes the push or ack before it.
     */
    let queue: Promise<void> = Promise.resolve();
    return {
      receive(text) {
        queue = queue.then(() => hear(text)).catch(() => {});
      },
      close() {
        live.open = false;
        sockets.delete(live);
        if (live.participant) {
          forget(live.participant);
          delete live.participant;
          tellWhoIsHere();
        }
      },
    };
  }

  return {
    store,
    connect,
    seatFor,
    protocol,
    handle: async (request) => {
      try {
        return await route(request);
      } catch (error) {
        return send(500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
    async close() {
      for (const live of sockets) {
        live.open = false;
        try {
          live.socket.close?.(1001, "The store is closing.");
        } catch {
          // Already gone.
        }
      }
      sockets.clear();
      unsubscribe();
      await flush();
    },
  };
}

