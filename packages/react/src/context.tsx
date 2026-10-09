import type {
  AnySchema,
  Brand,
  NodeOfSchema,
  Person,
  Presence,
  PresenceChannel,
  Principal,
  SearchResult,
  SettingDeclaration,
  Store,
  ViewRegistry,
} from "@graview/core";
import { openingOf, search, tellTheWatchItsAuthors, tellTheWatchWhatIsUnseen, touchWeights, type Place, type PagesArrangement } from "@graview/core";
import { loadIntelligenceConfig, saveIntelligenceConfig, type AffordanceProvider, type IntelligenceConfig } from "@graview/tools/frame";
import { honorSetting, loadSetting, rememberSetting, type ReaderMemory } from "./settings.js";
import { createSeatTalk, type SeatTalk } from "./seat-talk.js";
import { PRESENCE_SETTINGS, tabSession, usePresenceState } from "./presence.js";
import { useActivityState, type ActivityMark, type Attention } from "./activity.js";
import type { ViewState } from "@graview/layout/view";
import { EMPTY_VIEW, aggregateId, edgeOfSelection, isBandAggregate, kindOfCard, kindsOfAggregate, withFocus, withSelection } from "@graview/layout/view";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPointerStore, type PointerStore, type ScenePoint } from "./pointer.js";
import { createMotionStore, type MotionStore } from "./motion-store.js";
import { foldRobots, type RobotEvent, type RobotState, type SeatNote } from "./robot.js";
import type { ViewComponent, ViewMode } from "./view-registry.js";

export type { ViewMode } from "./view-registry.js";

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

/**
 * THE KEY THAT TAKES THE KEYBOARD FROM A CARD TO ITS ACTS.
 *
 * On a phone the acts live in a folded sheet, and from the keyboard the
 * sheet's toggle was a walk of a dozen Tabs past every other card from the
 * card you were on. Whatever draws the acts — the Shell's seat — lends the
 * scene this door; a card with the keyboard on it then answers `key` the
 * way it answers a right-click, and says so (`aria-keyshortcuts`). With no
 * seat drawn there is no door, and the card claims no key.
 */
export interface ActsDoor {
  /** The key, as `aria-keyshortcuts` names it: one letter, pressed on the card. */
  readonly key: string;
  /** Open the acts and put the keyboard on them; `from` is where it comes back to. */
  open(from: HTMLElement): void;
}

export interface PointerMenu {
  readonly x: number;
  readonly y: number;
  /** The node or edge the gesture landed on, when it landed on one. */
  readonly on?: string;
}

/** A box in scene coordinates: where something is drawn. */
export interface DrawnBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What a mounted scene lends the context: its own answer to "where is". */
export interface SceneHandle {
  whereIs(id: string): DrawnBox | null;
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
   * WHERE SOMETHING IS DRAWN, RIGHT NOW — the spatial API everything later
   * stands on. `id` is a node id, `kind:<kind>`, `aggregate:<kind>` or a
   * Place slug; the answer is its box in scene coordinates from the CURRENT
   * frame, so it rides the tween and the pan. A node not drawn itself
   * answers as the nearest drawn container, the rule the connectors use.
   * Null when nothing is drawing (no scene mounted, or the id is nowhere).
   */
  whereIs(id: string): DrawnBox | null;
  /**
   * The pointer over the scene, for whoever subscribes — and a quiet scene
   * runs no listener at all: the store counts its subscribers and the scene
   * attaches on the first, detaches on the last.
   */
  readonly pointer: PointerStore;
  /** Whether the scene is moving: set by the scene, read with `useSceneStill`. */
  readonly motion: MotionStore;
  /** The scene says what it is drawing. Nobody else calls this. */
  registerScene(handle: SceneHandle | null): void;
  /**
   * THE ROBOTS: one body per agent participant, standing where it read,
   * wrote, was refused or is asking — folded from the same events the
   * activity marks are folded from, plus what the seat itself says.
   */
  readonly robots: ReadonlyMap<string, RobotState>;
  /** Tell the robots something the log cannot: a refusal, a question, a reply, a follow. */
  noteSeat(event: SeatNote): void;
  /**
   * The seat this tab's interactive surfaces act as, so the one-press seat
   * and the chat are ONE robot: the seat registers its name and the chat
   * writes as it. Null until a seat sits down; the chat then writes as
   * "chat".
   */
  readonly seatWho: string | null;
  registerSeatWho(who: string | null): void;
  /** The way from a card to its acts, lent by whatever draws them; null when nothing does. */
  readonly actsDoor: ActsDoor | null;
  registerActsDoor(door: ActsDoor | null): void;
  /**
   * THE CONVERSATION WITH THE SEAT, held by the app rather than by the face
   * drawing it (see `seat-talk.ts`): the turns, what became of each
   * proposal, whether the seat is open and at which foot. A face switch
   * keeps it; Find's "Ask:" row asks through it.
   */
  readonly seatTalk: SeatTalk;
  /** Where the reader's own choices are kept: the host's, or the page's storage when it gave none. */
  readonly memory?: ReaderMemory;
  /**
   * WHO IS WHERE. The others on this map, by participant; whose stop this
   * tab is adopting; how this tab is seen; and this tab's own session —
   * the third part of every participant key, on its ops and its figure alike.
   */
  readonly who: ReadonlyMap<string, Presence>;
  readonly following: Presence | null;
  follow(participant: string | null): void;
  readonly sharing: { readonly participant: string; readonly name: string } | null;
  readonly session: string;
  /**
   * THE LADDER IS A SETTING. Which rung answers — the graph, a model in
   * this browser, a decision provider, or a frontier model with the
   * person's own key — is the reader's, kept in their own storage. Owned
   * here so the profile pane sets it and the chat reads it: one choice,
   * two surfaces that cannot disagree.
   */
  readonly intelligence: IntelligenceConfig;
  chooseIntelligence(next: IntelligenceConfig): void;
  /** A host that answers the chat itself (a `respond` on the panel) has decided for the reader: the ladder is not theirs to set. */
  readonly hostAnswers: boolean;
  registerHostAnswers(answers: boolean): void;
  /** Whether a hand has panned or dragged in this tab, so "moved" on the bar means a move somebody made. */
  readonly movedByHand: boolean;
  noteMoved(): void;
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
  /**
   * THE PEOPLE THE APP MAY NAME, apart from the seats (FR-13): a host's
   * directory of who has an account here, so the rail and the pages say
   * "Nick" for an op a member made, without anybody being offered a seat.
   */
  readonly people: readonly Person[];
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
const NO_PEOPLE: readonly Person[] = [];
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
  /**
   * Who the app may name: a host's directory, kept apart from the seats so
   * naming a member never offers to sit as them. Changes as the host's do.
   */
  readonly people?: readonly Person[];
  /**
   * Where the reader's own choices are kept. The page's `localStorage` by
   * default, which a sandboxed frame refuses; a host passes its own.
   */
  readonly memory?: ReaderMemory;
  /** How long a participant the presence channel told of stands without a fresh word. */
  readonly presenceTtlMs?: number;
  /** The app's declared reader settings — `app.settings`, passed straight through. */
  readonly settings?: readonly SettingDeclaration[];
  /**
   * The channel that carries who is where — `createBroadcastPresence` beside
   * the browser adapter, or a remote store's own. Without one this tab
   * broadcasts nothing and draws nobody, which is what an embed wants
   * unless it opts in.
   */
  readonly presence?: PresenceChannel;
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
/**
 * A watching harness is told what this seat may not see, and told again as
 * the graph changes, so every screen can be held to it (`scripts/lib/watch.mjs`,
 * "shown-what-is-not-theirs"). Outside a harness this is one property read.
 */
export function useTheWatchKnowsWhatIsUnseen<S extends AnySchema>(store: Store<S>, principal: Principal | undefined): void {
  const from = useId();
  useEffect(() => {
    if (!(globalThis as { __graviewWatch?: unknown }).__graviewWatch) return;
    const seat = principal ?? ANONYMOUS;
    const tell = () => {
      tellTheWatchWhatIsUnseen(store as never, seat, from);
      tellTheWatchItsAuthors(store as never);
    };
    tell();
    let soon: ReturnType<typeof setTimeout> | undefined;
    const off = store.subscribe(() => {
      clearTimeout(soon);
      soon = setTimeout(tell, 250);
    });
    return () => {
      clearTimeout(soon);
      off();
      // This surface is gone: what it could not see no longer counts.
      (globalThis as { __graviewWatch?: { unseen?(said: { words: readonly string[]; from: string; gone: true }): void } }).__graviewWatch?.unseen?.({ words: [], from, gone: true });
    };
  }, [store, principal, from]);
}

export function GraviewProvider<S extends AnySchema>({
  store: given,
  views,
  initialView,
  scheme = "dark",
  initialSelection,
  principal,
  seats = NO_SEATS,
  onSeat,
  people = NO_PEOPLE,
  memory,
  presenceTtlMs,
  settings: appSettings = NO_SETTINGS,
  presence,
  brand,
  providers,
  view,
  onViewChange,
  children,
}: GraviewProviderProps<S>) {
  /* Who is at the keyboard: see "WHO IS AT THE KEYBOARD" below. */
  const [seated, setSeated] = useState<Principal | null>(null);
  const seatNow = seated ?? principal ?? seats[0]?.principal ?? ANONYMOUS;
  /*
   * WHAT THEY MAY SEE. Every surface under this provider reads the store it
   * hands out, and that store holds only what the policy's `sees` lets the
   * seat see — a stranger at a storefront is not shown the customers. Acts
   * still go to the store itself. With no `sees` it is the store, unchanged.
   */
  const store = useMemo(() => given.seenBy(seatNow), [given, seatNow]);
  useTheWatchKnowsWhatIsUnseen(given, seatNow);
  /* This tab, for the life of the tab: see `tabSession`. */
  const [session] = useState(() => tabSession(memory));
  const [intelligence, setIntelligence] = useState<IntelligenceConfig>(() => loadIntelligenceConfig());
  const chooseIntelligence = useCallback((next: IntelligenceConfig) => {
    saveIntelligenceConfig(next);
    setIntelligence(next);
  }, []);
  const [movedByHand, setMovedByHand] = useState(false);
  const [hostAnswers, setHostAnswers] = useState(false);
  const registerHostAnswers = useCallback((answers: boolean) => setHostAnswers(answers), []);
  const noteMoved = useCallback(() => setMovedByHand(true), []);
  /* Privacy is a reader setting, and it appears only where there is somebody to be seen by. */
  const settings = useMemo(
    () => (presence ? [...appSettings, ...PRESENCE_SETTINGS] : appSettings),
    [appSettings, presence],
  );
  /*
   * WHERE THE APP OPENS: the view it was handed, else the place its
   * declaration names first (FR-80, `pages.first`), else nowhere in
   * particular.
   */
  const [opening] = useState<ViewState | undefined>(() => initialView ?? openingView(views, given.schema));
  const [internalView, setInternalView] = useState<ViewState>(() =>
    withSelection(opening ?? EMPTY_VIEW, initialSelection ?? opening?.selection ?? []),
  );
  const homeView = useRef<ViewState>(opening ?? EMPTY_VIEW).current;
  const [menuAt, setMenuAt] = useState<PointerMenu | null>(null);
  const [actsDoor, registerActsDoor] = useState<ActsDoor | null>(null);
  /* One conversation per app: an outer provider's when this one is drawn inside it (the routed face in an embed). */
  const outer = useContext(GraviewContext);
  const [seatTalk] = useState<SeatTalk>(() => outer?.seatTalk ?? createSeatTalk(brand?.name ?? given.schema.kinds.join(",")));
  /*
   * The scene's handle, held in a ref: where things are changes every frame
   * of a tween, and a context value that changed with it would re-render
   * every consumer sixty times a second for a question most never ask.
   */
  const sceneHandle = useRef<SceneHandle | null>(null);
  const registerScene = useCallback((handle: SceneHandle | null) => {
    sceneHandle.current = handle;
  }, []);
  const whereIs = useCallback((id: string): DrawnBox | null => sceneHandle.current?.whereIs(id) ?? null, []);
  const [pointer] = useState<PointerStore>(() => createPointerStore());
  const [motion] = useState<MotionStore>(() => createMotionStore());
  const [seatWho, setSeatWho] = useState<string | null>(null);
  /*
   * THE ROBOTS' STATE, folded here beside the activity marks, from the same
   * two sources — ops as they land, reads as the runtime reports them —
   * and from what a seat says of itself. One timer rests them after the
   * hold; a quiet city holds no timer.
   */
  const [robots, setRobots] = useState<ReadonlyMap<string, RobotState>>(() => new Map());
  const robotsLive = useRef(robots);
  robotsLive.current = robots;
  const restTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kindOf = useCallback((id: string) => store.graph.getNode(id)?.kind as string | undefined, [store]);
  const foldSeat = useCallback(
    (event: RobotEvent) => {
      const next = foldRobots(robotsLive.current, event, kindOf);
      robotsLive.current = next;
      setRobots(next);
      if (restTimer.current) clearTimeout(restTimer.current);
      const busy = [...next.values()].some((robot) => robot.mode !== "docked" && robot.mode !== "asking");
      if (busy) {
        restTimer.current = setTimeout(() => {
          const rested = foldRobots(robotsLive.current, { type: "rest", at: Date.now(), holdMs: ROBOT_REST_MS }, kindOf);
          robotsLive.current = rested;
          setRobots(rested);
        }, ROBOT_REST_MS + 20);
      }
    },
    [kindOf],
  );
  const noteSeat = useCallback((event: SeatNote) => foldSeat({ ...event, at: event.at ?? Date.now() } as RobotEvent), [foldSeat]);
  /*
   * A SEAT THAT SITS DOWN HAS A BODY AT ONCE, docked: the robot is in the
   * city from the first frame, not from the first turn.
   */
  const registerSeatWho = useCallback(
    (who: string | null) => {
      setSeatWho(who);
      if (who) foldSeat({ type: "home", author: { kind: "agent", id: who, session }, at: Date.now() });
    },
    [foldSeat, session],
  );
  useEffect(
    () =>
      store.subscribe((_diff, ops) => {
        for (const op of ops) {
          if (op.author.kind !== "agent") continue;
          foldSeat({ type: "write", author: op.author, ids: op.writes, at: Date.now() });
        }
      }),
    [store, foldSeat],
  );
  useEffect(
    () => () => {
      if (restTimer.current) clearTimeout(restTimer.current);
    },
    [],
  );
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
  // With this tab's session on it, so every op this seat authors names the tab that made it.
  const who = useMemo<Principal>(() => ({ ...seatNow, session }), [seatNow, session]);
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
    Object.fromEntries(settings.map((setting) => [setting.name, loadSetting(setting, memory)])),
  );
  useEffect(() => {
    for (const setting of settings) {
      honorSetting(setting, settingValues[setting.name] ?? setting.initial);
    }
  }, [settings, settingValues]);
  const chooseSetting = useCallback(
    (name: string, value: string) => {
      const setting = settings.find((candidate) => candidate.name === name);
      if (!setting || !setting.options.some((option) => option.value === value)) return;
      rememberSetting(setting, value, memory);
      setSettingValues((current) => ({ ...current, [name]: value }));
    },
    [settings, memory],
  );
  const [emphasis, setEmphasis] = useState<string | null>(null);
  const { activity, noteAttention: markAttention } = useActivityState(store);
  const noteAttention = useCallback(
    (note: Attention) => {
      markAttention(note);
      foldSeat({ type: "read", author: note.author, ids: note.reads, at: Date.now() });
    },
    [markAttention, foldSeat],
  );

  /** Whether an id in the address still names something the graph has. */
  const stillThere = useCallback(
    (id: string): boolean => {
      if (kindOfCard(id) !== null || kindsOfAggregate(id).length > 0) return true;
      // A band's group names a run of a relation, not a kind: it is kept as itself.
      if (isBandAggregate(id)) return true;
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
        /*
         * A HOME THAT IS GONE IS NO HOME. The stop an app opened on is its
         * home, and it may name a record — an embed handed `#focus=<id>`,
         * an address (FR-106) — that was since removed or that this seat
         * may not see. Falling back to it put the dead id straight back,
         * the next resolution took it out again, and the page re-rendered
         * for ever; such a home gives way to where the app opens.
         */
        const home = homeView.focusId !== null && !stillThere(homeView.focusId) ? (openingView(views, given.schema) ?? { ...EMPTY_VIEW, overview: true }) : homeView;
        if (home.focusId !== null && stillThere(home.focusId)) {
          resolved = { ...resolved, focusId: home.focusId };
        } else if (home.overview === true) {
          // An app that OPENS from altitude has no in-stack default:
          // falling out of the overview with nothing to focus lands back
          // on the overview, so Escape at the outermost place is a no-op
          // rather than a void.
          resolved = { ...resolved, overview: true };
        }
      }
      return resolved;
    },
    [withoutWhatIsGone, stillThere, store, homeView, who, views, given.schema],
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
       * Two writes in one gesture are ordinary — traveling also selects,
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

  const { who: others, following, follow, sharing } = usePresenceState<S>({
    channel: presence,
    store,
    view: current,
    principal: who,
    session,
    robots,
    seatWho,
    settingValues,
    setView,
    seats,
    people,
    ...(presenceTtlMs !== undefined ? { ttlMs: presenceTtlMs } : {}),
  });

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
      whereIs,
      pointer,
      motion,
      registerScene,
      robots,
      noteSeat,
      seatWho,
      registerSeatWho,
      actsDoor,
      registerActsDoor,
      seatTalk,
      ...(memory ? { memory } : {}),
      who: others,
      following,
      follow,
      sharing,
      session,
      intelligence,
      chooseIntelligence,
      hostAnswers,
      registerHostAnswers,
      movedByHand,
      noteMoved,
      emphasis,
      setEmphasis,
      activity,
      noteAttention,
      principal: who,
      seats,
      people,
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
      whereIs,
      pointer,
      motion,
      registerScene,
      robots,
      noteSeat,
      seatWho,
      registerSeatWho,
      actsDoor,
      seatTalk,
      memory,
      others,
      following,
      follow,
      sharing,
      session,
      intelligence,
      chooseIntelligence,
      hostAnswers,
      registerHostAnswers,
      movedByHand,
      noteMoved,
      emphasis,
      activity,
      noteAttention,
      who,
      seats,
      people,
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
      <FoundProvider>{children}</FoundProvider>
    </GraviewContext.Provider>
  );
}

/*
 * WHAT THE WORDS FIND, once for the whole scene.
 *
 * Every view reads the hits — to light them, to count them on a district —
 * and a search per view per render would be the same scan dozens of times.
 * So it runs here, once per change of the words, the graph, the seat or
 * the selection (nearness ranks by it), and only over the districts this
 * seat has drawn.
 */
const FoundContext = createContext<SearchResult | null>(null);

function FoundProvider({ children }: { children: ReactNode }) {
  const { store, view, views, principal, hiddenKinds, selection } = useGraview();
  const nodes = useGraph();
  const q = view.q;
  const focusId = view.focusId;
  /*
   * What the rules flag and what the log touched change only with the
   * graph, so they are worked out once per graph change — not re-run, every
   * invariant and the whole log, on every keystroke.
   */
  const searching = Boolean(q && q.trim().length > 0);
  const standing = useMemo(
    () =>
      searching
        ? { flagged: new Set(store.violations().flatMap((violation) => violation.nodeIds)), touched: touchWeights(store.log.all()) }
        : null,
    // `nodes` is the graph's tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, nodes, searching],
  );
  // The kind the person is in: the district they went into, or the kind of the record they are on.
  const inKind = focusId
    ? (store.graph.getNode(focusId)?.kind as string | undefined) ??
      kindOfCard(focusId) ??
      (kindsOfAggregate(focusId).length === 1 ? kindsOfAggregate(focusId)[0] : undefined)
    : undefined;
  const found = useMemo(() => {
    if (!q || !standing) return null;
    return search(store, q, {
      ...(inKind ? { inKind } : {}),
      principal,
      places: views.places(),
      kinds: (store.schema.kinds as readonly string[]).filter((kind) => !hiddenKinds.has(kind)),
      from: [...selection, ...(focusId && store.graph.has(focusId) ? [focusId] : [])],
      flagged: standing.flagged,
      touched: standing.touched,
      // The strip reads this many; the picture lights every match through `matched`.
      limit: 200,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, q, principal, views, hiddenKinds, selection, focusId, inKind, standing]);
  return <FoundContext.Provider value={found}>{children}</FoundContext.Provider>;
}

/** The scene's search, when `#q=` says there is one; null otherwise. */
export function useFound(): SearchResult | null {
  return useContext(FoundContext);
}

export function useGraview<S extends AnySchema>(): GraviewContextValue<S> {
  const value = useContext(GraviewContext);
  if (!value) {
    throw new Error("useGraview must be used inside a <GraviewProvider>.");
  }
  return value as unknown as GraviewContextValue<S>;
}

/**
 * The same, for a surface that can live on EITHER FACE.
 *
 * The scene is always inside a provider; the routed face is not — it carries
 * its store in a `PageContext` instead. Most primitives belong to one face
 * and can insist, but the few that belong to both must be able to ask
 * without throwing: a component cannot call a hook conditionally, so "is
 * there a provider" has to be a hook that answers rather than one that
 * raises.
 */
export function useGraviewIfAny<S extends AnySchema>(): GraviewContextValue<S> | null {
  return (useContext(GraviewContext) as GraviewContextValue<S> | null) ?? null;
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

/** How long a robot stands where it worked before walking home. The activity hold, so the mark and the body agree. */
export const ROBOT_REST_MS = 2600;

/** The robots, one per agent participant. */
export function useRobots(): ReadonlyMap<string, RobotState> {
  return useGraview().robots;
}

/** Where something is drawn right now, from the live frame. See `GraviewContextValue.whereIs`. */
export function useWhereIs(): (id: string) => DrawnBox | null {
  return useGraview().whereIs;
}

const NO_POINT = (): ScenePoint | null => null;

/**
 * The pointer over the scene, in scene coordinates, or null while it is
 * not over the scene. Subscribing is what turns the scene's listener on;
 * a component that stops rendering this turns it off again.
 */
export function useScenePointer(): ScenePoint | null {
  const { pointer } = useGraview();
  return useSyncExternalStore(pointer.subscribe, pointer.snapshot, NO_POINT);
}

/**
 * THE VIEW A DECLARATION OPENS ON (FR-80): `pages.first` as the registry
 * holds it, resolved against the places beside it — a place is its kind's
 * picture by that name, a kind is its district, and the home (or nothing)
 * is the app's own default. Undefined when there is nothing to say.
 */
export function openingView(
  views: { places(): readonly Place[]; arrangement?(): PagesArrangement | undefined },
  schema: AnySchema,
): ViewState | undefined {
  const opening = openingOf(views.arrangement?.()?.first, schema, views.places());
  if (!opening || opening.to === "home") return undefined;
  if (opening.to === "place") return { ...EMPTY_VIEW, focusId: aggregateId(opening.place.kind), within: { view: opening.place.as } };
  return { ...EMPTY_VIEW, focusId: aggregateId(opening.kind) };
}
