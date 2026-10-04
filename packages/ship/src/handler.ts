import {
  foldPresence,
  PRESENCE_TTL_MS,
  VISITOR_PRESENCE_TTL_MS,
  type AnySchema,
  type GraviewApp,
  type Operation,
  type PersistenceAdapter,
  type Presence,
  type Principal,
  type Store,
} from "@graview/core";
import { exportBundle } from "./export.js";
import { health } from "./health.js";
import { LIVE_PATH, type Limit, type LiveConnection, type LiveSocket } from "./live.js";
import {
  announcePresence,
  liveProtocol,
  presenceFrom,
  presenceSeenBy,
  serverBatchIds,
  visitorPresence,
  wireOf,
  type LivePeer,
  type LiveProtocol,
  type LiveSocketState,
  type Wire,
  type WireAnswer,
} from "./live-protocol.js";
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
  { method: "POST", path: "/graview/ops", says: "calls in, the ops they produced out — or `undo`, batches to take back; a `batch` the asking seat already landed is answered with the ops it made, and one that is somebody else's or not `batch:<tag>:<n>` is refused `invalid`; 409 with the policy's sentence and a `reason` when refused, 429 with `Retry-After` when the host is busy, 503 with the reason `unavailable` when it takes no changes for a while" },
  { method: "GET", path: "/graview/since", says: "the ops appended after ?seq=N — everyone else's" },
  { method: "GET", path: "/graview/health", says: "ship's own report, plus where the data is" },
  { method: "GET", path: "/graview/export", says: "the whole store as one bundle, the way out" },
  { method: "POST", path: "/graview/here", says: "say where you are; answers with who else is, the ops since `seq`, and the `participant` key you are held under" },
  { method: "GET", path: "/graview/who", says: "who is here right now" },
  { method: "POST", path: "/graview/leave", says: "say you have gone — only ever yourself" },
  { method: "GET", path: LIVE_PATH, says: "the live wire: a WebSocket of hello/welcome, call/undo/ack/refused/conflict/busy, ops and presence, declaration and reload; 426 to a plain request" },
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
   * AN AGENT THAT ACTS IS IN THE ROOM (FR-47). Every op an agent seat lands
   * in the store — through `POST /graview/ops`, an MCP handler over the
   * same store, the host's own loop — announces it to who is here, as the
   * agent and for whom, standing over what it wrote, for this long after
   * its last op: `VISITOR_PRESENCE_TTL_MS` when `true` or unsaid, the
   * number of ms when one is given, never when `false`. An agent seat that
   * holds a socket of its own is there already, and is not announced twice.
   */
  readonly announceAgents?: boolean | number;
  /**
   * THE HOST'S LIMITS (FR-45, FR-46): asked of every change — a socket's
   * `call` or `undo`, a `POST /graview/ops` — before it is judged.
   * `{ retryAfter }` is BUSY: the socket says `busy`, HTTP answers 429 with
   * `Retry-After`, and the client sends the change again after the wait.
   * `{ refuse }` is a hard cap: refused with reason `limit` (413 over
   * HTTP), and the client takes the change back. `{ unavailable }` is a
   * spell with no known end: refused `unavailable` (503 over HTTP), and
   * the client keeps the change and sends it again, backing off.
   */
  readonly limit?: Limit;
  /**
   * THE HOST'S BUILD (FR-44), an opaque string said in every welcome. A
   * client on another build keeps working and is told once, so a person
   * can reload when it suits them.
   */
  readonly build?: string;
  /**
   * THE LOWEST LIVE PROTOCOL SERVED (FR-44). A socket whose hello says an
   * older one is answered `reload`: its client keeps what it had not sent,
   * reloads onto a build that speaks this one, and offers it again there.
   * Absent, every protocol is served.
   */
  readonly minProtocol?: number;
  /**
   * THE LOWEST HOST PROTOCOL SERVED (FR-44): the host's own number for its
   * half of the wire, beside `WIRE_PROTOCOL`. A socket whose hello says an
   * older `hostProtocol` (`openRemote({ hostProtocol })`; absent is 0) is
   * answered `reload`, as below `minProtocol`.
   */
  readonly minHostProtocol?: number;
}

/**
 * THE DECLARATION THE HOST NOW SERVES (FR-43), handed to
 * `declarationChanged`. Over a store the host holds, `store` is the one it
 * migrated to `app` (with `flush` and `migrated` as at the start); over an
 * adapter, the handler opens it again itself with `openStore`, which
 * migrates what is stored.
 */
export interface DeclarationChange {
  readonly app: GraviewApp<AnySchema>;
  readonly store?: Store<AnySchema>;
  readonly flush?: (landed: readonly Operation[]) => Promise<void>;
  readonly migrated?: readonly string[];
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
  /**
   * Resolves once what landed is durable: a call's answer waits for it.
   * Handed the ops not yet durable, in seq order (`liveProtocol`'s
   * `flush`); one that rejects refuses the call `unavailable`, and the
   * change is kept and sent again. Absent, the answer goes at once.
   */
  readonly flush?: (landed: readonly Operation[]) => Promise<void>;
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
  /** The live protocol over this handler's store, for a host that holds its sockets' state itself (FR-41). Made again when the declaration changes. */
  readonly protocol: LiveProtocol<S>;
  /**
   * THE DECLARATION CHANGED (FR-43). The handler serves `change.app` from
   * now on, over the store migrated to it — the host's, or the one it opens
   * again from its adapter — and every open socket is told
   * `{ t: "declaration", version }`. A client of `openRemote` then opens on
   * the new declaration without reloading the page. While the change is
   * made, every request and message waits for it, so nothing lands on the
   * store being let go. `store`, `opened` and `protocol` are the new ones
   * afterwards.
   */
  declarationChanged(change: DeclarationChange): Promise<void>;
  /**
   * SOMEBODY HERE WITHOUT A SOCKET (FR-47): an agent acting over MCP or an
   * RPC, a polling tab. Told to every socket and every poll at once, as
   * each seat may see them, and gone `ttlMs` after (30 s unsaid) unless
   * announced again. The host builds the presence — `visitorPresence(seat)`
   * — because it is the host who knows who the seat is.
   */
  announce(presence: Presence, ttlMs?: number): void;
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
  if (options.store) {
    const { handler, swap } = storeHandler(options);
    return {
      ...handler,
      get store() {
        return handler.store;
      },
      get protocol() {
        return handler.protocol;
      },
      async declarationChanged(change) {
        const { store } = change;
        if (!store) throw new Error("A handler over a store the host holds is handed the store migrated to the new declaration: declarationChanged({ app, store }).");
        await swap(change.app, async () => ({ store, ...(change.flush ? { flush: change.flush } : {}), migrated: change.migrated ?? [] }));
      },
    };
  }
  const scope = options.scope ?? options.app.name;
  const opening = (app: GraviewApp<AnySchema>) =>
    openStore({
      app,
      adapter: options.adapter,
      scope,
      ...(options.seed ? { seed: options.seed } : {}),
      ...(options.enabledModules ? { enabledModules: options.enabledModules } : {}),
      // What the handler's store lands itself is in a batch no client could have named first.
      storeOptions: { batchIds: serverBatchIds() },
    });
  let opened = (await opening(options.app as unknown as GraviewApp<AnySchema>)) as OpenedStore<AnySchema>;
  const { adapter, seed: _seed, scope: _scope, enabledModules: _modules, ...rest } = options;
  const { handler, swap } = storeHandler({
    ...rest,
    store: opened.store as unknown as Store<S>,
    flush: () => opened.flush(),
    migrated: opened.migrated.map((op) => op.intent),
    // Said by the adapter where it knows, because it is the only thing
    // that does; `where` is for a caller with a better name for it.
    where: options.where ?? (adapter as { root?: string }).root ?? scope,
  }, adapter.name);
  return {
    ...handler,
    get store() {
      return handler.store;
    },
    get protocol() {
      return handler.protocol;
    },
    get opened() {
      return opened as unknown as OpenedStore<S>;
    },
    /*
     * OPENED AGAIN, ON THE NEW DECLARATION. What is pending is written
     * first, then the adapter is read again by `openStore`, which runs the
     * migrations between the stored version and the new one — here, once,
     * as it did at the start — while every request and message waits.
     */
    async declarationChanged(change) {
      await swap(change.app, async () => {
        if (change.store) return { store: change.store, ...(change.flush ? { flush: change.flush } : {}), migrated: change.migrated ?? [] };
        await opened.flush();
        opened.close();
        opened = await opening(change.app);
        return { store: opened.store, flush: () => opened.flush(), migrated: opened.migrated.map((op) => op.intent) };
      });
    },
    async close() {
      await handler.close();
      opened.close();
    },
  };
}

/** What the handler serves now: replaced, all together, when the declaration changes (FR-43). */
interface Serving {
  readonly app: GraviewApp<AnySchema>;
  readonly store: Store<AnySchema>;
  readonly flush: ((landed: readonly Operation[]) => Promise<void>) | undefined;
  readonly migrated: string[];
  readonly wire: Wire<AnySchema>;
  readonly protocol: LiveProtocol<AnySchema>;
}

type Swap = (app: GraviewApp<AnySchema>, open: () => Promise<{ store: Store<AnySchema>; flush?: (landed: readonly Operation[]) => Promise<void>; migrated: readonly string[] }>) => Promise<void>;

function storeHandler<S extends AnySchema>(options: HeldStoreHandlerOptions<S>, adapterName = "held by the host"): { handler: Omit<StoreHandler<S>, "declarationChanged">; swap: Swap } {
  const seatOf = options.seatOf ?? (options.trustSeatHeaders ? seatFromHeaders : undefined);
  const flush = async (landed: readonly Operation[] = []): Promise<void> => {
    await serving.flush?.(landed);
  };
  const serve = (app: GraviewApp<AnySchema>, store: Store<AnySchema>, flushing: ((landed: readonly Operation[]) => Promise<void>) | undefined, migrated: readonly string[]): Serving => ({
    app,
    store,
    flush: flushing,
    migrated: [...migrated],
    wire: wireOf(store),
    protocol: liveProtocol({
      store,
      version: app.version ?? 1,
      migrated,
      flush,
      ...(options.build ? { build: options.build } : {}),
      ...(options.minProtocol !== undefined ? { minProtocol: options.minProtocol } : {}),
      ...(options.minHostProtocol !== undefined ? { minHostProtocol: options.minHostProtocol } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
    }),
  });
  let serving = serve(options.app as unknown as GraviewApp<AnySchema>, options.store as unknown as Store<AnySchema>, options.flush, options.migrated ?? []);
  /** Set while the declaration is being changed: every request and message waits for it. */
  let changing: Promise<void> | undefined;

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
  const announce = (presence: Presence, ttlMs: number = VISITOR_PRESENCE_TTL_MS): void => {
    const now = Date.now();
    here = foldPresence(here, announcePresence([], presence, ttlMs, now), now, ttl);
    tellWhoIsHere();
  };

  async function route(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url, "http://localhost");
    // Answered from the declaration served once any change under way is made (FR-43).
    while (changing) await changing;
    const { store, wire, app } = serving;
    /*
     * WHICH DECLARATION, AND WHICH BUILD, ANSWERED (FR-43, FR-44): on every
     * answer a poll reads, so a client without a socket learns the
     * declaration changed — or that it runs another build — on its next one.
     */
    const answering = { version: app.version ?? 1, ...(options.build ? { build: options.build } : {}) };

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
    // The routes with semantics are the protocol's, so a host that routes its own requests answers them the same (`post`, `state`, `since`).
    const asked = async (otherwise: string) => {
      const author = await seat();
      return { seat: author, via: await viaFor(request, author, otherwise), ...(options.build ? { build: options.build } : {}) };
    };
    const answered = (answer: WireAnswer) => send(answer.status, answer.body, answer.headers);

    if (url.pathname === "/graview/state") return answered(serving.protocol.state(await asked("api")));

    if (url.pathname === "/graview/since") {
      const seq = Number(url.searchParams.get("seq") ?? "-1");
      return answered(serving.protocol.since(seq, await asked("api")));
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
      // `participant` is the key the server holds this poller under, so it can leave itself out (FR-47).
      return send(200, {
        participant: mine.participant,
        who: wire.whoFor(asking, alive().filter((presence) => presence.participant !== mine.participant)),
        ...(typeof body.seq === "number" ? { ops: wire.since(asking, body.seq) } : {}),
        ...answering,
      });
    }

    if (url.pathname === "/graview/leave" && request.method === "POST") {
      const body = (await read(request)) as { participant?: string };
      const asking = await seat();
      // Only your own: a seat says it has gone, never that somebody else has.
      const own = asking.id ? `${asking.kind}:${asking.id}:` : "";
      if (typeof body.participant === "string" && body.participant.startsWith(own)) {
        forget(body.participant);
        tellWhoIsHere();
      }
      return send(200, { who: wire.whoFor(asking, alive()) });
    }

    if (url.pathname === "/graview/health") {
      /*
       * A STRANGER GETS HEALTH, AND NO ID (FR-55). The counts are the whole
       * store's; the links it names are only those the asking seat may be
       * told of — and somebody the host cannot tell is judged as a seat
       * with no id and no roles, so a store with sights names them nothing.
       */
      let asking: Principal = { kind: "human" };
      if (seatOf) {
        try {
          asking = await seat();
        } catch {
          // A poller the host does not recognise is still told whether the store is well.
        }
      }
      return send(200, {
        ...health(store as never, { seat: asking }),
        where: options.where ?? app.name,
        adapter: adapterName,
      });
    }

    if (url.pathname === "/graview/export") return send(200, exportBundle(app, wire.seenFor(await seat())));

    if (url.pathname === "/graview/ops" && request.method === "POST") {
      const text = await request.text();
      // What the calls came through is the host's to say, never the body's (FR-52).
      const answer = await serving.protocol.post(text, await asked("api"));
      // Ops a failed flush had held back are durable now: down every socket.
      if (answer.landed) heldBackDurable();
      return answered(answer);
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
  const agentsFor = options.announceAgents === false ? 0 : typeof options.announceAgents === "number" ? options.announceAgents : VISITOR_PRESENCE_TTL_MS;
  const watch = (store: Store<AnySchema>) =>
    store.subscribe((_diff, ops) => {
      serving.protocol.publish(
        ops,
        [...sockets].filter((live) => !live.answering),
      );
      if (agentsFor > 0) agentsWereHere(ops);
    });
  let unsubscribe = watch(serving.store);
  /*
   * Every op is pushed as it lands — but one whose flush failed is held
   * back from every socket until a flush holds it (`liveProtocol`'s
   * `flush`). When one does, each socket is caught up from its cursor.
   */
  function heldBackDurable(except?: Live): void {
    serving.protocol.publish(
      [],
      [...sockets].filter((live) => live !== except && !live.answering),
    );
  }
  /*
   * AN AGENT THAT ACTED IS IN THE ROOM (FR-47), standing over the last
   * thing it wrote: once per agent per change, and not at all for one that
   * holds a socket here, which is in the room as itself already.
   */
  function agentsWereHere(ops: readonly Operation[]): void {
    const last = new Map<string, Operation>();
    for (const op of ops) if (op.author.kind === "agent") last.set(`${op.author.id ?? ""}`, op);
    let told = false;
    for (const op of last.values()) {
      const author = op.author;
      if ([...sockets].some((live) => live.seat.kind === "agent" && live.seat.id === author.id)) continue;
      const now = Date.now();
      here = foldPresence(here, announcePresence([], visitorPresence(author, { over: op.writes[0] ?? null, now: new Date(now) }), agentsFor, now), now, ttl);
      told = true;
    }
    if (told) tellWhoIsHere();
  }
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
    serving.protocol.tell(standing(), sockets);
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
      return serving.protocol.open(seat, await viaFor(asked, seat, "web"));
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
        // A message that came while the declaration was changing is answered under the new one (FR-43).
        while (changing) await changing;
        received = await serving.protocol.receive(live, text, standing());
      } finally {
        live.answering = false;
      }
      if (live.cursor !== undefined) {
        sockets.add(live);
        // What landed while this socket's own answer waited for its flush, after its ack.
        serving.protocol.publish([], [live]);
      }
      // Ops a failed flush had held back are durable now: down every other socket too.
      if (received.landed) heldBackDurable(live);
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

  /*
   * THE DECLARATION CHANGED (FR-43). What is pending on the old store is
   * written, the new store is opened (or handed over), and every socket is
   * told by the protocol over the new one, which forgets their cursors: a
   * seq of the old store means nothing on the new one. Meanwhile every
   * request and message waits, so nothing lands on the store let go.
   */
  const swap: Swap = async (app, open) => {
    while (changing) await changing;
    let done: () => void = () => {};
    changing = new Promise<void>((resolve) => (done = resolve));
    try {
      await flush();
      const next = await open();
      unsubscribe();
      serving = serve(app, next.store, next.flush ?? serving.flush, next.migrated);
      unsubscribe = watch(serving.store);
      serving.protocol.declared(sockets);
    } finally {
      changing = undefined;
      done();
    }
  };

  const handler: Omit<StoreHandler<S>, "declarationChanged"> = {
    get store() {
      return serving.store as unknown as Store<S>;
    },
    get protocol() {
      return serving.protocol as unknown as LiveProtocol<S>;
    },
    connect,
    seatFor,
    announce,
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
  return { handler, swap };
}

