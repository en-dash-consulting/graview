import { foldPresence, PRESENCE_TTL_MS, samePresence, type Presence, type PresenceChannel } from "@graview/core";

/**
 * WHO IS HERE, BETWEEN THE TABS OF ONE ORIGIN.
 *
 * A BroadcastChannel is multiplayer for free: two tabs on the same app see
 * each other with no server, and a driven browser's pages share one when
 * they share a context, which is what makes the harness deterministic. It
 * sits beside `createBrowserAdapter` and, like it, never touches the store,
 * the adapter or the log — presence is a fact about a person at a screen,
 * and the graph is not where those go.
 *
 * Scoped by the store's scope, because a channel is per origin: a launcher
 * with three apps mounted would otherwise put Things' keeper in the Colts'
 * dressing room.
 */

/** What this needs of a channel — the browser's own, or Node's, or a fake. */
export interface ChannelLike {
  postMessage(message: unknown): void;
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  close(): void;
}

export interface BroadcastPresenceOptions {
  /** How long a presence stands after its last word. Three heartbeats by default. */
  readonly ttlMs?: number;
  /** The channel itself, for a test or a host with its own. Defaults to `new BroadcastChannel(name)`. */
  readonly channel?: ChannelLike;
  readonly now?: () => number;
}

type Word = { readonly type: "here"; readonly presence: Presence } | { readonly type: "leave"; readonly participant: string };

export const presenceChannelName = (scope: string): string => `graview:who:${scope}`;

function openChannel(name: string): ChannelLike | null {
  const Channel = (globalThis as unknown as { BroadcastChannel?: new (name: string) => ChannelLike & { unref?: () => void } }).BroadcastChannel;
  if (!Channel) return null;
  const channel = new Channel(name);
  // Node's channel keeps the process alive; a presence channel must not.
  channel.unref?.();
  return channel;
}

export function createBroadcastPresence(scope: string, options: BroadcastPresenceOptions = {}): PresenceChannel {
  const ttl = options.ttlMs ?? PRESENCE_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const channel = options.channel ?? openChannel(presenceChannelName(scope));
  const listeners = new Set<(who: readonly Presence[]) => void>();
  let known = new Map<string, Presence>();
  let self: string | undefined;
  let sweep: ReturnType<typeof setInterval> | null = null;

  const tell = () => {
    const who = [...known.values()];
    for (const listener of listeners) listener(who);
  };
  const changed = (next: Map<string, Presence>): boolean => {
    if (next.size !== known.size) return true;
    for (const [participant, presence] of next) if (!samePresence(presence, known.get(participant))) return true;
    return false;
  };
  const fold = (arrived: readonly Presence[]) => {
    const next = foldPresence(known, arrived, now(), ttl, self);
    // The fresh timestamps are kept EVEN WHEN nothing else moved: a heartbeat
    // that says nothing new is exactly what keeps somebody here past the TTL.
    const moved = changed(next);
    known = next;
    if (moved) tell();
  };
  /* The sweep only runs while somebody is listening and somebody is here: a quiet page holds no timer. */
  const keep = () => {
    if (sweep || listeners.size === 0) return;
    sweep = setInterval(() => {
      if (known.size === 0 && sweep) {
        clearInterval(sweep);
        sweep = null;
        return;
      }
      fold([]);
    }, Math.max(100, Math.floor(ttl / 2)));
    (sweep as { unref?: () => void }).unref?.();
  };

  if (channel) {
    channel.onmessage = (event) => {
      const word = event.data as Word;
      if (word?.type === "here") {
        fold([word.presence]);
        keep();
      } else if (word?.type === "leave") {
        if (!known.has(word.participant)) return;
        known = new Map(known);
        known.delete(word.participant);
        tell();
      }
    };
  }

  return {
    here(presence) {
      self = presence.participant;
      // Never a word about yourself in your own map.
      if (known.has(presence.participant)) fold([]);
      channel?.postMessage({ type: "here", presence } satisfies Word);
    },
    onWho(listener) {
      listeners.add(listener);
      keep();
      return () => {
        listeners.delete(listener);
      };
    },
    leave() {
      if (self !== undefined) channel?.postMessage({ type: "leave", participant: self } satisfies Word);
      if (sweep) clearInterval(sweep);
      sweep = null;
      listeners.clear();
      known = new Map();
      channel?.close();
    },
  };
}
