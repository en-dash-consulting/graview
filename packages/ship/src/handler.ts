import {
  foldPresence,
  isSystem,
  participantKey,
  PRESENCE_TTL_MS,
  redact,
  seenBy,
  seesId,
  type AnySchema,
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
 * Polling rather than a socket, on purpose: a poll is a thing a person can
 * reproduce with `curl`, and a thing every runtime can answer.
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
  const since = (principal: Principal, seq: number): Operation[] => seenFor(principal).log.all().filter((op) => op.seq > seq);
  const sighted = (principal: Principal): boolean => (store.policy?.sees?.length ?? 0) > 0 && !isSystem(principal);
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

    if (url.pathname === "/graview/state") {
      const seen = seenFor(await seat());
      return send(200, {
        version: options.app.version ?? 1,
        snapshot: seen.snapshot(),
        log: seen.log.all(),
        migrated: opened.migrated.map((op) => op.intent),
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
      };
      const calls = body.calls ?? [];
      const author = await seat();
      const via = typeof body.via === "string" && body.via.length > 0 ? body.via : "api";
      try {
        /*
         * Through the STORE, under the requester's own seat. The policy
         * refuses here exactly what it refuses in the browser — and the
         * refusal comes back with the policy's own sentence rather than a
         * bare 403, because that sentence is the product.
         */
        const result = body.undo
          ? store.undo(body.undo, { author, via, ...(body.intent ? { intent: body.intent } : {}) })
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

  return {
    store,
    opened,
    handle: async (request) => {
      try {
        return await route(request);
      } catch (error) {
        return send(500, { error: error instanceof Error ? error.message : String(error) });
      }
    },
    async close() {
      await opened.flush();
      opened.close();
    },
  };
}
