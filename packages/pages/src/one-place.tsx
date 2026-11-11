import { OVERVIEW_PATH, LOCAL_LAYERS, type AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { lazyPart, useGraview } from "@graview/react/provider";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { useHref, useLocation, useNavigate } from "react-router";
import type { PageContext } from "./page-context.js";
import { pluralOf } from "./page-typography.js";
import { kindOfSlug, recordPath, pluralSlug } from "./registry.js";
import { OnePlaceUpContext } from "./one-place-control.js";
import { PHONE, stopsOf, type PageWhere, type Stop } from "./one-place-geometry.js";

/**
 * PAGES AND THE SCENE ARE ONE PLACE (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * The routed page is read over the Scene's own city — the `Scene` of
 * `@graview/react`, mounted underneath in the same provider the pages draw
 * with, laid out by the same `layout` → `placeCity` the Scene face uses —
 * and altitude is the Scene's own camera. Four levels:
 *
 * - L0, THE PAGE: the routed page, the whole window; the city is not drawn.
 * - L1, THE PANEL: the page's place in the Scene's map panel (a record, its
 *   fields and what it is connected to; a kind's district; a place's lens),
 *   the city beside it centered on its building or district, a line from
 *   each connected row to its building. "Open ↗" is the page again.
 * - L2, STOOD BACK: the page standing angled on its building with the city
 *   around it (flat on a phone), the lines from its parts to their buildings.
 * - THE OVERVIEW: the whole city, nothing over it.
 *
 * Up and Down, the wheel and the pinch move between them through the one
 * camera; a drag pans it. Pressing a building or a connected row puts that
 * record in the panel, the camera flying to it; following a link on a page
 * flies there through the city. The address is the page's route at every
 * level, so Back and Forward work.
 *
 * The city's own part (`one-place-city.tsx`) is fetched as the page first
 * draws, so a page reads before any of it arrives.
 */
const OnePlaceCity = lazyPart(retryingImport(() => import("./one-place-city.js").then((module) => ({ default: module.OnePlaceCity }))));

/** How long a move of the camera takes. A person who asked for less motion is cut straight there. */
export const TRAVEL_MS = 560;
const lessMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const windowSize = () => ({ width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight });

/** What the city part is handed: what an address is, and how to go somewhere from the city. */
export interface OnePlaceCityProps {
  /** The place the page stands on: during a link's travel, the page it left. */
  readonly where: PageWhere;
  /** The page's own address: the record chosen in the city. */
  readonly page: PageWhere;
  readonly stop: Stop;
  /** Coming back in: the page travels to fill the window. */
  readonly returning: boolean;
  readonly sheet: { readonly current: HTMLDivElement | null };
  readonly view: { readonly width: number; readonly height: number };
  readonly lessMotion: boolean;
  /** What an address on the page is: a record, a kind's list, or nothing of the city's. */
  readonly resolve: (pathname: string) => PageWhere | null;
  /** That record, at a level: its page, or in the panel. */
  readonly openRecord: (id: string, at: "page" | "panel") => void;
  /** That kind's list, at a level. */
  readonly openKind: (kind: string, at: "page" | "panel") => void;
  /** The person's hand took the camera to another level (a zoom past a stop's range, the panel closed). */
  readonly onStop: (stop: Stop) => void;
  /** The Scene's map panel, as the host handed it (`sceneUnderPages: { panel }`): drawn at the panel level. */
  readonly panel?: ComponentType | undefined;
}

/** What the page's address is in the city. */
function whereOf(schema: AnySchema, has: (id: string) => string | undefined, pathname: string, placeKinds: (as: string) => readonly string[]): PageWhere {
  if (pathname === OVERVIEW_PATH) return { type: "overview" };
  const segments = pathname.split("/").filter(Boolean).map((one) => {
    try {
      return decodeURIComponent(one);
    } catch {
      return one;
    }
  });
  if (segments.length === 0) return { type: "home" };
  if (segments[0] === "places" && segments.length === 2) {
    const kinds = placeKinds(segments[1]!);
    return kinds.length > 0 ? { type: "place", as: segments[1]!, kinds } : { type: "home" };
  }
  const kind = kindOfSlug(schema, segments[0]!);
  if (kind && segments.length === 1) return { type: "list", kind };
  if (kind && segments.length === 2 && has(segments[1]!) === kind) return { type: "record", id: segments[1]!, kind };
  return { type: "home" };
}

const sameWhere = (a: PageWhere, b: PageWhere) => JSON.stringify(a) === JSON.stringify(b);

export function OnePlace<S extends AnySchema>({ context, children }: { readonly context: PageContext<S>; readonly children: ReactNode }) {
  const { views } = useGraview<S>();
  const { store } = context;
  const schema = store.schema as AnySchema;
  const location = useLocation();
  const navigate = useNavigate();
  const base = useHref("/").replace(/\/$/, "");
  const address = `${location.pathname}${location.search}`;
  const has = useCallback((id: string) => store.graph.getNode(id)?.kind as string | undefined, [store]);
  const placeKinds = useCallback((as: string) => [...new Set(views.places().filter((place) => place.as === as).flatMap((place) => (place.kind ? [place.kind as string] : [])))], [views]);
  const where = useMemo(() => whereOf(schema, has, location.pathname, placeKinds), [schema, has, location.pathname, placeKinds]);
  const [view, setView] = useState(() => (typeof window === "undefined" ? { width: 1280, height: 800 } : windowSize()));
  const stops = stopsOf(where, view.width);
  const [stop, setStop] = useState<Stop>(where.type === "overview" ? "city" : "page");
  const [returning, setReturning] = useState(false);
  // During a link's travel: the page it left, which the camera starts over.
  const [from, setFrom] = useState<PageWhere | null>(null);
  const kept = useRef<{ readonly scrollY: number; readonly address: string } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const later = (ms: number, run: () => void) => timers.current.push(window.setTimeout(run, ms));
  const cancelTimers = () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  };
  useEffect(() => cancelTimers, []);

  useEffect(() => {
    const resized = () => setView(windowSize());
    window.addEventListener("resize", resized);
    return () => window.removeEventListener("resize", resized);
  }, []);

  /** Back in: the page travels to fill the window, then is the page again, scrolled where it was. */
  const comeIn = useCallback(() => {
    cancelTimers();
    setFrom(null);
    setStop("page");
    if (lessMotion()) return;
    setReturning(true);
    later(TRAVEL_MS + 40, () => setReturning(false));
  }, []);

  /** Out, to a stop: the scroll and the address kept, for the way back in. */
  const goTo = useCallback(
    (next: Stop) => {
      if (next === "page") return comeIn();
      cancelTimers();
      setReturning(false);
      if (stop === "page") kept.current = { scrollY: window.scrollY, address };
      // Home's overview is at its own address.
      if (next === "city" && where.type === "home") navigate(OVERVIEW_PATH);
      setStop(next);
    },
    [stop, address, where.type, comeIn, navigate],
  );

  const up = useCallback(() => {
    const at = stops.indexOf(stop);
    if (at < 0 || at >= stops.length - 1) return;
    goTo(stops[at + 1]!);
  }, [stops, stop, goTo]);

  const down = useCallback(() => {
    if (where.type === "overview") return navigate("/");
    const at = stops.indexOf(stop);
    if (at <= 0) return;
    goTo(stops[at - 1]!);
  }, [stops, stop, where.type, goTo, navigate]);

  /* IN AGAIN: the scroll where it was, unless the page is another one. */
  useLayoutEffect(() => {
    if (stop !== "page" || returning || from) return;
    const was = kept.current;
    kept.current = null;
    if (!was) return;
    window.scrollTo({ left: 0, top: was.address === address ? was.scrollY : 0, behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, returning, from]);

  /*
   * GOING SOMEWHERE MOVES THE CAMERA. A link followed on a page: the page
   * stands back over where it was, the camera flies to where it goes, and
   * it comes in there. Above the page — a building or a connected row
   * pressed, Back in the browser — the camera flies and the level is kept,
   * or becomes the one asked for. The overview's address is the city.
   */
  const was = useRef<PageWhere>(where);
  const asked = useRef<Stop | null>(null);
  useLayoutEffect(() => {
    const left = was.current;
    was.current = where;
    if (sameWhere(left, where)) return;
    const wanted = asked.current;
    asked.current = null;
    if (where.type === "overview") {
      cancelTimers();
      setFrom(null);
      setStop("city");
      return;
    }
    if (left.type === "overview") {
      cancelTimers();
      if (wanted && wanted !== "page") return setStop(wanted);
      setStop("page");
      if (!lessMotion()) {
        setReturning(true);
        later(TRAVEL_MS + 40, () => setReturning(false));
      }
      return;
    }
    const allowed = stopsOf(where, view.width);
    if (stop === "page" && !returning && wanted !== "panel") {
      if (lessMotion()) return;
      kept.current = { scrollY: 0, address };
      setFrom(left);
      setStop("back");
      later(TRAVEL_MS * 0.5, () => setFrom(null));
      later(TRAVEL_MS * 2.2, () => comeIn());
      return;
    }
    if (wanted === "page") {
      later(lessMotion() ? 0 : TRAVEL_MS + 120, () => comeIn());
      return;
    }
    if (wanted && allowed.includes(wanted)) {
      if (stop === "page") kept.current = { scrollY: window.scrollY, address };
      setStop(wanted);
      return;
    }
    if (!allowed.includes(stop)) setStop(allowed[1] ?? "page");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [where]);

  const openRecord = useCallback(
    (id: string, at: "page" | "panel") => {
      const kind = has(id);
      if (!kind) return;
      const path = recordPath(schema, kind, id);
      if (path === location.pathname) return at === "page" ? comeIn() : goTo("panel");
      asked.current = at;
      navigate(path);
    },
    [has, schema, location.pathname, navigate, comeIn, goTo],
  );
  const openKind = useCallback(
    (kind: string, at: "page" | "panel") => {
      // A place that shows this kind is already its page.
      if (where.type === "place" && where.kinds.includes(kind)) return at === "page" ? comeIn() : goTo("panel");
      const path = `/${pluralSlug(schema, kind)}`;
      if (path === location.pathname) return at === "page" ? comeIn() : goTo("panel");
      asked.current = at;
      navigate(path);
    },
    [schema, location.pathname, navigate, where, comeIn, goTo],
  );
  const onStop = useCallback((next: Stop) => (next === "page" ? comeIn() : goTo(next)), [comeIn, goTo]);

  const resolve = useCallback(
    (pathname: string): PageWhere | null => {
      const path = base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname;
      const found = whereOf(schema, has, path, placeKinds);
      return found.type === "record" || found.type === "list" ? found : null;
    },
    [base, schema, has, placeKinds],
  );

  /*
   * ON THE PAGE, A PINCH OUT (ctrl and the wheel on a trackpad) IS UP: the
   * city is not drawn, so nothing else takes it. Above the page the Scene's
   * own hand has the wheel, the pinch and the drag — the one camera — and a
   * zoom past a stop's range is the next stop (`one-place-city.tsx`).
   * Escape comes down one; a press on the page standing in the city brings
   * it in.
   */
  const latest = useRef({ stop, up, down, comeIn });
  latest.current = { stop, up, down, comeIn };
  useEffect(() => {
    let resting = 0;
    const once = (run: () => void) => {
      const now = Date.now();
      if (now < resting) return;
      resting = now + TRAVEL_MS + 120;
      run();
    };
    const wheel = (event: WheelEvent) => {
      if (latest.current.stop !== "page" || !event.ctrlKey || event.deltaY <= 0) return;
      event.preventDefault();
      once(latest.current.up);
    };
    let pinch: number | null = null;
    const apart = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);
    const touchStart = (event: TouchEvent) => {
      pinch = event.touches.length === 2 && latest.current.stop === "page" ? apart(event.touches) : null;
    };
    const touchMove = (event: TouchEvent) => {
      if (pinch === null || event.touches.length !== 2) return;
      event.preventDefault();
      if (apart(event.touches) / pinch < 0.75) {
        pinch = null;
        once(latest.current.up);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || latest.current.stop === "page") return;
      if (document.querySelector("[data-graview-overlay]:not([hidden])")) return;
      event.preventDefault();
      latest.current.down();
    };
    // The page standing in the city takes no pointer (a drag over it pans the city); a press on it, without a drag, brings it in.
    let downAt: { x: number; y: number } | null = null;
    const pointerDown = (event: PointerEvent) => {
      downAt = { x: event.clientX, y: event.clientY };
    };
    const click = (event: MouseEvent) => {
      if (latest.current.stop !== "back" || !sheet.current || !downAt) return;
      if (Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6) return;
      if ((event.target as Element | null)?.closest?.('[data-testid="one-place-ring"], [data-testid="one-place-controls"]')) return;
      const box = sheet.current.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.comeIn();
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("click", click, true);
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key);
    };
  }, []);

  /* Out of the page, the keyboard cannot stay on it: it waits on the way back up or down. */
  useLayoutEffect(() => {
    if (stop === "page") return;
    if (sheet.current?.contains(document.activeElement) || document.activeElement === document.body) controls.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus({ preventScroll: true });
  }, [stop]);

  const away = stop !== "page" || returning || from !== null;
  const shift = away ? -(kept.current?.scrollY ?? 0) : 0;
  const sheetStyle: CSSProperties = away
    ? {
        position: "fixed",
        left: 0,
        top: 0,
        width: view.width,
        height: view.height,
        overflow: "hidden",
        zIndex: LOCAL_LAYERS.over,
        background: "var(--graview-ground, Canvas)",
        outline: stop === "page" ? "none" : "2px solid var(--graview-edge)",
        borderRadius: stop === "page" ? 0 : 6,
        boxShadow: stop === "page" ? "none" : "0 24px 60px rgba(0,0,0,0.22)",
        // A drag over it pans the city under it; a press on it brings it in (above).
        pointerEvents: "none",
        opacity: stop === "city" || stop === "panel" ? 0 : 1,
        willChange: "transform",
      }
    : { display: "contents" };
  const innerStyle: CSSProperties = away ? { marginTop: shift, minHeight: view.height } : { display: "contents" };

  const said = saidFor(stop, stops, where, store as unknown as PageContext<AnySchema>["store"]);
  const upValue = useMemo(() => ({ up, said: said.up ?? "Up" }), [up, said.up]);
  const phone = view.width <= PHONE;
  const control: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 40,
    padding: "0 14px",
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderStyle: "solid",
    borderColor: "var(--graview-edge)",
    background: "none",
    color: "var(--graview-ink, CanvasText)",
    font: "inherit",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
  };
  return (
    <OnePlaceUpContext.Provider value={upValue}>
      <Suspense fallback={null}>
        <OnePlaceCity where={from ?? where} page={where} stop={stop} returning={returning} sheet={sheet} view={view} lessMotion={lessMotion()} resolve={resolve} openRecord={openRecord} openKind={openKind} onStop={onStop} panel={typeof context.sceneUnderPages === "object" ? context.sceneUnderPages.panel : undefined} />
      </Suspense>
      <div
        ref={sheet}
        data-graview-one-place={stop}
        data-graview-standing-on={where.type === "record" ? where.id : where.type === "list" ? `kind:${where.kind}` : where.type}
        style={sheetStyle}
      >
        <div style={innerStyle} {...(away ? { inert: true } : {})}>
          {children}
        </div>
      </div>
      {/* Above the page, Up and Down stand on the city, in a corner the panel and the Scene's own controls leave empty. */}
      {stop !== "page" ? (
        <div
          ref={controls}
          role="group"
          aria-label="Altitude"
          data-testid="one-place-controls"
          data-graview-stop={stop}
          style={{
            position: "fixed",
            left: phone ? 10 : 20,
            ...(phone ? { top: 10 } : { bottom: 20 }),
            zIndex: LOCAL_LAYERS.over + 2,
            display: "inline-flex",
            borderRadius: 20,
            border: "1px solid var(--graview-edge)",
            background: "var(--graview-panel, Canvas)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
            overflow: "hidden",
          }}
        >
          {said.up ? (
            <button type="button" data-testid="altitude-up" aria-label={said.up} title={said.up} onClick={up} style={control}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />
              </svg>
              Up
            </button>
          ) : null}
          <button type="button" data-testid="altitude-down" aria-label={said.down} title={said.down} onClick={down} style={{ ...control, ...(said.up ? { borderLeftWidth: 1 } : {}) }}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v10M3.5 8.5L8 13l4.5-4.5" />
            </svg>
            Down
          </button>
        </div>
      ) : null}
    </OnePlaceUpContext.Provider>
  );
}

/** What Up and Down say at a stop: where pressing each goes. Up is null at the top. */
function saidFor(stop: Stop, stops: readonly Stop[], where: PageWhere, store: PageContext<AnySchema>["store"]): { readonly up: string | null; readonly down: string } {
  const at = stops.indexOf(stop);
  const next = at >= 0 && at < stops.length - 1 ? stops[at + 1]! : null;
  const before = at > 0 ? stops[at - 1]! : null;
  const kind = where.type === "record" || where.type === "list" ? where.kind : null;
  const words: Record<Stop, string> = {
    page: "the page",
    panel: "the page beside the map",
    back: kind ? `the page standing in the ${pluralOf(store, kind).toLowerCase()} district` : "the page standing in the city",
    city: "the whole city",
  };
  return {
    up: next ? `Up to ${words[next]}` : null,
    down: where.type === "overview" ? "Down to the home page" : before ? `Down to ${words[before]}` : "Down to the page",
  };
}
