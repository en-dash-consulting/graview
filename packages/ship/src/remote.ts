import {
  FieldRevisions,
  foldPresence,
  PRESENCE_TTL_MS,
  ReceiveError,
  REMOTE_PRESENCE_TTL_MS,
  samePresence,
  Store,
  WIRE_PROTOCOL,
  writtenBy,
  type AnySchema,
  type FieldConflict,
  type FieldRevision,
  type GraviewApp,
  type MutationCall,
  type Operation,
  type Presence,
  type PresenceChannel,
  type Principal,
  type Via,
} from "@graview/core";
import { LIVE_PATH, type LiveClientMessage, type LiveServerMessage } from "./live.js";
import { SEAT_HEADERS } from "./seat-headers.js";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * THE OTHER END OF THE WIRE: a store whose graph lives on a server.
 *
 * The browser still holds a real `Store` — the scene, the strip, the rules
 * and the routed face all read it the way they always have — but it does not
 * own the truth. A call goes to the server, which judges it under this
 * seat's principal and answers with the op it produced; the op lands here by
 * `store.rebase`, under whatever is still pending, with its own id, author
 * and sequence, and the interface updates exactly as it does for a local
 * change.
 *
 * Everyone else's ops arrive the same way: on a poll, or — `live: true` —
 * pushed down a WebSocket the moment they land (FR-05). Two browsers open on
 * the same roster see each other at once, and neither of them has a second
 * way to write the graph.
 *
 * A call carries the revision of every field it changes, as this client
 * last saw it (FR-05). One that somebody else changed meanwhile comes back
 * as a conflict, naming the field, theirs and yours, and the person
 * chooses: keep theirs, or send theirs over with `useMine`. Nothing is
 * overwritten without anybody knowing.
 *
 * Undo is the interesting case and it needed no special handling: `undo`
 * produces ordinary calls, and they go down the same wire and are judged by
 * the same policy — what you may undo is what you may have done, decided on
 * the server rather than trusted from the client.
 */

/** As much of a WebSocket as the live wire needs: the platform's own, or a host's or a test's. */
export interface LiveSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  onclose: ((event: { readonly code: number; readonly reason: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface RemoteOptions<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  /** Where the server is: `http://localhost:5196`, say. */
  readonly url: string;
  /** Who is at this keyboard. Sent with every call; the server judges by it. */
  readonly principal?: Principal;
  /**
   * How often to ask for everybody else's ops, in milliseconds. 0 never asks.
   * A live client polls only while its socket is down.
   */
  readonly pollMs?: number;
  readonly fetch?: typeof fetch;
  readonly storeOptions?: Record<string, unknown>;
  /**
   * Headers sent with every request — a gateway's `authorization`, a
   * tenant, whatever the host in front of `graview serve` asks for. The
   * framework never reads them; the host's `seatOf` does. This is the seam
   * where a hosted store's own auth goes without the framework knowing it.
   */
  readonly headers?: Readonly<Record<string, string>>;
  /** What the calls come through, recorded on each op the server makes: `web` unless said (FR-06). */
  readonly via?: Via;
  /**
   * THE LIVE WIRE (FR-05): hold a WebSocket to the server's `LIVE_PATH`,
   * and have every op pushed down it as it lands. Calls go down it too.
   * While it is down, the client polls and posts as it would without it,
   * and reconnects, catching up from the last op it has.
   */
  readonly live?: boolean;
  /**
   * How to open the socket: the platform's `WebSocket` by default, with the
   * headers where the runtime can send them (Node 22 can; a page cannot,
   * and its seat rides in the query, which only a store trusting seat
   * headers reads).
   */
  readonly socket?: (url: string, headers: Readonly<Record<string, string>>) => LiveSocketLike;
  /** How long `openRemote({ live: true })` waits for the socket's welcome before it opens polling. 3000 by default. */
  readonly openTimeoutMs?: number;
  /**
   * The modules on, for a server that does not say (FR-12). The server's
   * word wins: its state names the set it serves, and an op of its that
   * turns one off or on reaches this client like any other.
   */
  readonly enabledModules?: readonly string[];
}

/** A stale write, as this client is told of it: the fields that moved, and the person's two answers. */
export interface RemoteConflict {
  /** In words: "Ana changed label to “Book the church hall” while you were editing; yours was …" */
  readonly sentence: string;
  readonly conflicts: readonly FieldConflict[];
  /** Leave it as they made it. Nothing more is sent. */
  keepTheirs(): void;
  /** Make the same change again, over theirs: the calls are applied and sent again without the old revisions. */
  useMine(): void;
}

export interface RemoteStore<S extends AnySchema> {
  readonly store: Store<S>;
  /** The server's version, and what opening it had to migrate. */
  readonly version: number;
  readonly migrated: readonly string[];
  /** Send calls to the server and take back the ops it made. Throws the policy's own sentence. */
  send(calls: readonly MutationCall[], options?: { intent?: string; batch?: string }): Promise<readonly Operation[]>;
  /** Ask for everything appended since this browser last looked. */
  pull(): Promise<readonly Operation[]>;
  /**
   * Told when the server refused something this browser had already shown.
   * The change is taken back before the listener runs; what is left is
   * saying so, in the policy's own words. A conflict nobody listens for
   * with `onConflict` is told here too, in its sentence.
   */
  onRefusal(listener: (reason: string) => void): () => void;
  /**
   * Told when a change this browser had already shown was refused as a
   * stale write (FR-05): somebody changed a field it changes since this
   * browser last saw it. The change is taken back first — theirs stands —
   * and the listener is handed the way to put yours over it.
   */
  onConflict(listener: (conflict: RemoteConflict) => void): () => void;
  /** The revision this client knows a field at: the seq of the op that last wrote it, or -1. */
  revision(node: string, field: string): number;
  /** The last op of the server's this client has. */
  seq(): number;
  /** How everybody else's ops reach this client now: pushed down the socket, or on the poll. */
  transport(): "socket" | "poll";
  /**
   * Resolves once every call sent so far has been answered — accepted and
   * landed, or refused and taken back. A browser never waits for this; a
   * host that must report the server's verdict before it exits (an MCP
   * seat, `graview apply`) does.
   */
  settled(): Promise<void>;
  /**
   * WHO IS HERE, over the same poll — or the socket. Saying where you are
   * rides on the next heartbeat and the answer carries everybody else — no
   * round trip of its own, nothing written to the store, the adapter or
   * the log.
   */
  readonly presence: PresenceChannel;
  close(): void;
}

/** A refusal that is a stale write: the server's sentence, and the fields that moved. */
class StaleWrite extends Error {
  constructor(
    message: string,
    readonly conflicts: readonly FieldConflict[],
  ) {
    super(message);
    this.name = "StaleWrite";
  }
}

/**
 * Opens a store from a server and keeps it in step with it.
 *
 * `seed` is deliberately absent: what is on the server is what there is. A
 * client that seeded would be a client that could overwrite everybody's
 * roster by being the first to load.
 */
/** A counter nobody else is using: this client's own, provisional ids. */
function localIds(): () => string {
  const who = Math.random().toString(36).slice(2, 8);
  let at = 0;
  return () => `local-${who}-${++at}`;
}

const OPEN = 1;

export async function openRemote<S extends AnySchema>(options: RemoteOptions<S>): Promise<RemoteStore<S>> {
  const call = options.fetch ?? fetch;
  const headers: Record<string, string> = { "content-type": "application/json", ...(options.headers ?? {}) };
  Object.assign(headers, seatHeaders(options.principal));
  const live = options.live === true;

  const fetchState = async () => {
    const reached = await call(`${options.url}/graview/state`, { headers });
    if (!reached.ok) throw new Error(((await reached.json().catch(() => ({}))) as { error?: string }).error ?? `The server refused (${reached.status})`);
    return (await reached.json()) as {
      version: number;
      snapshot: GraphSnapshot;
      log: Operation[];
      migrated: string[];
      /** Which modules the server has on (FR-12); absent from a server before it. */
      enabledModules?: string[];
      /** Where the server's log begins, when it was compacted (FR-23). */
      horizon?: number;
    };
  };
  const state = await fetchState();
  const enabledModules = state.enabledModules ?? options.enabledModules;

  const store = new Store<S>({
    schema: options.app.schema,
    mutations: options.app.mutations ?? [],
    invariants: options.app.invariants ?? [],
    ...(options.app.policy ? { policy: options.app.policy } : {}),
    ...(options.app.modules ? { modules: options.app.modules } : {}),
    ...(enabledModules ? { enabledModules } : {}),
    ...(options.app.intelligence ? { intelligence: options.app.intelligence } : {}),
    /*
     * The snapshot AND the log: the snapshot is the graph, the log is the
     * history that led to it. Folding the log alone would lose whatever the
     * server was seeded with, which was never an operation.
     */
    snapshot: state.snapshot,
    log: state.log,
    // A compacted server hands over its tail: this log begins where that one does (FR-23).
    ...(state.horizon !== undefined ? { horizon: state.horizon } : {}),
    /*
     * IDS THIS CLIENT CANNOT SHARE WITH ANYBODY.
     *
     * A store's default id is a monotonic counter, which is exactly right
     * for a test and exactly wrong for a second writer: two stores both
     * start at one, so this browser's first optimistic op and the server's
     * first op are both `op1` — and `receive` then drops the server's as
     * one it already had. The change silently never arrived, on whichever
     * browser happened to have acted once.
     *
     * The ops this store mints are PROVISIONAL anyway: the server's own is
     * what stays. Prefixing them says so, and makes the collision
     * impossible rather than unlikely.
     */
    ids: localIds(),
    ...(options.storeOptions ?? {}),
  });

  let seen = state.log.at(-1)?.seq ?? (state.horizon ?? 0) - 1;
  /** Every field's revision as the server's ops this client has say it (FR-05). */
  let revisions = FieldRevisions.of(state.log);

  /*
   * PRESENCE, beside the log and never in it. `mine` is the last word this
   * browser said about itself; it goes out with every poll (or down the
   * socket) while it stands, and what comes back is folded into `known` for
   * whoever is listening.
   */
  let mine: Presence | null = null;
  let known = new Map<string, Presence>();
  const whoListeners = new Set<(who: readonly Presence[]) => void>();
  const heard = (who: readonly Presence[]) => {
    const next = foldPresence(new Map(), who, Date.now(), REMOTE_PRESENCE_TTL_MS, mine?.participant);
    let changed = next.size !== known.size;
    if (!changed) for (const [participant, presence] of next) if (!samePresence(presence, known.get(participant))) changed = true;
    known = next;
    if (!changed) return;
    for (const listener of whoListeners) listener([...known.values()]);
  };

  /*
   * THE LOG READS `[confirmed…, pending…]`. `pending` is this browser's own
   * batches, applied here and not yet answered, oldest first. Whatever
   * arrives from the server lands UNDER them by `store.rebase`: the pending
   * tail is rolled back, the server's ops land in its order, and the
   * pending calls are applied again on top, heard as one change. A batch
   * the server has answered or refused is dropped, so its provisional op
   * never sits in the log beside the server's op for the same press.
   *
   * `provisional` is every batch whose provisional ops may still be in the
   * log: a batch is dropped once, and only while it is, because a live
   * client's batch id is the one the server's op lands in too, and
   * dropping it again would cut the server's op.
   */
  const pending: string[] = [];
  const provisional = new Set<string>();
  const settle = (batch: string) => {
    const at = pending.indexOf(batch);
    if (at >= 0) pending.splice(at, 1);
  };
  /** Socket calls not yet answered, by cid: what was sent, and how to tell the sender. */
  const waiting = new Map<string, { message: LiveClientMessage; mine?: string; resolve(answer: { ops: readonly Operation[]; batch?: string }): void; reject(error: unknown): void }>();
  /** Tells whoever sent a batch the server has now answered, with the ops it landed as. */
  const tellAnswered = (batch: string, ops: readonly Operation[]) => {
    const answered = waiting.get(batch);
    if (!answered) return;
    waiting.delete(batch);
    answered.resolve({ ops: ops.filter((op) => op.batch === batch), batch });
  };
  /** Set while the client takes the server's whole state; what arrives meanwhile waits for it, in order. */
  let resyncing: Promise<void> | undefined;
  let meanwhile: { readonly ops: readonly Operation[]; readonly drop: readonly string[] }[] = [];
  const land = (ops: readonly Operation[], drop: readonly string[] = []): readonly Operation[] => {
    if (ops.length === 0 && drop.length === 0) return [];
    if (resyncing) {
      meanwhile.push({ ops, drop });
      return [];
    }
    /*
     * NEVER NUMBERED OUT OF THE SERVER'S ORDER (FR-53). `rebase` lands each
     * op at the end of this log, so ops that begin past the next seq this
     * client has would be numbered as if the ones between never happened.
     * They begin there when the server compacted past where this client
     * left off: `/graview/since` and the welcome begin at the horizon, and
     * the ops between are in no answer. The client takes the state instead.
     */
    const first = Math.min(...ops.filter((op) => op.seq > seen).map((op) => op.seq));
    if (Number.isFinite(first) && first > seen + 1) {
      meanwhile.push({ ops, drop });
      resync();
      return [];
    }
    /*
     * A live client names the batch its call lands in, so an op of the
     * server's in one of its pending batches IS that batch's answer —
     * pushed, or caught up on after a reconnect, before its ack arrived.
     */
    const echoed = live ? pending.filter((batch) => ops.some((op) => op.batch === batch)) : [];
    const dropping = [...new Set([...drop, ...echoed])].filter((batch) => provisional.has(batch));
    let landed: readonly Operation[];
    try {
      landed = store.rebase({ confirmed: ops, pending: pending.filter((batch) => !echoed.includes(batch)), drop: dropping }).confirmed;
    } catch (error) {
      // An op of the server's that does not fit here: this copy drifted, and is as it was. The server's state is the truth.
      if (!(error instanceof ReceiveError)) throw error;
      meanwhile.push({ ops, drop });
      resync();
      return [];
    }
    for (const batch of echoed) settle(batch);
    if (ops.length > 0) {
      seen = Math.max(seen, ...ops.map((op) => op.seq));
      revisions.note(ops);
    }
    for (const batch of dropping) provisional.delete(batch);
    for (const batch of echoed) tellAnswered(batch, ops);
    return landed;
  };

  /*
   * THE SERVER'S WHOLE STATE, ADOPTED (FR-53): fetched, taken as this
   * store's graph and log by `store.adopt`, and this client's unanswered
   * batches applied again on top. A batch the state already holds (a live
   * client's, landed before its ack came) is answered, not applied twice.
   * What arrived while the state was on its way lands after it; whatever
   * the state already holds is skipped. A state that cannot be fetched
   * leaves the client as it was, and the next answer that cannot land asks
   * again.
   */
  const resync = (): void => {
    if (resyncing) return;
    resyncing = track(
      fetchState()
        .then((next) => {
          const held = new Set(next.log.map((op) => op.batch));
          const answered = pending.filter((batch) => held.has(batch));
          for (const batch of answered) settle(batch);
          const adopted = store.adopt({
            snapshot: next.snapshot as never,
            log: next.log,
            ...(next.horizon !== undefined ? { horizon: next.horizon } : {}),
            pending: [...pending],
            drop: [...provisional].filter((batch) => !pending.includes(batch)),
          });
          // The only provisional ops in the log now are the ones applied again.
          provisional.clear();
          for (const op of adopted.pending) provisional.add(op.batch);
          seen = next.log.at(-1)?.seq ?? (next.horizon ?? 0) - 1;
          revisions = FieldRevisions.of(next.log);
          for (const batch of answered) tellAnswered(batch, next.log);
        })
        .then(
          () => {
            resyncing = undefined;
            const later = meanwhile;
            meanwhile = [];
            for (const { ops, drop } of later) land(ops, drop);
          },
          () => {
            // Not reached, or not adopted: as it was. What waited comes again from `seen`.
            resyncing = undefined;
            meanwhile = [];
          },
        ),
    );
  };

  const since = async (seq: number): Promise<Operation[]> => {
    const response = await call(`${options.url}/graview/since?seq=${seq}`, { headers });
    return ((await response.json()) as { ops: Operation[] }).ops ?? [];
  };

  /** Asks for what is new, and waits for a resync the answer started, so the store is the server's when it returns. */
  const pull = async (): Promise<readonly Operation[]> => {
    const landed = await pulled();
    if (resyncing) await resyncing;
    return landed;
  };
  const pulled = async (): Promise<readonly Operation[]> => {
    if (mine && !socketReady()) {
      const response = await call(`${options.url}/graview/here`, {
        method: "POST",
        headers,
        body: JSON.stringify({ presence: mine, seq: seen }),
      });
      const { who, ops } = (await response.json()) as { who: Presence[]; ops?: Operation[] };
      heard(who ?? []);
      return land(ops ?? []);
    }
    return land(await since(seen));
  };

  /** The server's batch for each provisional one this browser minted, so an undo names what the server has. */
  const batches = new Map<string, string>();
  /** Each provisional batch's post, so an undo of it waits until the server has named it. */
  const answers = new Map<string, Promise<unknown>>();
  /** What each provisional batch asked for, so a conflict's `useMine` can ask again. */
  const asked = new Map<string, { calls: readonly MutationCall[]; intent?: string }>();
  /** Every post not yet answered, so `settled` can wait for the verdicts. */
  const inFlight = new Set<Promise<unknown>>();
  const track = <T>(promise: Promise<T>): Promise<T> => {
    inFlight.add(promise);
    void promise.finally(() => inFlight.delete(promise)).catch(() => {});
    return promise;
  };

  type Body = { calls?: readonly MutationCall[]; undo?: readonly string[]; intent?: string; batch?: string; base?: readonly FieldRevision[] };

  /*
   * `mine` names the provisional batch this post answers, when the call was
   * applied here first: the server's op lands and the provisional one is
   * dropped, in one rebase. `send` never applies first, so its answer
   * lands under whatever is pending.
   */
  const post = async (body: Body, mine?: string): Promise<{ ops: readonly Operation[]; batch?: string }> => {
    const response = await call(`${options.url}/graview/ops`, {
      method: "POST",
      headers,
      // A person at an interface, unless the caller said otherwise (FR-06).
      body: JSON.stringify({ via: options.via ?? "web", ...body }),
    });
    const answer = (await response.json()) as { ops?: Operation[]; batch?: string; error?: string; conflict?: boolean; conflicts?: FieldConflict[] };
    if (!response.ok) {
      // The policy's own sentence, carried across the wire unchanged: a
      // refusal a person can read is the whole point of having one.
      const sentence = answer.error ?? `The server refused (${response.status})`;
      throw answer.conflict ? new StaleWrite(sentence, answer.conflicts ?? []) : new Error(sentence);
    }
    let ops: readonly Operation[] = answer.ops ?? [];
    /*
     * ONE OP NEVER JUMPS ANOTHER. Somebody else's op may have landed on the
     * server between this client's last look and its call: the answer's
     * ops then start past the next seq this client has, and taking them in
     * as they are would number them out of the server's order — and the
     * next poll, asking from past them, would never bring the one between.
     * So the gap is asked for first, and lands with them.
     */
    const first = ops[0]?.seq;
    if (first !== undefined && first > seen + 1) ops = await since(seen);
    if (mine !== undefined) {
      if (answer.batch) batches.set(mine, answer.batch);
      settle(mine);
    }
    land(ops, mine !== undefined ? [mine] : []);
    return { ops: answer.ops ?? [], ...(answer.batch ? { batch: answer.batch } : {}) };
  };

  /* ── THE SOCKET (FR-05) ─────────────────────────────────────────────── */

  let socket: LiveSocketLike | undefined;
  /** Set once the server has said welcome on the socket now open. */
  let welcomed = false;
  let closed = false;
  let attempts = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let counter = 0;
  let saidAt = 0;
  let said: Presence | null = null;
  let opened: () => void = () => {};
  const openedLive = new Promise<void>((done) => {
    opened = done;
  });
  const socketReady = (): boolean => live && welcomed && socket?.readyState === OPEN;
  const say = (message: LiveClientMessage): boolean => {
    if (!socketReady()) return false;
    try {
      socket!.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  };
  const sayWhere = (force = false) => {
    if (!mine || !socketReady()) return;
    if (!force && said && samePresence(mine, said) && Date.now() - saidAt < PRESENCE_TTL_MS / 2) return;
    if (say({ t: "here", presence: mine })) {
      said = mine;
      saidAt = Date.now();
    }
  };

  /** A call down the socket; its answer lands when it comes, in the order the server said it. */
  const viaSocket = (body: Body, mine?: string): Promise<{ ops: readonly Operation[]; batch?: string }> =>
    new Promise((resolve, reject) => {
      const cid = mine ?? `send-${++counter}`;
      const via = options.via ?? "web";
      const message: LiveClientMessage = body.undo
        ? { t: "undo", cid, batches: body.undo, via, ...(body.intent ? { intent: body.intent } : {}), ...(body.batch ? { batch: body.batch } : {}) }
        : { t: "call", cid, calls: body.calls ?? [], via, ...(body.intent ? { intent: body.intent } : {}), ...(body.batch ? { batch: body.batch } : {}), ...(body.base?.length ? { base: body.base } : {}) };
      waiting.set(cid, { message, ...(mine !== undefined ? { mine } : {}), resolve, reject });
      // Not open: it goes when the socket is back, after the welcome has caught this client up.
      say(message);
    });

  /** Down the socket when it is up, over HTTP when it is not. */
  const transmit = (body: Body, mine?: string) => (socketReady() ? viaSocket(body, mine) : post(body, mine));

  const hear = (message: LiveServerMessage) => {
    switch (message.t) {
      case "welcome": {
        welcomed = true;
        attempts = 0;
        land(message.ops ?? []);
        // Whatever was sent and never answered goes again: the server answers a batch it already has with its ops.
        for (const waiter of waiting.values()) say(waiter.message);
        sayWhere(true);
        opened();
        return;
      }
      case "ops":
        land(message.ops ?? []);
        return;
      case "ack": {
        const waiter = waiting.get(message.cid);
        if (!waiter) {
          land(message.ops ?? []);
          return;
        }
        waiting.delete(message.cid);
        if (waiter.mine !== undefined) {
          batches.set(waiter.mine, message.batch);
          settle(waiter.mine);
        }
        land(message.ops ?? [], waiter.mine !== undefined ? [waiter.mine] : []);
        waiter.resolve({ ops: message.ops ?? [], batch: message.batch });
        return;
      }
      case "refused":
      case "conflict": {
        const waiter = waiting.get(message.cid);
        if (!waiter) return;
        waiting.delete(message.cid);
        waiter.reject(message.t === "conflict" ? new StaleWrite(message.sentence, message.conflicts ?? []) : new Error(message.sentence));
        return;
      }
      case "presence":
        heard(message.who ?? []);
        return;
      default:
        return;
    }
  };

  const connect = () => {
    if (closed || !live) return;
    const url = `${options.url.replace(/^http/, "ws").replace(/\/$/, "")}${LIVE_PATH}`;
    const { "content-type": _json, ...carried } = headers;
    let made: LiveSocketLike;
    try {
      made = (options.socket ?? platformSocket)(url, carried);
    } catch {
      return reconnect();
    }
    socket = made;
    welcomed = false;
    made.onopen = () => {
      if (socket !== made) return;
      // From the last op this client has: the welcome brings exactly the ones after it.
      made.send(JSON.stringify({ t: "hello", seq: seen, protocol: WIRE_PROTOCOL } satisfies LiveClientMessage));
    };
    made.onmessage = (event) => {
      if (socket !== made) return;
      let message: LiveServerMessage;
      try {
        message = JSON.parse(String(event.data)) as LiveServerMessage;
      } catch {
        return;
      }
      hear(message);
    };
    made.onclose = () => {
      if (socket !== made) return;
      socket = undefined;
      welcomed = false;
      said = null;
      reconnect();
    };
    made.onerror = () => {
      // The close follows; that is where reconnecting is decided.
    };
  };
  const reconnect = () => {
    if (closed) return;
    const wait = Math.min(10_000, 250 * 2 ** attempts) * (0.75 + Math.random() * 0.5);
    attempts++;
    retry = setTimeout(connect, wait);
  };

  /*
   * APPLIED HERE FIRST, DECIDED THERE.
   *
   * `store.apply` is synchronous — the scene, the strip and the routed face
   * all expect the graph to have moved by the time the press returns — and
   * the network is not. So the local store applies optimistically and the
   * server is told; what comes back is the SERVER's op, which is the one
   * that stays, with the id, author and sequence everybody else will see.
   *
   * And a refusal takes the optimism back. The alternative — leaving the
   * hopeful change on screen and logging the refusal to a console — is the
   * one behaviour that would make this whole design a lie: the interface
   * would be showing a graph the server does not have.
   */
  const appliedAll = store.applyAll.bind(store);
  const undone = store.undo.bind(store);
  const refusals = new Set<(reason: string) => void>();
  const conflictListeners = new Set<(conflict: RemoteConflict) => void>();
  /** Set while `useMine` sends a change again: it goes without the revisions it was refused for. */
  let overriding = false;
  /*
   * A refusal takes the optimism back: the provisional batch is dropped
   * by a rebase, which rolls it back and applies whatever is still pending
   * again on top. Nothing is undone, so nothing is judged a second time
   * and nothing is added to the log: the press simply never happened here,
   * as it never happened there.
   */
  const takeBack = async (batch: string, error: unknown): Promise<void> => {
    const reason = error instanceof Error ? error.message : String(error);
    settle(batch);
    try {
      land([], [batch]);
    } catch {
      // A take-back that cannot run leaves the interface wrong, and
      // saying so is still better than saying nothing.
    }
    const made = asked.get(batch);
    asked.delete(batch);
    /*
     * A stale write means this client is behind: theirs is on the server
     * and not yet here. A socket has already pushed it; a poller asks, so
     * what stands on screen when the person chooses is theirs.
     */
    if (error instanceof StaleWrite && !socketReady()) await pull().catch(() => []);
    if (error instanceof StaleWrite && conflictListeners.size > 0) {
      let chosen = false;
      const conflict: RemoteConflict = {
        sentence: reason,
        conflicts: error.conflicts,
        keepTheirs() {
          chosen = true;
        },
        useMine() {
          if (chosen || !made) return;
          chosen = true;
          overriding = true;
          try {
            store.applyAll(made.calls, made.intent ? { intent: made.intent } : {});
          } finally {
            overriding = false;
          }
        },
      };
      for (const told of conflictListeners) told(conflict);
      return;
    }
    for (const told of refusals) told(reason);
  };
  /*
   * EVERY WAY THE GRAPH CHANGES GOES DOWN THE WIRE. `apply` is one call;
   * `applyAll` is a whole gesture — a seat's plan lands as one batch — and
   * `undo` is a take-back. The first version patched `apply` alone, so a
   * robot's plans and undos stayed in the browser that made them while its
   * single presses travelled: two windows on one roster disagreed about
   * exactly the changes an agent had made.
   */
  store.applyAll = ((calls, applyOptions) => {
    /*
     * What this browser's earlier presses, still pending, wrote: a field
     * one of them changed is this browser's own to change again, not a
     * revision anybody else could have moved.
     */
    const earlier = writtenBy(store.log.all().filter((op) => provisional.has(op.batch)));
    /*
     * As WHOEVER IS AT THIS KEYBOARD, by default.
     *
     * The local store carries the app's policy, so a call with no author is
     * judged as an anonymous human — who, in an app with a policy, may do
     * nothing. Every surface that threads a principal is unaffected; what
     * this fixes is the one that does not, which would otherwise meet a
     * refusal about a person who is not sitting there.
     */
    const result = appliedAll(calls, {
      ...(options.principal ? { author: options.principal } : {}),
      ...applyOptions,
    });
    pending.push(result.batch);
    provisional.add(result.batch);
    asked.set(result.batch, { calls, ...(applyOptions?.intent ? { intent: applyOptions.intent } : {}) });
    // The revision of each field this changes, as this browser saw it — unless the person chose theirs over it.
    const base = overriding ? [] : revisions.baseFor(result.ops, earlier);
    answers.set(
      result.batch,
      track(
        transmit(
          {
            calls,
            ...(applyOptions?.intent ? { intent: applyOptions.intent } : {}),
            ...(live ? { batch: result.batch } : {}),
            ...(base.length > 0 ? { base } : {}),
          },
          result.batch,
        ).catch((error: unknown) => takeBack(result.batch, error)),
      ),
    );
    return result;
  }) as typeof store.applyAll;
  // `apply` is `applyAll` of one — and it must go through the patched one.
  store.apply = ((callMade, applyOptions) => store.applyAll([callMade], applyOptions)) as typeof store.apply;
  store.undo = ((batchIds, undoOptions) => {
    const ids = typeof batchIds === "string" ? [batchIds] : batchIds;
    /*
     * A provisional batch the server has answered is not in this log any
     * more: the server's op for it is. So it is undone by the name it
     * became, here as there.
     */
    const result = undone(
      ids.map((id) => batches.get(id) ?? id),
      {
        ...(options.principal ? { author: options.principal } : {}),
        ...undoOptions,
      },
    );
    pending.push(result.batch);
    provisional.add(result.batch);
    /*
     * Named as the server knows them: a provisional batch by the one it
     * became, once the server has said what that is.
     */
    const before = Promise.allSettled(ids.map((id) => answers.get(id)));
    answers.set(
      result.batch,
      track(
        before
          .then(() =>
            transmit(
              {
                undo: ids.map((id) => batches.get(id) ?? id),
                ...(undoOptions?.intent ? { intent: undoOptions.intent } : {}),
                ...(live ? { batch: result.batch } : {}),
              },
              result.batch,
            ),
          )
          .catch((error: unknown) => takeBack(result.batch, error)),
      ),
    );
    return result;
  }) as typeof store.undo;

  const send = async (
    calls: readonly MutationCall[],
    sending: { intent?: string; batch?: string } = {},
  ): Promise<readonly Operation[]> => (await track(transmit({ calls, ...sending }))).ops;

  const presence: PresenceChannel = {
    here(next) {
      mine = next;
      sayWhere();
    },
    onWho(listener) {
      whoListeners.add(listener);
      return () => {
        whoListeners.delete(listener);
      };
    },
    leave() {
      if (!mine) return;
      const body = JSON.stringify({ participant: mine.participant });
      mine = null;
      if (say({ t: "bye" })) return;
      // A page on its way out gets one shot; a beacon is what survives it.
      const beacon = (globalThis as { navigator?: { sendBeacon?: (url: string, body: string) => boolean } }).navigator?.sendBeacon;
      if (beacon) beacon.call((globalThis as { navigator?: unknown }).navigator, `${options.url}/graview/leave`, body);
      else void call(`${options.url}/graview/leave`, { method: "POST", headers, body }).catch(() => {});
    },
  };

  const every = options.pollMs ?? 800;
  const timer =
    every > 0 && typeof setInterval === "function"
      ? setInterval(() => {
          // A live client hears everything on its socket; it polls only while that is down.
          if (socketReady()) return;
          void pull().catch(() => {
            // A poll that cannot reach the server is a poll that will try
            // again; throwing here would take the interface down with the
            // connection.
          });
        }, every)
      : null;

  if (live) {
    connect();
    let waited: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([openedLive, new Promise<void>((done) => (waited = setTimeout(done, options.openTimeoutMs ?? 3000)))]);
    clearTimeout(waited);
  }

  return {
    store,
    version: state.version,
    migrated: state.migrated ?? [],
    send,
    pull,
    onRefusal(listener) {
      refusals.add(listener);
      return () => refusals.delete(listener);
    },
    onConflict(listener) {
      conflictListeners.add(listener);
      return () => conflictListeners.delete(listener);
    },
    revision: (node, field) => revisions.of(node, field),
    seq: () => seen,
    transport: () => (socketReady() ? "socket" : "poll"),
    async settled() {
      // Whatever is in flight now — and whatever a settling handler put in flight after it.
      while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
    },
    presence,
    close() {
      if (timer) clearInterval(timer);
      presence.leave();
      closed = true;
      if (retry) clearTimeout(retry);
      const was = socket;
      socket = undefined;
      welcomed = false;
      try {
        was?.close(1000, "Closed.");
      } catch {
        // Already gone.
      }
    },
  };

  /** The platform's WebSocket, with the headers where the runtime can send them. */
  function platformSocket(url: string, carried: Readonly<Record<string, string>>): LiveSocketLike {
    const Socket = (globalThis as { WebSocket?: new (url: string, init?: unknown) => LiveSocketLike }).WebSocket;
    if (!Socket) throw new Error("This runtime has no WebSocket; the client polls instead.");
    const page = typeof (globalThis as { document?: unknown }).document !== "undefined";
    if (!page) {
      try {
        return new Socket(url, { headers: carried });
      } catch {
        // A runtime whose WebSocket takes protocols only: the seat rides in the query, as a page's does.
      }
    }
    const withSeat = new URL(url);
    for (const [name, value] of Object.entries(seatHeaders(options.principal))) withSeat.searchParams.set(name, value);
    return new Socket(withSeat.toString());
  }
}

/**
 * A principal as the headers a TRUSTED server reads (`trustSeatHeaders`):
 * who, as what, by what name, and for whom. A server that does not trust
 * headers ignores every one of them and asks its own `seatOf`.
 */
export function seatHeaders(principal: Principal | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!principal) return headers;
  if (principal.id) headers[SEAT_HEADERS.seat] = principal.id;
  if (principal.roles?.length) headers[SEAT_HEADERS.roles] = principal.roles.join(",");
  if (principal.kind !== "human") headers[SEAT_HEADERS.kind] = principal.kind;
  if (principal.name) headers[SEAT_HEADERS.name] = encodeURIComponent(principal.name);
  const person = principal.onBehalfOf;
  if (person?.id) headers[SEAT_HEADERS.for] = person.id;
  if (person?.roles?.length) headers[SEAT_HEADERS.forRoles] = person.roles.join(",");
  if (person?.name) headers[SEAT_HEADERS.forName] = encodeURIComponent(person.name);
  return headers;
}
