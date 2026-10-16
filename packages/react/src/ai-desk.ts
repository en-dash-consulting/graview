import type { AiInteraction } from "@graview/core/catalog";
import type { AiInteractionHost } from "@graview/tools/frame";
import type { Ghost } from "@graview/tools/inline-ai";
import { useSyncExternalStore } from "react";

/**
 * THE INLINE AI'S DESK, held by the app rather than by the face drawing it:
 * the interactions this page made or its host handed back (`AiInteraction`,
 * what Activity draws), and the one ghost — changes proposed and not made —
 * waiting for the person to accept all of it, some or none, then the batch
 * it made, with its one undo, until it is put away.
 *
 * Plain data and a listener list, like the seat's conversation, so the
 * scene and the routed face read one desk and a face switch keeps it. An
 * entry made or changed is handed to the host's `keep`; the host's own are
 * asked for once (`load`), when Activity first draws them.
 */
export interface HeldGhost {
  readonly ghost: Ghost;
  /** The batch it made, once accepted: the tray's way back. */
  readonly batch?: string;
  /** How many of its proposals were taken. */
  readonly took?: number;
  /** Why the store refused it, said on the tray. */
  readonly refused?: string;
}

export interface AiDeskState {
  readonly entries: readonly AiInteraction[];
  readonly ghost: HeldGhost | null;
  /** Whether the host's entries were asked for. */
  readonly loaded: boolean;
}

export interface AiDesk {
  get(): AiDeskState;
  subscribe(listener: () => void): () => void;
  /** An entry made or changed: kept here by its id, and handed to the host. */
  record(entry: AiInteraction): void;
  setGhost(ghost: HeldGhost | null): void;
  /** Asks the host for its entries, once. */
  load(): void;
}

const EMPTY: AiDeskState = { entries: [], ghost: null, loaded: false };

/** Newest first; one entry per id, the later word kept. */
function merged(entries: readonly AiInteraction[], more: readonly AiInteraction[]): readonly AiInteraction[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const entry of more) byId.set(entry.id, { ...byId.get(entry.id), ...entry });
  return [...byId.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function createAiDesk(host: () => AiInteractionHost | undefined): AiDesk {
  let state = EMPTY;
  const listeners = new Set<() => void>();
  const set = (next: AiDeskState) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };
  return {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    record: (entry) => {
      set({ ...state, entries: merged(state.entries, [entry]) });
      void Promise.resolve(host()?.keep?.(entry)).catch((error: unknown) => {
        // The host could not keep it: it stays on this page, and the console says why.
        console.warn("The host did not keep an AI interaction:", error);
      });
    },
    setGhost: (ghost) => set({ ...state, ghost }),
    load: () => {
      if (state.loaded) return;
      set({ ...state, loaded: true });
      const loading = host()?.load;
      if (!loading) return;
      void Promise.resolve(loading())
        .then((entries) => set({ ...state, entries: merged(state.entries, entries) }))
        .catch((error: unknown) => {
          // The host's entries could not be had: this page's are still drawn.
          console.warn("The host's AI interactions could not be read:", error);
        });
    },
  };
}

/** The desk's state, drawn again when it changes. */
export function useAiDeskState(desk: AiDesk): AiDeskState {
  return useSyncExternalStore(desk.subscribe, desk.get, desk.get);
}
