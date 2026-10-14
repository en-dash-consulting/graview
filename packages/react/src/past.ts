import type { AnySchema, PastDeclaration, Principal, Store } from "@graview/core";
import type { HistoryHost } from "@graview/core/history";
import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from "react";

/**
 * THE APP AS IT WAS, SHOWN (Roadmap f-playback): which moment a face is
 * drawing instead of now, and the store of it (`store.at`) every surface
 * under it reads — the scene, the pages, the problems, the lenses — so the
 * past is drawn by the one renderer the present is.
 */
export interface PastShown<S extends AnySchema = AnySchema> {
  /** The ops before this seq are in it, none after. */
  readonly seq: number;
  /** When the last op in it was made. */
  readonly at: string | undefined;
  /** The whole store as it stood: read, never changed, offering no act. */
  readonly store: Store<S>;
}

/**
 * PLAYBACK, AS A FACE HOLDS IT: the moment shown (or `null`, now), the way
 * to show another, and the live store — what the timeline reads its ticks
 * from and a "Restore to here" changes. Held by the outermost provider of
 * a face (`GraviewProvider`, or the routed face's `PagesApp`), so a face
 * drawn inside another shares the one moment.
 */
export interface Playback<S extends AnySchema = AnySchema> {
  /** The moment drawn instead of now; `null` while now is drawn. */
  readonly past: PastShown<S> | null;
  /** Whether the timeline is open: at a moment, or at now with the way back still in reach. */
  readonly open: boolean;
  /**
   * Show the app as it stood at `seq` — the timeline opens on it; a seq at
   * or past the log's end is now, with the timeline still open. `null`
   * closes the timeline and comes back to now.
   */
  show(seq: number | null): void;
  /** The store as it is now, whole: read through the seat's sight (`seenBy`). */
  readonly live: Store<S>;
  /** What the host keeps outside the log: declaration changes, a script view's code at a moment. */
  readonly host: HistoryHost | undefined;
  /** Whether `store` is this playback's — now's or the moment's, whole or as one seat sees it. */
  owns(store: Store<AnySchema>, principal: Principal): boolean;
}

export const PlaybackContext = createContext<Playback | null>(null);

/** The playback the face under this is drawn with, if any. */
export function usePlayback<S extends AnySchema = AnySchema>(): Playback<S> | null {
  return useContext(PlaybackContext) as Playback<S> | null;
}

/**
 * THE STORE AS IT IS NOW, as this seat sees it, whatever moment the face
 * draws — what Activity lists and a timeline counts its ticks from — drawn
 * again as it changes. The provider's own store where there is no playback.
 */
export function useLiveStore<S extends AnySchema>(shown: Store<S>, principal: Principal): Store<S> {
  const playback = usePlayback<S>();
  const live = useMemo(() => (playback ? playback.live.seenBy(principal) : shown), [playback, shown, principal]);
  const version = useRef(0);
  const subscribe = useCallback(
    (listener: () => void) =>
      live.subscribe(() => {
        version.current += 1;
        listener();
      }),
    [live],
  );
  useSyncExternalStore(subscribe, () => version.current, () => 0);
  return live;
}

/** The declaration the host says a moment was made under: the last change at or before it that says one. */
function declarationIn(host: HistoryHost | undefined, seq: number): PastDeclaration | undefined {
  let found: PastDeclaration | undefined;
  for (const mark of [...(host?.declarations ?? [])].sort((a, b) => a.seq - b.seq)) {
    if (mark.seq > seq) break;
    if (mark.declaration) found = mark.declaration;
  }
  return found;
}

/**
 * A FACE'S OWN PLAYBACK over `live`, or the one it is drawn inside when
 * that one holds this store. Nothing past is folded until somebody asks to
 * see it; a moment the log no longer reaches (cut back under it) is now.
 */
export function useOwnPlayback<S extends AnySchema>(live: Store<S>, principal: Principal, host: HistoryHost | undefined): Playback<S> {
  const outer = useContext(PlaybackContext) as Playback<S> | null;
  const inherited = outer !== null && outer.owns(live as unknown as Store<AnySchema>, principal);
  const [seq, setSeq] = useState<number | null>(null);
  const past = useMemo<PastShown<S> | null>(() => {
    if (inherited || seq === null || seq >= live.log.length) return null;
    try {
      const store = live.at(seq, { declaration: declarationIn(host, seq) });
      return { seq, at: store.past?.at, store };
    } catch {
      return null;
    }
  }, [inherited, live, seq, host]);
  const show = useCallback((next: number | null) => setSeq(next === null ? null : next >= live.log.length ? Number.POSITIVE_INFINITY : next), [live]);
  const owns = useCallback(
    (store: Store<AnySchema>, seat: Principal) => [live as unknown as Store<AnySchema>, past?.store as unknown as Store<AnySchema> | undefined].some((one) => one !== undefined && (one === store || one.seenBy(seat) === store)),
    [live, past],
  );
  const open = seq !== null;
  const own = useMemo<Playback<S>>(() => ({ past, open, show, live, host, owns }), [past, open, show, live, host, owns]);
  return inherited ? outer : own;
}
