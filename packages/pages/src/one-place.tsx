import { OVERVIEW_PATH, LOCAL_LAYERS, type AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { lazyPart, useGraview } from "@graview/react/provider";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useHref, useLocation, useNavigate } from "react-router";
import type { PageContext } from "./page-context.js";
import { pluralOf } from "./page-typography.js";
import { kindOfSlug, recordPath, pluralSlug } from "./registry.js";
import { PHONE, stopsOf, type PageWhere, type Stop } from "./one-place-geometry.js";

/**
 * PAGES AND THE SCENE ARE ONE PLACE (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * The routed page is read over the Scene's own city — the `Scene` of
 * `@graview/react`, mounted underneath in the same provider the pages draw
 * with, laid out by the same `layout` → `placeCity` the Scene face uses —
 * and altitude is the camera. One control steps back: the page shrinks onto
 * the place its address is (a record's building, a kind's district, where a
 * place's districts meet, over the whole city for home), then the camera
 * rises to the district and to the city, which is the Scene with nothing
 * over it. Pressing a building flies the camera there and opens its page;
 * following a link on a page flies the camera to the linked record. The
 * address is the page's route throughout, so Back and Forward work.
 *
 * The city's own part — the Scene, the camera, the lines from the page's
 * parts to the buildings they show — is fetched as the page first draws
 * (`one-place-city.tsx`), so a page reads before any of it arrives.
 */
const OnePlaceCity = lazyPart(retryingImport(() => import("./one-place-city.js").then((module) => ({ default: module.OnePlaceCity }))));

/** How long one step of the camera takes. A person who asked for less motion is cut straight there. */
export const TRAVEL_MS = 520;
const lessMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const windowSize = () => ({ width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight });

/** What the city part is handed: what an address is, and how to go somewhere from the city. */
export interface OnePlaceCityProps {
  /** The place the page stands on: during a link's travel, the page it left. */
  readonly where: PageWhere;
  /** The page's own address: the record lit in the city. */
  readonly page: PageWhere;
  readonly stop: Stop;
  /** Coming back in: the page travels to fill the window. */
  readonly returning: boolean;
  readonly sheet: { readonly current: HTMLDivElement | null };
  readonly view: { readonly width: number; readonly height: number };
  readonly lessMotion: boolean;
  /** What an address on the page is: a record, a kind's list, or nothing of the city's. */
  readonly resolve: (pathname: string) => PageWhere | null;
  /** A building pressed, a line's ring, the Scene's own descent: that record's page. */
  readonly openRecord: (id: string) => void;
  /** A district pressed: its kind's list. */
  readonly openKind: (kind: string) => void;
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
    return kinds.length > 0 ? { type: "place", kinds } : { type: "home" };
  }
  const kind = kindOfSlug(schema, segments[0]!);
  if (kind && segments.length === 1) return { type: "list", kind };
  if (kind && segments.length === 2 && has(segments[1]!) === kind) return { type: "record", id: segments[1]!, kind };
  return { type: "home" };
}

const sameWhere = (a: PageWhere, b: PageWhere) => JSON.stringify(a) === JSON.stringify(b);

/** Where the person was when they stepped back: what comes back with them. */
interface Kept {
  readonly scrollY: number;
  readonly address: string;
}

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
  const kept = useRef<Kept | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const control = useRef<HTMLButtonElement>(null);
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
      // Home's city is the overview, at its own address.
      if (next === "city" && where.type === "home") navigate(OVERVIEW_PATH);
      setStop(next);
    },
    [stop, address, where.type, comeIn, navigate],
  );

  const up = useCallback(() => {
    const at = stops.indexOf(stop);
    if (at < 0 || at >= stops.length - 1) {
      // From the whole city the one control comes down to the page again — on the overview's own address, home's.
      if (where.type === "overview") {
        navigate("/");
        return;
      }
      return comeIn();
    }
    goTo(stops[at + 1]!);
  }, [stops, stop, where.type, goTo, comeIn, navigate]);

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
   * steps back over where it was, the camera flies to where it goes, and it
   * comes in there. Stepped back — a building pressed, Back in the browser
   * — the camera flies and the stop is kept. The overview's address is the
   * city.
   */
  const was = useRef<PageWhere>(where);
  const opening = useRef(false);
  useLayoutEffect(() => {
    const left = was.current;
    was.current = where;
    if (sameWhere(left, where)) return;
    if (where.type === "overview") {
      cancelTimers();
      setFrom(null);
      setStop("city");
      return;
    }
    if (left.type === "overview") {
      // Down from the overview: home's page, from above.
      cancelTimers();
      setStop("page");
      if (!lessMotion()) {
        setReturning(true);
        later(TRAVEL_MS + 40, () => setReturning(false));
      }
      return;
    }
    const allowed = stopsOf(where, view.width);
    if (stop === "page" && !returning) {
      if (lessMotion()) return;
      // The page stands back over the place it left, the camera flies to the new one, and the page comes in there.
      kept.current = { scrollY: 0, address };
      setFrom(left);
      setStop(allowed[1] ?? "back");
      later(TRAVEL_MS * 0.6, () => setFrom(null));
      later(TRAVEL_MS * 1.7, () => comeIn());
      return;
    }
    if (!allowed.includes(stop)) setStop(allowed.includes("back") ? "back" : allowed[1] ?? "page");
    if (opening.current) {
      opening.current = false;
      // A building pressed: once the camera is there, the page opens.
      later(lessMotion() ? 0 : TRAVEL_MS + 80, () => comeIn());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [where]);

  const openRecord = useCallback(
    (id: string) => {
      const kind = has(id);
      if (!kind) return;
      const path = recordPath(schema, kind, id);
      if (path === location.pathname) return comeIn();
      opening.current = true;
      navigate(path);
    },
    [has, schema, location.pathname, navigate, comeIn],
  );
  const openKind = useCallback(
    (kind: string) => {
      const path = `/${pluralSlug(schema, kind)}`;
      if (path === location.pathname) return;
      navigate(path);
      if (stop === "city" || stop === "page") setStop("back");
    },
    [schema, location.pathname, navigate, stop],
  );

  const resolve = useCallback(
    (pathname: string): PageWhere | null => {
      const path = base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname;
      const found = whereOf(schema, has, path, placeKinds);
      return found.type === "record" || found.type === "list" ? found : null;
    },
    [base, schema, has, placeKinds],
  );

  /*
   * THE WHEEL AND THE PINCH ARE THE CAMERA TOO. On the page, a pinch out
   * (ctrl+wheel on a trackpad) steps back; stepped back, the wheel goes up
   * and down the stops. At the city the Scene's own hand has them.
   */
  const latest = useRef({ stop, up, down });
  latest.current = { stop, up, down };
  useEffect(() => {
    let resting = 0;
    const once = (run: () => void) => {
      const now = Date.now();
      if (now < resting) return;
      resting = now + TRAVEL_MS + 120;
      run();
    };
    const wheel = (event: WheelEvent) => {
      const { stop: at, up: rise, down: fall } = latest.current;
      if (at === "city") return;
      if (at === "page") {
        if (!event.ctrlKey || event.deltaY <= 0) return;
        event.preventDefault();
        once(rise);
        return;
      }
      event.preventDefault();
      if (Math.abs(event.deltaY) < 4) return;
      once(event.deltaY > 0 ? rise : fall);
    };
    let pinch: number | null = null;
    const apart = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);
    const touchStart = (event: TouchEvent) => {
      pinch = event.touches.length === 2 && latest.current.stop !== "city" ? apart(event.touches) : null;
    };
    const touchMove = (event: TouchEvent) => {
      if (pinch === null || event.touches.length !== 2) return;
      event.preventDefault();
      const ratio = apart(event.touches) / pinch;
      if (ratio < 0.75) {
        pinch = null;
        once(latest.current.up);
      } else if (ratio > 1.35 && latest.current.stop !== "page") {
        pinch = null;
        once(latest.current.down);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || latest.current.stop === "page") return;
      if (document.querySelector("[data-graview-overlay]:not([hidden])")) return;
      event.preventDefault();
      latest.current.down();
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false });
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      document.removeEventListener("keydown", key);
    };
  }, []);

  /* Stepped back, the page cannot hold the keyboard: it waits on the control. */
  useLayoutEffect(() => {
    if (stop === "page") return;
    if (sheet.current?.contains(document.activeElement)) control.current?.focus({ preventScroll: true });
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
        transformOrigin: "50% 100%",
        outline: stop === "page" ? "none" : "2px solid var(--graview-edge)",
        borderRadius: stop === "page" ? 0 : 6,
        boxShadow: stop === "page" ? "none" : "0 24px 60px rgba(0,0,0,0.22)",
        cursor: "zoom-in",
        opacity: stop === "city" ? 0 : 1,
        pointerEvents: stop === "city" ? "none" : "auto",
        willChange: "transform",
      }
    : { display: "contents" };
  const innerStyle: CSSProperties = away ? { marginTop: shift, minHeight: view.height, pointerEvents: "none" } : { display: "contents" };

  const label = labelFor(stop, stops, where, store as unknown as PageContext<AnySchema>["store"]);
  return (
    <>
      <Suspense fallback={null}>
        <OnePlaceCity
          where={from ?? where}
          page={where}
          stop={stop}
          returning={returning}
          sheet={sheet}
          view={view}
          lessMotion={lessMotion()}
          resolve={resolve}
          openRecord={openRecord}
          openKind={openKind}
        />
      </Suspense>
      <div
        ref={sheet}
        data-graview-one-place={stop}
        data-graview-standing-on={where.type === "record" ? where.id : where.type === "list" ? `kind:${where.kind}` : where.type}
        style={sheetStyle}
        {...(stop !== "page" && stop !== "city" ? { onClick: () => comeIn(), title: "Back to the page" } : {})}
      >
        <div style={innerStyle} {...(away ? { inert: true } : {})}>
          {children}
        </div>
      </div>
      <button
        ref={control}
        type="button"
        data-testid="up"
        data-graview-stop={stop}
        aria-label={label.said}
        title={label.said}
        onClick={up}
        style={{
          position: "fixed",
          left: view.width <= PHONE ? 12 : 20,
          bottom: view.width <= PHONE ? 12 : 20,
          zIndex: LOCAL_LAYERS.over + 2,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 40,
          padding: "0 14px",
          borderRadius: 20,
          border: "1px solid var(--graview-edge)",
          background: "var(--graview-panel, Canvas)",
          color: "var(--graview-ink, CanvasText)",
          font: "inherit",
          fontSize: 14,
          fontWeight: 600,
          boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
          cursor: "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {label.down ? <path d="M8 3v10M3.5 8.5L8 13l4.5-4.5" /> : <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" />}
        </svg>
        {label.short}
      </button>
    </>
  );
}

/** What the one control says at a stop: where pressing it goes. */
function labelFor(stop: Stop, stops: readonly Stop[], where: PageWhere, store: PageContext<AnySchema>["store"]): { readonly short: string; readonly said: string; readonly down: boolean } {
  const at = stops.indexOf(stop);
  const next = at >= 0 && at < stops.length - 1 ? stops[at + 1]! : null;
  if (next === null) return { short: "Back to the page", said: where.type === "overview" ? "Down to the home page" : "Down to the page", down: true };
  if (next === "back") return { short: "Up", said: "Up: step back from the page, to where it stands in the city", down: false };
  if (next === "district") {
    const kind = where.type === "record" || where.type === "list" ? where.kind : null;
    return { short: "Up", said: kind ? `Up to the ${pluralOf(store, kind).toLowerCase()} district` : "Up to the district", down: false };
  }
  return { short: "Up", said: "Up to the whole city", down: false };
}
