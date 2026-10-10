import { addressOf, OVERVIEW_PATH, pathWithin, type Place } from "@graview/core";
import { aggregateId, EMPTY_VIEW, fromUrl, toUrl, withFocus, withOverview, type ViewState } from "@graview/layout/view";
import { descentTarget } from "@graview/primitives/frame";
import { useNavigation } from "@graview/react/provider";
import { useEffect, useRef, type MutableRefObject } from "react";
import type { EmbedFace, FrameOptions } from "./frame.js";

/*
 * THE ADDRESS BAR, FOR A HOST WHOSE PAGE IS THE APP (FR-106).
 *
 * Under `routing: "address"` the address says which face is drawn and
 * where on it, the way the whole-page Shell spells it:
 *
 *   <base>/places/the-board, <base>/tasks/t1   a page: the routed face, on its router
 *   <base>/places/overview#focus=t1            the overview (FR-132): the scene, its
 *                                              view state in the fragment — at altitude
 *                                              (`#overview=1`), the Graview
 *   <base>#focus=t1                            a stop written before the scene was a
 *                                              place: the scene still, tidied to the
 *                                              overview's address on arrival
 *   <base>                                     the routed face's home — or, on arrival
 *                                              with no entry the router wrote, the home
 *                                              when the app has a home view (FR-136),
 *                                              else the host's face
 *
 * Moving between the overview and a page is a step like any other: the bar
 * pushes the address of the place it goes to, and Back undoes it.
 */

/** The router's own mark on an entry it wrote: `{ idx }` (react-router), kept across a reload. */
const routerWrote = (state: unknown): boolean => typeof state === "object" && state !== null && "idx" in state;

/** The face an address names, or null when it names none: a bare home the router did not write, or outside the base. */
function faceNamed(basePath: string | undefined): EmbedFace | null {
  const path = pathWithin(window.location.pathname, basePath);
  if (path === null) return null;
  if (path === OVERVIEW_PATH) return fromUrl(window.location.hash).overview ? "graview" : "scene";
  if (path !== "/") return "pages";
  if (window.location.href.includes("#")) return fromUrl(window.location.hash).overview ? "graview" : "scene";
  return routerWrote(window.history.state) ? "pages" : null;
}

/**
 * THE FACE AN EMBED OPENS ON (FR-106): under memory routing, the host's
 * (`face`, else the one its `stop` implies); under address routing, the one
 * the address names — the overview's place is the scene (FR-132), any other
 * page the routed face, a fragment at the home the scene's stop — and the
 * host's when it names none.
 * `mount` asks this itself; a host that renders `<Embed>` passes it as `face`.
 */
export function faceAtAddress(options: Pick<FrameOptions, "routing" | "basePath"> & { readonly face?: EmbedFace; readonly stop?: string }): EmbedFace {
  const asked = options.face ?? (options.stop && fromUrl(options.stop).overview ? "graview" : "scene");
  if (options.routing !== "address" || typeof window === "undefined") return asked;
  return faceNamed(options.basePath) ?? asked;
}

/**
 * WHETHER THE ADDRESS IS THE BARE HOME, NAMING NO FACE (FR-136): under
 * address routing, the app's own address on arrival with no fragment and
 * no entry the router wrote. An app with a home view opens on it there,
 * whatever face the host would otherwise draw.
 */
export function atTheBareHome(options: Pick<FrameOptions, "routing" | "basePath">): boolean {
  if (options.routing !== "address" || typeof window === "undefined") return false;
  return pathWithin(window.location.pathname, options.basePath) === "/" && faceNamed(options.basePath) === null;
}

/** The stop the address holds for the scene on arrival, if it holds one: on the overview's address, or the home's. */
export function stopAtAddress(basePath: string | undefined): string | undefined {
  if (typeof window === "undefined") return undefined;
  const path = pathWithin(window.location.pathname, basePath);
  return (path === "/" || path === OVERVIEW_PATH) && window.location.href.includes("#") ? window.location.hash || "#" : undefined;
}

/**
 * Keeps the face in step with the address: Back and Forward move between
 * the routed face and the overview, and the bar pushes the address of the
 * place it goes to. Inside the provider; the scene's own fragment sync
 * (`UrlSync`) is drawn by the scene face, so it is fetched with the scene.
 */
export function AddressBar({
  basePath,
  pagesWere,
  shown,
  onFace,
  toggle,
  kinds,
  places,
  opens,
}: {
  readonly basePath: string | undefined;
  /** The page the routed face had before a new declaration (FR-116), to go back to. */
  readonly pagesWere?: string | undefined;
  readonly shown: EmbedFace;
  readonly onFace: ((face: EmbedFace) => void) | undefined;
  /** Where the app bar is handed this one's way of changing face: to a page's path, or to the overview at a stop. */
  readonly toggle: MutableRefObject<((face: EmbedFace, path?: string, stop?: string) => void) | undefined>;
  readonly kinds: readonly string[];
  readonly places: readonly Place[];
  /** Where the declaration says the app opens (FR-80), for a scene asked for while it holds nothing (FR-157). */
  readonly opens?: ViewState | undefined;
}) {
  const { view, go } = useNavigation();
  const latest = useRef({ shown, view, onFace });
  latest.current = { shown, view, onFace };
  // The page the routed face was on when the overview was asked for, to go back to.
  const pagesAt = useRef(pagesWere ?? "/");
  const leaving = () => {
    pagesAt.current = `${pathWithin(window.location.pathname, basePath) ?? "/"}${window.location.search}`;
  };

  toggle.current = (next, path, asked) => {
    const { shown: from, view: here, onFace: tell } = latest.current;
    if (next === "pages" && from !== "pages") {
      window.history.pushState(null, "", addressOf(path ?? pagesAt.current, { basePath }));
    } else if (next !== "pages" && from === "pages") {
      leaving();
      // The view the scene will draw, decided here so the fragment pushed is the one it lands on.
      const held = asked === undefined ? here : placed(fromUrl(asked), places);
      // Nothing held (FR-157): where the scene opens, and at altitude that is the Graview's face.
      const given = holdsNothing(held) ? whereTheSceneOpens(opens) : held;
      const face = given !== held && given.overview ? "graview" : next;
      const stop = landing(face, given, kinds);
      go(stop);
      window.history.pushState(null, "", `${addressOf(OVERVIEW_PATH, { basePath })}${toUrl(stop)}`);
      tell?.(face);
      return;
    }
    tell?.(next);
  };

  useEffect(() => {
    const onPop = () => {
      if (pathWithin(window.location.pathname, basePath) === null) return;
      // Past arrival, a bare home is the routed face's.
      const named = faceNamed(basePath) ?? "pages";
      const { shown: from, onFace: tell } = latest.current;
      if (named === "pages") {
        if (from !== "pages") tell?.("pages");
        return;
      }
      // Between the scene and the Graview the fragment sync follows by itself; from the pages, the scene comes back where the fragment says.
      if (from !== "pages") return;
      go(placed(fromUrl(window.location.hash), places));
      tell?.(named);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [basePath, go, places]);
  return null;
}

/** A stop that names a place by its name alone (`#view=the-board`) goes to the group it is a picture of. */
export function placed(parsed: ReturnType<typeof fromUrl>, places: readonly Place[]): ReturnType<typeof fromUrl> {
  const name = parsed.within?.["view"];
  const place = name !== undefined && !parsed.focusId ? places.find((candidate) => candidate.as === name) : undefined;
  return place ? { ...parsed, focusId: aggregateId(place.kind) } : parsed;
}

/** Where a face lands on a stop: the Graview at altitude, the scene down from altitude to what the stop was over. */
export function landing(face: EmbedFace, given: ViewState, kinds: readonly string[]): ViewState {
  if (face === "graview") return withOverview(given, true);
  return given.overview ? withFocus(withOverview(given, false), descentTarget(given, kinds)) : given;
}

/**
 * A VIEW THAT HOLDS NOTHING (FR-157): no focus, and not at altitude. The
 * pages leave the scene's view like this when no page named a place in it —
 * an address no route answers ("Nothing lives at this address") — and the
 * switch's Scene drew exactly that: the empty view, the overview off, the
 * control saying Up, over nothing.
 */
export function holdsNothing(view: ViewState): boolean {
  return view.focusId === null && view.overview !== true;
}

/** Where the scene opens: where the declaration says the app opens (FR-80), else at altitude. */
export function whereTheSceneOpens(opens: ViewState | undefined): ViewState {
  return opens ?? { ...EMPTY_VIEW, overview: true };
}
