import { aheadOf, listPageViewOf, type KeptDrawings } from "@graview/react/provider";
import type { AnySchema, ViewerState } from "@graview/core";
import type { PageContext } from "./page-context.js";
import { listOpensAs, placesOf } from "./page-places.js";
import { kindOfSlug, type PageRegistry } from "./registry.js";

/*
 * A CUSTOM PAGE FETCHED AHEAD OF ITS FIRST VISIT (Graview HQ
 * f-custom-pages-first-visit). Where a pointer rests on a link or one of the
 * bar's places, a finger or the keyboard comes to it, the view its page is
 * drawn by is fetched, as a visit would fetch it, so the page does not stand
 * empty while it comes; and once the page is idle, the code of the first few
 * of the app's places. Its own part, fetched after the first draw.
 *
 * BOUNDED: each view once (what its viewer keeps, once each AHEAD_MS); at
 * most MOST_AHEAD views a page for intent and IDLE_PLACES for idleness; none
 * where the person asked the browser to save data, or is on a 2G connection.
 * Only what this seat may go to: the places it is offered, records and
 * lists of kinds it sees.
 */
export const MOST_AHEAD = 24;
export const IDLE_PLACES = 4;
/** How long a pointer rests on a link before it counts as on its way. */
const REST_MS = 50;

interface Asked {
  readonly context: PageContext<AnySchema>;
  readonly registry: PageRegistry<AnySchema, unknown> | undefined;
  readonly viewerState: ViewerState | undefined;
  readonly kept: KeptDrawings | null;
}

/** The view a path's page is drawn by, as the routed face would draw it for this seat; undefined where it is none of the app's views'. */
export function viewAt({ context, registry }: Pick<Asked, "context" | "registry">, path: string): unknown {
  const { views, store } = context;
  if (!views) return undefined;
  let segments: string[];
  try {
    segments = path.split(/[?#]/)[0]!.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return undefined;
  }
  const many = { cardinality: "many", fidelity: "full" } as const;
  if (registry?.routes().some((route) => route.path === path)) return undefined;
  if (segments.length === 0) return registry?.lookupSurface("home") ? undefined : views.homeView?.();
  if (segments[0] === "places" && segments.length === 2) {
    const place = placesOf(context).find((one) => one.as === segments[1]);
    return place && views.resolve(place.kind, many, place.as)?.view;
  }
  const kind = kindOfSlug(store.schema, segments[0]!);
  if (!kind || store.kindsKeptFrom(context.principal).has(kind)) return undefined;
  if (segments.length === 1) {
    if (registry?.lookup(kind, "list")) return undefined;
    const opens = listOpensAs(context, kind)?.place;
    return opens ? views.resolve(opens.kind, many, opens.as)?.view : listPageViewOf(views, kind)?.view;
  }
  /* A record the seat may see, whose page is the face's own. */
  if (segments.length !== 2 || registry?.lookup(kind, "record") || store.graph.getNode(segments[1]!)?.kind !== kind) return undefined;
  return views.resolve(kind, { cardinality: "one", fidelity: "full" })?.view;
}

/** Whether the person asked for as little as possible to be fetched. */
const saving = (window: Window): boolean => {
  const connection = (window.navigator as Navigator & { connection?: { readonly saveData?: boolean; readonly effectiveType?: string } }).connection;
  return connection?.saveData === true || /2g$/.test(connection?.effectiveType ?? "");
};

/** Hears, on `root`, what a person is on their way to, and fetches it; the answer stops. `base` is the face's, off every link's address. */
export function fetchAhead(root: HTMLElement, base: string, now: () => Asked): () => void {
  const window = root.ownerDocument.defaultView;
  if (!window) return () => undefined;
  const seen = new WeakSet<object>();
  let left = MOST_AHEAD;
  const fetch = (path: string, intent: boolean): boolean => {
    const asked = now();
    const view = viewAt(asked, path);
    const ahead = aheadOf(view);
    if (!ahead || saving(window)) return false;
    const first = !seen.has(view as object);
    if (first && (left -= 1) < 0) return false;
    if (first) seen.add(view as object);
    /* What its viewer keeps is asked with a person on the way, where it is not already on its own way (mine.ts). */
    if (first || intent) ahead({ store: asked.context.store, principal: asked.context.principal ?? { kind: "human" }, viewerState: asked.viewerState, kept: asked.kept, intent });
    return first;
  };
  const pathOf = (event: Event): string | undefined => {
    for (const one of event.composedPath()) {
      const element = one as Element;
      if (element.nodeType !== 1) continue;
      if (element === root) return undefined;
      const place = element.getAttribute("data-place-path");
      if (place) return place;
      if (element.localName !== "a" || !element.hasAttribute("href")) continue;
      const to = new URL((element as HTMLAnchorElement).href, root.ownerDocument.baseURI);
      if (to.origin !== window.location.origin || (base && to.pathname !== base && !to.pathname.startsWith(`${base}/`))) return undefined;
      const path = to.pathname.slice(base.length) || "/";
      /* The built-in page, a list asked for as a list, or one of two places of a name: not what the path alone is drawn by. */
      if (to.searchParams.has("drawn") || to.searchParams.has("of") || (to.search !== "" && path.lastIndexOf("/") === 0)) return undefined;
      return to.pathname === window.location.pathname ? undefined : path;
    }
    return undefined;
  };
  let resting: ReturnType<typeof setTimeout> | undefined;
  let over: string | undefined;
  const heard = (event: Event) => {
    const path = pathOf(event);
    if (event.type !== "pointerover") return void (path && fetch(path, true));
    /* Passing over the bar is on the way to nothing. */
    if (path === over) return;
    over = path;
    clearTimeout(resting);
    if (path) resting = setTimeout(() => fetch(path, true), REST_MS);
  };
  const events = ["pointerover", "pointerdown", "touchstart", "focusin"];
  for (const type of events) root.addEventListener(type, heard, { passive: true });
  /* Idle: the first few places the app offers, one at a time, and nothing of anybody's values. */
  let gone = false;
  const idle = (run: () => void) => (window.requestIdleCallback ? window.requestIdleCallback(run, { timeout: 5_000 }) : window.setTimeout(run, 1_500));
  const paths = now().context.views ? placesOf(now().context).filter((place) => place.hidden !== true).map((place) => `/places/${encodeURIComponent(place.as)}`) : [];
  let fetched = 0;
  const next = () => {
    if (gone) return;
    for (let path = paths.shift(); path !== undefined && fetched < IDLE_PLACES; path = paths.shift()) {
      if (!fetch(path, false)) continue;
      fetched += 1;
      idle(next);
      return;
    }
  };
  idle(next);
  return () => {
    gone = true;
    clearTimeout(resting);
    for (const type of events) root.removeEventListener(type, heard);
  };
}
