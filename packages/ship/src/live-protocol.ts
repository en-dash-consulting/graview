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
import { bytesOf, conflictSentence, LIVE_WIRE, type Limit, type LiveClientMessage, type LiveServerMessage } from "./live.js";

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
  /** Resolves once what landed is durable: an ack waits for it. */
  readonly flush?: () => Promise<void>;
  /** The host's build, an opaque string said in every welcome (FR-44): a client on another one is told once and keeps working. */
  readonly build?: string;
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
  /** The state a socket starts with: its seat and its channel, and no cursor until it says hello. */
  open(seat: Principal, via: string): LiveSocketState;
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
   * THE DECLARATION CHANGED (FR-43), and this protocol is the one over the
   * store migrated to it. Every socket that has said hello is told
   * `{ t: "declaration", version }` and its cursor is forgotten: a seq of
   * the old store means nothing on the new one, so nothing is pushed and
   * no call is served until it says hello again. The host keeps the
   * cursors as it keeps them after `receive`.
   */
  declared(peers: Iterable<LivePeer>): void;
}

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

  /** Every op this socket has not been sent, down it now, as its seat sees them. */
  const catchUp = (peer: LivePeer, ops?: readonly Operation[]): void => {
    if (peer.cursor === undefined) return;
    const last = wire.lastSeq();
    if (peer.cursor >= last) return;
    const from = peer.cursor + 1;
    // The ops handed in, when they are the whole of what this peer is missing; the log otherwise.
    const after = ops && ops.length > 0 && ops[0]!.seq <= from && ops.at(-1)!.seq === last ? ops.filter((op) => op.seq >= from) : store.log.opsFrom(from);
    peer.cursor = last;
    if (after.length > 0) say(peer, { t: "ops", seq: last, ops: wire.shown(peer.seat, after) });
  };

  /** A call or an undo from a socket: judged as its seat, exactly as `POST /graview/ops` judges it. */
  const answer = async (peer: LivePeer, message: Extract<LiveClientMessage, { t: "call" | "undo" }>): Promise<LiveReceived> => {
    const cid = typeof message.cid === "string" ? message.cid : "";
    const author = peer.seat;
    const intent = typeof message.intent === "string" && message.intent.length > 0 ? message.intent : undefined;
    catchUp(peer);
    const batch = typeof message.batch === "string" && message.batch.length > 0 ? message.batch : mintServed(message.t === "undo" ? "undo" : "batch");
    const calls = message.t === "call" && Array.isArray(message.calls) ? message.calls : [];
    if (message.t === "call") {
      const conflicts = wire.conflictsOf(author, calls, message.base);
      if (conflicts.length > 0) {
        say(peer, { t: "conflict", cid, sentence: conflictSentence(conflicts), conflicts });
        return { cursor: peer.cursor! };
      }
    }
    let result: { readonly ops: readonly Operation[]; readonly batch: string };
    try {
      // The channel is the seat's, as the host said it when the socket opened: a client's own `via` is never read (FR-52).
      const applying = { author, via: peer.via, ...(intent ? { intent } : {}), batch };
      result = message.t === "undo" ? store.undo(Array.isArray(message.batches) ? message.batches : [], applying) : store.applyAll(calls, applying);
    } catch (error) {
      say(peer, { t: "refused", cid, ...refusalOf(error) });
      return { cursor: peer.cursor! };
    }
    // Every op before this call's went down this socket before it landed; its own go in the ack.
    peer.cursor = wire.lastSeq();
    const ops = wire.shown(author, result.ops);
    await options.flush?.();
    say(peer, { t: "ack", cid, seq: ops.at(-1)?.seq ?? peer.cursor, batch: result.batch, ops });
    return { cursor: peer.cursor, landed: result.ops };
  };

  return {
    store,
    open: (seat, via) => ({ seat, via }),
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
          if (typeof message.build === "string" && message.build.length > 0) peer.build = message.build.slice(0, 64);
          const seq = typeof message.seq === "number" && Number.isFinite(message.seq) ? message.seq : undefined;
          peer.cursor = wire.lastSeq();
          // Its own key, built from the seat, so the client can leave itself out of who is here (FR-47).
          peer.participant ??= participantKey({ kind: peer.seat.kind, ...(peer.seat.id ? { id: peer.seat.id } : {}), session: mintSession() });
          const participant = peer.participant;
          const said = { protocol: WIRE_PROTOCOL, wire: LIVE_WIRE, version: options.version ?? 1, participant, ...(options.build ? { build: options.build } : {}) };
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
           * BUSY IS NOT REFUSED (FR-45). A call made after one that was told
           * to wait waits too, whatever the rate says now: the client sends
           * them again in the order it made them, the held one first.
           */
          /*
           * SENT AGAIN AFTER IT LANDED: answered with what it made, before the
           * host is asked anything. A call whose ack was lost is never told
           * busy, capped or unavailable for a change already made — and only
           * ever with the asking seat's own ops (`claim`).
           */
          const claim = wire.claim(message.batch, peer.seat);
          if (claim.refusal || claim.answered) {
            catchUp(peer);
            if (peer.held?.cid === cid) delete peer.held;
            if (claim.refusal) say(peer, { t: "refused", cid, ...claim.refusal });
            else say(peer, { t: "ack", cid, seq: claim.answered!.at(-1)!.seq, batch: message.batch!, ops: wire.shown(peer.seat, claim.answered!) });
            return { cursor: peer.cursor };
          }
          const now = Date.now();
          if (peer.held && peer.held.cid !== cid) {
            say(peer, { t: "busy", cid, retryAfter: Math.max(0, peer.held.until - now) });
            return { cursor: peer.cursor };
          }
          const limited = options.limit
            ? await options.limit({
                seat: peer.seat,
                via: peer.via,
                t: message.t,
                bytes: bytesOf(text),
                calls: message.t === "call" && Array.isArray(message.calls) ? message.calls : [],
              })
            : undefined;
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
          return answer(peer, message);
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
    declared(peers) {
      for (const peer of peers) {
        if (peer.cursor === undefined) continue;
        delete peer.cursor;
        say(peer, { t: "declaration", version: options.version ?? 1 });
      }
    },
  };
}
