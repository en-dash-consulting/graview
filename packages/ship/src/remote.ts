import {
  FieldRevisions,
  foldPresence,
  ReceiveError,
  refusalOf,
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
  type WireRefusal,
} from "@graview/core";
import type { StorageLike } from "./browser-adapter.js";
import { LIVE_PATH, LIVE_SUBPROTOCOL, LIVE_WIRE, type LiveClientMessage, type LiveServerMessage } from "./live.js";
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
  /**
   * What the calls come through: `web` unless said (FR-06). Sent as
   * `SEAT_HEADERS.via`, which a server believes exactly where it believes
   * the seat headers; a server that asks its own `seatOf` says the channel
   * itself (FR-52).
   */
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
  readonly socket?: (url: string, headers: Readonly<Record<string, string>>, protocols: readonly string[]) => LiveSocketLike;
  /**
   * ASK FOR SHIP'S CODEC BY NAME (FR-44): the platform socket sends
   * `LIVE_SUBPROTOCOL` as its WebSocket subprotocol. Off by default,
   * because a browser fails the handshake with a server that does not
   * answer it; `serveStore` answers it, and a Worker answers it with
   * `liveSubprotocol(request)`. A `socket` factory is handed the same
   * list and decides itself. `hello.wire` names the codec either way.
   */
  readonly subprotocol?: boolean;
  /**
   * THE DECLARATION A VERSION NAMES (FR-43). Told `{ t: "declaration" }`,
   * or welcomed on a version other than the one it opened on, the client
   * asks this for the app at the server's version and opens again on it:
   * `onDeclaration` hands over the new remote store, and the calls still
   * on the way are offered again under it, or refused in words. The host
   * says how: a TS app imports its next declaration, a document-declared
   * app fetches and compiles its document. Absent, the client reloads the
   * page as `reload` does, carrying what it had not sent.
   */
  readonly resolveApp?: (version: number) => GraviewApp<AnySchema> | Promise<GraviewApp<AnySchema>>;
  /**
   * THE HOST'S POLICY, IN THE BROWSER TOO. A call is judged here before the
   * server is asked, under the app this store is built from; a host whose
   * own store judges by more than the declaration says — Graview Cloud adds
   * a sight, an app's owners see everything — shapes that app here the same
   * way, or the browser refuses what the server would allow. Applied to
   * `app` and to every app `resolveApp` gives. The server judges regardless:
   * this only keeps the two in agreement.
   */
  readonly localApp?: (app: GraviewApp<AnySchema>) => GraviewApp<AnySchema>;
  /**
   * THE HOST'S BUILD THIS PAGE RUNS (FR-44), an opaque string said in
   * `hello`. A server on another build keeps serving it; `onBuild` is told
   * once, so the page can offer a reload when it suits the person.
   */
  readonly build?: string;
  /**
   * WHERE UNSENT CALLS WAIT ACROSS A RELOAD (FR-44). When the server
   * answers `reload`, every call not yet answered is written to `storage`
   * under `key`, and the next `openRemote` with the same key offers them
   * again once it is open. `sessionStorage` in a page, a `Map` in a test.
   * Without it they are refused in words before the page reloads.
   */
  readonly carry?: { readonly storage: StorageLike; readonly key: string };
  /** How to reload the page when the server asks: `location.reload()` in a page by default. */
  readonly reloadPage?: () => void;
  /** How long `openRemote({ live: true })` waits for the socket's welcome before it opens polling. 3000 by default. */
  readonly openTimeoutMs?: number;
  /**
   * The modules on, for a server that does not say (FR-12). The server's
   * word wins: its state names the set it serves, and an op of its that
   * turns one off or on reaches this client like any other.
   */
  readonly enabledModules?: readonly string[];
  /**
   * How long to wait before each attempt to open the socket again (FR-49):
   * a function of the attempt (0 first, reset once a socket is welcomed)
   * that answers in milliseconds, or `{ min, max, factor }` for the
   * jittered exponential default — `min * factor ** attempt`, at most
   * `max`, give or take a quarter. 250, 10000 and 2 unless said.
   */
  readonly backoff?: RemoteBackoff;
  /**
   * A HEARTBEAT DOWN THE SOCKET, opted into, in milliseconds (FR-49). A
   * server holds a socket's presence for as long as the socket is open
   * (`held: "socket"`), so by default the socket says `here` only when where
   * this client stands changes — an idle tab says nothing, and a host that
   * hibernates is not woken for it. Given, an unchanged presence is said
   * again on the heartbeat, no oftener than this: for a host that still
   * keeps a socket's presence by time. A polling client says it with every
   * poll whatever this says, so `pollMs` paces it.
   */
  readonly presenceEveryMs?: number;
  /**
   * Whether anybody is looking (FR-49). While it answers false, this
   * client's presence is not said — on the socket or the poll — and lapses
   * where others see it. In a page it is `document.visibilityState` unless
   * said; where there is no document, always true.
   */
  readonly visible?: () => boolean;
}

/** How a client is reaching its server now (FR-49): not yet, yes, or not at the moment. */
export type RemoteStatus = "connecting" | "online" | "offline";

/** What happened to a client since it opened, as counts for a host's beacon (FR-49). */
export interface RemoteCounters {
  /** Times it was offline and came back online. */
  readonly reconnects: number;
  /** Times the server's ops landed under calls of this client's still pending. */
  readonly rebases: number;
  /** Stale writes: calls of this client's refused because a field moved since it last saw it. */
  readonly conflicts: number;
  /** Times it could not catch up and took the server's whole state (FR-53). */
  readonly resyncs: number;
}

/** A reconnect delay (FR-49): the attempt's own, in ms, or the bounds of the jittered default. */
export type RemoteBackoff = ((attempt: number) => number) | { readonly min?: number; readonly max?: number; readonly factor?: number };

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
   *
   * The second argument says why as a code a program can branch on
   * (FR-46): `forbidden`, `missing`, `invalid` or `limit`, with `wouldNeed`
   * when the policy knows who could. Busy is never told here: a change the
   * host asked to wait is kept, and sent again (FR-45).
   */
  onRefusal(listener: (sentence: string, refusal: RemoteRefusal) => void): () => void;
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
  /**
   * THIS CLIENT'S OWN KEY in who is here, as the server built it from the
   * seat (FR-47): said in the socket's welcome, or in the answer to a poll's
   * `here`. Undefined until one of them has, or from a server before it.
   * Who is here, as `presence` tells it, never includes it.
   */
  participant(): string | undefined;
  /** How everybody else's ops reach this client now: pushed down the socket, or on the poll. */
  transport(): "socket" | "poll";
  /**
   * Whether the server is being reached (FR-49). `online` once a welcome or
   * an answer has landed; `offline` while a socket that was welcomed is down
   * and nothing has been heard since, or when a poll or a call does not
   * reach the server. A live client is `connecting` until its socket is
   * welcomed or its first poll lands. An answer that refuses is an answer:
   * the server was reached.
   */
  status(): RemoteStatus;
  /** Told each time the status changes — the offline banner's switch. Returns the way to stop listening. */
  onStatus(listener: (status: RemoteStatus) => void): () => void;
  /** How often this client reconnected, rebased, met a conflict and resynced — counts only. */
  counters(): RemoteCounters;
  /**
   * The calls sent and not yet answered: shown here and waiting for the
   * server's verdict. A call made while the server cannot be reached counts
   * here until it is back and has answered; it is not taken back meanwhile.
   */
  pending(): number;
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
   * the log. Its `onWho` tells a listener added late who is here already,
   * at once, as `onBuild` does.
   */
  readonly presence: PresenceChannel;
  /** Who else is here now, as this client was last told: never itself. */
  who(): readonly Presence[];
  /**
   * THE DECLARATION CHANGED ON THE SERVER (FR-43): handed a new remote
   * store, opened on the server's migrated state under the app
   * `resolveApp` gave for `version`, with this one's unanswered calls
   * offered again on it. This one is closed: mount the new one. A call
   * that no longer fits is told on `onRefusal`, in words.
   *
   * THE HOST'S WIRING GOES WITH IT. Every listener put on this store —
   * `onRefusal`, `onConflict`, `onStatus`, `onBuild`, `presence.onWho` and
   * `onDeclaration` itself — is carried to the new one, and to each after
   * it, and `counters()` run on rather than starting again; the way to stop
   * listening a host was handed stops it on whichever store is current. So
   * a host writes its listeners once: one added again on the new store is
   * told twice.
   */
  onDeclaration(listener: (next: RemoteStore<AnySchema>, version: number) => void): () => void;
  /**
   * THE SERVER RUNS ANOTHER BUILD (FR-44): told once, with its build, when
   * its welcome names one other than `build`. A listener added after it
   * was noticed is told at once. The client keeps working.
   */
  onBuild(listener: (build: string) => void): () => void;
  close(): void;
}

/** A call on its way, as it is carried to a store on a new declaration or across a reload (FR-43, FR-44). */
interface Carried {
  readonly calls: readonly MutationCall[];
  readonly intent?: string;
  /** The batch it was sent in: a server that already has it answers with its ops rather than making it again. */
  readonly batch?: string;
  /** What it claimed to come through — `view:<name>` — sent as a claim the server may believe or not. */
  readonly via?: Via;
}

/** A call this client let go of for a new declaration or a reload: not refused, so nothing is taken back or said. */
class Superseded extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Superseded";
  }
}

/** "rename (Version 2 has no …)": a call that no longer fits, named in a sentence. */
const named = (carried: Carried, error: unknown): string =>
  `${carried.calls.map((call) => call.name.replace(/-/g, " ")).join(", ")} (${error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error)})`;

/** Calls kept across a reload, as the next page reads them: read once, then forgotten. */
function takeCarried(carry: RemoteOptions<AnySchema>["carry"]): Carried[] {
  if (!carry) return [];
  try {
    const raw = carry.storage.getItem(carry.key);
    if (raw === null) return [];
    carry.storage.removeItem(carry.key);
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((one): one is Carried => !!one && Array.isArray((one as Carried).calls)) : [];
  } catch {
    return [];
  }
}

/** A refusal as the client is told it: the reason, the sentence and who could (FR-46). */
export type RemoteRefusal = WireRefusal;

/**
 * WHAT `send` THROWS, AND WHAT A TAKEN-BACK CHANGE WAS REFUSED WITH: the
 * server's sentence as the message, and `refusal` for a program to branch
 * on (FR-46).
 */
export class RemoteRefusedError extends Error {
  constructor(readonly refusal: RemoteRefusal) {
    super(refusal.sentence);
    this.name = "RemoteRefusedError";
  }
}

/** A server before FR-46 says no reason: read one from the status it answered with. */
const REASON_BY_STATUS: Readonly<Record<number, RemoteRefusal["reason"]>> = { 401: "forbidden", 403: "forbidden", 404: "missing", 413: "limit" };

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

/** A request that never reached the server: the network refused it, or a gateway said the server is away. */
class Unreached extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Unreached";
  }
}

/** What a gateway in front of a server says when the server behind it is not there. */
const AWAY = new Set([502, 503, 504]);

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

/*
 * THE HOST'S WIRING, carried from a remote store to each one that replaces
 * it on a new declaration (FR-43): every listener a host put on the first,
 * the counters, and the build already noticed. A host writes its listeners
 * once; an unsubscribe it was handed stops them on whichever store is
 * current.
 */
interface Wiring {
  readonly refusals: Set<(sentence: string, refusal: RemoteRefusal) => void>;
  readonly conflicts: Set<(conflict: RemoteConflict) => void>;
  readonly statuses: Set<(status: RemoteStatus) => void>;
  readonly builds: Set<(build: string) => void>;
  readonly who: Set<(who: readonly Presence[]) => void>;
  readonly declarations: Set<(next: RemoteStore<AnySchema>, version: number) => void>;
  readonly tally: { reconnects: number; rebases: number; conflicts: number; resyncs: number };
  /** The status the listeners were last told, so a store that replaces another does not tell them `online` again. */
  told?: RemoteStatus;
  /** Another build, once noticed: told once across every store. */
  otherBuild?: string;
}

const freshWiring = (): Wiring => ({
  refusals: new Set(),
  conflicts: new Set(),
  statuses: new Set(),
  builds: new Set(),
  who: new Set(),
  declarations: new Set(),
  tally: { reconnects: 0, rebases: 0, conflicts: 0, resyncs: 0 },
});

export async function openRemote<S extends AnySchema>(options: RemoteOptions<S>): Promise<RemoteStore<S>> {
  return (await opening(options, takeCarried(options.carry), "This app was updated while your changes were on the way.", freshWiring())).remote;
}

/**
 * The remote store, and what the store it replaces needs from it: the
 * sentences about carried calls nobody has heard yet, for it to tell
 * when the new store's own listeners are not there (FR-43).
 */
async function opening<S extends AnySchema>(
  options: RemoteOptions<S>,
  offered: readonly Carried[],
  lostSaid: string,
  wiring: Wiring,
): Promise<{ remote: RemoteStore<S>; unheard(): RemoteRefusal[] }> {
  const call = options.fetch ?? fetch;
  const headers: Record<string, string> = { "content-type": "application/json", ...(options.headers ?? {}) };
  // Who, and through what: a claim only a server that trusts the seat headers believes (FR-06, FR-52).
  const seat = { ...seatHeaders(options.principal), [SEAT_HEADERS.via]: options.via ?? "web" };
  Object.assign(headers, seat);
  const live = options.live === true;
  /** Undefined: the socket says `here` only on a change, because the server holds it while the socket is open. */
  const presenceEveryMs = options.presenceEveryMs;
  const visible = options.visible ?? pageVisible;

  /*
   * WHETHER THE SERVER IS BEING REACHED (FR-49), for a host's banner. Every
   * request after the first goes through `reach`, which says so either way;
   * the socket says so on its welcome and when a welcomed socket drops.
   */
  let status: RemoteStatus = "connecting";
  const statusListeners = wiring.statuses;
  const tally = wiring.tally;
  /** Calls that could not reach the server, each waiting to be sent again once it is back. */
  const held: { again(): void; give(error: unknown): void }[] = [];
  const become = (next: RemoteStatus) => {
    if (next === status || retiring) return;
    if (status === "offline" && next === "online") tally.reconnects++;
    status = next;
    // A store that replaced another and comes online says nothing its listeners were not already told.
    if (wiring.told !== next) {
      wiring.told = next;
      for (const told of [...statusListeners]) told(next);
    }
    if (next === "online") for (const waiting of held.splice(0)) waiting.again();
  };
  const reach = async (url: string, init: RequestInit): Promise<Response> => {
    let response: Response;
    try {
      response = await call(url, init);
    } catch (error) {
      // A live client whose socket is up is reaching the server, whatever one request met.
      if (!socketReady()) become("offline");
      throw new Unreached(error instanceof Error ? error.message : String(error));
    }
    if (AWAY.has(response.status)) {
      if (!socketReady()) become("offline");
      throw new Unreached(`The server is away (${response.status})`);
    }
    become("online");
    return response;
  };

  const fetchState = async (first = false) => {
    const url = `${options.url}/graview/state`;
    const reached = first ? await call(url, { headers }) : await reach(url, { headers });
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
      /** The host's build (FR-44); absent from a server before it, or a host that says none. */
      build?: string;
    };
  };
  const state = await fetchState(true);
  // A polling client has its first answer; a live one is connecting until its socket is welcomed.
  if (!live) status = "online";
  const enabledModules = state.enabledModules ?? options.enabledModules;

  // The app as the host judges it (`localApp`), so the browser refuses only what the server would.
  const app = (options.localApp ? options.localApp(options.app as unknown as GraviewApp<AnySchema>) : options.app) as unknown as GraviewApp<S>;
  const store = new Store<S>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(app.policy ? { policy: app.policy } : {}),
    ...(app.modules ? { modules: app.modules } : {}),
    ...(enabledModules ? { enabledModules } : {}),
    ...(app.intelligence ? { intelligence: app.intelligence } : {}),
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
  /** The key the server holds this client under, as its welcome or its last `here` said (FR-47). */
  let self: string | undefined;
  let known = new Map<string, Presence>();
  const whoListeners = wiring.who;
  /** Set when a list of who is here arrives; read when a dropped socket's held presences lapse. */
  let heardWho = false;
  const heard = (who: readonly Presence[]) => {
    if (retiring) return;
    heardWho = true;
    const next = foldPresence(new Map(), who, Date.now(), REMOTE_PRESENCE_TTL_MS, mine?.participant);
    // Never yourself, under the key you made or the one the server built for you.
    if (self !== undefined) next.delete(self);
    let changed = next.size !== known.size;
    if (!changed) for (const [participant, presence] of next) if (!samePresence(presence, known.get(participant))) changed = true;
    known = next;
    if (!changed) return;
    for (const listener of [...whoListeners]) listener([...known.values()]);
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
   * log: a batch is dropped once, and only while it is, because a
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
     * A client names the batch its call lands in (FR-49), so an op of the
     * server's in one of its pending batches IS that batch's answer —
     * pushed, polled, or caught up on after a reconnect, before its answer arrived.
     */
    const echoed = pending.filter((batch) => ops.some((op) => op.batch === batch));
    const dropping = [...new Set([...drop, ...echoed])].filter((batch) => provisional.has(batch));
    let landed: readonly Operation[];
    const under = pending.filter((batch) => !echoed.includes(batch));
    try {
      landed = store.rebase({ confirmed: ops, pending: under, drop: dropping }).confirmed;
    } catch (error) {
      // An op of the server's that does not fit here: this copy drifted, and is as it was. The server's state is the truth.
      if (!(error instanceof ReceiveError)) throw error;
      meanwhile.push({ ops, drop });
      resync();
      return [];
    }
    for (const batch of echoed) settle(batch);
    if (ops.some((op) => op.seq > seen) && under.some((batch) => !dropping.includes(batch))) tally.rebases++;
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
          // A state on another declaration is not this store's to adopt: the client opens on it instead (FR-43).
          if (moved(next)) {
            meanwhile = [];
            return;
          }
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
          tally.resyncs++;
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

  /*
   * EVERY ANSWER A POLL READS SAYS WHICH DECLARATION AND WHICH BUILD
   * (FR-43, FR-44). One on another declaration is not landed here: the
   * client opens on the new one, exactly as a socket's `declaration` makes
   * it, and its calls on the way go with it.
   */
  const moved = (answer: { readonly version?: unknown; readonly build?: unknown }): boolean => {
    if (typeof answer.build === "string") noticeBuild(answer.build);
    if (typeof answer.version !== "number" || answer.version === state.version) return false;
    void declarationChanged(answer.version);
    return true;
  };

  const since = async (seq: number): Promise<Operation[]> => {
    const response = await reach(`${options.url}/graview/since?seq=${seq}`, { headers });
    const answer = (await response.json()) as { ops?: Operation[]; version?: number; build?: string };
    return moved(answer) ? [] : (answer.ops ?? []);
  };

  /** Asks for what is new, and waits for a resync the answer started, so the store is the server's when it returns. */
  const pull = async (): Promise<readonly Operation[]> => {
    const landed = await pulled();
    if (resyncing) await resyncing;
    return landed;
  };
  const pulled = async (): Promise<readonly Operation[]> => {
    // Presence rides the poll only while somebody is looking (FR-49).
    if (mine && !socketReady() && visible()) {
      const response = await reach(`${options.url}/graview/here`, {
        method: "POST",
        headers,
        body: JSON.stringify({ presence: mine, seq: seen }),
      });
      const answer = (await response.json()) as { who: Presence[]; ops?: Operation[]; participant?: string; version?: number; build?: string };
      if (moved(answer)) return [];
      if (typeof answer.participant === "string") self = answer.participant;
      heard(answer.who ?? []);
      return land(answer.ops ?? []);
    }
    return land(await since(seen));
  };

  /** The server's batch for each provisional one this browser minted, so an undo names what the server has. */
  const batches = new Map<string, string>();
  /** Each provisional batch's post, so an undo of it waits until the server has named it. */
  const answers = new Map<string, Promise<unknown>>();
  /** What each provisional batch asked for, so a conflict's `useMine` can ask again. */
  const asked = new Map<string, { calls: readonly MutationCall[]; intent?: string; via?: Via }>();
  /** Every post not yet answered, so `settled` can wait for the verdicts. */
  const inFlight = new Set<Promise<unknown>>();
  const track = <T>(promise: Promise<T>): Promise<T> => {
    inFlight.add(promise);
    void promise.finally(() => inFlight.delete(promise)).catch(() => {});
    return promise;
  };

  /** `via` is a claim — a guest view's `view:<name>` — which a server records only if its `viaOf` accepts it (FR-52). */
  type Body = { calls?: readonly MutationCall[]; undo?: readonly string[]; intent?: string; batch?: string; base?: readonly FieldRevision[]; via?: Via };

  /*
   * `mine` names the provisional batch this post answers, when the call was
   * applied here first: the server's op lands and the provisional one is
   * dropped, in one rebase. `send` never applies first, so its answer
   * lands under whatever is pending.
   */
  /*
   * ONE POST AT A TIME, IN THE ORDER THE CHANGES WERE MADE. The server
   * judges them in the order they reach it, and a post that has to wait —
   * the host is busy (FR-45), or the server cannot be reached (FR-49) —
   * must not be overtaken by one made after it. So a post waits in its
   * turn and goes again from there, and the posts behind it wait for it.
   */
  let lane: Promise<unknown> = Promise.resolve();
  const post = (body: Body, mine?: string): Promise<{ ops: readonly Operation[]; batch?: string }> => {
    const turn = lane.then(() => posted(body, mine));
    lane = turn.catch(() => {});
    return turn;
  };
  /** Resolves once the server is reached again (FR-49); rejects if the client closes first. */
  const backOnline = (): Promise<void> => new Promise((again, give) => held.push({ again, give }));
  const posted = async (body: Body, mine?: string): Promise<{ ops: readonly Operation[]; batch?: string }> => {
    type Answer = { ops?: Operation[]; batch?: string; error?: string; conflict?: boolean; conflicts?: FieldConflict[]; reason?: RemoteRefusal["reason"]; wouldNeed?: string[]; retryAfter?: number; version?: number; build?: string };
    let response: Response;
    let answer: Answer;
    for (;;) {
      try {
        response = await reach(`${options.url}/graview/ops`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      } catch (error) {
        /*
         * NOT REFUSED, NOT REACHED (FR-49). A call the server never heard is
         * not taken back as if it had been refused: it stays shown, counts as
         * pending, and goes again — down the socket or over HTTP, whichever is
         * up — the moment the server is reached again. Posts batch-named, so
         * one the server did hear is answered with the ops it made.
         */
        if (!(error instanceof Unreached) || closed) throw error;
        await backOnline();
        if (socketReady()) return viaSocket(body, mine);
        continue;
      }
      answer = (await response.json().catch(() => ({}))) as Answer;
      if (response.status !== 429 || closed) break;
      /*
       * BUSY, NOT REFUSED (FR-45): the host asked for it again later. The
       * change stays shown and pending, and goes again after the wait.
       */
      const header = Number(response.headers.get("retry-after"));
      const wait = typeof answer.retryAfter === "number" ? answer.retryAfter : Number.isFinite(header) && header > 0 ? header * 1000 : 1000;
      await new Promise((later) => setTimeout(later, Math.max(0, wait)));
      if (socketReady()) return viaSocket(body, mine);
    }
    /*
     * Answered on another declaration, or after this store was let go: the
     * call goes with the rest to the store on the new one, under its batch,
     * where the server answers it once (FR-43).
     */
    if (retiring || moved(answer)) throw new Superseded("The app was changed.");
    if (!response.ok) {
      // The policy's own sentence, carried across the wire unchanged: a
      // refusal a person can read is the whole point of having one.
      const sentence = answer.error ?? `The server refused (${response.status})`;
      if (answer.conflict) throw new StaleWrite(sentence, answer.conflicts ?? []);
      throw new RemoteRefusedError({
        reason: answer.reason ?? REASON_BY_STATUS[response.status] ?? "invalid",
        sentence,
        ...(answer.wouldNeed?.length ? { wouldNeed: answer.wouldNeed } : {}),
      });
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
    if (!mine || !socketReady() || !visible()) return;
    // Unchanged: said again only on a heartbeat the host opted into. The server holds it while the socket is open.
    if (!force && said && samePresence(mine, said) && (presenceEveryMs === undefined || Date.now() - saidAt < presenceEveryMs)) return;
    if (say({ t: "here", presence: mine })) {
      said = mine;
      saidAt = Date.now();
    }
  };

  /*
   * CALLS THE HOST ASKED TO WAIT (FR-45), by cid. They stay shown and
   * pending, and go again together once the wait is over, in the order
   * they were made; a call made meanwhile joins them rather than going
   * ahead of them.
   */
  const busy = new Set<string>();
  let busyTimer: ReturnType<typeof setTimeout> | undefined;
  const sendBusy = () => {
    busyTimer = undefined;
    const again = [...waiting.entries()].filter(([cid]) => busy.has(cid));
    busy.clear();
    for (const [, waiter] of again) say(waiter.message);
  };
  const hold = (cid: string, retryAfter: number) => {
    if (!waiting.has(cid)) return;
    busy.add(cid);
    if (busyTimer) clearTimeout(busyTimer);
    busyTimer = setTimeout(sendBusy, Math.max(0, retryAfter));
  };

  /** A call down the socket; its answer lands when it comes, in the order the server said it. */
  const viaSocket = (body: Body, mine?: string): Promise<{ ops: readonly Operation[]; batch?: string }> =>
    new Promise((resolve, reject) => {
      const cid = mine ?? `send-${++counter}`;
      const message: LiveClientMessage = body.undo
        ? { t: "undo", cid, batches: body.undo, ...(body.intent ? { intent: body.intent } : {}), ...(body.batch ? { batch: body.batch } : {}), ...(body.via ? { via: body.via } : {}) }
        : {
            t: "call",
            cid,
            calls: body.calls ?? [],
            ...(body.intent ? { intent: body.intent } : {}),
            ...(body.batch ? { batch: body.batch } : {}),
            ...(body.base?.length ? { base: body.base } : {}),
            ...(body.via ? { via: body.via } : {}),
          };
      waiting.set(cid, { message, ...(mine !== undefined ? { mine } : {}), resolve, reject });
      // Behind calls the host asked to wait: it goes with them.
      if (busy.size > 0) {
        busy.add(cid);
        return;
      }
      // Not open: it goes when the socket is back, after the welcome has caught this client up.
      say(message);
    });

  /** Down the socket when it is up, over HTTP when it is not. */
  const transmit = (body: Body, mine?: string) => (socketReady() ? viaSocket(body, mine) : post(body, mine));

  const hear = (message: LiveServerMessage) => {
    switch (message.t) {
      case "welcome": {
        noticeBuild(message.build);
        // Back on a server whose declaration moved while this socket was away (FR-43): its ops are not this store's to fold.
        if (typeof message.version === "number" && message.version !== state.version) {
          void declarationChanged(message.version);
          return;
        }
        welcomed = true;
        attempts = 0;
        if (typeof message.participant === "string") self = message.participant;
        land(message.ops ?? []);
        // Whatever was sent and never answered goes again: the server answers a batch it already has with its ops.
        busy.clear();
        if (busyTimer) clearTimeout(busyTimer);
        busyTimer = undefined;
        for (const waiter of waiting.values()) say(waiter.message);
        sayWhere(true);
        // And what could not reach the server at all goes after it.
        become("online");
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
        waiter.reject(
          message.t === "conflict"
            ? new StaleWrite(message.sentence, message.conflicts ?? [])
            : new RemoteRefusedError({
                // A server before FR-46 says no reason.
                reason: message.reason ?? "invalid",
                sentence: message.sentence,
                ...(message.wouldNeed?.length ? { wouldNeed: [...message.wouldNeed] } : {}),
              }),
        );
        return;
      }
      case "busy":
        // Not now, and not refused (FR-45): kept, and sent again after the wait.
        if (typeof message.cid === "string") hold(message.cid, typeof message.retryAfter === "number" ? message.retryAfter : 1000);
        return;
      case "presence":
        heard(message.who ?? []);
        return;
      case "declaration":
        if (typeof message.version === "number" && message.version !== state.version) void declarationChanged(message.version);
        return;
      case "reload":
        reloadOntoNewer(typeof message.reason === "string" ? message.reason : "This app was updated.");
        return;
      default:
        return;
    }
  };

  /* ── SKEW AND CHANGE (FR-43, FR-44) ─────────────────────────────────── */

  /** Set once this store has been let go of, for a new declaration or a reload: it acts on nothing more. */
  let retiring = false;
  const declarationListeners = wiring.declarations;
  const buildListeners = wiring.builds;
  const noticeBuild = (build: string | undefined) => {
    if (retiring || wiring.otherBuild !== undefined || !options.build || typeof build !== "string" || build.length === 0 || build === options.build) return;
    wiring.otherBuild = build;
    for (const listener of [...buildListeners]) listener(build);
  };

  /** Every call this client applied that the server has not answered, oldest first; and how many undos are. */
  const unanswered = (): { carried: Carried[]; undos: number } => {
    const carried: Carried[] = [];
    let undos = 0;
    for (const batch of pending) {
      const made = asked.get(batch);
      if (made) carried.push({ calls: made.calls, ...(made.intent ? { intent: made.intent } : {}), ...(made.via ? { via: made.via } : {}), batch });
      else undos++;
    }
    return { carried, undos };
  };
  const undosSaid = (undos: number, why: string) =>
    `${why} while ${undos === 1 ? "an undo of yours was" : "undos of yours were"} on the way; ${undos === 1 ? "it was" : "they were"} not made.`;

  /** Lets this store go: what it waits for is let go too, never said to be refused, and its socket closes without a goodbye. */
  const retire = (why: string) => {
    retiring = true;
    // Where this page stands is the next store's to say now: closing this one later must not say it left.
    mine = null;
    const superseded = new Superseded(why);
    for (const waiter of waiting.values()) waiter.reject(superseded);
    waiting.clear();
    if (timer) clearInterval(timer);
    closed = true;
    if (retry) clearTimeout(retry);
    if (busyTimer) clearTimeout(busyTimer);
    if (lapse) clearTimeout(lapse);
    // A post waiting for the server to be reached again goes with the rest instead.
    for (const waiting of held.splice(0)) waiting.give(superseded);
    const was = socket;
    socket = undefined;
    welcomed = false;
    try {
      was?.close(1000, why);
    } catch {
      // Already gone.
    }
    opened();
  };

  /*
   * THE DECLARATION CHANGED (FR-43). The host's `resolveApp` names the app
   * at the server's version; a remote store is opened on it — the
   * server's migrated state — and handed to `onDeclaration`, with every
   * call this one had on the way offered again there under the batch it
   * was sent in, so one the server already made is not made twice.
   */
  async function declarationChanged(version: number): Promise<void> {
    if (retiring) return;
    if (!options.resolveApp) {
      reloadOntoNewer(`This app was changed on its server (version ${version}); reload the page to carry on.`);
      return;
    }
    const { carried, undos } = unanswered();
    const resolveApp = options.resolveApp;
    const standing = mine;
    retire("The app was changed.");
    try {
      const resolved = await resolveApp(version);
      // The host's wiring goes with it: its listeners, the counters, the build it was told of.
      const next = await opening({ ...(options as unknown as RemoteOptions<AnySchema>), app: resolved }, carried, "The app was changed while your changes were on the way.", wiring);
      if (standing) next.remote.presence.here(standing);
      for (const listener of [...declarationListeners]) listener(next.remote, version);
      const said = [...(undos > 0 ? [refused(undosSaid(undos, "The app was changed"))] : []), ...next.unheard()];
      for (const refusal of said) for (const told of refusals) told(refusal.sentence, refusal);
    } catch (error) {
      const sentence = `The app was changed, but the new version could not be opened: ${error instanceof Error ? error.message : String(error)}`;
      for (const told of refusals) told(sentence, refused(sentence));
    }
  }

  /*
   * THE SERVER NO LONGER SERVES THIS PAGE'S PROTOCOL (FR-44). Every call
   * not yet answered is kept in `carry`, the page reloads, and the next
   * `openRemote` with the same key offers them again. Without `carry`
   * they are refused in words first, so nobody believes they were made.
   */
  function reloadOntoNewer(reason: string): void {
    if (retiring) return;
    const { carried, undos } = unanswered();
    retire(reason);
    let kept = false;
    if (options.carry && carried.length > 0) {
      try {
        options.carry.storage.setItem(options.carry.key, JSON.stringify(carried));
        kept = true;
      } catch {
        // Storage full or refused: the reload still happens, and the calls are said lost below.
      }
    }
    const said: string[] = [];
    if (!kept && carried.length > 0) {
      said.push(`${reason} ${carried.length === 1 ? "A change of yours was" : `${carried.length} changes of yours were`} not sent; make ${carried.length === 1 ? "it" : "them"} again after the page reloads.`);
    }
    if (undos > 0) said.push(undosSaid(undos, "This app was updated"));
    for (const sentence of said) for (const told of refusals) told(sentence, refused(sentence));
    (options.reloadPage ?? pageReload)();
  }

  const connect = () => {
    if (closed || !live) return;
    const url = `${options.url.replace(/^http/, "ws").replace(/\/$/, "")}${LIVE_PATH}`;
    const { "content-type": _json, ...carried } = headers;
    let made: LiveSocketLike;
    try {
      made = options.socket ? options.socket(url, carried, [LIVE_SUBPROTOCOL]) : platformSocket(url, carried);
    } catch {
      return reconnect();
    }
    socket = made;
    welcomed = false;
    made.onopen = () => {
      if (socket !== made) return;
      // From the last op this client has: the welcome brings exactly the ones after it.
      // Which codec, which protocol and which build this page speaks (FR-44).
      made.send(JSON.stringify({ t: "hello", seq: seen, protocol: WIRE_PROTOCOL, wire: LIVE_WIRE, ...(options.build ? { build: options.build.slice(0, 64) } : {}) } satisfies LiveClientMessage));
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
      const dropped = welcomed;
      socket = undefined;
      welcomed = false;
      said = null;
      // A socket that never opened says nothing a poll does not; one that was up and dropped is the server gone.
      if (dropped) {
        become("offline");
        lapseHeld();
      }
      reconnect();
    };
    made.onerror = () => {
      // The close follows; that is where reconnecting is decided.
    };
  };
  /*
   * WHAT A DROPPED SOCKET WAS TOLD STANDS NO LONGER ON THE SERVER'S WORD. A
   * presence held by somebody's socket stands while the server lists it,
   * and this client hears the server no longer. Unless a list comes within
   * `REMOTE_PRESENCE_TTL_MS` — a welcome after a reconnect, a poll — the
   * held ones are let go, as a word that old would be.
   */
  let lapse: ReturnType<typeof setTimeout> | undefined;
  const lapseHeld = () => {
    heardWho = false;
    if (lapse) clearTimeout(lapse);
    lapse = setTimeout(() => {
      lapse = undefined;
      if (heardWho || closed) return;
      const kept = new Map([...known].filter(([, presence]) => presence.held !== "socket"));
      if (kept.size === known.size) return;
      known = kept;
      for (const listener of whoListeners) listener([...known.values()]);
    }, REMOTE_PRESENCE_TTL_MS);
    (lapse as { unref?: () => void }).unref?.();
  };
  const reconnect = () => {
    if (closed) return;
    const wait = backoffFor(options.backoff, attempts);
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
  const refusals = wiring.refusals;
  /** What became of carried calls before anybody listened: told to the first listener (FR-43, FR-44). */
  let unheard: RemoteRefusal[] = [];
  /** A change of this client's that did not survive a new declaration or a reload: `invalid`, it no longer fits (FR-46). */
  const refused = (sentence: string): RemoteRefusal => ({ reason: "invalid", sentence });
  const conflictListeners = wiring.conflicts;
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
    // Let go of for a new declaration or a reload: carried, not refused (FR-43, FR-44).
    if (error instanceof Superseded || retiring) return;
    const refusal = error instanceof RemoteRefusedError ? error.refusal : refusalOf(error);
    const reason = refusal.sentence;
    settle(batch);
    try {
      land([], [batch]);
    } catch {
      // A take-back that cannot run leaves the interface wrong, and
      // saying so is still better than saying nothing.
    }
    const made = asked.get(batch);
    asked.delete(batch);
    if (error instanceof StaleWrite) tally.conflicts++;
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
            store.applyAll(made.calls, { ...(made.intent ? { intent: made.intent } : {}), ...(made.via ? { via: made.via } : {}) });
          } finally {
            overriding = false;
          }
        },
      };
      for (const told of conflictListeners) told(conflict);
      return;
    }
    for (const told of refusals) told(reason, refusal);
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
    asked.set(result.batch, { calls, ...(applyOptions?.intent ? { intent: applyOptions.intent } : {}), ...(applyOptions?.via ? { via: applyOptions.via } : {}) });
    // The revision of each field this changes, as this browser saw it — unless the person chose theirs over it.
    const base = overriding ? [] : revisions.baseFor(result.ops, earlier);
    answers.set(
      result.batch,
      track(
        transmit(
          {
            calls,
            ...(applyOptions?.intent ? { intent: applyOptions.intent } : {}),
            batch: result.batch,
            ...(base.length > 0 ? { base } : {}),
            // What it claims to come through, for a server that may believe it (FR-52).
            ...(applyOptions?.via ? { via: applyOptions.via } : {}),
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
                batch: result.batch,
                ...(undoOptions?.via ? { via: undoOptions.via } : {}),
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
  ): Promise<readonly Operation[]> => {
    sendsOut++;
    try {
      return (await track(transmit({ calls, ...sending }))).ops;
    } finally {
      sendsOut--;
    }
  };
  /** `send` calls not yet answered: they apply nothing here first, so `pending` does not hold them. */
  let sendsOut = 0;

  const presence: PresenceChannel = {
    here(next) {
      mine = next;
      sayWhere();
    },
    onWho(listener) {
      whoListeners.add(listener);
      // Told at once who is here already: a host that subscribes after the welcome is not shown an empty room.
      if (known.size > 0) listener([...known.values()]);
      return () => {
        whoListeners.delete(listener);
      };
    },
    leave() {
      if (!mine) return;
      const body = JSON.stringify({ participant: self ?? mine.participant });
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

  /*
   * CALLS CARRIED HERE — from the store this one replaces, or across a
   * reload — offered again now it is open, each under the batch it was
   * sent in. One the server's log already holds landed before the change
   * and is not made twice; one that no longer fits is named, in words.
   */
  if (offered.length > 0 && !retiring) {
    const lost: string[] = [];
    const landed = new Set(store.log.all().map((op) => op.batch));
    for (const one of offered) {
      if (one.batch !== undefined && landed.has(one.batch)) continue;
      try {
        store.applyAll(one.calls, { ...(one.intent ? { intent: one.intent } : {}), ...(one.batch ? { batch: one.batch } : {}), ...(one.via ? { via: one.via } : {}) });
      } catch (error) {
        lost.push(named(one, error));
      }
    }
    if (lost.length > 0) {
      unheard.push(refused(`${lostSaid} ${lost.length === 1 ? "One no longer fits and was not made" : `${lost.length} no longer fit and were not made`}: ${lost.join("; ")}.`));
    }
  }

  const remote: RemoteStore<S> = {
    store,
    version: state.version,
    migrated: state.migrated ?? [],
    send,
    pull,
    onRefusal(listener) {
      refusals.add(listener);
      const told = unheard;
      unheard = [];
      for (const refusal of told) listener(refusal.sentence, refusal);
      return () => refusals.delete(listener);
    },
    onDeclaration(listener) {
      declarationListeners.add(listener);
      return () => declarationListeners.delete(listener);
    },
    onBuild(listener) {
      buildListeners.add(listener);
      if (wiring.otherBuild !== undefined) listener(wiring.otherBuild);
      return () => buildListeners.delete(listener);
    },
    onConflict(listener) {
      conflictListeners.add(listener);
      return () => conflictListeners.delete(listener);
    },
    revision: (node, field) => revisions.of(node, field),
    seq: () => seen,
    participant: () => self,
    transport: () => (socketReady() ? "socket" : "poll"),
    status: () => status,
    onStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    counters: () => ({ ...tally }),
    who: () => [...known.values()],
    pending: () => pending.length + sendsOut,
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
      if (busyTimer) clearTimeout(busyTimer);
      if (lapse) clearTimeout(lapse);
      for (const waiting of held.splice(0)) waiting.give(new Error("The client closed before the server could be reached."));
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
  return {
    remote,
    unheard() {
      const told = unheard;
      unheard = [];
      return told;
    },
  };

  /** The platform's WebSocket, with the headers where the runtime can send them. */
  function platformSocket(url: string, carried: Readonly<Record<string, string>>): LiveSocketLike {
    const Socket = (globalThis as { WebSocket?: new (url: string, init?: unknown) => LiveSocketLike }).WebSocket;
    if (!Socket) throw new Error("This runtime has no WebSocket; the client polls instead.");
    const page = typeof (globalThis as { document?: unknown }).document !== "undefined";
    const protocols = options.subprotocol ? [LIVE_SUBPROTOCOL] : [];
    if (!page) {
      try {
        return new Socket(url, { headers: carried, ...(protocols.length > 0 ? { protocols } : {}) });
      } catch {
        // A runtime whose WebSocket takes protocols only: the seat rides in the query, as a page's does.
      }
    }
    const withSeat = new URL(url);
    for (const [name, value] of Object.entries(seat)) withSeat.searchParams.set(name, value);
    return protocols.length > 0 ? new Socket(withSeat.toString(), protocols) : new Socket(withSeat.toString());
  }
}

/** The page's own reload, where there is a page. */
function pageReload(): void {
  (globalThis as { location?: { reload?: () => void } }).location?.reload?.();
}

/** Whether a page is being looked at; a runtime with no document always is. */
function pageVisible(): boolean {
  const page = (globalThis as { document?: { visibilityState?: string } }).document;
  return page?.visibilityState !== "hidden";
}

/** How long before reconnect attempt `attempt` (FR-49): the host's own, or jittered exponential. */
function backoffFor(backoff: RemoteBackoff | undefined, attempt: number): number {
  if (typeof backoff === "function") return Math.max(0, backoff(attempt));
  const { min = 250, max = 10_000, factor = 2 } = backoff ?? {};
  return Math.min(max, min * factor ** attempt) * (0.75 + Math.random() * 0.5);
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
