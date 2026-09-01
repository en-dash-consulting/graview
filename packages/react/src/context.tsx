import type {
  AnySchema,
  Brand,
  NodeOfSchema,
  Principal,
  Store,
  ViewRegistry,
} from "@graview/core";
import { useActivityState, type ActivityMark, type Attention } from "./activity.js";
import type { ViewState } from "@graview/layout";
import { EMPTY_VIEW, kindsOfAggregate, withSelection } from "@graview/layout";
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
  /**
   * The view the app OPENED ON — the landing stop. The wordmark returns
   * here, the way a site's logo returns to its front page; remembered at
   * mount so navigation cannot redefine what "home" means.
   */
  readonly homeView: ViewState;
  readonly selection: readonly string[];
  setSelection(next: readonly string[] | ((current: readonly string[]) => readonly string[])): void;
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
   * A relation singled out for emphasis, by edge kind, or null for none.
   *
   * Hovering a row of the relation key names the relation whose lines should
   * come forward while the rest recede — which is what makes the legend part
   * of the picture instead of a caption beside it. Held here for the same
   * reason selection is: the key is chrome and the connectors are the
   * scene's, and the two must agree about which relation is being asked
   * about.
   */
  readonly emphasis: string | null;
  setEmphasis(kind: string | null): void;
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
  /**
   * Whose product this is: name, wordmark, typography, palette.
   *
   * Absent means the framework's own, which is what makes branding an
   * installation a matter of passing one object rather than forking the
   * components that read it.
   */
  readonly brand?: Brand;
}

const GraviewContext = createContext<GraviewContextValue<AnySchema> | null>(null);

/**
 * Which mode the view being rendered right now is in.
 *
 * `mode` already arrives as a prop, and every view author was expected to
 * thread it into whatever primitive needed it — which is the kind of contract
 * that holds for the framework's own views and quietly does not for anyone
 * else's. Three apps in, the app-written views were still drawing card
 * furniture on a full page because nobody remembers a prop they only need on
 * one screen.
 *
 * So the primitives read it themselves. A view can still say `variant`
 * explicitly and win; the context is only what happens when it says nothing.
 */
const ViewModeContext = createContext<ViewMode>("scene");

export function ViewModeProvider({
  mode,
  children,
}: {
  readonly mode: ViewMode;
  readonly children: ReactNode;
}) {
  return <ViewModeContext.Provider value={mode}>{children}</ViewModeContext.Provider>;
}

/** How the surrounding view is being drawn. `scene` outside any view. */
export function useViewMode(): ViewMode {
  return useContext(ViewModeContext);
}

/**
 * Nobody in particular. A store with no policy permits this principal
 * everything, which is what makes permission opt-in rather than a tax every
 * app pays before it has decided it has users.
 */
const ANONYMOUS: Principal = { kind: "human" };

/** One shared empty, so "nothing selected" is referentially stable. */
const EMPTY_SELECTION: readonly string[] = [];

export interface GraviewProviderProps<S extends AnySchema> {
  readonly store: Store<S>;
  readonly views: ViewRegistry<S, ViewComponent<S>>;
  readonly initialView?: ViewState;
  readonly scheme?: Scheme;
  /**
   * Start with something already selected.
   *
   * The deep-link case again: "here is the thing I am talking about" is a
   * legitimate way to arrive, and the interface should open with its actions
   * already on screen rather than making the arrival a second gesture.
   */
  readonly initialSelection?: readonly string[];
  /** Defaults to an unroled human, which a store with no policy permits everything. */
  readonly principal?: Principal;
  readonly brand?: Brand;
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
  initialSelection,
  principal = ANONYMOUS,
  brand,
  view,
  onViewChange,
  children,
}: GraviewProviderProps<S>) {
  const [internalView, setInternalView] = useState<ViewState>(() =>
    withSelection(initialView ?? EMPTY_VIEW, initialSelection ?? initialView?.selection ?? []),
  );
  const homeView = useRef<ViewState>(initialView ?? EMPTY_VIEW).current;
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [emphasis, setEmphasis] = useState<string | null>(null);
  const { activity, noteAttention } = useActivityState(store);

  const current = view ?? internalView;

  const setView = useCallback(
    (next: ViewState | ((currentView: ViewState) => ViewState)) => {
      const resolve = (base: ViewState): ViewState => {
        let resolved = typeof next === "function" ? next(base) : next;
        /*
         * INSIDE THE STACK, SOMETHING IS ALWAYS FOCUSED.
         *
         * A focusless in-stack view renders a shelf and a void — a screen
         * with no main view, which reads as being stuck rather than as being
         * anywhere. No control writes that state on purpose, but URLs,
         * history pops and chains of chrome can compose it. Whatever asked
         * for nothing lands on the view the app opened with instead. The
         * overview stays free to be focusless: up there the ring is the
         * picture.
         */
        /*
         * A focus this workspace cannot show — a bookmarked node whose
         * module is off — lands on home rather than on a void with its
         * name in the address bar.
         */
        if (resolved.focusId !== null && store.modules.disabledKinds.size > 0) {
          const disabled = store.modules.disabledKinds;
          const kinds = kindsOfAggregate(resolved.focusId);
          const node = store.graph.getNode(resolved.focusId);
          const gone =
            kinds.length > 0
              ? kinds.every((kind) => disabled.has(kind))
              : node
                ? disabled.has(node.kind as string)
                : false;
          if (gone) resolved = { ...resolved, focusId: null };
        }
        if (!resolved.overview && resolved.focusId === null) {
          if (homeView.focusId !== null) {
            resolved = { ...resolved, focusId: homeView.focusId };
          } else if (homeView.overview === true) {
            // An app that OPENS from altitude has no in-stack default:
            // falling out of the overview with nothing to focus lands back
            // on the overview, so Escape at the outermost place is a no-op
            // rather than a void.
            resolved = { ...resolved, overview: true };
          }
        }
        return resolved;
      };
      if (view !== undefined) {
        onViewChange?.(resolve(view));
        return;
      }
      if (onViewChange) onViewChange(resolve(current));
      /*
       * Resolved against the PREVIOUS state, not the render-time view.
       *
       * Two writes in one gesture are ordinary — travelling also selects,
       * going home also clears — and React batches them into one commit.
       * Resolving both against the same stale render made the second write
       * silently discard the first: the travel never happened, only its
       * selection did. Functional composition is what "two updates" means.
       */
      setInternalView((previous) => resolve(previous));
    },
    [current, onViewChange, view, homeView, store],
  );

  /*
   * Selection is VIEW STATE — part of the stop, not component state beside
   * it. That is what makes back/forward restore the pane that was open, a
   * refresh keep what you were pointing at, and a link carry the thing as
   * well as the place. Changing it is an adjustment of the stop you are on
   * (like a pan), so a run of clicks is not a run of history entries.
   */
  const selection = current.selection ?? EMPTY_SELECTION;
  const setSelection = useCallback(
    (next: readonly string[] | ((currentSelection: readonly string[]) => readonly string[])) => {
      setView((currentView) =>
        withSelection(
          currentView,
          typeof next === "function" ? next(currentView.selection ?? EMPTY_SELECTION) : next,
        ),
      );
    },
    [setView],
  );

  const value = useMemo<GraviewContextValue<S>>(
    () => ({
      store,
      scheme,
      views,
      view: current,
      setView,
      homeView,
      selection,
      setSelection,
      menuAt,
      setMenuAt,
      emphasis,
      setEmphasis,
      activity,
      noteAttention,
      principal,
      ...(brand ? { brand } : {}),
    }),
    [
      store,
      scheme,
      views,
      current,
      setView,
      selection,
      setSelection,
      menuAt,
      emphasis,
      activity,
      noteAttention,
      principal,
      brand,
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
