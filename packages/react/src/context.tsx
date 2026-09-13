import type {
  AnySchema,
  Brand,
  NodeOfSchema,
  Principal,
  SettingDeclaration,
  Store,
  ViewRegistry,
} from "@graview/core";
import type { AffordanceProvider } from "@graview/tools";
import { honourSetting, loadSetting, rememberSetting } from "./settings.js";
import { useActivityState, type ActivityMark, type Attention } from "./activity.js";
import type { ViewState } from "@graview/layout";
import { EMPTY_VIEW, edgeOfSelection, kindOfCard, kindsOfAggregate, withFocus, withSelection } from "@graview/layout";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

/**
 * A menu asked for at a point — and, when the gesture landed on something,
 * WHAT it landed on.
 *
 * The point alone was enough to draw the menu and not enough to order it: a
 * right-click on the fourth of six late tasks produced the same list as a
 * right-click on the first, led by whichever repair the rule happened to
 * name first. `on` is the thing under the pointer, and it reaches the
 * derivation as its focus so the menu opens on the press.
 */
/** One person a reader may sit down as, for an app that declares roles. */
export interface Seat {
  readonly label: string;
  readonly principal: Principal;
}

export interface PointerMenu {
  readonly x: number;
  readonly y: number;
  /** The node or edge the gesture landed on, when it landed on one. */
  readonly on?: string;
}

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
  readonly menuAt: PointerMenu | null;
  setMenuAt(at: PointerMenu | null): void;
  /**
   * The seats a reader may sit in, and how to sit down in one.
   *
   * A policy nobody can feel is a policy nobody believes. An app that
   * declares roles can offer the seats that hold them, and the bar draws a
   * control for them — the same way an embed's strip already did, except
   * that the demo people actually open is the app, not the embed.
   *
   * Empty when the app offers none, which is every app that has no policy.
   */
  readonly seats: readonly Seat[];
  /** Sit down in one of `seats`. A no-op when the app offered none. */
  takeSeat(principal: Principal): void;
  /**
   * The settings this app declares as the READER's, and what this reader
   * has them set to. The profile pane draws exactly these; nothing else
   * needs to know a setting exists, because the shell has already carried
   * the answer to the root element that every surface is sized against.
   */
  readonly settings: readonly SettingDeclaration[];
  readonly settingValues: Readonly<Record<string, string>>;
  chooseSetting(name: string, value: string): void;
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
   * The kinds not drawn for this seat at this stop: a workspace's disabled
   * modules, the administered modules this seat may not see, and the ones
   * it may see but has not asked to. One set, so the scene, the shelf, the
   * chat and the pages never disagree about what is there.
   */
  readonly hiddenKinds: ReadonlySet<string>;
  /**
   * The modules drawn only for those who administer them, as this seat
   * meets them: whether it may show each, and whether it is shown now.
   */
  readonly administered: readonly AdministeredModule[];
  /**
   * The intelligence this installation runs, as affordance providers.
   *
   * Held here so every suggestion surface derives from the same set — the
   * inspector, the pointer menu and a seat must not disagree about which
   * providers exist. Absent means the defaults.
   */
  readonly providers?: readonly AffordanceProvider<S>[];
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
const NO_SEATS: readonly Seat[] = [];
const NO_SETTINGS: readonly SettingDeclaration[] = [];

/** One shared empty, so "nothing selected" is referentially stable. */
const EMPTY_SELECTION: readonly string[] = [];

export interface AdministeredModule {
  readonly name: string;
  readonly description?: string;
  readonly kinds: readonly string[];
  /** Whether this seat may run any of the module's acts, and so may see it. */
  readonly canShow: boolean;
  /** Whether the stop shows it. Never true when `canShow` is false. */
  readonly shown: boolean;
}

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
  /**
   * The seats a reader may take. The first is where they start unless
   * `principal` says otherwise; the bar draws a control when there are two
   * or more, and nothing at all when there are none.
   */
  readonly seats?: readonly Seat[];
  /** Told when a seat is taken, for a host that keeps the choice (a URL, storage). */
  readonly onSeat?: (principal: Principal) => void;
  /** The app's declared reader settings — `app.settings`, passed straight through. */
  readonly settings?: readonly SettingDeclaration[];
  readonly brand?: Brand;
  /** Extra or replacement affordance providers (e.g. an LLM intelligence). */
  readonly providers?: readonly AffordanceProvider<S>[];
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
  principal,
  seats = NO_SEATS,
  onSeat,
  settings = NO_SETTINGS,
  brand,
  providers,
  view,
  onViewChange,
  children,
}: GraviewProviderProps<S>) {
  const [internalView, setInternalView] = useState<ViewState>(() =>
    withSelection(initialView ?? EMPTY_VIEW, initialSelection ?? initialView?.selection ?? []),
  );
  const homeView = useRef<ViewState>(initialView ?? EMPTY_VIEW).current;
  const [menuAt, setMenuAt] = useState<PointerMenu | null>(null);
  /*
   * WHO IS AT THE KEYBOARD, and the reader's own answer to it.
   *
   * `principal` is the app's: a host that knows who signed in passes one and
   * the seats never move it. Where the app instead offers seats — the demos,
   * an embed on a page, anywhere the point is to FEEL the policy — sitting
   * down is a state change here, so every surface (the strip's narrowing,
   * the withheld sentence, "Show the installation", the pages, the agent's
   * tools) re-derives from one principal rather than each reading its own.
   */
  const [seated, setSeated] = useState<Principal | null>(null);
  const who = seated ?? principal ?? seats[0]?.principal ?? ANONYMOUS;
  const takeSeat = useCallback(
    (next: Principal) => {
      setSeated(next);
      onSeat?.(next);
    },
    [onSeat],
  );

  /*
   * WHAT THE READER SET FOR THEMSELVES, read once and applied to the root.
   *
   * Read lazily so a browser that cannot remember still opens on the
   * declaration's own values, and applied in an effect rather than during
   * render — writing to `document.documentElement` while React is
   * rendering is a side effect in the wrong place, and would also run on a
   * server where there is no document at all.
   */
  const [settingValues, setSettingValues] = useState<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(settings.map((setting) => [setting.name, loadSetting(setting)])),
  );
  useEffect(() => {
    for (const setting of settings) {
      honourSetting(setting, settingValues[setting.name] ?? setting.initial);
    }
  }, [settings, settingValues]);
  const chooseSetting = useCallback(
    (name: string, value: string) => {
      const setting = settings.find((candidate) => candidate.name === name);
      if (!setting || !setting.options.some((option) => option.value === value)) return;
      rememberSetting(setting, value);
      setSettingValues((current) => ({ ...current, [name]: value }));
    },
    [settings],
  );
  const [emphasis, setEmphasis] = useState<string | null>(null);
  const { activity, noteAttention } = useActivityState(store);

  /** Whether an id in the address still names something the graph has. */
  const stillThere = useCallback(
    (id: string): boolean => {
      if (kindOfCard(id) !== null || kindsOfAggregate(id).length > 0) return true;
      const edge = edgeOfSelection(id);
      if (edge) {
        return store.graph
          .allEdges()
          .some(
            (other) => other.kind === edge.kind && other.from === edge.from && other.to === edge.to,
          );
      }
      return store.graph.getNode(id) !== undefined;
    },
    [store],
  );

  /** The same stop with every dead id taken out of it. */
  const withoutWhatIsGone = useCallback(
    (state: ViewState): ViewState => {
      const held = state.selection ?? EMPTY_SELECTION;
      const kept = held.filter(stillThere);
      let next = kept.length === held.length ? state : withSelection(state, kept);
      // Null, not home: `resolveStop` below already knows where an app's
      // home is, and an app that opens from altitude has no in-stack one.
      if (next.focusId !== null && !stillThere(next.focusId)) next = withFocus(next, null);
      return next;
    },
    [stillThere],
  );

  /*
   * A STOP, MADE STANDABLE-ON.
   *
   * Every way in writes here — a control, a popstate, a pasted link — and
   * so does the render itself, because the graph can change underneath a
   * stop nobody navigated away from. An id resolved at navigation time only
   * is an id that goes stale the moment an act removes what it names.
   */
  const resolveStop = useCallback(
    (state: ViewState): ViewState => {
      let resolved = withoutWhatIsGone(state);
      /*
       * A focus this workspace cannot show — a bookmarked node whose
       * module is off — lands on home rather than on a void with its
       * name in the address bar.
       */
      const disabled = hiddenFor(store, who, resolved.shown);
      if (resolved.focusId !== null && disabled.size > 0) {
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
    },
    [withoutWhatIsGone, store, homeView, who],
  );

  /*
   * Resolved on the way OUT, not only on the way in: an act that removes
   * the focused record has to leave a stop standing on solid ground in the
   * very render that reports the removal, before a layout is asked to place
   * a node that is not there.
   */
  const current = resolveStop(view ?? internalView);
  const hiddenKinds = useMemo(() => hiddenFor(store, who, current.shown), [store, who, current.shown]);
  const administered = useMemo<readonly AdministeredModule[]>(
    () =>
      [...store.modules.administered.entries()].map(([name, module]) => {
        const canShow = store.mayAdminister(name, who);
        return {
          name,
          ...(module.description ? { description: module.description } : {}),
          kinds: module.kinds ?? [],
          canShow,
          shown: canShow && (current.shown ?? []).includes(name),
        };
      }),
    [store, who, current.shown],
  );

  const setView = useCallback(
    (next: ViewState | ((currentView: ViewState) => ViewState)) => {
      const resolve = (base: ViewState): ViewState =>
        resolveStop(typeof next === "function" ? next(base) : next);
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
    [current, onViewChange, view, resolveStop],
  );

  /*
   * And the address follows: once the render has resolved the stop, the
   * fragment says the place you are actually standing in rather than the
   * one that was removed underneath you. `useUrlSync` writes from the
   * resolved view, so this only has to make sure the state behind it
   * agrees — otherwise the next navigation resolves against a dead id.
   */
  useEffect(() => {
    if (view !== undefined) return;
    setInternalView((previous) => {
      const resolved = resolveStop(previous);
      return resolved === previous ? previous : resolved;
    });
  }, [current, view, resolveStop]);

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
      principal: who,
      seats,
      takeSeat,
      settings,
      settingValues,
      chooseSetting,
      hiddenKinds,
      administered,
      ...(providers ? { providers } : {}),
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
      who,
      seats,
      takeSeat,
      settings,
      settingValues,
      chooseSetting,
      hiddenKinds,
      administered,
      providers,
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

/**
 * What a seat does not see at a stop. Disabled modules are nobody's; an
 * administered module is kept from a seat that may not run its acts, and
 * from one that may until the stop says `shown` — what the address says is
 * never enough on its own.
 */
function hiddenFor<S extends AnySchema>(
  store: Store<S>,
  principal: Principal,
  shown: readonly string[] | undefined,
): ReadonlySet<string> {
  const hidden = new Set<string>(store.modules.disabledKinds);
  for (const kind of store.kindsKeptFrom(principal)) hidden.add(kind);
  for (const [name, module] of store.modules.administered) {
    if (store.mayAdminister(name, principal) && (shown ?? []).includes(name)) continue;
    for (const kind of module.kinds ?? []) hidden.add(kind);
  }
  return hidden;
}
