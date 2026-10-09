import { pluralOf, addressOf, OVERVIEW_PATH, pathWithin, placeSlug, type AnySchema, type GraviewApp, type Place, type Store } from "@graview/core";
import { aggregateId, AGGREGATE_PREFIX, fromUrl, kindOfCard, toUrl, withFocus, type ViewState } from "@graview/layout/view";
import { faceAtAddress, stopAtAddress } from "./address.js";
import type { EmbedProps } from "./embed.js";
import type { EmbedFace } from "./frame.js";

/**
 * WHERE THE READER IS (FR-116): the face, the path of the place they are
 * on — the overview's, `/places/overview`, on the scene (FR-132) — and the
 * scene's stop. `handle.where()` reads it; a host
 * that must remount hands it back as `mount(…, { at })`, and `setApp`
 * carries it across a new declaration by itself.
 */
export interface EmbedWhere {
  readonly face: EmbedFace;
  /** The place's path within the app's own routes, with its search: `/places/overview` on the scene (FR-132). */
  readonly path: string;
  /** The scene's stop, as the fragment the app itself would write. */
  readonly stop: string;
  /** The kind of the record the scene is focused on, so a remount falls back to its kind's group when the record is gone. */
  readonly kind?: string;
}

const slugOf = (schema: AnySchema, kind: string) => placeSlug(pluralOf(schema, kind));

/** Whether one of the app's own routes (`/survey`, `/desk/:id`) answers a path. */
function answers(route: string, parts: readonly string[]): boolean {
  const own = route.split("/").filter(Boolean);
  return own.length === parts.length && own.every((part, at) => part.startsWith(":") || part === "*" || part === parts[at]);
}

/** The framework's own pages, which every app has. */
const OWN = ["problems", "search", "map", "places"];

/**
 * A place, settled in the app it is now in. What the change took away falls
 * back to its nearest parent: a removed record to its kind's list (on Pages)
 * or its kind's group (in the scene); a removed kind, place or lens to the
 * home — a lens in the scene to its kind's group when the kind is still there.
 * A path that is no kind's, the app's own routes, is kept.
 */
export function settle(where: EmbedWhere, app: GraviewApp<AnySchema>, store: Store<AnySchema>, places: readonly Place[], routes: readonly { readonly path: string }[] = []): EmbedWhere {
  const { schema } = app;
  const kinds = schema.kinds as readonly string[];
  const known = (id: string): boolean => {
    if (id.startsWith(AGGREGATE_PREFIX)) return (id.slice(AGGREGATE_PREFIX.length).split("|")[0] ?? "").split("+").every((kind) => kinds.includes(kind));
    const card = kindOfCard(id);
    if (card !== null) return kinds.includes(card);
    return id.startsWith("edge:") || store.graph.getNode(id) !== undefined;
  };

  // The page: `/<plural>`, `/<plural>/<id>`, `/places/<as>`.
  const [pathname = "/", search] = where.path.split("?");
  const parts = pathname.split("/").filter(Boolean);
  const query = search ? `?${search}` : "";
  const kind = parts.length > 0 && !OWN.includes(parts[0]!) ? kinds.find((one) => slugOf(schema, one) === parts[0]) : undefined;
  let path = where.path;
  if (parts[0] === "places" && parts.length === 2) {
    // The overview is a place every app has (FR-132).
    if (`/places/${parts[1]}` !== OVERVIEW_PATH && !places.some((place) => place.as === decodeURIComponent(parts[1]!))) path = "/";
  } else if (kind) {
    const id = parts[1] === undefined ? undefined : decodeURIComponent(parts[1]);
    path = `/${slugOf(schema, kind)}${id !== undefined && store.graph.getNode(id)?.kind === kind ? `/${parts[1]}` : ""}${query}`;
  } else if (parts.length > 0 && parts.length <= 2 && !OWN.includes(parts[0]!) && !routes.some((route) => answers(route.path, parts))) {
    // No kind of the new app's, and none of its own pages: a kind the change took away.
    path = "/";
  }

  // The stop: its focus, its lens, and what it holds open.
  const was = fromUrl(where.stop);
  const lens = was.within?.["view"];
  const lensGone = lens !== undefined && !places.some((place) => place.as === lens);
  let view: ViewState = was;
  if (lensGone) {
    const { view: _gone, ...rest } = was.within ?? {};
    view = { ...view, within: rest };
  }
  if (was.focusId && !known(was.focusId)) {
    const parent = where.kind && kinds.includes(where.kind) ? aggregateId(where.kind) : null;
    view = { ...withFocus(view, parent), zoom: false };
  }
  view = {
    ...view,
    relation: view.relation && (kinds.includes(view.relation) || schema.edgeKinds.includes(view.relation)) ? view.relation : null,
    expanded: view.expanded.filter(known),
    pins: Object.fromEntries(Object.entries(view.pins).filter(([id]) => known(id))),
    ...(view.selection ? { selection: view.selection.filter(known) } : {}),
  };
  return { face: where.face, path, stop: toUrl(view), ...(where.kind ? { kind: where.kind } : {}) };
}

/**
 * The place a host handed back, settled in the app the embed now draws.
 * Under address routing the address is the source of truth, and when what
 * it names is gone it is replaced, in place, by where the reader lands.
 */
export function settleAt(props: Pick<EmbedProps<AnySchema>, "at" | "app" | "routing" | "basePath" | "pages">, store: Store<AnySchema>, places: readonly Place[]): EmbedWhere {
  const given = props.at!;
  const routes = props.pages?.routes() ?? [];
  if (props.routing !== "address" || typeof window === "undefined") return settle(given, props.app, store, places, routes);
  const { pathname, search, hash } = window.location;
  const within = pathWithin(pathname, props.basePath);
  // The face too is the address's: a place handed back on the scene, at an address that names a page, is settled as that page.
  const face = faceAtAddress({ routing: "address", ...(props.basePath === undefined ? {} : { basePath: props.basePath }), face: given.face });
  const onPages = face === "pages";
  const asked = { ...given, face, ...(within === null ? {} : onPages ? { path: within + search } : { stop: stopAtAddress(props.basePath) ?? given.stop }) };
  const settled = settle(asked, props.app, store, places, routes);
  const next = onPages
    ? settled.path === asked.path ? null : addressOf(settled.path, props.basePath === undefined ? {} : { basePath: props.basePath })
    : settled.stop === toUrl(fromUrl(asked.stop)) ? null : pathname + search + settled.stop;
  if (within !== null && next !== null && next !== pathname + search + hash) window.history.replaceState(window.history.state, "", next);
  return settled;
}
