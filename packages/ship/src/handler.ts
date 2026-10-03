import {
  FieldRevisions,
  foldPresence,
  isSystem,
  isUnset,
  participantKey,
  WIRE_PROTOCOL,
  PRESENCE_TTL_MS,
  redact,
  seenBy,
  seesId,
  type AnySchema,
  type FieldConflict,
  type FieldRevision,
  type GraviewApp,
  type MutationCall,
  type Operation,
  type PersistenceAdapter,
  type Presence,
  type Principal,
  type Store,
} from "@graview/core";
import { exportBundle } from "./export.js";
import { health } from "./health.js";
import { conflictSentence, LIVE_PATH, type LiveClientMessage, type LiveConnection, type LiveServerMessage, type LiveSocket } from "./live.js";
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
 *   GET  /graview/state        the graph, the log and the stored version
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
 * host hands it, and `GET /graview/live` names it on the wire.
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
  { method: "GET", path: "/graview/state", says: "the graph, the log and the stored version" },
  { method: "POST", path: "/graview/ops", says: "calls in, the ops they produced out — or `undo`, batches to take back; 409 with the policy's sentence when refused" },
  { method: "GET", path: "/graview/since", says: "the ops appended after ?seq=N — everyone else's" },
  { method: "GET", path: "/graview/health", says: "ship's own report, plus where the data is" },
  { method: "GET", path: "/graview/export", says: "the whole store as one bundle, the way out" },
  { method: "POST", path: "/graview/here", says: "say where you are; answers with who else is, and the ops since `seq`" },
  { method: "GET", path: "/graview/who", says: "who is here right now" },
  { method: "POST", path: "/graview/leave", says: "say you have gone" },
  { method: "GET", path: LIVE_PATH, says: "the live wire: a WebSocket of hello/welcome, call/undo/ack/refused/conflict, ops and presence; 426 to a plain request" },
] as const;

export { SEAT_HEADERS };

export interface StoreHandlerOptions<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  /** Where the graph lives: any `PersistenceAdapter` — a file, SQLite, Durable Object storage. */
  readonly adapter: PersistenceAdapter<string>;
  /** What to put in an empty store on first start. */
  readonly seed?: GraphSnapshot;
  readonly scope?: string;
  /**
   * Who a request is. The host's to say — from a session, a bearer token,
   * whatever it authenticates with — and the store judges every call under
   * the principal it returns. It may answer a promise, for a host that
   * verifies a token with `crypto.subtle`.
   */
  readonly seatOf?: (request: Request) => Principal | Promise<Principal>;
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
}

export interface StoreHandler<S extends AnySchema> {
  readonly store: Store<S>;
  readonly opened: OpenedStore<S>;
  /** Every WIRE route: a `Request` in, a `Response` out. Bound, so it can be handed on as it is. */
  readonly handle: (request: Request) => Promise<Response>;
  /**
   * THE LIVE WIRE, ON ANY SOCKET (FR-05). Hand it the upgrade `Request`
   * (the seat is read from it, as on every route) and a way to send text
   * down the socket; it answers with the connection to hand each message
   * the client sends and the close, or with the `Response` refusing it (a
   * 401 when it cannot say who is asking). A Worker or Durable Object
   * attaches a `WebSocketPair`'s server end here; `serveStore` attaches
   * Node's upgrade.
   */
  readonly connect: (request: Request, socket: LiveSocket) => Promise<LiveConnection | Response>;
  /** Writes what is pending and lets the adapter go. */
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

/**
 * WHO IS HERE, AS ONE SEAT MAY BE TOLD (FR-02). Somebody whose own record
 * the seat may not see is not shown to it at all; anybody else is, without
 * where they stand or what they hover when that names a record the seat
 * may not see. A participant whose id is no record is shown as they are.
 */
export function presenceSeenBy(who: readonly Presence[], sees: (id: string) => boolean): Presence[] {
  const names = (value: string): boolean => value.split(/[/?#=&,;]/).every((part) => part === "" || sees(decodeURIComponent(part)));
  return who
    .filter((presence) => {
      // `kind:id:session`, and an id may hold a colon of its own: every reading of it must be one the seat sees.
      const parts = presence.participant.split(":");
      return parts.slice(2).every((_, at) => sees(parts.slice(1, at + 2).join(":")));
    })
    .map((presence) => ({
      ...presence,
      stop: names(presence.stop) ? presence.stop : "",
      ...(typeof presence.over === "string" && !sees(presence.over) ? { over: null } : {}),
      ...(presence.robot?.at && !sees(presence.robot.at) ? { robot: { ...presence.robot, at: null } } : {}),
    }));
}

/** A browser on another origin is the ordinary case for an embed. */
const CORS: Readonly<Record<string, string>> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": ["content-type", "authorization", ...Object.values(SEAT_HEADERS)].join(", "),
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

function send(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

async function read(request: Request): Promise<unknown> {
  const text = await request.text();
  return text.length === 0 ? {} : JSON.parse(text);
}

/**
 * Open the store and answer the wire for it. The migration runs HERE, once,
 * against the stored graph — which is the whole reason a server is the
 * honest place for it. A browser that migrates its own copy migrates it once
 * per browser; a server that migrates the roster migrates the roster.
 */
export async function createStoreHandler<S extends AnySchema>(options: StoreHandlerOptions<S>): Promise<StoreHandler<S>> {
  const scope = options.scope ?? options.app.name;
  const seatOf = options.seatOf ?? (options.trustSeatHeaders ? seatFromHeaders : undefined);
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
   * stamped with the handler's clock, so expiry does not depend on two
   * browsers agreeing what time it is.
   */
  const ttl = options.presenceTtlMs ?? PRESENCE_TTL_MS;
  let here = new Map<string, Presence>();
  const alive = (): Presence[] => {
    here = foldPresence(here, [], Date.now(), ttl);
    return [...here.values()];
  };
  const arrive = (told: Presence, seat: Principal): Presence => {
    // The session is what follows the seat's own `kind:id:` — an id may hold a colon (`shopper:bethan`).
    const own = `${seat.kind}:${seat.id ?? ""}:`;
    const session = told.participant.startsWith(own) ? told.participant.slice(own.length) : (told.participant.split(":").at(-1) ?? "");
    const participant = seat.id ? participantKey({ kind: seat.kind, id: seat.id, session }) : told.participant;
    const presence: Presence = { ...told, participant, at: new Date().toISOString() };
    here = foldPresence(here, [presence], Date.now(), ttl);
    return presence;
  };
  /*
   * WHAT A SEAT MAY SEE NEVER LEAVES THE STORE (FR-02). Every read below is
   * of the store as the asking seat sees it: its graph without what the
   * policy keeps from it, and its log with every op in its place and the
   * ones that touched what it may not see withheld (FR-16).
   */
  const seenFor = (principal: Principal) => seenBy(store, principal);
  const sighted = (principal: Principal): boolean => (store.policy?.sees?.length ?? 0) > 0 && !isSystem(principal);
  /*
   * The ops after `seq`, as the seat sees them: the same ops `seenBy`'s log
   * holds after it (each op is withheld or not on its own), without
   * redacting the whole log for every push down every socket.
   */
  const since = (principal: Principal, seq: number): Operation[] => {
    const after = store.log.opsFrom(Math.max(0, Math.floor(seq) + 1));
    return sighted(principal) ? redact(after, seesId(store, principal)) : [...after];
  };
  const lastSeq = (): number => store.log.length - 1;
  /*
   * WHERE THE LOG BEGINS, when it was compacted behind an undo horizon
   * (FR-23): a client hydrating on the state is handed the tail, and its
   * log begins where the server's does. Said only when it is past 0, so a
   * store that was never compacted answers exactly as before.
   */
  const horizonOf = (): { horizon?: number } => (store.log.horizon > 0 ? { horizon: store.log.horizon } : {});

  /*
   * EVERY FIELD'S REVISION (FR-05): the seq of the op that last wrote it,
   * read off the log once and kept current as ops land. A call that says
   * it saw an older one is a stale write, refused by name.
   */
  const revisions = FieldRevisions.of(store.log.all());
  const conflictsOf = (author: Principal, calls: readonly MutationCall[], base: unknown): FieldConflict[] => {
    if (!Array.isArray(base) || base.length === 0) return [];
    const sees = sighted(author) ? seesId(store, author) : () => true;
    // A record the seat may not see is not there to have moved: the call itself is refused for naming it.
    const claimed = (base as FieldRevision[]).filter(
      (entry) => entry && typeof entry.node === "string" && typeof entry.field === "string" && typeof entry.rev === "number" && sees(entry.node),
    );
    const stale = revisions.stale(claimed);
    if (stale.length === 0) return [];
    /*
     * A conflict is a choice — keep theirs, or put yours over it — and only
     * a call that could still land offers one. A call the policy refuses,
     * or one that no longer runs on the graph as it is (somebody finished
     * it first), is refused for that, in its own sentence.
     */
    if (store.policy && calls.some((call) => !store.permits(call, author).ok)) return [];
    const yours = new Map<string, unknown>();
    try {
      for (const primitive of store.previewAll(calls).primitives) {
        if (primitive.op === "patch-node") for (const [field, value] of Object.entries(primitive.after)) yours.set(`${primitive.id}\u0000${field}`, isUnset(value) ? undefined : value);
      }
    } catch {
      return [];
    }
    return stale.map((entry) => {
      const rev = revisions.of(entry.node, entry.field);
      const wrote = rev >= store.log.horizon ? store.log.opsFrom(rev)[0] : undefined;
      const shown = wrote && sighted(author) ? redact([wrote], sees)[0] : wrote;
      return {
        node: entry.node,
        field: entry.field,
        theirs: (store.graph.getNode(entry.node) as Record<string, unknown> | undefined)?.[entry.field],
        yours: yours.get(`${entry.node}\u0000${entry.field}`),
        by: shown?.author.name ?? shown?.author.id ?? "Someone",
        rev,
        saw: entry.rev,
      };
    });
  };
  const whoFor = (principal: Principal, who: readonly Presence[]): Presence[] => (sighted(principal) ? presenceSeenBy(who, seesId(store, principal)) : [...who]);

  async function route(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url, "http://localhost");

    /*
     * WHO IS ASKING, OR NOTHING. Health is the only route a stranger gets:
     * it says whether the store is well, not what is in it.
     */
    if (!seatOf && url.pathname !== "/graview/health") {
      return send(401, {
        error: "This store cannot tell who is asking: the host gives serveStore a seatOf, or trusts the seat headers (trustSeatHeaders) on a server only it can reach.",
      });
    }
    const seat = async (): Promise<Principal> => (seatOf as NonNullable<typeof seatOf>)(request);

    if (url.pathname === LIVE_PATH) {
      return send(426, { error: `${LIVE_PATH} is a WebSocket: open one, say hello, and the store's ops come to you. A plain request polls /graview/since instead.` });
    }

    if (url.pathname === "/graview/state") {
      const seen = seenFor(await seat());
      return send(200, {
        version: options.app.version ?? 1,
        snapshot: seen.snapshot(),
        log: seen.log.all(),
        migrated: opened.migrated.map((op) => op.intent),
        ...horizonOf(),
      });
    }

    if (url.pathname === "/graview/since") {
      const seq = Number(url.searchParams.get("seq") ?? "-1");
      return send(200, { ops: since(await seat(), seq) });
    }

    if (url.pathname === "/graview/who") return send(200, { who: whoFor(await seat(), alive()) });

    if (url.pathname === "/graview/here" && request.method === "POST") {
      const body = (await read(request)) as { presence?: Presence; seq?: number };
      if (!body.presence || typeof body.presence.participant !== "string" || typeof body.presence.stop !== "string") {
        return send(400, { error: "A presence is a participant and a stop." });
      }
      const asking = await seat();
      const mine = arrive(body.presence, asking);
      tellWhoIsHere();
      // Folded into the poll: the heartbeat carries back everybody else AND
      // the ops since, so being here costs no round trip of its own.
      return send(200, {
        who: whoFor(asking, alive().filter((presence) => presence.participant !== mine.participant)),
        ...(typeof body.seq === "number" ? { ops: since(asking, body.seq) } : {}),
      });
    }

    if (url.pathname === "/graview/leave" && request.method === "POST") {
      const body = (await read(request)) as { participant?: string };
      if (typeof body.participant === "string") {
        here = new Map(here);
        here.delete(body.participant);
        tellWhoIsHere();
      }
      return send(200, { who: whoFor(await seat(), alive()) });
    }

    if (url.pathname === "/graview/health") {
      return send(200, {
        ...health(store as never, options.app as never),
        // Said by the adapter where it knows, because it is the only thing
        // that does; `where` is for a caller with a better name for it.
        where: options.where ?? (options.adapter as { root?: string }).root ?? scope,
        adapter: options.adapter.name,
      });
    }

    if (url.pathname === "/graview/export") return send(200, exportBundle(options.app, seenFor(await seat())));

    if (url.pathname === "/graview/ops" && request.method === "POST") {
      const body = (await read(request)) as {
        calls?: readonly MutationCall[];
        /** Batches to take back instead — judged like any change, as the seat that asks. */
        undo?: readonly string[];
        intent?: string;
        batch?: string;
        /** What the calls came through; `api` unless the caller says (FR-06). */
        via?: string;
        /** The revision of each field the calls change, as the caller last saw it (FR-05). */
        base?: readonly FieldRevision[];
      };
      const calls = body.calls ?? [];
      const author = await seat();
      const via = typeof body.via === "string" && body.via.length > 0 ? body.via : "api";
      /*
       * A STALE WRITE IS A CONFLICT, NOT A LOSS (FR-05). A field that moved
       * since the caller read it is refused by name — theirs and yours —
       * and nothing is written: what to do about it is the person's call.
       */
      const conflicts = body.undo ? [] : conflictsOf(author, calls, body.base);
      if (conflicts.length > 0) return send(409, { error: conflictSentence(conflicts), refused: true, conflict: true, conflicts });
      try {
        /*
         * Through the STORE, under the requester's own seat. The policy
         * refuses here exactly what it refuses in the browser — and the
         * refusal comes back with the policy's own sentence rather than a
         * bare 403, because that sentence is the product.
         */
        const result = body.undo
          ? store.undo(body.undo, { author, via, ...(body.intent ? { intent: body.intent } : {}), ...(body.batch ? { batch: body.batch } : {}) })
          : store.applyAll(calls, {
              author,
              via,
              ...(body.intent ? { intent: body.intent } : {}),
              ...(body.batch ? { batch: body.batch } : {}),
            });
        await opened.flush();
        // An act may make what its own seat may not see: that op goes back withheld, as it would on a poll.
        const ops = sighted(author) ? redact(result.ops, seesId(store, author)) : result.ops;
        return send(200, { ops, batch: result.batch });
      } catch (error) {
        return send(409, { error: error instanceof Error ? error.message : String(error), refused: true });
      }
    }

    return send(404, { error: `Nothing at ${url.pathname}` });
  }

  /*
   * THE LIVE WIRE (FR-05). One entry per open socket: who it is, the last
   * seq it has been sent, and where it says it is. Every op that lands is
   * pushed down every socket in seq order, none skipped — each as its seat
   * may see it — and a socket's own call is answered by its `ack`, which
   * carries that call's ops, so they reach it once.
   */
  interface Live {
    readonly seat: Principal;
    readonly socket: LiveSocket;
    cursor: number;
    participant?: string;
    /** Set while this socket's own call lands, so its ops go in the ack rather than a push. */
    answering: boolean;
    open: boolean;
  }
  const sockets = new Set<Live>();
  const say = (live: Live, message: LiveServerMessage) => {
    if (!live.open) return;
    try {
      live.socket.send(JSON.stringify(message));
    } catch {
      // A socket that cannot be written to is closing; its close is what forgets it.
    }
  };
  const push = (live: Live) => {
    if (live.cursor >= lastSeq()) return;
    const ops = since(live.seat, live.cursor);
    live.cursor = lastSeq();
    if (ops.length > 0) say(live, { t: "ops", seq: live.cursor, ops });
  };
  store.subscribe((_diff, ops) => {
    revisions.note(ops);
    for (const live of sockets) if (!live.answering) push(live);
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
    const who = standing();
    for (const live of sockets) say(live, { t: "presence", who: whoFor(live.seat, who.filter((presence) => presence.participant !== live.participant)) });
  }

  /** A call or an undo from a socket: judged as its seat, exactly as `POST /graview/ops` judges it. */
  const answer = async (live: Live, message: Extract<LiveClientMessage, { t: "call" | "undo" }>): Promise<void> => {
    const cid = typeof message.cid === "string" ? message.cid : "";
    const author = live.seat;
    const via = typeof message.via === "string" && message.via.length > 0 ? message.via : "web";
    const intent = typeof message.intent === "string" && message.intent.length > 0 ? message.intent : undefined;
    const batch = typeof message.batch === "string" && message.batch.length > 0 ? message.batch : undefined;
    const shown = (ops: readonly Operation[]) => (sighted(author) ? redact(ops, seesId(store, author)) : [...ops]);
    push(live);
    /*
     * SENT TWICE, ANSWERED ONCE. A client that lost its socket before the
     * ack sends the call again under the same batch; one already in the
     * log is answered with the ops it made.
     */
    const already = batch ? store.log.all().filter((op) => op.batch === batch) : [];
    if (already.length > 0) {
      say(live, { t: "ack", cid, seq: already.at(-1)!.seq, batch: batch!, ops: shown(already) });
      return;
    }
    const calls = message.t === "call" && Array.isArray(message.calls) ? message.calls : [];
    if (message.t === "call") {
      const conflicts = conflictsOf(author, calls, message.base);
      if (conflicts.length > 0) {
        say(live, { t: "conflict", cid, sentence: conflictSentence(conflicts), conflicts });
        return;
      }
    }
    let result: { readonly ops: readonly Operation[]; readonly batch: string };
    live.answering = true;
    try {
      const applying = { author, via, ...(intent ? { intent } : {}), ...(batch ? { batch } : {}) };
      result = message.t === "undo" ? store.undo(Array.isArray(message.batches) ? message.batches : [], applying) : store.applyAll(calls, applying);
    } catch (error) {
      say(live, { t: "refused", cid, sentence: error instanceof Error ? error.message : String(error) });
      return;
    } finally {
      live.answering = false;
    }
    // Every op before this call's went down this socket before it landed; its own go in the ack.
    live.cursor = lastSeq();
    const ops = shown(result.ops);
    await opened.flush();
    say(live, { t: "ack", cid, seq: ops.at(-1)?.seq ?? live.cursor, batch: result.batch, ops });
  };

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

  async function connect(request: Request, socket: LiveSocket): Promise<LiveConnection | Response> {
    if (!seatOf) {
      return send(401, {
        error: "This store cannot tell who is asking: the host gives serveStore a seatOf, or trusts the seat headers (trustSeatHeaders) on a server only it can reach.",
      });
    }
    let seat: Principal;
    try {
      seat = await seatOf(seatRequest(request));
    } catch (error) {
      return send(401, { error: error instanceof Error ? error.message : String(error) });
    }
    const live: Live = { seat, socket, cursor: Number.POSITIVE_INFINITY, answering: false, open: true };
    const leave = () => {
      if (!live.participant) return;
      here = new Map(here);
      here.delete(live.participant);
      delete live.participant;
      tellWhoIsHere();
    };
    const hear = async (text: string): Promise<void> => {
      let message: LiveClientMessage;
      try {
        message = JSON.parse(text) as LiveClientMessage;
      } catch {
        say(live, { t: "error", sentence: "A message on the live wire is one JSON object." });
        return;
      }
      if (!message || typeof message !== "object") return;
      switch (message.t) {
        case "hello": {
          const seq = typeof message.seq === "number" && Number.isFinite(message.seq) ? message.seq : undefined;
          sockets.add(live);
          live.cursor = lastSeq();
          if (seq === undefined) {
            const seen = seenFor(seat);
            say(live, {
              t: "welcome",
              protocol: WIRE_PROTOCOL,
              seq: live.cursor,
              ops: [],
              state: { version: options.app.version ?? 1, snapshot: seen.snapshot(), log: seen.log.all(), migrated: opened.migrated.map((op) => op.intent), ...horizonOf() },
            });
          } else {
            say(live, { t: "welcome", protocol: WIRE_PROTOCOL, seq: live.cursor, ops: since(seat, seq) });
          }
          const who = standing().filter((presence) => presence.participant !== live.participant);
          if (who.length > 0) say(live, { t: "presence", who: whoFor(seat, who) });
          return;
        }
        case "call":
        case "undo":
          if (!sockets.has(live)) {
            say(live, { t: "refused", cid: String(message.cid ?? ""), sentence: "Say hello first: the live wire answers calls once it knows what the client has." });
            return;
          }
          return answer(live, message);
        case "here": {
          const told = message.presence;
          if (!told || typeof told.participant !== "string" || typeof told.stop !== "string") {
            say(live, { t: "error", sentence: "A presence is a participant and a stop." });
            return;
          }
          live.participant = arrive(told, seat).participant;
          tellWhoIsHere();
          return;
        }
        case "bye":
          leave();
          return;
        default:
          // A message this server does not know is ignored, never refused (docs/stability.md).
          return;
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
        leave();
      },
    };
  }

  return {
    store,
    opened,
    connect,
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
      await opened.flush();
      opened.close();
    },
  };
}
