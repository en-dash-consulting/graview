import type { AnySchema } from "@graview/core";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import type { ComponentType, ReactNode } from "react";
import {
  DefaultHomePage,
  DefaultListPage,
  DefaultProblemsPage,
  DefaultRecordPage,
  DefaultShell,
  type PageContext,
} from "./pages.js";
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
  /** For tests and SSR: render at a fixed address with no real history. */
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
        <Route path="/" element={<Home context={inside} />} />
        <Route path="/problems" element={<Problems context={inside} />} />
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
  const inner = <PagesRoutes context={context} {...(registry ? { registry } : {})} />;
  if (initialPath !== undefined) {
    return <MemoryRouter initialEntries={[initialPath]}>{inner}</MemoryRouter>;
  }
  return <BrowserRouter {...(basename === undefined ? {} : { basename })}>{inner}</BrowserRouter>;
}

export { createPageRegistry };
