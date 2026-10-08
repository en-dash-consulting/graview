import { faviconHref, Store, type AnySchema, type Brand, type GraviewApp, type Person, type PresenceChannel, type Principal } from "@graview/core";
import type { NavigationHow, PageComponent, PageRegistry } from "@graview/pages";
import { AppBar, createNoticeBoard, Notices, Profile, registerDeclaredLenses, Standing, themeBaseCss, useFavicon, useScenePlaces, type BarFaces, type BarFind, type BarGo, type BarPlace, type BarSwitch, type HostAction, type NoticeBoard } from "@graview/primitives/frame";
import { layerViews, useGraview, useTheKeyboardLandsSomewhere, type ErrorReport, type ReactViewRegistry, type ReaderMemory, type Scheme } from "@graview/react/provider";
import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { fontsLink } from "./fonts.js";

/*
 * THE FRAME EVERY FACE SHARES: the element the embed owns, the theme scoped
 * to it, the store, the bar, the routed face. The scene, the Graview and
 * the studio are `./embed.tsx`'s; the pages alone (`@graview/embed/pages`)
 * are this module and `./pages.tsx`, so a host that only ever shows the
 * pages does not bundle a map it never draws (FR-19).
 */

/**
 * The faces. `picture` is ONE NAMED LENS AND NOTHING ELSE — the place the
 * stop names (`#view=the-week`), drawn at full size over the kind's current
 * members, with no bar, no rail, no standing: a page that is about a lens
 * shows the lens, not an app with the lens somewhere inside it.
 */
export type EmbedFace = "scene" | "graview" | "pages" | "picture";

/**
 * WHAT WENT WRONG, AS A HOST MAY KEEP IT (FR-24): the error's class
 * (`TypeError`, `GraphError`), never its message, which may quote a
 * record's words.
 */
export interface EmbedError {
  readonly name: string;
}

/** Where it went wrong: the framework module that caught it, and the face it was in. */
export interface EmbedErrorWhere {
  readonly module: string;
  readonly face: EmbedFace;
}

/** How long the embed took to first render, in milliseconds, and the face it rendered. */
export interface EmbedReady {
  readonly ms: number;
  readonly face: EmbedFace;
}

/**
 * WHAT A HOST SAYS ABOUT ITS FRAME (FR-13). A chat's widget is told its
 * theme by the chat, over `postMessage` (MCP Apps' `hostContext.theme`,
 * ChatGPT's `openai.theme`), not by a `data-theme` on a document it owns.
 * The embed takes the theme from here before it looks at the page.
 */
export interface EmbedHostContext {
  readonly theme?: Scheme;
}

/**
 * A STORE THAT LIVES SOMEWHERE ELSE: what `openRemote` from
 * `@graview/ship` returns, or any host's own with the same two parts. The
 * embed acts through its store and draws who is here from its channel.
 */
export interface EmbedRemote<S extends AnySchema = AnySchema> {
  readonly store: Store<S>;
  readonly presence?: PresenceChannel;
}

/** What every face takes: the app, its store, who is here, and the frame it sits in. */
export interface FrameOptions<S extends AnySchema = AnySchema> {
  readonly app: GraviewApp<S>;
  /** The graph to open with. Nothing means the empty city. */
  readonly seed?: { readonly nodes: readonly unknown[]; readonly edges: readonly unknown[] };
  /**
   * For the pages face: the path to open, within the app's own routes. Set
   * again (`setPath`), the face goes there. Under `routing: "address"` the
   * address the page was loaded at is where the face opens instead.
   */
  readonly path?: string;
  /**
   * WHO OWNS THE ADDRESS BAR (FR-106). `"memory"`, the default, is for an
   * embed inside somebody else's page — an article, a chat's widget: the
   * routed face keeps its own history in memory and never touches
   * `location` or `history`. `"address"` is for a host whose page IS the
   * app: the routed face reads its route from the address under `basePath`
   * and pushes each page, so a place, a record and the home can be linked,
   * reloaded and shared, and the scene keeps its stop in the fragment, as
   * the whole-page Shell does.
   */
  readonly routing?: "memory" | "address";
  /**
   * Where the app is served under address routing: `/` (the default) or a
   * path of the host's own, `/apps/<id>/`. A trailing slash is the same base.
   */
  readonly basePath?: string;
  /**
   * TOLD WHERE THE ROUTED FACE WENT (FR-106): its path within the app's own
   * routes, with its search, each time it changes after arrival, and how
   * (`"push"`, `"replace"` or `"pop"`). Under memory routing it is how a host
   * that keeps its own history learns of a page, handing a path back with
   * `setPath` when its own Back arrives.
   */
  readonly onNavigate?: (path: string, how: NavigationHow) => void;
  readonly principal?: Principal;
  /**
   * WHO ELSE IS HERE, if the host wants that: an embed broadcasts nothing
   * and draws nobody unless it is handed a channel — a page that puts a
   * graph on it is not thereby a page that tells its readers about each
   * other.
   */
  readonly presence?: PresenceChannel;
  /**
   * The seats a reader may take, when the page wants the policy to be felt
   * rather than read: each is a name and a principal, shown in the person's menu and
   * pressed while it is at the keyboard. The bar, the pages and the acts
   * all narrow to the seat, so what a gardener may not do is struck through
   * the moment a gardener sits down.
   */
  readonly seats?: readonly { readonly label: string; readonly principal: Principal }[];
  /**
   * WHO THE APP MAY NAME, apart from the seats (FR-13). A hosted app knows
   * its members and the agents that act in it; listing them as seats
   * offered every reader the chance to sit as each of them. A directory
   * names authors in the rail, the pages and presence, and offers no seat.
   * `setPeople` changes it after mount, for an agent who first acts later.
   */
  readonly people?: readonly Person[];
  /** "auto" follows the host: the host context's theme, else the page's `data-theme` stamp, else the system's preference, as each changes. */
  readonly scheme?: Scheme | "auto";
  /** What the host says about its frame: a chat widget's theme. `setHostContext` follows it as it changes. */
  readonly hostContext?: EmbedHostContext;
  /** Defaults to the app's own brand. */
  readonly brand?: Brand;
  /** A store to share; otherwise one is made from the app and the seed. */
  readonly store?: Store<S>;
  /**
   * A store that lives on a server (`await openRemote(...)`): its store is
   * the embed's store, and its presence the embed's channel unless
   * `presence` names another. The host opened it and closes it.
   */
  readonly remote?: EmbedRemote<S>;
  /**
   * WHERE THE READER'S OWN CHOICES ARE KEPT: text size, motion, what they
   * share, this tab's session. The page's storage by default, and nothing
   * is lost but the remembering where a sandboxed frame refuses it; a host
   * that keeps them itself passes any `getItem`/`setItem` object.
   */
  readonly memory?: ReaderMemory;
  /** How long somebody a presence channel told of stands without a fresh word. Default `REMOTE_PRESENCE_TTL_MS`. */
  readonly presenceTtlMs?: number;
  /** The pages face's own pages, over the derived defaults. */
  readonly pages?: PageRegistry<S, PageComponent<S>>;
  /*
   * The app's OWN registry, in the app's own schema.
   *
   * This was typed as `ReturnType<typeof registerDefaultViews>`, which erases
   * to `AnySchema` — so a project passing the `views()` it wrote for its own
   * declaration, which is the only thing this option is for, was a type
   * error with eleven lines of variance in it.
   *
   * OVER THE DEFAULTS, NOT INSTEAD OF THEM (FR-36). The function is handed
   * a registry that already holds the framework's own view for every cell
   * and the declaration's view specs; register onto it what you want
   * different. A function that builds a registry of its own is laid over
   * the same defaults, so one card is one card and not the loss of every
   * other view. The pages draw from it too (FR-35): a view registered here
   * is the gallery's card, the list's row and the record's page.
   */
  /** Views beyond the derived defaults. */
  readonly views?: (schema: S, registry: ReactViewRegistry<S>) => ReactViewRegistry<S>;
  /**
   * THE APP BAR (FR-131) above every face: the app's name, its places —
   * the overview among them — Find, the standing and the person. Default
   * on; off for a host whose own page already says all of that.
   */
  readonly bar?: boolean;
  /**
   * HOW THE BAR'S SWITCH BETWEEN THE SCENE AND THE PAGES IS DRAWN (FR-137).
   * `"words"`, the default, says "Scene" and "Pages" beside their marks
   * where the bar has room, and draws the marks alone where the bar is
   * narrow — by the bar's own width, the box the host gives it, never the
   * screen's. `"icons"` draws the marks alone at every width, for a host
   * whose box is small or whose own page already says what the faces are.
   * Either way the words are the buttons' names and their titles.
   */
  readonly switch?: BarSwitch;
  /**
   * THE PAGE'S ICON (FR-124): `true` when the host's page IS the app (a
   * hosted app on its own address), so the page wears the brand's
   * favicon while the embed is mounted. Off by default: an embed on
   * somebody else's page never changes that page's icon.
   */
  readonly favicon?: boolean;
  /** Fetch the brand's fonts. Default on; off when the host already has them. */
  readonly fonts?: boolean;
  /**
   * The embed's height; the element's own by default. `"auto"` sizes it to
   * its content: the pages face grows with its page, and the scene and the
   * Graview take `AUTO_SCENE_HEIGHT`. A frame that is sized from its content
   * (a chat's widget) wants `"auto"` and `onIntrinsicHeight`.
   */
  readonly height?: number | string;
  /**
   * THE HEIGHT THE EMBED ASKS FOR, as it changes (FR-13): the bar and the
   * whole page under it on the pages face, the bar and the picture's box
   * on the others. A widget forwards it to its host (MCP Apps'
   * `ui/notifications/size-changed`, ChatGPT's `notifyIntrinsicHeight`).
   */
  readonly onIntrinsicHeight?: (height: number) => void;
  /** What Standing says when nothing is wrong. */
  readonly standing?: string;
  /**
   * THE HOST'S OWN ACTIONS (FR-72): "Your apps", "Change the app", "Report
   * this app" — links (or presses, with `onSelect`) drawn in the bar's
   * profile menu, under who is signed in, reached by the keyboard like
   * everything else in it. Nothing of the host's needs to stand over the
   * scene.
   */
  readonly hostActions?: readonly HostAction[];
  /**
   * THE BOARD THE HOST NOTICES ARE SAID ON (FR-75). `mount` makes one and
   * hands its `notify` back on the handle; a React host drawing `<Embed>`
   * makes its own with `createNoticeBoard()` and says things on it.
   */
  readonly notices?: NoticeBoard;
  /**
   * TOLD WHAT WENT WRONG (FR-24). A view, a page or the bar that throws
   * is contained where it threw, the rest of the embed keeps working, and
   * the host is told the error's class and the framework module that
   * caught it, never what was on screen.
   */
  readonly onError?: (error: EmbedError, where: EmbedErrorWhere) => void;
  /** Told once, after the first render, how long it took (FR-24). */
  readonly onReady?: (ready: EmbedReady) => void;
  /**
   * What this embed is called, for assistive technology. Several Graviews
   * on one page each carry the same landmarks — the relation key, the
   * inspector, the pages' navigation — and a landmark has to be unique by
   * role and name; every landmark inside is named after the embed.
   */
  readonly label?: string;
}

/*
 * THE DEFAULTS, THE DECLARATION'S SPECS, THEN THE HOST'S OWN — one
 * registry, each layer over the one before, so what the host leaves alone
 * stays drawn (FR-36) and what the declaration says as data is drawn with
 * no views at all (FR-03). Every face draws from it, the pages too (FR-35).
 */
export function useViews<S extends AnySchema>(
  props: Pick<FrameOptions<S>, "app" | "views">,
  /**
   * The framework's own views for the schema, its defaults with the
   * declaration's specs over them. The whole embed registers them behind
   * doors (`frameworkViewDoors`), fetched with the face that draws them
   * (FR-57); the pages alone register them outright.
   */
  framework: (schema: S, specs: GraviewApp<S>["viewSpecs"]) => ReactViewRegistry<S>,
): ReactViewRegistry<S> {
  const { app } = props;
  return useMemo(() => {
    // The lenses the declaration titles are places of their own (FR-79), and its arrangement goes with them (FR-80).
    const base = registerDeclaredLenses(framework(app.schema, app.viewSpecs), app);
    return (props.views ? layerViews(base, props.views(app.schema, base)) : base) as ReactViewRegistry<S>;
  }, [props.views, app.schema, app.viewSpecs, app.lenses, app.pages, app.home]);
}

/** A store from a declaration and a seed: the app's own policy, in memory. */
export function storeOf<S extends AnySchema>(app: GraviewApp<S>, seed: FrameOptions<S>["seed"]): Store<S> {
  return new Store<S>({
    schema: app.schema,
    mutations: app.mutations ?? [],
    invariants: app.invariants ?? [],
    ...(seed ? { snapshot: seed as never } : {}),
    ...(app.policy ? { policy: app.policy } : {}),
    ...(app.intelligence ? { intelligence: app.intelligence } : {}),
  } as never);
}

/**
 * The host page's scheme: an explicit `data-theme`, else the scheme the
 * app prefers (`brand.scheme`, FR-124), else the system's preference.
 */
export function hostScheme(preferred?: Scheme | "auto"): Scheme {
  if (typeof document === "undefined") return preferred === "dark" ? "dark" : "light";
  const stamped = document.documentElement.dataset["theme"];
  if (stamped === "dark" || stamped === "light") return stamped;
  if (preferred === "dark" || preferred === "light") return preferred;
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * THE HOST PAGE'S SCHEME, AS IT CHANGES. Read once, an embed kept the
 * scheme the page had when it mounted: a host that stamps `data-theme` when
 * its own toggle is pressed (or a widget's glue, when the chat says the
 * theme changed) left the embed in the other one.
 */
function useHostScheme(follow: boolean, preferred?: Scheme | "auto"): Scheme {
  const [scheme, setScheme] = useState<Scheme>(() => hostScheme(preferred));
  useEffect(() => {
    if (!follow || typeof document === "undefined") return;
    const read = () => setScheme(hostScheme(preferred));
    read();
    const stamped = new MutationObserver(read);
    stamped.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
    media?.addEventListener?.("change", read);
    return () => {
      stamped.disconnect();
      media?.removeEventListener?.("change", read);
    };
  }, [follow, preferred]);
  return scheme;
}

/** Element heights, read the one way a ResizeObserver also reads them. */
const heightOf = (element: Element | null | undefined): number => (element ? element.getBoundingClientRect().height : 0);

/**
 * THE HEIGHT THE EMBED ASKS FOR, told as it changes (FR-13). A chat's
 * widget frame is sized from its content, and an embed that filled
 * whatever box it was given had no height of its own to say: the frame
 * stayed at its first guess. The pages face asks for the bar and the
 * whole page; the other faces for the bar and the picture's box.
 */
export function useIntrinsicHeight(rootRef: { readonly current: HTMLElement | null }, face: string, onHeight: ((height: number) => void) | undefined): void {
  const told = useRef(onHeight);
  told.current = onHeight;
  const wanted = onHeight !== undefined;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !wanted) return;
    const parts = () => {
      const children = [...root.children];
      const strip = children.find((child) => child.hasAttribute("data-graview-app-bar"));
      const content = children.find((child) => child.hasAttribute("data-embed-content"));
      const measure = content?.querySelector("[data-embed-measure]") ?? null;
      // On a phone the place is the page's first line, under the bar (FR-138).
      const line = children.find((child) => child.hasAttribute("data-graview-place-line"));
      return { strip, line, content, measure };
    };
    let last = -1;
    const report = () => {
      const { strip, line, content, measure } = parts();
      const height = Math.ceil(heightOf(strip) + heightOf(line) + (measure ? heightOf(measure) : heightOf(content)));
      if (height === last) return;
      last = height;
      told.current?.(height);
    };
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    const watch = () => {
      observer.disconnect();
      const { strip, line, content, measure } = parts();
      for (const element of [root, strip, line, content, measure]) if (element) observer.observe(element);
    };
    watch();
    // The bar comes and goes with the face's own children; a page that
    // routes changes size inside the measured box, which the observer sees.
    const swapped = new MutationObserver(() => {
      watch();
      report();
    });
    swapped.observe(root, { childList: true });
    return () => {
      observer.disconnect();
      swapped.disconnect();
    };
  }, [rootRef, face, wanted]);
}

/** The scene and the Graview's height when the embed sizes itself to its content (`height: "auto"`). */
export const AUTO_SCENE_HEIGHT = 480;

let sequence = 0;

/**
 * The frame itself: the element's own keyboard, its scoped theme, the
 * brand's fonts, the landmarks inside named after the embed, and the store.
 */
export function useFrame<S extends AnySchema>(props: FrameOptions<S>) {
  const { app, seed, scheme: askedScheme = "auto", brand = app.brand, fonts = true, height = "100%", label } = props;
  const rootRef = useRef<HTMLElement>(null);
  useTheKeyboardLandsSomewhere(rootRef as never);
  const scope = useMemo(() => `graview-embed-${++sequence}`, []);
  /*
   * ONE STORE ACROSS THE SEATS. Who is at the keyboard is the provider's
   * business, not the store's: with the principal in these dependencies a
   * seat change made a fresh store from the seed, and a React host that sat
   * somebody else down lost every edit and the history with them.
   */
  const store = useMemo(() => props.store ?? props.remote?.store ?? storeOf(app, seed), [props.store, props.remote, app, seed]);
  const presence = props.presence ?? props.remote?.presence;
  const told = props.hostContext?.theme;
  const followed = useHostScheme(askedScheme === "auto" && told === undefined, brand?.scheme);
  const scheme: Scheme = askedScheme === "auto" ? (told ?? followed) : askedScheme;
  /* Every face's sheet; the scene face draws the scene's own rules beside it (`sceneCss`, FR-104). */
  const css = useMemo(() => themeBaseCss(scheme, brand, { scope: `.${scope}` }), [scheme, brand, scope]);

  // The page's icon, only when the host said its page is the app's (FR-124).
  useFavicon(props.favicon ? faviconHref(brand) : undefined);

  // The brand's fonts, fetched once per family set, without the host's help.
  useEffect(() => {
    if (!fonts || typeof document === "undefined") return;
    const href = fontsLink(brand);
    if (!href || document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [brand, fonts]);

  // Landmarks inside, named after the embed — kept so through re-renders, and through a new label (FR-128).
  const namedAfter = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const root = rootRef.current;
    const before = namedAfter.current;
    namedAfter.current = label;
    if (!root || !label) return;
    const name = (el: Element) => {
      const said = el.getAttribute("aria-label") ?? "";
      // The last label's part of a name was the embed's, not the landmark's own.
      const own = before && before !== label ? (said.startsWith(`${before} · `) ? said.slice(before.length + 3) : said === before ? "" : said) : said;
      // Named the same thing: "The pipeline · The pipeline" is one name said
      // twice, not a place inside a place. A region of that name IS the
      // embed's region, so it stops being a second landmark (two regions of
      // one name is axe's `landmark-unique`) and stays a named group.
      if (own === label && (el.getAttribute("role") === "region" || (el.tagName === "SECTION" && !el.hasAttribute("role")))) el.setAttribute("role", "group");
      const next = own.startsWith(`${label} · `) || own === label ? own : own ? `${label} · ${own}` : label;
      if (next !== said) el.setAttribute("aria-label", next);
    };
    // The root is the embed's own region and already wears the label; the
    // sweep names what is INSIDE it — a named section is a region too, and
    // the seat is one (FR-40).
    // A landmark that already says which picture it is in — a board's column, "Vendors by status · Researching, 0" (FR-109) — keeps its name.
    const sweep = () =>
      root.querySelectorAll("aside, nav, main, header, footer, section[aria-label]:not([role]), [role=region], [role=complementary], [role=navigation], [role=search]").forEach((el) => {
        if (!el.hasAttribute("data-graview-named-by-lens")) name(el);
      });
    sweep();
    const observer = new MutationObserver(sweep);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });
    return () => observer.disconnect();
  }, [label]);

  return { rootRef, scope, css, scheme, store, presence, brand, auto: height === "auto", height };
}

/**
 * THE HOST'S NOTICES, over the face (FR-75): banners at the top of the
 * picture, toasts at its foot, said aloud. The board is the host's when it
 * gave one, else the frame's own.
 */
export function FrameNotices({ rootRef, board }: { readonly rootRef: { readonly current: HTMLElement | null }; readonly board: NoticeBoard | undefined }) {
  const [own] = useState(() => board ?? createNoticeBoard());
  const anchor = useCallback(() => rootRef.current?.querySelector<HTMLElement>("[data-embed-content]") ?? rootRef.current, [rootRef]);
  return <Notices board={board ?? own} anchor={anchor} />;
}

/** What the provider under every face is handed from the options, beside the store and the views. */
export function providerProps<S extends AnySchema>(props: FrameOptions<S>, presence: PresenceChannel | undefined, brand: Brand | undefined) {
  return {
    ...(brand ? { brand } : {}),
    ...(props.principal ? { principal: props.principal } : {}),
    /* The seats, so every surface under the provider names a seat as it was offered (W-114). */
    ...(props.seats ? { seats: props.seats } : {}),
    ...(presence ? { presence } : {}),
    ...(props.people ? { people: props.people } : {}),
    ...(props.memory ? { memory: props.memory } : {}),
    ...(props.presenceTtlMs !== undefined ? { presenceTtlMs: props.presenceTtlMs } : {}),
    /* The reader's own text size and motion, on somebody else's page
       too: the answer lives on the browser, not on the installation. */
    settings: props.app.settings ?? [],
  };
}

/**
 * THE ONE APP BAR (FR-131), as every face of the embed draws it: the app's
 * mark and name — the heading, the way home — the switch between the scene
 * and the pages (FR-137), the place you are on (FR-138) — on the scene,
 * what it shows (FR-144) — or the places themselves where they fit (FR-145), then
 * Find (the face under the bar puts its own box there), the standing and
 * the person, whose menu holds the seats, the host's own actions and, for
 * the seat that keeps the app, the ways into it.
 */
export function FrameBar({
  name,
  heading,
  faces,
  places,
  current,
  home,
  reach,
  standing,
  hostActions,
  keeping,
  onFind,
  switch: switchForm,
}: {
  readonly name: string;
  readonly heading: 1 | 2 | 3 | 4 | 5 | 6 | false;
  /** The switch between the scene and the pages (FR-137); none where only the pages are drawn. */
  readonly faces?: BarFaces | undefined;
  readonly places: readonly BarPlace[];
  readonly current: string | null;
  readonly home: { readonly href?: string | undefined; readonly go: () => void; readonly current: boolean };
  readonly reach: BarGo;
  readonly standing: string;
  /** The host's own actions, in the person's menu (FR-72). */
  readonly hostActions?: readonly HostAction[] | undefined;
  /** The ways into the app, for the seat that keeps it. */
  readonly keeping?: ReactNode;
  readonly onFind: (find: BarFind | null) => void;
  /** How the switch is drawn (`FrameOptions["switch"]`). */
  readonly switch?: BarSwitch | undefined;
}) {
  const { brand } = useGraview();
  // On the scene, what it can show, from the view it holds (FR-144).
  const scene = useScenePlaces();
  return (
    <AppBar
      brand={brand}
      name={name}
      description={brand?.subtitle}
      heading={heading}
      faces={faces}
      home={home}
      places={places}
      current={current}
      reach={reach}
      onFind={onFind}
      {...(switchForm ? { switch: switchForm } : {})}
      {...(faces ? { scenePlaces: scene } : {})}
      tools={
        <>
          <Standing clean={standing} />
          <Profile {...(hostActions ? { hostActions } : {})} {...(keeping ? { keeping } : {})} />
        </>
      }
    />
  );
}

/** The level a page's own title is said at: one below the app's name on the bar, or 2 when the host's own heading says the name (FR-131). */
export const titleBelow = (heading: 1 | 2 | 3 | 4 | 5 | 6 | false): 2 | 3 | 4 | 5 | 6 => (heading === false ? 2 : (Math.min(heading + 1, 6) as 2 | 3 | 4 | 5 | 6));

/**
 * THE PLACE THE ROUTED FACE IS ON, and the way to send it elsewhere (FR-131):
 * the bar is drawn above the face, outside its router, so the router says
 * where it is as it moves, and takes the bar's presses.
 */
export function useSteering(initial: string) {
  const [at, setAt] = useState(initial);
  const go = useRef<((path: string) => void) | undefined>(undefined);
  const pending = useRef<string | undefined>(undefined);
  const steering = useMemo(() => ({ go, at: setAt, pending }), []);
  /*
   * Sends the routed face to a path, or, while it is still arriving (FR-140:
   * fetched as it is first drawn), keeps the path for it to go to as it does.
   */
  const steer = useCallback((path: string) => {
    if (go.current) {
      go.current(path);
      return;
    }
    pending.current = path;
    setAt(path);
  }, []);
  return { at, setAt, steering, steer };
}

/** An error as a host may keep it: its class, and nothing it says. */
export function errorClass(error: unknown): EmbedError {
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  return { name: typeof name === "string" && name.length > 0 ? name : typeof error === "object" ? "Error" : typeof error };
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** The report every boundary under the embed tells, as the host's `onError` with the face it was in. */
export function useErrorReport(onError: FrameOptions["onError"], face: EmbedFace): ErrorReport {
  const latest = useRef({ onError, face });
  latest.current = { onError, face };
  return useCallback<ErrorReport>((error, where) => latest.current.onError?.(errorClass(error), { module: where.module, face: latest.current.face }), []);
}

/**
 * `onReady`, once: from the first render to the moment the first face is
 * drawn. The returned function is called as a face draws; only its first
 * call tells the host. A face is fetched as it is first drawn (FR-57), so
 * the frame's own first commit is not the app on the page.
 */
export function useReady(onReady: FrameOptions["onReady"], face: EmbedFace): (drawn: EmbedFace) => void {
  const start = useRef<number | null>(null);
  if (start.current === null) start.current = now();
  const latest = useRef({ onReady, face });
  latest.current = { onReady, face };
  const fired = useRef(false);
  return useCallback((drawn: EmbedFace) => {
    if (fired.current) return;
    fired.current = true;
    latest.current.onReady?.({ ms: Math.max(0, now() - (start.current ?? now())), face: drawn });
  }, []);
}

interface FaceBoundaryProps {
  /** The framework module this part of the embed is drawn by. */
  readonly module: string;
  readonly report: ErrorReport;
  /** Whether the fallback stands in for the face's content (measured for height) or for a part of the bar. */
  readonly content?: boolean;
  readonly children: ReactNode;
}

/**
 * A PART THAT THROWS STAYS A PART (FR-24). Each face, the bar and the
 * studio's place on it draw behind one of these: what threw says it could
 * not draw, in the framework's words rather than the error's, and offers
 * to try again; everything around it keeps working.
 */
export class FaceBoundary extends Component<FaceBoundaryProps, { readonly failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console, for whoever fixes it; the host, told only the class.
    console.error(`[graview] ${this.props.module} threw while rendering`, error, info.componentStack);
    this.props.report(error, { module: this.props.module });
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        data-graview-face-error={this.props.module}
        {...(this.props.content ? { "data-embed-content": "" } : {})}
        style={
          this.props.content
            ? { flex: "1 1 auto", display: "grid", alignContent: "center", justifyItems: "center", gap: 8, padding: 24, background: "var(--graview-ground)", color: "var(--graview-ink)", fontSize: "0.9375rem" }
            : { display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", color: "var(--graview-ink-muted)" }
        }
      >
        <span>{this.props.content ? "This part of the app could not draw." : "Could not draw."}</span>
        <button type="button" onClick={() => this.setState({ failed: false })} style={{ padding: "3px 11px", fontSize: "0.8125rem" }}>
          Try again
        </button>
      </div>
    );
  }
}
