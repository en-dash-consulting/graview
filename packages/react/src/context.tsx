import type { AnySchema, NodeOfSchema, Principal, Store, ViewRegistry } from "@graview/core";
import { useActivityState, type ActivityMark, type Attention } from "./activity.js";
import type { ViewState } from "@graview/layout";
import { EMPTY_VIEW } from "@graview/layout";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ViewComponent } from "./view-registry.js";

/**
 * How a view is being drawn right now.
 *
 * Every view must render correctly in BOTH modes — captured into the scene,
 * and live as a full page. That two-mode contract is the central constraint
 * on the view authoring API, and this is how a view finds out which it is in.
 */
export type ViewMode = "scene" | "fullscreen";

/** Which visual scheme the scene is drawn in. */
export type Scheme = "light" | "dark";

export interface GraviewContextValue<S extends AnySchema> {
  readonly store: Store<S>;
  /**
   * The scheme, so the RENDERER can match it. Depth is drawn differently in
   * daylight and in the dark, and a plane that recedes by losing light looks
   * wrong on paper.
   */
  readonly scheme: Scheme;
  readonly views: ViewRegistry<S, ViewComponent<S>>;
  readonly view: ViewState;
  setView(next: ViewState | ((current: ViewState) => ViewState)): void;
  readonly selection: readonly string[];
  setSelection(next: readonly string[] | ((current: readonly string[]) => readonly string[])): void;
  /** The view lifted out into a full page, if any. */
  readonly jackedIn: string | null;
  setJackedIn(id: string | null): void;
  /**
   * Where a context menu was asked for, in viewport coordinates.
   *
   * Selection stopped moving the view, so the actions want to be near the
   * thing rather than only in a strip at the bottom. This is the anchor; the
   * workbench draws the same derived affordances there that it draws in the
   * strip, because there must not be two renderings of an action.
   */
  readonly menuAt: { readonly x: number; readonly y: number } | null;
  setMenuAt(at: { x: number; y: number } | null): void;
  /**
   * What has just happened, per node, for a few seconds.
   *
   * Here for the same reason selection is: the scene, the chrome and an agent
   * seat must be looking at the same activity, or the picture and the list
   * disagree about what just happened.
   */
  readonly activity: ReadonlyMap<string, ActivityMark>;
  /** Report something looked at. A read leaves no diff, so it has to be told. */
  noteAttention(note: Attention): void;
  /**
   * Who is using this installation.
   *
   * Not a UI concern with a UI copy of the rules: this is the principal the
   * store enforces against and the log attributes to. The interface reads it
   * to decide what to OFFER; the store decides what to allow, and the two
   * cannot drift because they are the same object.
   */
  readonly principal: Principal;
}

const GraviewContext = createContext<GraviewContextValue<AnySchema> | null>(null);

/**
 * Nobody in particular. A store with no policy permits this principal
 * everything, which is what makes permission opt-in rather than a tax every
 * app pays before it has decided it has users.
 */
const ANONYMOUS: Principal = { kind: "human" };

export interface GraviewProviderProps<S extends AnySchema> {
  readonly store: Store<S>;
  readonly views: ViewRegistry<S, ViewComponent<S>>;
  readonly initialView?: ViewState;
  readonly scheme?: Scheme;
  /** Start jacked into one view — the deep-link case. */
  readonly initialJackedIn?: string | null;
  /** Defaults to an unroled human, which a store with no policy permits everything. */
  readonly principal?: Principal;
  /** Controlled mode: pass both to own navigation yourself (e.g. from a router). */
  readonly view?: ViewState;
  readonly onViewChange?: (next: ViewState) => void;
  readonly children: ReactNode;
}

/**
 * One provider holds the store, the view registry, the current view and the
 * selection.
 *
 * Selection lives HERE rather than inside the scene so that the scene and the
 * affordance surface are looking at the same thing — an action offered for a
 * selection the scene no longer has is the bug this prevents.
 */
export function GraviewProvider<S extends AnySchema>({
  store,
  views,
  initialView,
  scheme = "dark",
  initialJackedIn,
  principal = ANONYMOUS,
  view,
  onViewChange,
  children,
}: GraviewProviderProps<S>) {
  const [internalView, setInternalView] = useState<ViewState>(initialView ?? EMPTY_VIEW);
  const [selection, setSelectionState] = useState<readonly string[]>([]);
  const [jackedIn, setJackedIn] = useState<string | null>(initialJackedIn ?? null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const { activity, noteAttention } = useActivityState(store);

  const current = view ?? internalView;

  const setView = useCallback(
    (next: ViewState | ((currentView: ViewState) => ViewState)) => {
      const resolved = typeof next === "function" ? next(current) : next;
      if (onViewChange) onViewChange(resolved);
      if (view === undefined) setInternalView(resolved);
    },
    [current, onViewChange, view],
  );

  const setSelection = useCallback(
    (next: readonly string[] | ((currentSelection: readonly string[]) => readonly string[])) => {
      setSelectionState((previous) => (typeof next === "function" ? next(previous) : next));
    },
    [],
  );

  const value = useMemo<GraviewContextValue<S>>(
    () => ({
      store,
      scheme,
      views,
      view: current,
      setView,
      selection,
      setSelection,
      jackedIn,
      setJackedIn,
      menuAt,
      setMenuAt,
      activity,
      noteAttention,
      principal,
    }),
    [
      store,
      scheme,
      views,
      current,
      setView,
      selection,
      setSelection,
      jackedIn,
      menuAt,
      activity,
      noteAttention,
      principal,
    ],
  );

  return (
    <GraviewContext.Provider value={value as unknown as GraviewContextValue<AnySchema>}>
      {children}
    </GraviewContext.Provider>
  );
}

export function useGraview<S extends AnySchema>(): GraviewContextValue<S> {
  const value = useContext(GraviewContext);
  if (!value) {
    throw new Error("useGraview must be used inside a <GraviewProvider>.");
  }
  return value as unknown as GraviewContextValue<S>;
}

/**
 * Subscribes to the graph. Re-renders on every applied diff, whoever caused
 * it — so an agent's edit updates the interface through exactly the path a
 * human edit does.
 *
 * The snapshot is CACHED between diffs. `allNodes()` builds a fresh array
 * every call, and `useSyncExternalStore` compares snapshots by identity: a
 * new array each read is an infinite render loop, which is exactly what this
 * hook did before the cache existed.
 */
export function useGraph<S extends AnySchema>(): readonly NodeOfSchema<S>[] {
  const { store } = useGraview<S>();
  const cache = useRef<readonly NodeOfSchema<S>[] | null>(null);
  const owner = useRef<Store<S> | null>(null);

  const read = useCallback(() => {
    if (owner.current !== store) {
      owner.current = store;
      cache.current = null;
    }
    cache.current ??= store.graph.allNodes();
    return cache.current;
  }, [store]);

  const subscribe = useCallback(
    (listener: () => void) =>
      store.subscribe(() => {
        cache.current = null;
        listener();
      }),
    [store],
  );

  return useSyncExternalStore(subscribe, read, read);
}

/** One node, kept current as the graph changes underneath it. */
export function useNode<S extends AnySchema>(id: string | null): NodeOfSchema<S> | undefined {
  const { store } = useGraview<S>();
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  // A node is a stable object reference between edits, so this needs no cache.
  const read = useCallback(
    () => (id === null ? undefined : store.graph.getNode(id)),
    [store, id],
  );
  return useSyncExternalStore(subscribe, read, read);
}
