import type { AnySchema } from "@graview/core";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import type { ComponentType, ReactNode } from "react";
import { GraviewProvider } from "@graview/react";
import { PageAsk } from "./ask.js";
import { DefaultHomePage, DefaultListPage, DefaultMapPage, DefaultPlacePage, DefaultPlacesPage, DefaultProblemsPage, DefaultRecordPage, DefaultShell, type PageContext } from "./pages.js";
import { createPageRegistry, kindOfSlug, type PageRegistry } from "./registry.js";
import { useParams } from "react-router-dom";

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
    <Shell context={context}>
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
        <Route path="/" element={<Home context={inside} />} />
        <Route path="/problems" element={<Problems context={inside} />} />
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
  );
}

export function PagesApp<S extends AnySchema>({
  context,
  registry,
  basename,
  initialPath,
}: PagesAppProps<S>) {
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
