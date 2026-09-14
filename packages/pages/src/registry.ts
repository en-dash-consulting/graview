import type { AnySchema, KindOfSchema } from "@graview/core";
import type { ComponentType } from "react";

/**
 * The page registry, shaped like the view registry ON PURPOSE.
 *
 * (kind × page type) → component, defaults registered first, an app
 * overriding per cell — an author who has registered a view already knows
 * how to register a page, and that symmetry is the whole SDK story. The
 * layout shell is itself a registration, so custom chrome is the same
 * authoring move as a custom record page.
 */
export type PageType = "list" | "record";

/** App-level surfaces that are not per-kind: the shell and the fixed pages. */
export type SurfaceType = "shell" | "home" | "problems";

export interface PageRegistration<P = unknown> {
  readonly kind: string;
  readonly page: PageType;
  readonly component: P;
}

export interface PageRegistry<S extends AnySchema, P = unknown> {
  register<K extends KindOfSchema<S>>(kind: K, page: PageType, component: P): PageRegistry<S, P>;
  surface(surface: SurfaceType, component: P): PageRegistry<S, P>;
  lookup(kind: string, page: PageType): P | undefined;
  lookupSurface(surface: SurfaceType): P | undefined;
  all(): readonly PageRegistration<P>[];
}

export function createPageRegistry<S extends AnySchema, P = ComponentType<never>>(
  _schema: S,
): PageRegistry<S, P> {
  const entries = new Map<string, P>();
  const surfaces = new Map<SurfaceType, P>();
  const registrations: PageRegistration<P>[] = [];

  const registry: PageRegistry<S, P> = {
    register(kind, page, component) {
      entries.set(`${kind}|${page}`, component);
      registrations.push({ kind, page, component });
      return registry;
    },
    surface(surface, component) {
      surfaces.set(surface, component);
      return registry;
    },
    lookup(kind, page) {
      return entries.get(`${kind}|${page}`);
    },
    lookupSurface(surface) {
      return surfaces.get(surface);
    },
    all() {
      return registrations;
    },
  };
  return registry;
}

/**
 * Routes derive from the schema: `/:plural` and `/:plural/:id` off the
 * plural the declaration already carries. One slug per kind — `graview
 * check` refuses two kinds whose plurals collide, because a route that
 * depends on registration order is a route nobody can link to.
 */
export function pluralSlug(schema: AnySchema, kind: string): string {
  const definition = schema.tryDefinition(kind);
  const plural = definition?.plural ?? `${kind}s`;
  return plural
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** kind ← slug, the other direction of `pluralSlug`. */
export function kindOfSlug(schema: AnySchema, slug: string): string | undefined {
  return (schema.kinds as readonly string[]).find((kind) => pluralSlug(schema, kind) === slug);
}

/** The routed address of one node — shared ids are what make two faces one app. */
export function recordPath(schema: AnySchema, kind: string, id: string): string {
  return `/${pluralSlug(schema, kind)}/${encodeURIComponent(id)}`;
}

/** The spatial stop for the same node, for the link back into the scene. */
export function spatialHref(id: string): string {
  return `/#focus=${encodeURIComponent(id)}`;
}

/**
 * The spatial stop that shows one NAMED PLACE — a lens, by the name it was
 * registered under.
 *
 * A page that has just drawn three areas wants to link to the map, and could
 * only ever say "open the scene and press The grounds", because the long form
 * of that stop needs the aggregate id of the kind behind the picture and a
 * page has no business knowing how the layout spells one. A place's name is
 * unique across an app, so naming it is enough: the scene looks it up and
 * focuses the group it is a picture of.
 *
 * `placeSlug(title)` in `@graview/core` turns a registered title into the
 * name to pass here.
 */
export function placeHref(as: string, sceneHref = "/"): string {
  return `${sceneHref}#view=${encodeURIComponent(as)}`;
}
