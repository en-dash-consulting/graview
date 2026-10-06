import { addressOf, pathWithin, type Place } from "@graview/core";
import { aggregateId, fromUrl, toUrl, withFocus, withOverview } from "@graview/layout/view";
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
 *   <base>#overview=1, <base>#focus=t1         a stop: the scene (the Graview at altitude),
 *                                              its view state in the fragment
 *   <base>                                     the routed face's home — or, on arrival
 *                                              with no entry the router wrote, the host's face
 *
 * The scene always writes a fragment, even an empty `#`, so an address
 * without one past arrival is a page. The face toggle is a step like any
 * other: it pushes the address of the face it goes to, and Back undoes it.
 */

/** The router's own mark on an entry it wrote: `{ idx }` (react-router), kept across a reload. */
const routerWrote = (state: unknown): boolean => typeof state === "object" && state !== null && "idx" in state;

/** The face an address names, or null when it names none: a bare home the router did not write, or outside the base. */
function faceNamed(basePath: string | undefined): EmbedFace | null {
  const path = pathWithin(window.location.pathname, basePath);
  if (path === null) return null;
  if (path !== "/") return "pages";
  if (window.location.href.includes("#")) return fromUrl(window.location.hash).overview ? "graview" : "scene";
  return routerWrote(window.history.state) ? "pages" : null;
}

/**
 * THE FACE AN EMBED OPENS ON (FR-106): under memory routing, the host's
 * (`face`, else the one its `stop` implies); under address routing, the one
 * the address names — a page past the home is the routed face, a fragment
 * at the home is the scene's stop — and the host's when it names none.
 * `mount` asks this itself; a host that renders `<Embed>` passes it as `face`.
 */
export function faceAtAddress(options: Pick<FrameOptions, "routing" | "basePath"> & { readonly face?: EmbedFace; readonly stop?: string }): EmbedFace {
  const asked = options.face ?? (options.stop && fromUrl(options.stop).overview ? "graview" : "scene");
  if (options.routing !== "address" || typeof window === "undefined") return asked;
  return faceNamed(options.basePath) ?? asked;
}

/** The stop the address holds for the scene on arrival, if it holds one. */
export function stopAtAddress(basePath: string | undefined): string | undefined {
  if (typeof window === "undefined") return undefined;
  return pathWithin(window.location.pathname, basePath) === "/" && window.location.href.includes("#") ? window.location.hash || "#" : undefined;
}

/**
 * Keeps the face in step with the address: Back and Forward move between
 * the routed face and the scene, and the face toggle pushes the address of
 * the face it goes to. Inside the provider; the scene's own fragment sync
 * (`UrlSync`) is drawn by the scene face, so it is fetched with the scene.
 */
export function AddressBar({
  basePath,
  shown,
  onFace,
  toggle,
  kinds,
  places,
}: {
  readonly basePath: string | undefined;
  readonly shown: EmbedFace;
  readonly onFace: ((face: EmbedFace) => void) | undefined;
  /** Where the strip's toggle is handed this bar's way of changing face. */
  readonly toggle: MutableRefObject<((face: EmbedFace) => void) | undefined>;
  readonly kinds: readonly string[];
  readonly places: readonly Place[];
}) {
  const { view, go } = useNavigation();
  const latest = useRef({ shown, view, onFace });
  latest.current = { shown, view, onFace };
  // The page the routed face was on when the scene was asked for, to go back to by the toggle.
  const pagesAt = useRef("/");
  const leaving = () => {
    pagesAt.current = `${pathWithin(window.location.pathname, basePath) ?? "/"}${window.location.search}`;
  };

  toggle.current = (next) => {
    const { shown: from, view: here, onFace: tell } = latest.current;
    if (next === "pages" && from !== "pages") {
      window.history.pushState(null, "", addressOf(pagesAt.current, { basePath }));
    } else if (next !== "pages" && from === "pages") {
      leaving();
      // The view the scene will draw, decided here so the fragment pushed is the one it lands on.
      const stop = next === "graview" ? withOverview(here, true) : here.overview ? withFocus(withOverview(here, false), descentTarget(here, kinds)) : here;
      go(stop);
      window.history.pushState(null, "", `${addressOf("/", { basePath })}${toUrl(stop)}`);
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
      const parsed = fromUrl(window.location.hash);
      const name = parsed.within?.["view"];
      const place = name !== undefined && !parsed.focusId ? places.find((candidate) => candidate.as === name) : undefined;
      go(place ? { ...parsed, focusId: aggregateId(place.kind) } : parsed);
      tell?.(named);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [basePath, go, places]);
  return null;
}
