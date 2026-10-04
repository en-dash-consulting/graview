import {
  FieldRevisions,
  hidesFrom,
  hueFor,
  isUnset,
  namesUnseen,
  participantKey,
  redact,
  seatLens,
  seenBy,
  seesId,
  refusalOf,
  VISITOR_PRESENCE_TTL_MS,
  WIRE_PROTOCOL,
  type AnySchema,
  type Author,
  type FieldConflict,
  type FieldRevision,
  type MutationCall,
  type Operation,
  type Presence,
  type Principal,
  type Store,
  type WireRefusal,
} from "@graview/core";
import { bytesOf, conflictSentence, LIVE_WIRE, type Limit, type LimitAnswer, type LiveClientMessage, type LiveServerMessage } from "./live.js";

/**
 * THE LIVE WIRE AS FUNCTIONS OVER STATE THE HOST HOLDS (FR-41, FR-42).
 *
 * `connect()` used to keep everything about a socket in a closure: who it
 * is, the last seq it was sent, where it said it stood. A Durable Object
 * that hibernates wakes on the next message with no closure left, so it
 * could not serve ship's wire without staying awake. Here the protocol is
 * a handful of functions over two things a host already keeps:
 *
 *   - a `Store` it opened, migrates, heals and meters itself, and
 *   - one `LiveSocketState` per socket, plain JSON — what a Durable Object
 *     puts in `serializeAttachment` and reads back on a wake.
 *
 * Everything else `liveProtocol` holds is derived from the store and may
 * be thrown away at any moment: make it again on the wake and the next
 * message is answered exactly as it would have been.
 *
 * `createStoreHandler`'s `connect` is this, with the state in memory: one
 * implementation, two ways to hold it.
 */

/**
 * ONE SOCKET, AS A HOST KEEPS IT BETWEEN MESSAGES. Plain JSON on purpose:
 * it survives `JSON.stringify` and `JSON.parse` unchanged, which is all a
 * hibernating host can promise.
 */
export interface LiveSocketState {
  /** Who this socket is: read once, from its upgrade, by the host's `seatOf`. */
  readonly seat: Principal;
  /** What its calls come through, recorded on every op they make: the host's word, never the client's (FR-52). */
  readonly via: string;
  /** The last seq this socket has been sent. Absent until it says hello: a call before that is refused. */
  cursor?: number;
  /**
   * Its presence key: built from the seat at hello (or at its first `here`),
   * said back in the welcome, and the key every later `here` on this
   * socket is held under — never taken from the client (FR-47).
   */
  participant?: string;
  /** The build its hello said it runs (FR-44): the client's word, kept for the host to count, never judged. */
  build?: string;
  /**
   * THE HOST'S BUILD THIS SOCKET IS SERVED BY (FR-44), said at `open` —
   * for a host that learns it per upgrade, as a worker carrying the socket
   * says which shell it serves. Said in the welcome over the protocol's
   * own `build`.
   */
  readonly hostBuild?: string;
  /**
   * The call this socket was told is busy (FR-45), and when (epoch ms) it
   * may come again. Every other call is busy too until it does, so nothing
   * made after it overtakes it.
   */
  held?: { readonly cid: string; readonly until: number };
}

/** A socket as the protocol is handed it: its state, and a way to send it text. */
export interface LivePeer extends LiveSocketState {
  send(text: string): void;
}

/** What one message did, for the host to keep and pass on. */
export interface LiveReceived {
  /** The socket's cursor now; the protocol has also set it on the peer it was handed. Absent before hello. */
  readonly cursor?: number;
  /**
   * The socket said where it is (`here`): its presence as the server built
   * it, for the host to hold and tell the others; or `null` — it said
   * `bye`, and the host forgets it. Absent: nothing changed.
   */
  readonly presence?: Presence | null;
  /** The ops this message landed in the store, unredacted, for the host to `publish` to every other socket. */
  readonly landed?: readonly Operation[];
}

export interface LiveProtocolOptions<S extends AnySchema> {
  /** The store the wire serves: the host's own (FR-42). */
  readonly store: Store<S>;
  /** The declaration's version, said in a welcome's state. 1 when unsaid. */
  readonly version?: number;
  /** What opening the store migrated, said in a welcome's state. */
  readonly migrated?: readonly string[];
  /**
   * MAKES WHAT LANDED DURABLE: an ack, and a post's answer, wait for it.
   * Handed every op the protocol landed that is not durable yet, in seq
   * order — the ones that just landed, after any a failed flush left — so
   * a host that writes ops (a ledger) writes exactly these. Flushes run one
   * at a time. One that rejects is not silence: the client is refused
   * `unavailable` in words and keeps the change, the socket's cursor does
   * not move, and the ops stay in the store but are held back from every
   * socket until a later flush holds them — the change sent again, or the
   * next one, which is handed them first. So a change sent again after a
   * failed flush is never made twice, and never acked before it is durable.
   * A flush may be handed an op again after it rejected: one it already
   * holds, it skips.
   */
  readonly flush?: (landed: readonly Operation[]) => Promise<void>;
  /**
   * The host's build, an opaque string said in every welcome (FR-44): a
   * client on another one is told once and keeps working. One string for
   * every socket, or a function of the socket for a host whose build
   * differs per upgrade; a socket opened with its own (`open(seat, via,
   * { build })`) is welcomed with that. A route answers with its request's
   * `build`, else this.
   */
  readonly build?: string | ((peer: Pick<LiveSocketState, "seat" | "via" | "hostBuild">) => string | undefined);
  /**
   * THE LOWEST HOST PROTOCOL SERVED (FR-44): the host's own number for its
   * half of the wire — its routing, its auth, its shell — beside ship's
   * `WIRE_PROTOCOL`, which a host does not move. A hello whose
   * `hostProtocol` is below it (absent is 0) is answered `reload` with
   * `hostProtocol` and nothing else, so the page reloads onto a build that
   * speaks it, carrying its unsent calls (`openRemote({ hostProtocol })`).
   */
  readonly minHostProtocol?: number;
  /**
   * WHAT A CHANGE CAME THROUGH, WHEN THE CLIENT CLAIMS IT (FR-52). A call
   * or an undo may carry `via` — `openRemote` sends the one a call was
   * applied with, as a guest view's `view:<name>` — and this judges it:
   * handed the socket (or the route's `WireAsked`) and the claim, it
   * answers the via to record. Asked of every change, with `claimed`
   * undefined when there is none; answering nothing records the host's
   * own. Absent, a claim is never read: what a change came through is the
   * host's word, and a browser could otherwise record its edit as Claude's.
   */
  readonly viaOf?: (peer: Pick<LiveSocketState, "seat" | "via">, claimed: string | undefined) => string | undefined;
  /**
   * THE LOWEST PROTOCOL SERVED (FR-44). A hello on an older one is answered
   * `reload` and nothing else: its calls are refused until it says hello
   * on one served. Absent, every protocol is served.
   */
  readonly minProtocol?: number;
  /**
   * THE HOST'S LIMITS (FR-45, FR-46), asked of every call and undo before
   * it is judged: busy (`{ retryAfter }`, try again), refused at a hard cap
   * (`{ refuse }`, reason `limit`), or nothing.
   */
  readonly limit?: Limit;
}

export interface LiveProtocol<S extends AnySchema> {
  readonly store: Store<S>;
  /**
   * The state a socket starts with: its seat and its channel, and no
   * cursor until it says hello — and the host's `build` for this socket,
   * when the host learns it per upgrade.
   */
  open(seat: Principal, via: string, options?: { readonly build?: string }): LiveSocketState;
  /**
   * Hand it one message the client sent. It answers down `peer.send`,
   * moves `peer.cursor` (and `peer.participant`) as it goes, and says what
   * the host should keep and pass on. `who` is everybody the host has
   * here, for the presence a welcome is followed by.
   *
   * Messages on one socket are handed in the order they came, each after
   * the one before has resolved. A host that publishes while a receive
   * awaits its flush reads the cursor off the same peer object, or
   * leaves the receiving socket out: its ops reach it in the ack.
   *
   * `landed` is what became durable: the call's ops, and any a failed
   * flush had held back before them. When the flush fails, nothing has:
   * `landed` is absent, the cursor is where it was, and the client was
   * refused `unavailable`.
   */
  receive(peer: LivePeer, text: string, who?: readonly Presence[]): Promise<LiveReceived>;
  /**
   * Ops that landed, down every socket that has said hello and has not had
   * them, each as its own seat may see them (FR-02, FR-16): in seq order,
   * none skipped, caught up from the peer's own cursor. Sets each peer's
   * cursor; the host keeps it.
   */
  publish(ops: readonly Operation[], peers: Iterable<LivePeer>): void;
  /** Who is here, told to every socket that has said hello: as its seat may be told it, and without itself. */
  tell(who: readonly Presence[], peers: Iterable<LivePeer>): void;
  /**
   * `POST /graview/ops`, FOR A HOST THAT ROUTES ITS OWN REQUESTS. Hand it
   * the request's body as text and who is asking; it answers the status,
   * the JSON body and the headers to send, exactly as `createStoreHandler`
   * answers the route — which is this — and `landed`, the ops it put in
   * the store, unredacted, for the host to `publish` to its sockets:
   *
   * - a batch the asking seat already landed: 200 with the ops it made;
   *   somebody else's, or not a client's shape: 409, `invalid`;
   * - the host's `limit`: 429 with `Retry-After` (busy), 413 `limit`,
   *   503 `unavailable`;
   * - a field that moved since the call's `base`: 409 with `conflict`;
   * - refused by the store: 409 with its sentence and `reason`;
   * - landed: 200 with the ops as the seat may see them, once `flush`
   *   says they are durable.
   *
   * Every answer but busy says the declaration `version` and the `build`.
   */
  post(body: string, asked: WireAsked): Promise<WireAnswer & { readonly landed?: readonly Operation[] }>;
  /** `GET /graview/state`: the store as the asking seat sees it — snapshot, log, migrations, modules, horizon. */
  state(asked: WireAsked): WireAnswer;
  /** `GET /graview/since?seq=N`: the ops after `seq`, as the asking seat sees them. */
  since(seq: number, asked: WireAsked): WireAnswer;
  /**
   * THE DECLARATION CHANGED (FR-43), and this protocol is the one over the
   * store migrated to it. Every socket that has said hello is told
   * `{ t: "declaration", version }` and its cursor is forgotten: a seq of
   * the old store means nothing on the new one, so nothing is pushed and
   * no call is served until it says hello again. The host keeps the
   * cursors as it keeps them after `receive`.
   */
  declared(peers: Iterable<LivePeer>): void;
}

/**
 * WHO ASKS A ROUTE, as the host's own routing says it: the seat its
 * credential names, what the request came through (FR-52), and — for a
 * host whose build differs per request — the build that answers it (FR-44).
 */
export interface WireAsked {
  readonly seat: Principal;
  readonly via: string;
  /** The host's build answering this request; the protocol's `build` when absent. */
  readonly build?: string;
}

/** A route's answer, for the host to send: a status, a JSON body, and the headers that carry meaning (`Retry-After`). */
export interface WireAnswer {
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
  readonly headers: Readonly<Record<string, string>>;
}

/** A change as both the socket and `POST /graview/ops` ask for one. */
interface Change {
  readonly t: "call" | "undo";
  readonly calls: readonly MutationCall[];
  readonly batches: readonly string[];
  readonly intent: string | undefined;
  readonly batch: unknown;
  readonly base: unknown;
  /** The via the client claimed, for the host's `viaOf` to judge; never read without one. */
  readonly claimed: string | undefined;
}

/** What judging a change came to: a stale write, a refusal, or the ops it landed in the store. */
type Landing =
  | { readonly conflicts: readonly FieldConflict[]; readonly refusal?: undefined; readonly result?: undefined }
  | { readonly refusal: WireRefusal; readonly conflicts?: undefined; readonly result?: undefined }
  | {
      readonly result: { readonly ops: readonly Operation[]; readonly batch: string };
      /** What the flush made durable — these ops, and any a failed flush left — or nothing: it failed, and they are held back. */
      readonly saved: readonly Operation[] | undefined;
      readonly conflicts?: undefined;
      readonly refusal?: undefined;
    };

/** A client's claim of what its change came through: a short string, or none. */
const claimOfVia = (via: unknown): string | undefined => (typeof via === "string" && via.length > 0 ? via.slice(0, 64) : undefined);

/** For whom an author acts, as a presence says it: the person's id and name, or nothing. */
const forWhom = (author: Author): Pick<Presence, "onBehalfOf" | "onBehalfOfName"> =>
  author.onBehalfOf?.id ? { onBehalfOf: author.onBehalfOf.id, ...(author.onBehalfOf.name ? { onBehalfOfName: author.onBehalfOf.name } : {}) } : {};

/**
 * A PRESENCE AS THE SERVER BUILDS IT. Keyed by the seat — a client cannot
 * claim to be somebody else — with only the session taken from what it
 * said, and stamped with the server's clock. What it is, and for whom it
 * acts, are the seat's (FR-47): a claimed `kind`, `onBehalfOf` or `until`
 * is dropped, and the seat's name stands over a claimed one. `participant`
 * is the key the server already gave this socket (its welcome said it):
 * given, the claimed key is not read at all.
 */
export function presenceFrom(told: Presence, seat: Principal, now: Date = new Date(), participant?: string): Presence {
  const { participant: claimed, kind: _kind, name: claimedName, onBehalfOf: _for, onBehalfOfName: _forName, until: _until, at: _at, ...said } = told;
  // The session is what follows the seat's own `kind:id:` — an id may hold a colon (`shopper:bethan`).
  const own = `${seat.kind}:${seat.id ?? ""}:`;
  const session = claimed.startsWith(own) ? claimed.slice(own.length) : (claimed.split(":").at(-1) ?? "");
  const key = participant ?? (seat.id ? participantKey({ kind: seat.kind, id: seat.id, session }) : claimed);
  const name = seat.name ?? claimedName;
  return { ...said, participant: key, kind: seat.kind, ...(name ? { name } : {}), ...forWhom(seat), at: now.toISOString() };
}

/**
 * A VISITOR WITHOUT A SOCKET, as a host announces it (FR-47): an agent
 * acting over MCP or an RPC, a polling tab. Built from the author the host
 * already trusts — what it is, what it is called, for whom — keyed
 * `kind:id:visit` unless a session is given, so every call by one agent
 * refreshes one figure rather than adding another.
 */
export function visitorPresence(
  author: Author,
  options: { readonly session?: string; readonly stop?: string; readonly over?: string | null; readonly hue?: number; readonly now?: Date } = {},
): Presence {
  const name = author.name ?? author.id;
  return {
    participant: participantKey({ kind: author.kind, ...(author.id ? { id: author.id } : {}), session: options.session ?? author.session ?? "visit" }),
    kind: author.kind,
    ...(name ? { name } : {}),
    ...forWhom(author),
    hue: options.hue ?? hueFor(author.id ?? author.kind),
    stop: options.stop ?? "",
    ...(options.over !== undefined ? { over: options.over } : {}),
    at: (options.now ?? new Date()).toISOString(),
  };
}

/**
 * WHO IS HERE, WITH ONE MORE (FR-47) — for a host that holds `who` itself,
 * as a hibernating one does. The visitor is stamped now and stands until
 * `ttlMs` from now; the same participant announced again replaces it, and
 * anybody whose announced time has passed is dropped. Pure: keep what it
 * answers, and hand it to `receive` and `tell`.
 */
export function announcePresence(who: readonly Presence[], presence: Presence, ttlMs: number = VISITOR_PRESENCE_TTL_MS, now: number = Date.now()): Presence[] {
  const stamped: Presence = { ...presence, at: new Date(now).toISOString(), until: new Date(now + ttlMs).toISOString() };
  return [...who.filter((one) => one.participant !== presence.participant && (one.until === undefined || now < Date.parse(one.until))), stamped];
}

/** A key for a socket that has not said one, minted by the server: the welcome tells the client what it is. */
const mintSession = (): string => globalThis.crypto.randomUUID().slice(0, 8);

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
    .map((presence) => {
      // An agent is shown; for whom it acts is not, to a seat that may not see that person (FR-47).
      const { onBehalfOf, onBehalfOfName, ...rest } = presence;
      const forWhom = onBehalfOf !== undefined && sees(onBehalfOf) ? { onBehalfOf, ...(onBehalfOfName !== undefined ? { onBehalfOfName } : {}) } : {};
      return {
        ...rest,
        ...forWhom,
        stop: names(presence.stop) ? presence.stop : "",
        ...(typeof presence.over === "string" && !sees(presence.over) ? { over: null } : {}),
        ...(presence.robot?.at && !sees(presence.robot.at) ? { robot: { ...presence.robot, at: null } } : {}),
      };
    });
}

/**
 * THE SHAPE OF A BATCH A CLIENT NAMES: what a `Store` mints by default,
 * `batch:<tag>:<n>` for a change and `undo:<tag>:<n>` for a take-back,
 * the tag 1–24 lowercase letters and digits and `n` up to 12 digits. A
 * client names the batch its call lands in, so a call sent twice is
 * answered once (FR-49) — and anything else a client names is refused
 * `invalid`, so it cannot claim a batch the host mints for itself
 * (`setup`, `migration:v2`) before the host does.
 */
const CLIENT_BATCH = /^(?:batch|undo):[0-9a-z]{1,24}:[0-9]{1,12}$/;

/** Whether a client may name this batch: `batch:<tag>:<n>` or `undo:<tag>:<n>`, as a `Store` mints them. */
export function isClientBatch(batch: unknown): batch is string {
  return typeof batch === "string" && CLIENT_BATCH.test(batch);
}

/** A tag for one minter, from the platform's random source. */
const mintTag = (): string => globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);

/**
 * BATCH IDS NO CLIENT CAN NAME FIRST: `served:<kind>:<tag>:<n>`, outside
 * the shape `isClientBatch` accepts. Hand it to the host's own store —
 * `new Store({ batchIds: serverBatchIds() })`, or `openStore`'s
 * `storeOptions` — so what the host lands itself (an agent's RPC, a
 * migration, a seed) is in a batch no client could have claimed.
 * `createStoreHandler` mints its own this way, and `liveProtocol` mints
 * one for a call that names none.
 */
export function serverBatchIds(): (kind: "batch" | "undo") => string {
  const tag = mintTag();
  let count = 0;
  return (kind) => `served:${kind}:${tag}:${++count}`;
}

/**
 * THE SAME SEAT. An op is the asking seat's own when its author is the
 * same kind and id — and, for an agent, acts for the same person: Claude
 * for Ada is not Claude for Bo.
 */
export function authoredBy(author: Author, seat: Principal): boolean {
  if (author.kind !== seat.kind || (author.id ?? "") !== (seat.id ?? "")) return false;
  return seat.kind !== "agent" || (author.onBehalfOf?.id ?? "") === (seat.onBehalfOf?.id ?? "");
}

/**
 * WHAT A BATCH A CHANGE NAMES IS: answered already (`answered`, the ops it
 * made), refused (`refusal`), or free to land in (neither).
 */
export type BatchClaim =
  | { readonly answered: readonly Operation[]; readonly refusal?: undefined }
  | { readonly refusal: WireRefusal; readonly answered?: undefined }
  | { readonly answered?: undefined; readonly refusal?: undefined };

/**
 * THE STORE AS EACH SEAT SEES IT, on the wire — shared by the HTTP routes
 * and the socket, so the two can never disagree. Internal: everything in
 * it is derived from the store, and kept only to save reading the log
 * again; a field's revisions are caught up from the log as it grew, so a
 * wake that made this again reads the same revisions the sleeper had.
 */
export interface Wire<S extends AnySchema> {
  readonly store: Store<S>;
  lastSeq(): number;
  /** Kept from a seat: what its sight does not reach (FR-02), and the kinds of a module that is off (FR-12). */
  sighted(principal: Principal): boolean;
  /** Ops as the seat may see them, withheld in place (FR-16). */
  shown(principal: Principal, ops: readonly Operation[]): Operation[];
  /** The ops after `seq`, as the seat sees them. */
  since(principal: Principal, seq: number): Operation[];
  /** The store as the seat sees it. */
  seenFor(principal: Principal): Store<S>;
  whoFor(principal: Principal, who: readonly Presence[]): Presence[];
  /** The fields a call would write that moved since the caller's base: a stale write (FR-05). */
  conflictsOf(author: Principal, calls: readonly MutationCall[], base: unknown): FieldConflict[];
  /**
   * SENT TWICE, ANSWERED ONCE: what the batch a call or an undo names is,
   * for the seat that names it. A client that never heard the answer sends
   * again under the same batch — down the socket or over HTTP — and is
   * answered with what it made the first time (FR-49): only ever its own
   * ops. A batch that holds somebody else's, or one a client may not name
   * (`isClientBatch`), is refused `invalid`.
   */
  claim(batch: unknown, seat: Principal): BatchClaim;
  /** `{ horizon }` when the log was compacted (FR-23); nothing otherwise. */
  horizonOf(): { horizon?: number };
  enabledModules(): string[];
}

export function wireOf<S extends AnySchema>(store: Store<S>): Wire<S> {
  const sighted = (principal: Principal): boolean => hidesFrom(store, principal);
  // Withheld in place (FR-16), and no id the seat may not see in any of them (FR-55).
  const shown = (principal: Principal, ops: readonly Operation[]): Operation[] => (sighted(principal) ? redact(ops, seatLens(store, principal)) : [...ops]);
  /*
   * EVERY FIELD'S REVISION (FR-05): the seq of the op that last wrote it,
   * read off the log once and caught up from wherever the log has grown
   * to since — no subscription, so nothing here goes stale while a host
   * sleeps, and a host that made this again reads the same revisions.
   */
  const revisions = FieldRevisions.of(store.log.all());
  let noted = store.log.length;
  const current = (): FieldRevisions => {
    if (store.log.length > noted) {
      revisions.note(store.log.opsFrom(noted));
      noted = store.log.length;
    }
    return revisions;
  };
  return {
    store,
    lastSeq: () => store.log.length - 1,
    sighted,
    shown,
    since: (principal, seq) => shown(principal, store.log.opsFrom(Math.max(0, Math.floor(seq) + 1))),
    seenFor: (principal) => seenBy(store, principal),
    whoFor: (principal, who) => {
      // A visitor whose announced time has passed is never told of, though a host may still hold it.
      const now = Date.now();
      const standing = who.filter((presence) => presence.until === undefined || now < Date.parse(presence.until));
      return sighted(principal) ? presenceSeenBy(standing, seesId(store, principal)) : standing;
    },
    claim(batch, seat) {
      if (batch === undefined || batch === null || batch === "") return {};
      if (!isClientBatch(batch)) {
        const said = typeof batch === "string" ? `“${batch.length > 40 ? `${batch.slice(0, 37)}…` : batch}”` : "a batch that is not a string";
        return {
          refusal: {
            reason: "invalid",
            sentence: `A client names its batch batch:<tag>:<n> or undo:<tag>:<n>, as a Store mints it; ${said} is not one. Send the change without a batch, or under one this client minted.`,
          },
        };
      }
      const ops = store.log.all().filter((op) => op.batch === batch);
      if (ops.some((op) => !authoredBy(op.author, seat))) {
        return { refusal: { reason: "invalid", sentence: "That batch is somebody else's: send the change under a batch this client minted." } };
      }
      return ops.length > 0 ? { answered: ops } : {};
    },
    horizonOf: () => (store.log.horizon > 0 ? { horizon: store.log.horizon } : {}),
    enabledModules: () => [...store.modules.enabled].sort(),
    conflictsOf(author, calls, base) {
      if (!Array.isArray(base) || base.length === 0) return [];
      const lens = sighted(author) ? seatLens(store, author) : undefined;
      // A record the seat is not served is not there to have moved: the call itself is refused for naming it.
      const claimed = (base as FieldRevision[]).filter(
        (entry) => entry && typeof entry.node === "string" && typeof entry.field === "string" && typeof entry.rev === "number" && (!lens || lens.shows(entry.node)),
      );
      const revs = current();
      const stale = revs.stale(claimed);
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
        const rev = revs.of(entry.node, entry.field);
        const wrote = rev >= store.log.horizon ? store.log.opsFrom(rev)[0] : undefined;
        const seen = wrote && lens ? redact([wrote], lens)[0] : wrote;
        // Theirs as the seat's view serves the record: a field naming what it may not see is cleared there too (FR-55).
        const theirs = ((lens ? seenBy(store, author) : store).graph.getNode(entry.node) as Record<string, unknown> | undefined)?.[entry.field];
        const mine = yours.get(`${entry.node}\u0000${entry.field}`);
        return {
          node: entry.node,
          field: entry.field,
          theirs,
          yours: lens && namesUnseen(mine, lens.sees) ? undefined : mine,
          by: seen?.author.name ?? seen?.author.id ?? "Someone",
          rev,
          saw: entry.rev,
        };
      });
    },
  };
}

const say = (peer: LivePeer, message: LiveServerMessage): void => {
  try {
    peer.send(JSON.stringify(message));
  } catch {
    // A socket that cannot be written to is closing; its close is what forgets it.
  }
};

/**
 * THE PROTOCOL OVER A STORE. Cheap to make, and safe to make again on
 * every wake: what it keeps is derived from the store.
 */
export function liveProtocol<S extends AnySchema>(options: LiveProtocolOptions<S>): LiveProtocol<S> {
  const { store } = options;
  const wire = wireOf(store);
  /** A call that names no batch lands in one minted here, outside the shape a client may name. */
  const mintServed = serverBatchIds();

  /**
   * OPS THAT LANDED AND ARE NOT DURABLE: a flush rejected them. Held back
   * from every socket — nothing is sent past the first of them, so none is
   * skipped — until a flush holds them. Derived: a host that wakes makes
   * its store again from what is durable, where none of them is.
   */
  let unsaved: Operation[] = [];
  let flushing: Promise<unknown> = Promise.resolve();
  /**
   * THROUGH THE HOST'S FLUSH, ONE AT A TIME: `ops` and every op a failed
   * flush left before them. Says whether they are durable now, and which
   * ops became durable — for the host to publish.
   */
  const durable = (ops: readonly Operation[]): Promise<{ readonly saved: readonly Operation[] } | { readonly failed: true }> => {
    const turn = flushing.then(async () => {
      const ids = new Set(unsaved.map((op) => op.id));
      const handing = [...unsaved, ...ops.filter((op) => !ids.has(op.id))].sort((a, b) => a.seq - b.seq);
      try {
        await options.flush?.(handing);
      } catch {
        unsaved = handing;
        return { failed: true as const };
      }
      const saved = new Set(handing.map((op) => op.id));
      unsaved = unsaved.filter((op) => !saved.has(op.id));
      return { saved: handing };
    });
    flushing = turn.catch(() => {});
    return turn;
  };
  /** Whether any of these ops is not durable yet. */
  const unsavedIn = (ops: readonly Operation[]): boolean => unsaved.length > 0 && ops.some((op) => unsaved.some((one) => one.id === op.id));
  const UNSAVED = "Your change could not be saved just now. It is kept, and sent again until it is.";

  /** The ops after this socket's cursor up to `last`, down it now, as its seat sees them. */
  const sendUpTo = (peer: LivePeer, last: number, ops?: readonly Operation[]): void => {
    if (peer.cursor === undefined || peer.cursor >= last) return;
    const from = peer.cursor + 1;
    // The ops handed in, when they are the whole of what this peer is missing; the log otherwise.
    const after = (ops && ops.length > 0 && ops[0]!.seq <= from && ops.at(-1)!.seq >= last ? ops.filter((op) => op.seq >= from) : store.log.opsFrom(from)).filter((op) => op.seq <= last);
    peer.cursor = last;
    if (after.length > 0) say(peer, { t: "ops", seq: last, ops: wire.shown(peer.seat, after) });
  };
  /** Every op this socket has not been sent, down it now, as its seat sees them — up to the first that is not durable. */
  const catchUp = (peer: LivePeer, ops?: readonly Operation[]): void => {
    const held = unsaved[0]?.seq;
    sendUpTo(peer, held === undefined ? wire.lastSeq() : Math.min(wire.lastSeq(), held - 1), ops);
  };

  /** What the host's `limit` says of a change, before it is judged; nothing when it has none. */
  const limitOf = async (seat: Principal, via: string, change: Change, bytes: number): Promise<LimitAnswer | undefined> =>
    options.limit ? options.limit({ seat, via, t: change.t, bytes, calls: change.t === "call" ? change.calls : [] }) : undefined;

  /**
   * ONE CHANGE, JUDGED AS ITS SEAT — the socket's and `POST /graview/ops`'s
   * alike, so the two can never disagree. A stale write is a conflict and
   * nothing is written (FR-05); then through the store, under the seat and
   * the host's channel (never the client's, FR-52), in the batch the client
   * named or one minted here; then flushed. `applied` runs between the
   * store taking it and the flush, for the socket to move its cursor.
   */
  const land = async (seat: Principal, via: string, change: Change, applied?: () => void): Promise<Landing> => {
    if (change.t === "call") {
      const conflicts = wire.conflictsOf(seat, change.calls, change.base);
      if (conflicts.length > 0) return { conflicts };
    }
    const batch = typeof change.batch === "string" && change.batch.length > 0 ? change.batch : mintServed(change.t === "undo" ? "undo" : "batch");
    let result: { readonly ops: readonly Operation[]; readonly batch: string };
    try {
      const applying = { author: seat, via, ...(change.intent ? { intent: change.intent } : {}), batch };
      result = change.t === "undo" ? store.undo(change.batches, applying) : store.applyAll(change.calls, applying);
    } catch (error) {
      return { refusal: refusalOf(error) };
    }
    applied?.();
    const flushed = await durable(result.ops);
    return { result, saved: "saved" in flushed ? flushed.saved : undefined };
  };

  /** A change as the socket's message says it. */
  const changeOf = (message: Extract<LiveClientMessage, { t: "call" | "undo" }>): Change => ({
    t: message.t,
    calls: message.t === "call" && Array.isArray(message.calls) ? message.calls : [],
    batches: message.t === "undo" && Array.isArray(message.batches) ? message.batches : [],
    intent: typeof message.intent === "string" && message.intent.length > 0 ? message.intent : undefined,
    batch: message.batch,
    base: message.t === "call" ? message.base : undefined,
    claimed: claimOfVia(message.via),
  });

  /** What a change came through: the host's word, or a claim its `viaOf` accepts (FR-52). */
  const viaFor = (peer: Pick<LiveSocketState, "seat" | "via">, change: Change): string => {
    const judged = options.viaOf?.(peer, change.claimed);
    return typeof judged === "string" && judged.length > 0 ? judged : peer.via;
  };

  /** A call or an undo from a socket, past its claim and the host's limit: judged as its seat, exactly as `POST /graview/ops` judges it. */
  const answer = async (peer: LivePeer, cid: string, change: Change, via: string): Promise<LiveReceived> => {
    catchUp(peer);
    const prior = peer.cursor!;
    /*
     * Every op before this call's went down this socket before it landed;
     * its own go in the ack. Unless one before it is held back as not
     * durable: then the cursor stays, and they go down after the flush.
     */
    const landing = await land(peer.seat, via, change, () => {
      if (unsaved.length === 0) peer.cursor = wire.lastSeq();
    });
    if (landing.conflicts) {
      say(peer, { t: "conflict", cid, sentence: conflictSentence(landing.conflicts), conflicts: [...landing.conflicts] });
      return { cursor: peer.cursor! };
    }
    if (landing.refusal) {
      say(peer, { t: "refused", cid, ...landing.refusal });
      return { cursor: peer.cursor! };
    }
    const { result, saved } = landing;
    if (!saved) {
      // Not durable: refused `unavailable`, which the client keeps and sends again; nothing is acked and the cursor does not move.
      peer.cursor = prior;
      say(peer, { t: "refused", cid, reason: "unavailable", sentence: UNSAVED });
      return { cursor: prior };
    }
    return acked(peer, cid, result.batch, result.ops, saved);
  };

  /** The ack of ops that are durable: what was held back before them goes first, so none is skipped. */
  const acked = (peer: LivePeer, cid: string, batch: string, own: readonly Operation[], saved: readonly Operation[] | undefined): LiveReceived => {
    const first = own[0]?.seq;
    if (first !== undefined) {
      sendUpTo(peer, first - 1);
      peer.cursor = Math.max(peer.cursor!, own.at(-1)!.seq);
    }
    const ops = wire.shown(peer.seat, own);
    say(peer, { t: "ack", cid, seq: ops.at(-1)?.seq ?? peer.cursor!, batch, ops });
    return { cursor: peer.cursor!, ...(saved && saved.length > 0 ? { landed: saved } : {}) };
  };

  /** The host's build a socket — or a route's request — is served by (FR-44): its own, else the protocol's word for it. */
  const buildFor = (peer: Pick<LiveSocketState, "seat" | "via" | "hostBuild">): string | undefined =>
    peer.hostBuild ?? (typeof options.build === "function" ? options.build(peer) : options.build);
  /** Which declaration, and which build, answered (FR-43, FR-44): on every route's answer a poll reads. */
  const answering = (asked: WireAsked): { version: number; build?: string } => {
    const build = buildFor({ seat: asked.seat, via: asked.via, ...(asked.build ? { hostBuild: asked.build } : {}) });
    return { version: options.version ?? 1, ...(build ? { build } : {}) };
  };
  const reply = (status: number, body: Record<string, unknown>, headers: Record<string, string> = {}): WireAnswer => ({ status, body, headers });

  return {
    store,
    open: (seat, via, opening = {}) => ({ seat, via, ...(opening.build ? { hostBuild: opening.build.slice(0, 64) } : {}) }),
    async receive(peer, text, who = []) {
      let message: LiveClientMessage;
      try {
        message = JSON.parse(text) as LiveClientMessage;
      } catch {
        say(peer, { t: "error", sentence: "A message on the live wire is one JSON object." });
        return peer.cursor !== undefined ? { cursor: peer.cursor } : {};
      }
      const unchanged = (): LiveReceived => (peer.cursor !== undefined ? { cursor: peer.cursor } : {});
      if (!message || typeof message !== "object") return unchanged();
      switch (message.t) {
        case "hello": {
          /*
           * ANOTHER CODEC, OR A PROTOCOL NO LONGER SERVED (FR-44). Neither is
           * welcomed, and neither has its cursor set, so its calls are
           * refused rather than read as something they are not.
           */
          if (typeof message.wire === "string" && message.wire !== LIVE_WIRE) {
            say(peer, { t: "error", sentence: `This socket speaks ${LIVE_WIRE}, not ${message.wire}: say hello in ${LIVE_WIRE}, or open the socket the ${message.wire} host serves.` });
            return unchanged();
          }
          const speaks = typeof message.protocol === "number" && Number.isFinite(message.protocol) ? message.protocol : 1;
          if (options.minProtocol !== undefined && speaks < options.minProtocol) {
            delete peer.cursor;
            say(peer, {
              t: "reload",
              reason: `This app was updated: its server no longer speaks protocol ${speaks} of the live wire, only ${options.minProtocol} and later. Reload the page; changes not yet sent are offered again after it.`,
              protocol: options.minProtocol,
            });
            return {};
          }
          // The host's own half of the wire, numbered by the host: an older page reloads onto a build that speaks it.
          const hostSpeaks = typeof message.hostProtocol === "number" && Number.isFinite(message.hostProtocol) ? message.hostProtocol : 0;
          if (options.minHostProtocol !== undefined && hostSpeaks < options.minHostProtocol) {
            delete peer.cursor;
            say(peer, {
              t: "reload",
              reason: "This app was updated, and this page is from before it. Reload the page; changes not yet sent are offered again after it.",
              protocol: options.minProtocol ?? WIRE_PROTOCOL,
              hostProtocol: options.minHostProtocol,
            });
            return {};
          }
          if (typeof message.build === "string" && message.build.length > 0) peer.build = message.build.slice(0, 64);
          const seq = typeof message.seq === "number" && Number.isFinite(message.seq) ? message.seq : undefined;
          peer.cursor = wire.lastSeq();
          // Its own key, built from the seat, so the client can leave itself out of who is here (FR-47).
          peer.participant ??= participantKey({ kind: peer.seat.kind, ...(peer.seat.id ? { id: peer.seat.id } : {}), session: mintSession() });
          const participant = peer.participant;
          const build = buildFor(peer);
          const said = { protocol: WIRE_PROTOCOL, wire: LIVE_WIRE, version: options.version ?? 1, participant, ...(build ? { build } : {}) };
          if (seq === undefined) {
            const seen = wire.seenFor(peer.seat);
            say(peer, {
              t: "welcome",
              ...said,
              seq: peer.cursor,
              ops: [],
              state: {
                version: options.version ?? 1,
                snapshot: seen.snapshot(),
                log: seen.log.all(),
                migrated: [...(options.migrated ?? [])],
                enabledModules: wire.enabledModules(),
                ...wire.horizonOf(),
              },
            });
          } else {
            say(peer, { t: "welcome", ...said, seq: peer.cursor, ops: wire.since(peer.seat, seq) });
          }
          const others = who.filter((presence) => presence.participant !== peer.participant);
          if (others.length > 0) say(peer, { t: "presence", who: wire.whoFor(peer.seat, others) });
          return { cursor: peer.cursor };
        }
        case "call":
        case "undo": {
          const cid = String(message.cid ?? "");
          if (peer.cursor === undefined) {
            say(peer, { t: "refused", cid, reason: "invalid", sentence: "Say hello first: the live wire answers calls once it knows what the client has." });
            return {};
          }
          /*
           * SENT AGAIN AFTER IT LANDED: answered with what it made, before the
           * host is asked anything. A call whose ack was lost is never told
           * busy, capped or unavailable for a change already made — and only
           * ever with the asking seat's own ops (`claim`).
           */
          const change = changeOf(message);
          const claim = wire.claim(message.batch, peer.seat);
          if (claim.refusal) {
            catchUp(peer);
            if (peer.held?.cid === cid) delete peer.held;
            say(peer, { t: "refused", cid, ...claim.refusal });
            return { cursor: peer.cursor };
          }
          if (claim.answered) {
            if (peer.held?.cid === cid) delete peer.held;
            // Landed, but a flush failed it: flushed again, and acked only once it holds.
            if (unsavedIn(claim.answered)) {
              const flushed = await durable([]);
              if (!("saved" in flushed)) {
                catchUp(peer);
                say(peer, { t: "refused", cid, reason: "unavailable", sentence: UNSAVED });
                return { cursor: peer.cursor };
              }
              catchUp(peer);
              return acked(peer, cid, message.batch as string, claim.answered, flushed.saved);
            }
            catchUp(peer);
            say(peer, { t: "ack", cid, seq: claim.answered.at(-1)!.seq, batch: message.batch as string, ops: wire.shown(peer.seat, claim.answered) });
            return { cursor: peer.cursor };
          }
          /*
           * BUSY IS NOT REFUSED (FR-45). A call made after one that was told
           * to wait waits too, whatever the rate says now: the client sends
           * them again in the order it made them, the held one first.
           */
          const now = Date.now();
          if (peer.held && peer.held.cid !== cid) {
            say(peer, { t: "busy", cid, retryAfter: Math.max(0, peer.held.until - now) });
            return { cursor: peer.cursor };
          }
          const via = viaFor(peer, change);
          const limited = await limitOf(peer.seat, via, change, bytesOf(text));
          if (limited && "refuse" in limited) {
            delete peer.held;
            say(peer, { t: "refused", cid, reason: "limit", sentence: limited.refuse });
            return { cursor: peer.cursor };
          }
          // Not for a while, and no wait to name: refused `unavailable`, which the client keeps and sends again, backing off.
          if (limited && "unavailable" in limited) {
            delete peer.held;
            say(peer, { t: "refused", cid, reason: "unavailable", sentence: limited.unavailable });
            return { cursor: peer.cursor };
          }
          if (limited) {
            const retryAfter = Math.max(0, Math.ceil(limited.retryAfter));
            peer.held = { cid, until: now + retryAfter };
            say(peer, { t: "busy", cid, retryAfter, ...(limited.sentence ? { sentence: limited.sentence } : {}) });
            return { cursor: peer.cursor };
          }
          delete peer.held;
          return answer(peer, cid, change, via);
        }
        case "here": {
          const told = message.presence;
          if (!told || typeof told.participant !== "string" || typeof told.stop !== "string") {
            say(peer, { t: "error", sentence: "A presence is a participant and a stop." });
            return unchanged();
          }
          const presence = presenceFrom(told, peer.seat, new Date(), peer.participant);
          peer.participant = presence.participant;
          return { ...unchanged(), presence };
        }
        case "bye":
          if (!peer.participant) return unchanged();
          delete peer.participant;
          return { ...unchanged(), presence: null };
        default:
          // A message this server does not know is ignored, never refused (docs/stability.md).
          return unchanged();
      }
    },
    publish(ops, peers) {
      for (const peer of peers) catchUp(peer, ops);
    },
    tell(who, peers) {
      for (const peer of peers) {
        if (peer.cursor === undefined) continue;
        say(peer, { t: "presence", who: wire.whoFor(peer.seat, who.filter((presence) => presence.participant !== peer.participant)) });
      }
    },
    async post(text, asked) {
      const said = answering(asked);
      let body: { calls?: unknown; undo?: unknown; intent?: unknown; batch?: unknown; base?: unknown; via?: unknown };
      try {
        body = text.length === 0 ? {} : (JSON.parse(text) as typeof body);
      } catch {
        return reply(400, { error: "A change is one JSON object: { calls } to make, or { undo } to take back.", reason: "invalid" });
      }
      if (!body || typeof body !== "object") return reply(400, { error: "A change is one JSON object: { calls } to make, or { undo } to take back.", reason: "invalid" });
      const undo = Array.isArray(body.undo) ? (body.undo as string[]) : undefined;
      const change: Change = {
        t: undo ? "undo" : "call",
        calls: !undo && Array.isArray(body.calls) ? (body.calls as MutationCall[]) : [],
        batches: undo ?? [],
        intent: typeof body.intent === "string" && body.intent.length > 0 ? body.intent : undefined,
        batch: body.batch,
        base: undo ? undefined : body.base,
        claimed: claimOfVia(body.via),
      };
      const via = viaFor(asked, change);
      // Sent again after its answer was lost — or offered again on a new declaration, or after a reload (FR-43, FR-44, FR-49): only ever the asker's own ops.
      const claim = wire.claim(change.batch, asked.seat);
      if (claim.refusal) return reply(409, { error: claim.refusal.sentence, refused: true, reason: claim.refusal.reason, ...said });
      if (claim.answered) {
        // Landed, but a flush failed it: flushed again, and answered only once it holds.
        if (unsavedIn(claim.answered)) {
          const flushed = await durable([]);
          if (!("saved" in flushed)) return reply(503, { error: UNSAVED, refused: true, reason: "unavailable", ...said });
          return { ...reply(200, { ops: wire.shown(asked.seat, claim.answered), batch: change.batch, ...said }), landed: flushed.saved };
        }
        return reply(200, { ops: wire.shown(asked.seat, claim.answered), batch: change.batch, ...said });
      }
      /*
       * THE HOST'S LIMITS, BEFORE ANYTHING IS JUDGED. Busy is 429 and the
       * change is kept to send again (FR-45); a hard cap is refused, `limit`,
       * and the change is taken back (FR-46); unavailable is 503, kept.
       */
      const limited = await limitOf(asked.seat, via, change, bytesOf(text));
      if (limited && "refuse" in limited) return reply(413, { error: limited.refuse, refused: true, reason: "limit", ...said });
      if (limited && "unavailable" in limited) return reply(503, { error: limited.unavailable, refused: true, reason: "unavailable", ...said });
      if (limited) {
        const retryAfter = Math.max(0, Math.ceil(limited.retryAfter));
        return reply(429, { error: limited.sentence ?? `The store is busy: send it again in ${retryAfter} ms.`, busy: true, retryAfter }, { "retry-after": String(Math.ceil(retryAfter / 1000)) });
      }
      const landing = await land(asked.seat, via, change);
      // A stale write is a conflict, not a loss (FR-05): theirs and yours, by name, and nothing written.
      if (landing.conflicts) return reply(409, { error: conflictSentence(landing.conflicts), refused: true, conflict: true, conflicts: landing.conflicts, ...said });
      // The policy's own sentence rather than a bare 403, because that sentence is the product.
      if (landing.refusal) {
        const { sentence, ...why } = landing.refusal;
        return reply(409, { error: sentence, refused: true, ...why, ...said });
      }
      // Not durable: refused `unavailable`, which the client keeps and sends again.
      if (!landing.saved) return reply(503, { error: UNSAVED, refused: true, reason: "unavailable", ...said });
      // An act may make what its own seat may not see: that op goes back withheld, as it would on a poll.
      return { ...reply(200, { ops: wire.shown(asked.seat, landing.result.ops), batch: landing.result.batch, ...said }), landed: landing.saved };
    },
    state(asked) {
      const seen = wire.seenFor(asked.seat);
      return reply(200, {
        ...answering(asked),
        snapshot: seen.snapshot(),
        log: seen.log.all(),
        migrated: [...(options.migrated ?? [])],
        enabledModules: wire.enabledModules(),
        ...wire.horizonOf(),
      });
    },
    since(seq, asked) {
      return reply(200, { ops: wire.since(asked.seat, seq), ...answering(asked) });
    },
    declared(peers) {
      for (const peer of peers) {
        if (peer.cursor === undefined) continue;
        delete peer.cursor;
        say(peer, { t: "declaration", version: options.version ?? 1 });
      }
    },
  };
}
