import type { AnySchema } from "@graview/core";
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { openingOf } from "@graview/core";
import { pathOfPlace } from "./page-places.js";
import { pluralSlug } from "./registry.js";
import { useEffect, useLayoutEffect, useRef, type ComponentType, type ReactNode } from "react";
import { GraviewProvider, useTheKeyboardLandsSomewhere, useTheWatchKnowsWhatIsUnseen } from "@graview/react/provider";
import { PageAsk } from "./ask.js";
import { FaceControlsRoot } from "./face-controls.js";
import { DefaultHomePage, DefaultListPage, DefaultMapPage, DefaultPlacePage, DefaultPlacesPage, DefaultProblemsPage, DefaultRecordPage, DefaultSearchPage, DefaultShell, type PageContext } from "./pages.js";
import { createPageRegistry, kindOfSlug, type PageRegistry } from "./registry.js";
import { useLocation, useNavigationType, useParams } from "react-router-dom";

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
        {children}
      </FaceControlsRoot>
    </div>
  );
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
    const active = document.activeElement;
    if (active !== null && active !== document.body && active !== document.documentElement) return;
    const main = mark.current?.closest("main") ?? document.querySelector("main");
    const heading = main?.querySelector<HTMLElement>("h1") ?? null;
    const target = heading ?? main ?? null;
    if (!target) return;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return <span ref={mark} hidden data-graview-scroll-reset="" />;
}

/**
 * WHERE THE APP OPENS (FR-80). A reader who arrives at the home of an app
 * whose declaration names `pages.first` is taken there instead — a place
 * to its page, a kind to its list — once: the arrival is replaced, so Back
 * leaves the app rather than bouncing, and the masthead and every link to
 * the home still go home.
 */
function Opening<S extends AnySchema>({ context, Home }: { readonly context: PageContext<S>; readonly Home: PageComponent<S> }) {
  const location = useLocation();
  // The address the reader arrived at is the router's first entry, which no navigation made.
  const arriving = location.key === "default";
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
  const own = registry?.lookupSurface("shell");
  const Shell = (own ?? DefaultShell) as ComponentType<{
    context: PageContext<S>;
    children: ReactNode;
  }>;
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
  const inside: PageContext<S> = own ? { ...context, framed: true } : context;
  return (
    // The routed face holds the keyboard the way the scene does, and offers Find and the way back, whichever shell an app draws.
    <FaceRoot context={context} registry={registry}>
    <Shell context={context}>
      <ScrollReset />
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
        {/* What the words find, anywhere: the Find box's matcher at an address. */}
        <Route path="/search" element={<DefaultSearchPage context={inside} />} />
        {/* The app's pictures, when it handed the face its views: an index, and each lens at its name. */}
        <Route path="/map" element={<DefaultMapPage context={inside} />} />
        <Route path="/places" element={<DefaultPlacesPage context={inside} />} />
        <Route path="/places/:as" element={<DefaultPlacePage context={inside} />} />
        <Route path="/:slug" element={<KindSwitch context={inside} registry={registry} page="list" />} />
        <Route
          path="/:slug/:id"
          element={<KindSwitch context={inside} registry={registry} page="record" />}
        />
      </Routes>
    </Shell>
    </FaceRoot>
  );
}

export function PagesApp<S extends AnySchema>({
  context: given,
  registry,
  basename,
  initialPath,
}: PagesAppProps<S>) {
  /*
   * WHAT THE SEAT MAY SEE. Every page reads `context.store`; under a policy
   * that says who sees what (`sees`), that store holds only what this seat
   * may see — a stranger is not shown the customers — and acts still go to
   * the store itself. With no `sees`, it is the store, unchanged.
   */
  const viewed = given.store.seenBy(given.principal ?? { kind: "human" });
  const context = viewed === given.store ? given : { ...given, store: viewed };
  useTheWatchKnowsWhatIsUnseen(given.store, given.principal);
  const routed = <PagesRoutes context={context} {...(registry ? { registry } : {})} />;
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
      {...(context.settings ? { settings: context.settings } : {})}
      {...(context.presence ? { presence: context.presence } : {})}
      {...(context.people ? { people: context.people } : {})}
    >
      {routed}
      <PageAsk context={context} />
    </GraviewProvider>
  ) : (
    routed
  );
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
        {inner}
      </MemoryRouter>
    );
  }
  return <BrowserRouter {...(basename === undefined ? {} : { basename })}>{inner}</BrowserRouter>;
}

export { createPageRegistry };
