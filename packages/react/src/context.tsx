import type { AnySchema, NodeOfSchema, Store, ViewRegistry } from "@graview/core";
import type { ViewState } from "@graview/layout";
import { EMPTY_VIEW } from "@graview/layout";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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

export interface GraviewContextValue<S extends AnySchema> {
  readonly store: Store<S>;
  readonly views: ViewRegistry<S, ViewComponent<S>>;
  readonly view: ViewState;
  setView(next: ViewState | ((current: ViewState) => ViewState)): void;
  readonly selection: readonly string[];
  setSelection(next: readonly string[] | ((current: readonly string[]) => readonly string[])): void;
  /** The view lifted out into a full page, if any. */
  readonly jackedIn: string | null;
  setJackedIn(id: string | null): void;
}

const GraviewContext = createContext<GraviewContextValue<AnySchema> | null>(null);

export interface GraviewProviderProps<S extends AnySchema> {
  readonly store: Store<S>;
  readonly views: ViewRegistry<S, ViewComponent<S>>;
  readonly initialView?: ViewState;
  /** Start jacked into one view — the deep-link case. */
  readonly initialJackedIn?: string | null;
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
  initialJackedIn,
  view,
  onViewChange,
  children,
}: GraviewProviderProps<S>) {
  const [internalView, setInternalView] = useState<ViewState>(initialView ?? EMPTY_VIEW);
  const [selection, setSelectionState] = useState<readonly string[]>([]);
  const [jackedIn, setJackedIn] = useState<string | null>(initialJackedIn ?? null);

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
      views,
      view: current,
      setView,
      selection,
      setSelection,
      jackedIn,
      setJackedIn,
    }),
    [store, views, current, setView, selection, setSelection, jackedIn],
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
 */
export function useGraph<S extends AnySchema>(): readonly NodeOfSchema<S>[] {
  const { store } = useGraview<S>();
  return useSyncExternalStore(
    useCallback((listener) => store.subscribe(listener), [store]),
    useCallback(() => store.graph.allNodes(), [store]),
    useCallback(() => store.graph.allNodes(), [store]),
  );
}

/** One node, kept current as the graph changes underneath it. */
export function useNode<S extends AnySchema>(id: string | null): NodeOfSchema<S> | undefined {
  const { store } = useGraview<S>();
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const read = useCallback(
    () => (id === null ? undefined : store.graph.getNode(id)),
    [store, id],
  );
  return useSyncExternalStore(subscribe, read, read);
}
