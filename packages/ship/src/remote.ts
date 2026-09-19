import {
  foldPresence,
  PRESENCE_TTL_MS,
  samePresence,
  Store,
  type AnySchema,
  type GraviewApp,
  type MutationCall,
  type Operation,
  type Presence,
  type PresenceChannel,
  type Principal,
} from "@graview/core";
import type { GraphSnapshot } from "./snapshot.js";

/**
 * THE OTHER END OF THE WIRE: a store whose graph lives on a server.
 *
 * The browser still holds a real `Store` — the scene, the strip, the rules
 * and the routed face all read it the way they always have — but it does not
 * own the truth. A call goes to the server, which judges it under this
 * seat's principal and answers with the op it produced; the op is `receive`d
 * here, so it lands with its own id, author and sequence and the interface
 * updates exactly as it does for a local change.
 *
 * Everyone else's ops arrive the same way, on a poll. Two browsers open on
 * the same roster see each other within a second, and neither of them has a
 * second way to write the graph.
 *
 * Undo is the interesting case and it needed no special handling: `undo`
 * produces ordinary calls, and they go down the same wire and are judged by
 * the same policy — what you may undo is what you may have done, decided on
 * the server rather than trusted from the client.
 */

export interface RemoteOptions<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  /** Where the server is: `http://localhost:5196`, say. */
  readonly url: string;
  /** Who is at this keyboard. Sent with every call; the server judges by it. */
  readonly principal?: Principal;
  /** How often to ask for everybody else's ops, in milliseconds. 0 never asks. */
  readonly pollMs?: number;
  readonly fetch?: typeof fetch;
  readonly storeOptions?: Record<string, unknown>;
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
   * saying so, in the policy's own words.
   */
  onRefusal(listener: (reason: string) => void): () => void;
  /**
   * WHO IS HERE, over the same poll. Saying where you are rides on the next
   * heartbeat and the answer carries everybody else — no round trip of its
   * own, nothing written to the store, the adapter or the log.
   */
  readonly presence: PresenceChannel;
  close(): void;
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

export async function openRemote<S extends AnySchema>(options: RemoteOptions<S>): Promise<RemoteStore<S>> {
  const call = options.fetch ?? fetch;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.principal?.id) headers["x-graview-seat"] = options.principal.id;
  if (options.principal?.roles?.length) headers["x-graview-roles"] = options.principal.roles.join(",");

  const state = (await (await call(`${options.url}/graview/state`)).json()) as {
    version: number;
    snapshot: GraphSnapshot;
    log: Operation[];
    migrated: string[];
  };

  const store = new Store<S>({
    schema: options.app.schema,
    mutations: options.app.mutations ?? [],
    invariants: options.app.invariants ?? [],
    ...(options.app.policy ? { policy: options.app.policy } : {}),
    ...(options.app.modules ? { modules: options.app.modules } : {}),
    ...(options.app.intelligence ? { intelligence: options.app.intelligence } : {}),
    /*
     * The snapshot AND the log: the snapshot is the graph, the log is the
     * history that led to it. Folding the log alone would lose whatever the
     * server was seeded with, which was never an operation.
     */
    snapshot: state.snapshot as never,
    log: state.log,
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
  } as never);

  let seen = state.log.at(-1)?.seq ?? -1;

  /*
   * PRESENCE, beside the log and never in it. `mine` is the last word this
   * browser said about itself; it goes out with every poll while it stands,
   * and what comes back is folded into `known` for whoever is listening.
   */
  let mine: Presence | null = null;
  let known = new Map<string, Presence>();
  const whoListeners = new Set<(who: readonly Presence[]) => void>();
  const heard = (who: readonly Presence[]) => {
    const next = foldPresence(new Map(), who, Date.now(), PRESENCE_TTL_MS * 4, mine?.participant);
    let changed = next.size !== known.size;
    if (!changed) for (const [participant, presence] of next) if (!samePresence(presence, known.get(participant))) changed = true;
    known = next;
    if (!changed) return;
    for (const listener of whoListeners) listener([...known.values()]);
  };

  const land = (ops: readonly Operation[]): readonly Operation[] => {
    if (ops.length === 0) return [];
    seen = Math.max(seen, ...ops.map((op) => op.seq));
    return store.receive(ops);
  };

  const pull = async (): Promise<readonly Operation[]> => {
    if (mine) {
      const response = await call(`${options.url}/graview/here`, {
        method: "POST",
        headers,
        body: JSON.stringify({ presence: mine, seq: seen }),
      });
      const { who, ops } = (await response.json()) as { who: Presence[]; ops?: Operation[] };
      heard(who ?? []);
      return land(ops ?? []);
    }
    const response = await call(`${options.url}/graview/since?seq=${seen}`, { headers });
    const { ops } = (await response.json()) as { ops: Operation[] };
    return land(ops);
  };

  const presence: PresenceChannel = {
    here(next) {
      mine = next;
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
      // A page on its way out gets one shot; a beacon is what survives it.
      const beacon = (globalThis as { navigator?: { sendBeacon?: (url: string, body: string) => boolean } }).navigator?.sendBeacon;
      if (beacon) beacon.call((globalThis as { navigator?: unknown }).navigator, `${options.url}/graview/leave`, body);
      else void call(`${options.url}/graview/leave`, { method: "POST", headers, body }).catch(() => {});
    },
  };

  /** The server's batch for each provisional one this browser minted, so an undo names what the server has. */
  const batches = new Map<string, string>();

  const post = async (
    body: { calls?: readonly MutationCall[]; undo?: readonly string[]; intent?: string; batch?: string },
  ): Promise<{ ops: readonly Operation[]; batch?: string }> => {
    const response = await call(`${options.url}/graview/ops`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const answer = (await response.json()) as { ops?: Operation[]; batch?: string; error?: string };
    if (!response.ok) {
      // The policy's own sentence, carried across the wire unchanged: a
      // refusal a person can read is the whole point of having one.
      throw new Error(answer.error ?? `The server refused (${response.status})`);
    }
    const ops = answer.ops ?? [];
    land(ops);
    return { ops, ...(answer.batch ? { batch: answer.batch } : {}) };
  };

  const send = async (
    calls: readonly MutationCall[],
    sending: { intent?: string; batch?: string } = {},
  ): Promise<readonly Operation[]> => (await post({ calls, ...sending })).ops;

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
  /*
   * A refusal takes the optimism back — undone by its own batch, which is
   * the same mechanism a person's undo uses — AS THE SAME PERSON. What you
   * may undo is what you may have done, and an undo judged as nobody is
   * refused in an app with a policy: taking back your own optimism would
   * have thrown a second, more confusing refusal on top of the first.
   */
  const takeBack = (batch: string, error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    try {
      const asMe = options.principal ? { author: options.principal } : {};
      if (store.canUndo(batch).ok) undone(batch, asMe);
    } catch {
      // A take-back that cannot run leaves the interface wrong, and
      // saying so is still better than saying nothing.
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
    void post({ calls, ...(applyOptions?.intent ? { intent: applyOptions.intent } : {}) })
      .then((answer) => {
        if (answer.batch) batches.set(result.batch, answer.batch);
      })
      .catch((error: unknown) => takeBack(result.batch, error));
    return result;
  }) as typeof store.applyAll;
  // `apply` is `applyAll` of one — and it must go through the patched one.
  store.apply = ((callMade, applyOptions) => store.applyAll([callMade], applyOptions)) as typeof store.apply;
  store.undo = ((batchIds, undoOptions) => {
    const ids = typeof batchIds === "string" ? [batchIds] : batchIds;
    const result = undone(ids, {
      ...(options.principal ? { author: options.principal } : {}),
      ...undoOptions,
    });
    // Named as the server knows them: a provisional batch by the one it became.
    const theirs = ids.map((id) => batches.get(id) ?? id);
    void post({ undo: theirs, ...(undoOptions?.intent ? { intent: undoOptions.intent } : {}) })
      .then((answer) => {
        if (answer.batch) batches.set(result.batch, answer.batch);
      })
      .catch((error: unknown) => takeBack(result.batch, error));
    return result;
  }) as typeof store.undo;

  const every = options.pollMs ?? 800;
  const timer =
    every > 0 && typeof setInterval === "function"
      ? setInterval(() => {
          void pull().catch(() => {
            // A poll that cannot reach the server is a poll that will try
            // again; throwing here would take the interface down with the
            // connection.
          });
        }, every)
      : null;

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
    presence,
    close() {
      if (timer) clearInterval(timer);
      presence.leave();
    },
  };
}
