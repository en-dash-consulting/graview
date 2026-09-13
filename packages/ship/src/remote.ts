import { Store, type AnySchema, type GraviewApp, type MutationCall, type Operation, type Principal } from "@graview/core";
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

  const pull = async (): Promise<readonly Operation[]> => {
    const response = await call(`${options.url}/graview/since?seq=${seen}`, { headers });
    const { ops } = (await response.json()) as { ops: Operation[] };
    if (ops.length === 0) return [];
    seen = Math.max(seen, ...ops.map((op) => op.seq));
    return store.receive(ops);
  };

  const send = async (
    calls: readonly MutationCall[],
    sending: { intent?: string; batch?: string } = {},
  ): Promise<readonly Operation[]> => {
    const response = await call(`${options.url}/graview/ops`, {
      method: "POST",
      headers,
      body: JSON.stringify({ calls, ...sending }),
    });
    const body = (await response.json()) as { ops?: Operation[]; error?: string };
    if (!response.ok) {
      // The policy's own sentence, carried across the wire unchanged: a
      // refusal a person can read is the whole point of having one.
      throw new Error(body.error ?? `The server refused (${response.status})`);
    }
    const ops = body.ops ?? [];
    if (ops.length > 0) seen = Math.max(seen, ...ops.map((op) => op.seq));
    store.receive(ops);
    return ops;
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
  const applied = store.apply.bind(store);
  const refusals = new Set<(reason: string) => void>();
  store.apply = ((callMade, applyOptions) => {
    /*
     * As WHOEVER IS AT THIS KEYBOARD, by default.
     *
     * The local store carries the app's policy, so a call with no author is
     * judged as an anonymous human — who, in an app with a policy, may do
     * nothing. Every surface that threads a principal is unaffected; what
     * this fixes is the one that does not, which would otherwise meet a
     * refusal about a person who is not sitting there.
     */
    const result = applied(callMade, {
      ...(options.principal ? { author: options.principal } : {}),
      ...applyOptions,
    });
    void send([callMade], applyOptions?.intent ? { intent: applyOptions.intent } : {}).catch(
      (error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        /*
         * Undone by its own batch, which is the same mechanism a person's
         * undo uses — AS THE SAME PERSON. What you may undo is what you may
         * have done, and an undo judged as nobody is refused in an app with
         * a policy: taking back your own optimism would have thrown a
         * second, more confusing refusal on top of the first.
         */
        try {
          const mine = options.principal ? { author: options.principal } : {};
          if (store.canUndo(result.batch).ok) store.undo(result.batch, mine);
        } catch {
          // A take-back that cannot run leaves the interface wrong, and
          // saying so is still better than saying nothing.
        }
        for (const told of refusals) told(reason);
      },
    );
    return result;
  }) as typeof store.apply;

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
    close() {
      if (timer) clearInterval(timer);
    },
  };
}
