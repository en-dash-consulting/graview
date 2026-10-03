import {
  FieldRevisions,
  hidesFrom,
  isUnset,
  participantKey,
  redact,
  seenBy,
  seesId,
  WIRE_PROTOCOL,
  type AnySchema,
  type FieldConflict,
  type FieldRevision,
  type MutationCall,
  type Operation,
  type Presence,
  type Principal,
  type Store,
} from "@graview/core";
import { conflictSentence, LIVE_WIRE, type LiveClientMessage, type LiveServerMessage } from "./live.js";

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
  /** Its presence key, once it has said where it is; built from the seat, never taken from the client. */
  participant?: string;
  /** The build its hello said it runs (FR-44): the client's word, kept for the host to count, never judged. */
  build?: string;
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

/**
 * A PRESENCE AS THE SERVER BUILDS IT. Keyed by the seat — a client cannot
 * claim to be somebody else — with only the session taken from what it
 * said, and stamped with the server's clock.
 */
export function presenceFrom(told: Presence, seat: Principal, now: Date = new Date()): Presence {
  // The session is what follows the seat's own `kind:id:` — an id may hold a colon (`shopper:bethan`).
  const own = `${seat.kind}:${seat.id ?? ""}:`;
  const session = told.participant.startsWith(own) ? told.participant.slice(own.length) : (told.participant.split(":").at(-1) ?? "");
  const participant = seat.id ? participantKey({ kind: seat.kind, id: seat.id, session }) : told.participant;
  return { ...told, participant, at: now.toISOString() };
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
  /** `{ horizon }` when the log was compacted (FR-23); nothing otherwise. */
  horizonOf(): { horizon?: number };
  enabledModules(): string[];
}

export function wireOf<S extends AnySchema>(store: Store<S>): Wire<S> {
  const sighted = (principal: Principal): boolean => hidesFrom(store, principal);
  const shown = (principal: Principal, ops: readonly Operation[]): Operation[] => (sighted(principal) ? redact(ops, seesId(store, principal)) : [...ops]);
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
    whoFor: (principal, who) => (sighted(principal) ? presenceSeenBy(who, seesId(store, principal)) : [...who]),
    horizonOf: () => (store.log.horizon > 0 ? { horizon: store.log.horizon } : {}),
    enabledModules: () => [...store.modules.enabled].sort(),
    conflictsOf(author, calls, base) {
      if (!Array.isArray(base) || base.length === 0) return [];
      const sees = sighted(author) ? seesId(store, author) : () => true;
      // A record the seat may not see is not there to have moved: the call itself is refused for naming it.
      const claimed = (base as FieldRevision[]).filter(
        (entry) => entry && typeof entry.node === "string" && typeof entry.field === "string" && typeof entry.rev === "number" && sees(entry.node),
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
        const seen = wrote && sighted(author) ? redact([wrote], sees)[0] : wrote;
        return {
          node: entry.node,
          field: entry.field,
          theirs: (store.graph.getNode(entry.node) as Record<string, unknown> | undefined)?.[entry.field],
          yours: yours.get(`${entry.node}\u0000${entry.field}`),
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
    const batch = typeof message.batch === "string" && message.batch.length > 0 ? message.batch : undefined;
    catchUp(peer);
    /*
     * SENT TWICE, ANSWERED ONCE. A client that lost its socket before the
     * ack sends the call again under the same batch; one already in the
     * log is answered with the ops it made.
     */
    const already = batch ? store.log.all().filter((op) => op.batch === batch) : [];
    if (already.length > 0) {
      say(peer, { t: "ack", cid, seq: already.at(-1)!.seq, batch: batch!, ops: wire.shown(author, already) });
      return { cursor: peer.cursor! };
    }
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
      const applying = { author, via: peer.via, ...(intent ? { intent } : {}), ...(batch ? { batch } : {}) };
      result = message.t === "undo" ? store.undo(Array.isArray(message.batches) ? message.batches : [], applying) : store.applyAll(calls, applying);
    } catch (error) {
      say(peer, { t: "refused", cid, sentence: error instanceof Error ? error.message : String(error) });
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
          const said = { protocol: WIRE_PROTOCOL, wire: LIVE_WIRE, version: options.version ?? 1, ...(options.build ? { build: options.build } : {}) };
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
        case "undo":
          if (peer.cursor === undefined) {
            say(peer, { t: "refused", cid: String(message.cid ?? ""), sentence: "Say hello first: the live wire answers calls once it knows what the client has." });
            return {};
          }
          return answer(peer, message);
        case "here": {
          const told = message.presence;
          if (!told || typeof told.participant !== "string" || typeof told.stop !== "string") {
            say(peer, { t: "error", sentence: "A presence is a participant and a stop." });
            return unchanged();
          }
          const presence = presenceFrom(told, peer.seat);
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
