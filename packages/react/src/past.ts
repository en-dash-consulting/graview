import type { AnySchema, Principal, Store } from "@graview/core";
import type { HistoryHost } from "@graview/core/history";
import { retryingImport } from "@graview/core/retry";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

/**
 * THE APP AS IT WAS, SHOWN (Roadmap f-playback): which moment a face is
 * drawing instead of now, and the store of it (`pastOf`) every surface
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
  /** What the host keeps outside the log: declaration changes, a script view's code at a moment, the ops a compaction archived. */
  readonly host: HistoryHost | undefined;
  /**
   * A MOMENT BEHIND THE UNDO HORIZON, WHILE IT IS READ FROM THE HOST'S
   * ARCHIVE (FR-196): its seq, and what the host's refusal or failure said
   * when it could not be. Meanwhile `past` is the picture shown before.
   * `null` when no moment is waiting on the archive.
   */
  readonly archive: { readonly seq: number; readonly refused?: string } | null;
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

type History = typeof import("@graview/core/past");
/** `@graview/core/past`, fetched when somebody first asks to see the past: the fold is none of a page's weight until then. */
const history = /* @__PURE__ */ retryingImport(() => import("@graview/core/past"));
/** The module once it is here, so a face drawn after it arrived shows the past at once. */
let arrived: History | undefined;
/** How long a moment holds the picture it had while the host is asked for its declaration, before it is drawn under today's until the answer comes. */
const ANSWER_HELD_MS = 400;

/**
 * A FACE'S OWN PLAYBACK over `live`, or the one it is drawn inside when
 * that one holds this store. Nothing past is folded — or fetched — until
 * somebody asks to see it; a moment the log no longer reaches (cut back
 * under it) is now.
 */
export function useOwnPlayback<S extends AnySchema>(live: Store<S>, principal: Principal, host: HistoryHost | undefined): Playback<S> {
  const outer = useContext(PlaybackContext) as Playback<S> | null;
  const inherited = outer !== null && outer.owns(live as unknown as Store<AnySchema>, principal);
  const [seq, setSeq] = useState<number | null>(null);
  const [folds, setFolds] = useState<History | undefined>(arrived);
  // The past is fetched the first time it is asked for; until it is here, now is drawn.
  useEffect(() => {
    if (folds || inherited || seq === null) return;
    let live = true;
    void history().then(
      (module) => {
        arrived = module;
        if (live) setFolds(module);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [folds, inherited, seq]);
  // A mark the host handed without its declaration is asked for (`history.declarationAt`); the moment waits on the answer.
  const [answered, setAnswered] = useState(0);
  // A moment behind the horizon is first read from the host's archive (FR-196): held however long that takes, and said when it is refused.
  const asked = useMemo(() => (inherited || seq === null || seq >= live.log.length || !folds ? undefined : (folds.askArchived(live, seq, host) ?? folds.askDeclaration(host, seq))), [inherited, live, seq, host, folds, answered]);
  const waiting = asked && "waiting" in asked ? asked.waiting : undefined;
  const reading = asked && "seq" in asked ? asked : null;
  const [late, setLate] = useState<Promise<void> | undefined>(undefined);
  useEffect(() => {
    if (!waiting) return;
    let on = true;
    const slow = setTimeout(() => on && setLate(waiting), ANSWER_HELD_MS);
    void waiting.then(() => on && setAnswered((n) => n + 1));
    return () => {
      on = false;
      clearTimeout(slow);
    };
  }, [waiting]);
  const held = (waiting !== undefined && late !== waiting) || reading !== null;
  const drawn = useMemo<PastShown<S> | null>(() => {
    if (inherited || seq === null || seq >= live.log.length || !folds || held) return null;
    try {
      const store = folds.pastAt(live, seq, host);
      return { seq, at: store.past?.at, store };
    } catch {
      return null;
    }
  }, [inherited, live, seq, host, folds, held, answered]);
  // While the answer is on its way the picture it had stays, rather than flash the moment under today's declaration.
  const last = useRef<PastShown<S> | null>(null);
  const past = held ? last.current : drawn;
  useEffect(() => {
    last.current = past;
  }, [past]);
  const show = useCallback((next: number | null) => setSeq(next === null ? null : next >= live.log.length ? Number.POSITIVE_INFINITY : next), [live]);
  const owns = useCallback(
    (store: Store<AnySchema>, seat: Principal) => [live as unknown as Store<AnySchema>, past?.store as unknown as Store<AnySchema> | undefined].some((one) => one !== undefined && (one === store || one.seenBy(seat) === store)),
    [live, past],
  );
  const open = seq !== null;
  const own = useMemo<Playback<S>>(() => ({ past, open, show, live, host, owns, archive: reading }), [past, open, show, live, host, owns, reading]);
  return inherited ? outer : own;
}
