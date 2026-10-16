import { numberAsRead, pluralLabel, type AnySchema, type Store } from "@graview/core";
import { BrowserRouter, Link, MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { openingOf, OVERVIEW_PATH, OVERVIEW_SLUG, sayIn } from "@graview/core";
import { narrowedPath } from "@graview/core/navigate";
import { revealSection } from "./section.js";
import { pluralSlug } from "./registry.js";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { aggregateId } from "@graview/layout/view";
import { GoToContext, GraviewProvider, hasLanded, HostFilesContext, markLanded, PlaybackContext, useGraviewIfAny, useOwnPlayback, useTheKeyboardLandsSomewhere, useTheWatchKnowsWhatIsUnseen, type GoTo, type GraviewContextValue, type Playback } from "@graview/react/provider";
import { PageAsk } from "./ask.js";
/* A view the seat drew, as a page: fetched when one is first shown here. */
const DraftPage = lazy(() => import("./page-draft.js").then((module) => ({ default: module.DraftPage })));
import { FaceControlsRoot } from "./face-controls.js";
import { PagesContextMenu } from "./context-menu.js";
import { DefaultHomePage, DefaultListPage, DefaultMapPage, DefaultPlacePage, DefaultPlacesPage, DefaultProblemsPage, DefaultRecordPage, DefaultSearchPage, DefaultShell, type PageContext } from "./pages.js";
import { pathOfPlace, placesOf } from "./page-places.js";
import { createPageRegistry, kindOfSlug, type PageRegistry } from "./registry.js";
import { useLocation, useNavigate, useNavigationType, useParams } from "react-router-dom";
import { appKeyOf, BarFindContext, FirstLookDoor, HeadingsUnder, PastBar, registerReaderLenses, SpecLinks, type BarFind, type FirstLook } from "@graview/primitives/pages";

/** Who reads the face when the host names nobody. */
const ANYONE = { kind: "human" } as const;
import { OwnBarFind } from "./page-shell.js";
import { recordPath } from "./registry.js";

/**
 * A LIST CUT SHORT SAYS WHERE THE REST IS. A list of cards is never a box
 * to scroll inside: it shows its `limit`, and "See all 96 features" goes to
 * the kind's list — said so when it listed every record of the kind, else
 * how many more there are and the way to the kind's list.
 */
function SeeAll<S extends AnySchema>({ list, store }: { readonly list: { readonly members: readonly { readonly kind: string }[]; readonly total: number }; readonly store: Store<S> }) {
  const kinds = new Set(list.members.map((node) => node.kind));
  const more = list.total - list.members.length;
  const kind = kinds.size === 1 ? [...kinds][0]! : undefined;
  if (!kind) return <p className="graview-spec-text graview-spec-more">{`and ${more} more`}</p>;
  const plural = pluralLabel(store.schema, kind).toLowerCase();
  return (
    <p className="graview-spec-text graview-spec-more">
      {/* Its count a figure in the page's locale (the ninth walk, W-198). */}
      <Link to={`/${pluralSlug(store.schema, kind)}`} className="graview-spec-link graview-spec-see-all" data-testid="see-all">
        {list.total === store.graph.nodesOfKind(kind as never).length ? `See all ${numberAsRead(list.total)} ${plural}` : `${numberAsRead(more)} more · all ${plural}`}
      </Link>
    </p>
  );
}

/**
 * WHERE A LISTED RECORD LEADS ON THIS FACE (FR-81, FR-82): a list block in a
 * home, a lens, a card or a row draws each record as a link, and here a
 * link is the record's own address, followed by the router.
 */
function RecordLinks<S extends AnySchema>({ context, children }: { readonly context: PageContext<S>; readonly children: ReactNode }) {
  const navigate = useNavigate();
  const schema = context.store.schema;
  const value = useMemo(
    () => ({
      href: (node: { readonly id: string; readonly kind: string }) => recordPath(schema, node.kind, node.id),
      go: (node: { readonly id: string; readonly kind: string }) => navigate(recordPath(schema, node.kind, node.id)),
      more: (list: { readonly members: readonly { readonly id: string; readonly kind: string }[]; readonly total: number }) => <SeeAll list={list} store={context.store} />,
    }),
    [schema, navigate, context.store],
  );
  // A view's own headlines are said under the page's title, which is said under the app's name (FR-131).
  return (
    <SpecLinks.Provider value={value}>
      <HeadingsUnder.Provider value={(context.titleLevel ?? (context.framed && !context.barAbove ? 1 : 2)) - 1}>{children}</HeadingsUnder.Provider>
    </SpecLinks.Provider>
  );
}

/**
 * The routed face, assembled: `/` home, `/:plural` a list per kind,
 * `/:plural/:id` a record per node, `/problems` the standing. Routes derive
 * from the schema; the registry overrides components per cell; the shell is
 * itself a registration. One store underneath — the two faces are one
 * application because the ids are.
 */

export type PageComponent<S extends AnySchema> = ComponentType<{ context: PageContext<S> }>;

export interface PagesAppProps<S extends AnySchema> {
  readonly context: PageContext<S>;
  readonly registry?: PageRegistry<S, PageComponent<S>>;
  /** Mount path when the scene owns "/" — e.g. "/pages". */
  readonly basename?: string;
  /**
   * For tests and SSR: render at a fixed address with no real history.
   *
   * BASENAME-RELATIVE, like every `to` on this face. Given `basename`, the
   * router is mounted at it and this path is joined on — so what a test
   * renders is what a browser renders.
   */
  readonly initialPath?: string;
  /**
   * TOLD WHERE THE FACE WENT (FR-106): the path, basename-relative with its
   * search and the section it went to (`#shipping-soon`), each time it
   * changes after arrival — and how, `"push"`,
   * `"replace"` or `"pop"` — so a host that keeps its own history can.
   */
  readonly onNavigate?: (path: string, how: NavigationHow) => void;
  /**
   * WHERE THE HOST NOW SENDS IT (FR-106): basename-relative, like
   * `initialPath`. The face goes there whenever this changes — a host that
   * keeps its own history hands back the path its own Back arrived at.
   */
  readonly path?: string;
  /**
   * A BAR ABOVE THE FACE, OUTSIDE ITS ROUTER (FR-131): told where the face
   * is each time it moves — on arrival too — and handed the way to send it
   * somewhere, for its tabs.
   */
  readonly steering?: PagesSteering;
  /**
   * A FIRST LOOK, ONCE, when this face owns the page: hints beside the
   * app's own controls on its bar — as the whole-page Shell's `firstLook`,
   * remembered for the same app, so a person who saw it on the scene is not
   * shown it again here. Off unless given.
   */
  readonly firstLook?: FirstLook;
}

/** What a bar drawn outside the router holds of it: where the face is, and the way to move it. */
export interface PagesSteering {
  /** Set by the face to its own way of going to a path, basename-relative; none while no face is listening. */
  readonly go: { current: ((path: string) => void) | undefined };
  /** Told the path, basename-relative with its search, each time the face moves. */
  readonly at: (path: string) => void;
  /**
   * A path the bar was asked for before the face was listening (FR-140):
   * the face goes there as it arrives.
   */
  readonly pending?: { current: string | undefined };
}

/**
 * Says where the face is to a bar above it, and takes its presses.
 *
 * THE PLACE LIST IS READY WHEN IT OPENS (FR-140). The bar can be pressed
 * before this face is listening — Pages pressed, the list opened and an
 * entry chosen while the face is still being fetched — so a path asked for
 * meanwhile waits in `pending` and is gone to as the face arrives; and a
 * face that leaves takes its way of going with it, so a pick is never
 * handed to a router that is gone.
 */
function Steered({ steering }: { readonly steering: PagesSteering }) {
  const location = useLocation();
  const navigate = useNavigate();
  const here = `${location.pathname}${location.search}`;
  useLayoutEffect(() => steering.at(here), [here, steering]);
  /*
   * The way of going is handed over once this face is on the page, never
   * while it renders: a render the face's fetch suspends is never
   * committed, and a router that was never committed ignores a navigation —
   * the pick was handed to it and lost.
   */
  useLayoutEffect(() => {
    const go = (path: string) => {
      if (path !== here) navigate(path);
    };
    steering.go.current = go;
    const asked = steering.pending?.current;
    if (asked !== undefined) {
      steering.pending!.current = undefined;
      go(asked);
    }
    return () => {
      if (steering.go.current === go) steering.go.current = undefined;
    };
  }, [here, navigate, steering]);
  return null;
}

/**
 * WHERE THE READER IS, SAID TO THE OTHERS FROM THIS FACE (FR-155). The
 * page is said as the stop it is on the scene — a record, its kind's
 * group, a picture, the overview — so another reader's bar says where
 * this one is in the declaration's words, on either face, and a figure on
 * the scene stands there. A page with no place on the scene (the home,
 * Find, the problems) says none. Handed back to the scene when the face goes.
 */
function SaysWhere<S extends AnySchema>({ context, to }: { readonly context: PageContext<S>; readonly to: GraviewContextValue<AnySchema> | null }) {
  const { pathname } = useLocation();
  const nearest = useGraviewIfAny();
  // The provider above the face first: the one below says nothing of its own there (`PagesApp`).
  const say = (to ?? nearest)?.sayWhere;
  const stop = stopOfPage(context, pathname);
  useEffect(() => {
    say?.(stop);
    return () => say?.(null);
  }, [say, stop]);
  return null;
}

/** A page's stop on the scene, as a fragment: `#` for a page that has none. */
function stopOfPage<S extends AnySchema>(context: PageContext<S>, pathname: string): string {
  const [first = "", second, more] = pathname.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  });
  if (more !== undefined) return "#";
  if (first === "places" && second !== undefined) {
    if (second === OVERVIEW_SLUG) return "#overview=1";
    const place = context.views?.places().find((one) => one.as === second);
    return place ? `#focus=${encodeURIComponent(aggregateId(place.kind))}&view=${encodeURIComponent(place.as)}` : "#";
  }
  const kind = kindOfSlug(context.store.schema, first);
  return kind ? `#focus=${encodeURIComponent(second ?? aggregateId(kind))}` : "#";
}

/** How the face arrived where it is: a new entry, a replaced one, or Back and Forward. */
export type NavigationHow = "push" | "replace" | "pop";

/**
 * Says where the face went to a host that asked, and goes where the host
 * sends it. Inside the router, whichever router it is.
 */
function Reported({ onNavigate, path }: { readonly onNavigate: PagesAppProps<AnySchema>["onNavigate"]; readonly path: string | undefined }) {
  const location = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate();
  // A section the face went to (`#shipping-soon`) is part of where it is, so a host that keeps the address can share it.
  const section = location.hash && !location.hash.includes("=") ? location.hash : "";
  const here = `${location.pathname}${location.search}${section}`;
  const told = useRef(onNavigate);
  told.current = onNavigate;
  // The address the face arrived at is no navigation, so it is not reported.
  const last = useRef<string | null>(null);
  useEffect(() => {
    const was = last.current;
    last.current = here;
    if (was === null) return;
    // The router tidying the entry it arrived on is no step: the same address, replaced or popped, is not said.
    if (here === was && type !== "PUSH") return;
    told.current?.(here, type === "POP" ? "pop" : type === "REPLACE" ? "replace" : "push");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
  const asked = useRef(path);
  useEffect(() => {
    if (path === undefined || path === asked.current) return;
    asked.current = path;
    if (path !== here) navigate(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  return null;
}

function KindSwitch<S extends AnySchema>({
  context,
  registry,
  page,
}: {
  context: PageContext<S>;
  registry: PageRegistry<S, PageComponent<S>> | undefined;
  page: "list" | "record";
}) {
  const params = useParams();
  const kind = kindOfSlug(context.store.schema, params["slug"] ?? "");
  const Fallback = page === "list" ? DefaultListPage : DefaultRecordPage;
  const Registered = kind ? registry?.lookup(kind, page) : undefined;
  const Component = (Registered ?? Fallback) as PageComponent<S>;
  return <Component context={context} />;
}

/*
 * A NEW PAGE OPENS AT ITS TOP.
 *
 * The router keeps the document where it was: press a card at the foot of
 * the gallery and the picture's page opened already scrolled to its own
 * foot, with the heading somewhere above the window. A browser resets the
 * scroll on a full navigation and this face never had one, which the
 * readme-shaped home was short enough to hide.
 *
 * Reset on a NEW address only: Back and Forward are left to the browser,
 * which restores the position it recorded for that entry, and a change of
 * search alone — the list page writes `?q=` as you type — is an adjustment
 * of the page you are on, not a page. What scrolls is whatever holds the
 * face: the window when it owns the document, the nearest ancestor that
 * scrolls when it is inside an embed's frame or a shell's own region — so
 * a host page with three embeds is never yanked to the top of one of them.
 */
/**
 * The routed face's root: the rule that the keyboard always lands
 * somewhere, and the controls the face offers whichever shell draws it —
 * Find and the way back (face-controls.tsx).
 */
function FaceRoot<S extends AnySchema>({
  context,
  registry,
  children,
}: {
  readonly context: PageContext<S>;
  readonly registry: PageRegistry<S, PageComponent<S>> | undefined;
  readonly children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useTheKeyboardLandsSomewhere(root);
  return (
    <div ref={root} data-graview-face="pages" style={{ display: "contents" }}>
      <FaceControlsRoot context={context} registry={registry as PageRegistry<S, unknown> | undefined} root={root}>
        {/* The scene's context menu, on what a right-click, the keyboard or a resting finger lands on here. */}
        <PagesContextMenu context={context} root={root}>
          {children}
        </PagesContextMenu>
      </FaceControlsRoot>
    </div>
  );
}

/** Whether the keyboard is in somewhere a person types: a text field, a choice, a box that edits. */
function typingIn(active: Element | null): boolean {
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable || active.tagName === "TEXTAREA" || active.tagName === "SELECT") return true;
  return active.tagName === "INPUT" && !["button", "submit", "reset", "checkbox", "radio", "image", "file", "color", "range"].includes((active as HTMLInputElement).type);
}

function ScrollReset() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  const mark = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (type === "POP") return;
    for (let at = mark.current?.parentElement; at; at = at.parentElement) {
      const { overflowY } = getComputedStyle(at);
      if ((overflowY === "auto" || overflowY === "scroll") && at.scrollHeight > at.clientHeight) {
        at.scrollTop = 0;
        return;
      }
    }
    window.scrollTo(0, 0);
    // The address is the page; its search and hash are where you are on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  /*
   * A NEW PAGE TAKES THE KEYBOARD AT ITS HEADING. Following a link removes
   * the page the link was on, and with it the keyboard, which fell to
   * <body>: Tab started again at the top of the document and a screen
   * reader said nothing about where it had arrived. Where the keyboard was
   * on the page that left, it lands on the heading of the one that came —
   * which a reader then hears — and nowhere else, so a person who was
   * typing in the search box is not moved.
   */
  // The first page is where the reader arrived, not where they went.
  const arrivedAt = useRef(pathname);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current && pathname === arrivedAt.current) return;
    moved.current = true;
    /*
     * AND FROM A LINK THAT STAYS. A place followed from the bar left the
     * keyboard on the bar's link, which is still there: the page under it
     * changed and a screen reader said nothing at all. Only a person
     * typing — the Find box, the seat, a field — keeps the keyboard where it is.
     */
    const active = document.activeElement;
    if (typingIn(active)) return;
    const main = mark.current?.closest("main") ?? document.querySelector("main");
    const heading = mark.current?.closest("[data-graview-face]")?.querySelector<HTMLElement>("[data-graview-page-title]") ?? main?.querySelector<HTMLElement>("h1, h2") ?? null;
    const target = heading ?? main ?? null;
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return <span ref={mark} hidden data-graview-scroll-reset="" />;
}

/**
 * GOING SOMEWHERE, ON THIS FACE: a record is its page, a place is its
 * address under `/places/`, a kind's list is `/<plural>`. What a view that
 * is not React — a worker view (FR-93) — reaches through `useGoTo`. A list
 * or a place narrowed carries `?filter=` — the word its arranging line
 * writes — and a section `#<section>`, so the address can be shared.
 */
function GoesByAddress<S extends AnySchema>({ context, children }: { readonly context: PageContext<S>; readonly children: ReactNode }) {
  const navigate = useNavigate();
  const goTo = useMemo<GoTo>(
    () => ({
      record: (id, also) => {
        const node = context.store.graph.getNode(id);
        if (node) navigate(narrowedPath(recordPath(context.store.schema, node.kind, id), { section: also?.section }));
      },
      place: (as, also) => {
        const place = context.views?.places().find((candidate) => candidate.as === as);
        if (place) navigate(narrowedPath(pathOfPlace(context, place), also));
      },
      list: (kind, also) => {
        if (context.store.schema.tryDefinition(kind)) navigate(narrowedPath(`/${pluralSlug(context.store.schema, kind)}`, also));
      },
      // A view drawn stands in the main column, at its own address, as the seat's does.
      draft: () => navigate("/~draft"),
    }),
    [context, navigate],
  );
  return <GoToContext.Provider value={goTo}>{children}</GoToContext.Provider>;
}

/**
 * A SECTION OF THE PAGE, FROM THE ADDRESS: `#shipping-soon` scrolls to the
 * heading that says it (or the element with that id) once it is drawn, and
 * gives it the keyboard — on arrival from a shared link as after a view's
 * `navigate`. A scene's fragment (`#view=…`) is no section.
 */
function SectionOnArrival() {
  const { pathname, search, hash } = useLocation();
  useEffect(() => {
    const section = decodeURIComponent(hash.replace(/^#/, ""));
    if (!section || section.includes("=")) return;
    return revealSection(section);
  }, [pathname, search, hash]);
  return null;
}

/**
 * WHERE THE APP OPENS (FR-80). A reader who arrives at the home of an app
 * whose declaration names `pages.first` is taken there instead — a place
 * to its page, a kind to its list — once: the arrival is replaced, so Back
 * leaves the app rather than bouncing, and the masthead and every link to
 * the home still go home. Once a visit has landed — on this face, or on the
 * scene it opened on (`hasLanded`) — the home is the home: a press on Home
 * from the scene draws the pages at their first entry, and that is no
 * arrival.
 */
function Opening<S extends AnySchema>({ context, Home }: { readonly context: PageContext<S>; readonly Home: PageComponent<S> }) {
  const location = useLocation();
  const views = context.views;
  // The address the reader arrived at is the router's first entry, which no navigation made.
  const arriving = location.key === "default" && !(views && hasLanded(views));
  useEffect(() => {
    if (views) markLanded(views);
  }, [views]);
  const opening = arriving ? openingOf(context.views?.arrangement?.()?.first, context.store.schema, context.views?.places() ?? []) : undefined;
  const to =
    opening?.to === "place" ? pathOfPlace(context, opening.place) : opening?.to === "kind" ? `/${pluralSlug(context.store.schema, opening.kind)}` : undefined;
  return to ? <Navigate to={to} replace /> : <Home context={context} />;
}

export function PagesRoutes<S extends AnySchema>({
  context,
  registry,
}: {
  readonly context: PageContext<S>;
  readonly registry?: PageRegistry<S, PageComponent<S>>;
}) {
  const Own = registry?.lookupSurface("shell") as ComponentType<{ context: PageContext<S>; children: ReactNode }> | undefined;
  const own = Own !== undefined;
  /*
   * ONE BAR, WHICHEVER SHELL (FR-131). A design's shell is drawn UNDER the
   * app bar, as it always was inside an embed. Standalone it used to be the
   * whole window, so every design drew its own masthead, its own Find, its
   * own "In the scene ↗" and its own "Remembered in this browser", and the
   * same app read differently at its own address than in a host's page.
   * Told `barAbove`, a design draws only what is its own. A design that
   * really is the whole window says so: `without: ["bar"]`.
   */
  const ownsTheWindow = own && (registry?.without().has("bar") ?? false);
  const under: PageContext<S> = own && !ownsTheWindow && !context.embedded ? { ...context, barAbove: true } : context;
  const frame = (children: ReactNode) =>
    Own === undefined ? (
      <DefaultShell context={context}>{children}</DefaultShell>
    ) : ownsTheWindow ? (
      <Own context={context}>{children}</Own>
    ) : (
      <DefaultShell context={context}>
        <Own context={under}>{children}</Own>
      </DefaultShell>
    );
  const Home = (registry?.lookupSurface("home") ?? DefaultHomePage) as PageComponent<S>;
  const Problems = (registry?.lookupSurface("problems") ?? DefaultProblemsPage) as PageComponent<S>;
  /*
   * A SHELL OF THE APP'S OWN OWNS THE LANDMARK.
   *
   * `graview-pages` tells a design's shell to render the one `main`, and the
   * framework's own pages went on wrapping themselves in `PageMain`
   * underneath it — so every route a design left derived had a main inside a
   * main, and so did the not-found page, which is reachable in EVERY design
   * because there is no kind to register it on. The registry already knows;
   * the pages under the shell just had to be told.
   */
  const inside: PageContext<S> = own ? { ...under, framed: true } : context;
  /* The own bar's Find slot, where the face's root puts the one Find box (an embed's bar keeps its own). */
  const [barFind, setBarFind] = useState<BarFind | null>(null);
  const told = useMemo(() => ({ onFind: setBarFind, find: !(registry?.without().has("find") ?? false), places: !(registry?.without().has("places") ?? false) }), [registry]);
  const routes = (
    // The routed face holds the keyboard the way the scene does, and offers Find and the way back, whichever shell an app draws.
    <FaceRoot context={context} registry={registry}>
    <GoesByAddress context={context}>
    {frame(<>
    {/* The app as it was, and the way through it (Roadmap f-playback): at the head of the page, under the bar. */}
    <PastBar face="pages" />
    <RecordLinks context={inside}>
      <ScrollReset />
      <SectionOnArrival />
      <Routes>
        {/*
          * THE APP'S OWN ROUTES FIRST — a survey desk, an onboarding, a
          * settings page — because `/:slug` would otherwise swallow every
          * one of them and hand the address to the kind switch.
          */}
        {(registry?.routes() ?? []).map(({ path, component }) => {
          const Page = component as PageComponent<S>;
          return <Route key={path} path={path} element={<Page context={inside} />} />;
        })}
        <Route path="/" element={<Opening context={inside} Home={Home} />} />
        <Route path="/problems" element={<Problems context={inside} />} />
        {/* A view the seat drew, before it is kept as a lens or put away. */}
        <Route
          path="/~draft"
          element={
            <Suspense fallback={null}>
              <DraftPage context={inside as unknown as PageContext<AnySchema>} />
            </Suspense>
          }
        />
        {/* What the words find, anywhere: the Find box's matcher at an address. */}
        <Route path="/search" element={<DefaultSearchPage context={inside} />} />
        {/* The app's pictures, when it handed the face its views: an index, and each lens at its name. */}
        <Route path="/map" element={<DefaultMapPage context={inside} />} />
        <Route path="/places" element={<DefaultPlacesPage context={inside} />} />
        {/*
          * THE OVERVIEW'S ADDRESS ON THE ROUTED FACE (FR-132): the scene is
          * drawn there, so the routed face reaches it only where the scene
          * stands aside — an embed narrower than `pagesBelow` arriving at
          * it — and there it is the home, never a place nobody declared. A
          * place that took the address (`pages-overview-taken` warns of it)
          * keeps its page here.
          */}
        {placesOf(inside).some((place) => place.as === OVERVIEW_SLUG) ? null : <Route path={OVERVIEW_PATH} element={<Navigate to="/" replace />} />}
        <Route path="/places/:as" element={<DefaultPlacePage context={inside} />} />
        <Route path="/:slug" element={<KindSwitch context={inside} registry={registry} page="list" />} />
        <Route
          path="/:slug/:id"
          element={<KindSwitch context={inside} registry={registry} page="record" />}
        />
      </Routes>
    </RecordLinks>
    </>)}
    </GoesByAddress>
    </FaceRoot>
  );
  // Only a design under the bar hands the bar its Find: the derived shell draws its own in the bar, and so says it before any script runs.
  if (context.embedded || !own || ownsTheWindow) return routes;
  return (
    <OwnBarFind.Provider value={told}>
      <BarFindContext.Provider value={barFind}>{routes}</BarFindContext.Provider>
    </OwnBarFind.Provider>
  );
}

/** Where a first look finds the controls of a face that owns the page. */
const thePage = (): Element | null => (typeof document === "undefined" ? null : document.body);

export function PagesApp<S extends AnySchema>({
  context: handed,
  registry,
  basename,
  initialPath,
  onNavigate,
  path,
  steering,
  firstLook,
}: PagesAppProps<S>) {
  /*
   * THE SEAT THE READER TOOK, where the app offers seats and no provider
   * above holds them. The face names the person by their seat (the tenth
   * walk found "user-lena" on the person's button: the seats never reached
   * the provider), and once they reach it the person's menu offers "Sit as
   * somebody else" — so the face sits there too, until the app hands it
   * another principal.
   */
  const [taken, setTaken] = useState<{ readonly from: PageContext<S>["principal"]; readonly seat: NonNullable<PageContext<S>["principal"]> } | undefined>(undefined);
  const given = taken !== undefined && taken.from === handed.principal ? { ...handed, principal: taken.seat } : handed;
  /*
   * WHAT THE SEAT MAY SEE. Every page reads `context.store`; under a policy
   * that says who sees what (`sees`), that store holds only what this seat
   * may see — a stranger is not shown the customers — and acts still go to
   * the store itself. With no `sees`, it is the store, unchanged.
   */
  /* The lenses this reader kept from the seat, beside the app's own places, before a page draws them. */
  useState(() => (given.views ? registerReaderLenses(given.views, given.store.schema, appKeyOf(given.brand, given.store.schema)) : undefined));
  /*
   * A provider above this face — an embed's, drawing the bar — already says
   * where this tab is: it is told this face's page, and the provider below
   * says nothing of its own, or one tab would say two places by turns.
   */
  const outer = useGraviewIfAny();
  // Days, times and numbers in the reader's locale, else the app's (FR-178), whether or not a provider is drawn under the pages.
  sayIn({ reader: given.locale ?? outer?.locale, app: given.brand?.locale ?? given.app?.brand?.locale });
  /*
   * THE MOMENT DRAWN (Roadmap f-playback): now, or the app as it stood at
   * a moment somebody asked to see — the provider's this face is drawn
   * inside when that one holds this store, else the face's own. Every page
   * reads the one store, so the place a person is on is drawn as it was.
   */
  const seat = given.principal ?? ANYONE;
  const playback = useOwnPlayback(given.store, seat, given.history);
  const shown = playback.past && playback.live === given.store ? playback.past.store : given.store;
  const viewed = shown.seenBy(seat);
  const context = viewed === given.store ? given : { ...given, store: viewed };
  useTheWatchKnowsWhatIsUnseen(given.store, given.principal);
  const routed = (
    <>
      {onNavigate || path !== undefined ? <Reported onNavigate={onNavigate} path={path} /> : null}
      {steering ? <Steered steering={steering} /> : null}
      {context.presence || outer ? <SaysWhere context={context} to={outer} /> : null}
      <PagesRoutes context={context} {...(registry ? { registry } : {})} />
      {/* The face owns the page: its controls are found in the page. */}
      {firstLook ? <FirstLookDoor firstLook={firstLook} root={thePage} app={appKeyOf(given.brand, given.store.schema)} /> : null}
    </>
  );
  /*
   * A PROVIDER UNDER THE PAGES when the app handed over its views, so a lens
   * drawn on a page finds the store, the seat and the registry its hooks ask
   * for — the same provider the embed puts under this face. No scene, no
   * URL sync: the router owns the address here.
   */
  /*
   * THE SEAT BELONGS TO THE FACE, NOT TO ONE SHELL. Mounted here rather
   * than inside the derived chrome, so an app that replaced every surface
   * with a design of its own still has the assistant — the same panel, on
   * every route, however the pages around it are drawn.
   */
  const inner = context.views ? (
    <GraviewProvider
      store={context.store}
      views={context.views}
      {...(context.principal ? { principal: context.principal } : {})}
      {...(context.brand ? { brand: context.brand } : {})}
      {...(context.locale ? { locale: context.locale } : {})}
      {...(context.settings ? { settings: context.settings } : {})}
      {...(context.presence && !outer ? { presence: context.presence } : {})}
      {...(context.people ? { people: context.people } : {})}
      {...(context.seats ? { seats: context.seats } : {}) /* So the person's button names the seat, not its principal id. */}
      onSeat={(seat) => (outer ? outer.takeSeat(seat) : setTaken({ from: handed.principal, seat }))}
      {...(context.onKeepLens ? { onKeepLens: context.onKeepLens } : {})}
      {...(context.ai ? { ai: context.ai } : {})}
      {...(context.subscriptions ? { subscriptions: context.subscriptions } : {})}
      resolveApp={context.resolveApp ?? outer?.resolveApp /* The host's way to name another app (FR-171): the face's own, else the provider's it is drawn inside. */}
      linkedRecords={context.linkedRecords ?? outer?.linkedRecords /* And to read its records, as this viewer (FR-171). */}
      {...(context.app ? { app: context.app } : {})}
      {...(context.menuSections ? { menuSections: context.menuSections } : {})}
    >
      {routed}
      <PageAsk context={context} />
    </GraviewProvider>
  ) : (
    routed
  );
  const timed = <PlaybackContext.Provider value={playback as unknown as Playback}>{inner}</PlaybackContext.Provider>;
  const filed = context.files ? <HostFilesContext.Provider value={context.files}>{timed}</HostFilesContext.Provider> : timed;
  if (initialPath !== undefined) {
    /*
     * THE TEST ROUTER CARRIES THE BASENAME TOO, OR THE TESTS ARE A LIE.
     *
     * `MemoryRouter` used to be handed the path and nothing else, so under
     * `basename="/pages"` a `<Link to="/survey">` rendered `/survey` in a
     * test and `/pages/survey` in a browser — and a link written the other
     * way round, `to="/pages/survey"`, rendered correctly in every test and
     * doubled to `/pages/pages/survey` the moment anybody opened it. A
     * product shipped nine of those with twenty-five green tests asserting
     * the exact hrefs.
     *
     * `initialPath` is basename-RELATIVE, like every `to` on this face, and
     * the router is given both — so a test renders the hrefs a browser will.
     * A path that already carries the basename now doubles here as well,
     * which is the whole point: the mistake fails where it is cheap.
     */
    const entry = basename === undefined ? initialPath : `${basename.replace(/\/$/, "")}${initialPath}`;
    return (
      <MemoryRouter initialEntries={[entry]} {...(basename === undefined ? {} : { basename })}>
        {filed}
      </MemoryRouter>
    );
  }
  return <BrowserRouter {...(basename === undefined ? {} : { basename })}>{filed}</BrowserRouter>;
}

export { createPageRegistry };
