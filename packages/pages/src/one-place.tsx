import { OVERVIEW_PATH, LOCAL_LAYERS, type AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { lazyPart, useGraview } from "@graview/react/provider";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useHref, useLocation, useNavigate } from "react-router";
import { recordFacts } from "./facts.js";
import type { PageContext } from "./page-context.js";
import { pluralOf } from "./page-typography.js";
import { kindOfSlug, recordPath, pluralSlug } from "./registry.js";
import { OnePlaceUpContext } from "./one-place-control.js";
import { CITY, PAGE, PANEL, PHONE, type PageWhere } from "./one-place-geometry.js";

/**
 * PAGES AND THE SCENE ARE ONE PLACE (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * The routed page is read over the Scene's own city — the `Scene` of
 * `@graview/react`, mounted underneath in the same provider the pages draw
 * with — and altitude is the Scene's own camera. The page the person is
 * reading is the one element that moves, continuously, every step drawn:
 *
 * - L0, THE PAGE: the routed page, the whole window; the city not seen.
 * - L1, THE PANEL: the same page, its box narrowed to a column beside the
 *   city (a sheet from the foot on a phone), the camera pulled back to its
 *   building, and a Connected list grown into its foot — what the record
 *   is linked to, each row with a line to its building.
 * - L2, STOOD BACK: the same page, standing angled on its building's roof
 *   (flat on a phone), the city around it, the lines from its parts.
 * - THE OVERVIEW: the page shrunk into its building; the whole city.
 *
 * Up and Down move a level; a pinch or ctrl and the wheel scrub the camera,
 * and the page with it, as far as the hand goes, settling to the nearest
 * level when let go. A drag pans the camera. The address is the page's
 * route at every level, so Back and Forward work.
 *
 * The city's part (`one-place-city.tsx`) — the Scene, the camera, the
 * lines — is fetched as the page first draws.
 */
const OnePlaceCity = lazyPart(retryingImport(() => import("./one-place-city.js").then((module) => ({ default: module.OnePlaceCity }))));

const lessMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const windowSize = () => ({ width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight });

/** What the frame asks the camera for, read by the city part each frame. */
export interface Motion {
  /** A level to move to (Up, Down, a press), taken when it is read. */
  level: number | null;
  /** How far a hand on the page has scrubbed the altitude since the last frame. */
  scrub: number;
  /** A scrub under way, until the hand lets go. */
  scrubbing: boolean;
  /** Fingers on the glass: nothing settles while they are. */
  held: boolean;
}

/** What the city part is handed. */
export interface OnePlaceCityProps {
  /** The place the page stands on. */
  readonly where: PageWhere;
  /** The page's own address: the record chosen in the city. */
  readonly page: PageWhere;
  /** The page's own element: the one thing that moves between the levels. */
  readonly sheet: RefObject<HTMLDivElement | null>;
  /** The Connected list's box in the page, grown as the page becomes the panel. */
  readonly connected: RefObject<HTMLDivElement | null>;
  readonly view: { readonly width: number; readonly height: number };
  readonly lessMotion: boolean;
  /** What an address on the page is: a record, a kind's list, or nothing of the city's. */
  readonly resolve: (pathname: string) => PageWhere | null;
  /** That record (or that kind's list), at a level. */
  readonly openRecord: (id: string, level: number) => void;
  readonly openKind: (kind: string, level: number) => void;
  readonly motion: { readonly current: Motion };
  /** Told as the level rested at or headed for, whether the page is out of the window, or whether it is moving, changes. */
  readonly onAltitude: (now: { readonly level: number; readonly away: boolean; readonly moving: boolean }) => void;
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

export function OnePlace<S extends AnySchema>({ context, children }: { readonly context: PageContext<S>; readonly children: ReactNode }) {
  const { views } = useGraview<S>();
  const store = context.store as unknown as PageContext<AnySchema>["store"];
  const schema = store.schema as AnySchema;
  const location = useLocation();
  const navigate = useNavigate();
  const base = useHref("/").replace(/\/$/, "");
  const address = `${location.pathname}${location.search}`;
  const has = useCallback((id: string) => store.graph.getNode(id)?.kind as string | undefined, [store]);
  const placeKinds = useCallback((as: string) => [...new Set(views.places().filter((place) => place.as === as).flatMap((place) => (place.kind ? [place.kind as string] : [])))], [views]);
  const where = useMemo(() => whereOf(schema, has, location.pathname, placeKinds), [schema, has, location.pathname, placeKinds]);
  const [view, setView] = useState(() => (typeof window === "undefined" ? { width: 1280, height: 800 } : windowSize()));
  const motion = useRef<Motion>({ level: where.type === "overview" ? CITY : null, scrub: 0, scrubbing: false, held: false });
  // What the camera says: the level rested at or headed for, and whether the page is out of the window.
  const [now, setNow] = useState<{ level: number; away: boolean; moving: boolean }>({ level: PAGE, away: where.type === "overview", moving: false });
  const sheet = useRef<HTMLDivElement>(null);
  const connected = useRef<HTMLDivElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const kept = useRef<{ readonly scrollY: number; readonly address: string } | null>(null);

  useEffect(() => {
    const resized = () => setView(windowSize());
    window.addEventListener("resize", resized);
    return () => window.removeEventListener("resize", resized);
  }, []);

  /** Out of the window: where the page was scrolled, for the page as it moves and for the way back in. */
  const keep = () => {
    if (!now.away && !kept.current) kept.current = { scrollY: window.scrollY, address };
  };
  const goLevel = useCallback(
    (level: number) => {
      const to = Math.max(PAGE, Math.min(CITY, level));
      if (to > PAGE) keep();
      // Home's overview is at its own address; down from it is home.
      if (to === CITY && where.type === "home") navigate(OVERVIEW_PATH);
      if (to < CITY && where.type === "overview") navigate("/");
      motion.current.level = to;
      // The page leaves the window in this commit, so the first frame of the move draws it where it was.
      if (to > PAGE) setNow((was) => (was.away ? was : { ...was, away: true }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [where.type, navigate, now.away, address],
  );
  const up = useCallback(() => goLevel(now.level + 1), [goLevel, now.level]);
  const down = useCallback(() => goLevel(now.level - 1), [goLevel, now.level]);

  /* Out of the window, the page keeps its own scroll; in again, the window takes it back. */
  useLayoutEffect(() => {
    const plane = sheet.current;
    if (!plane) return;
    if (now.away) {
      if (kept.current) plane.scrollTop = kept.current.address === address ? kept.current.scrollY : 0;
      return;
    }
    const was = kept.current;
    kept.current = null;
    if (was) window.scrollTo({ left: 0, top: was.address === address ? was.scrollY : 0, behavior: "instant" as ScrollBehavior });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.away]);

  /* The overview's own address is the city. */
  useEffect(() => {
    if (where.type === "overview" && now.level !== CITY) {
      motion.current.level = CITY;
      setNow((was) => ({ ...was, away: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [where.type]);

  /** Another place, at a level: its address, and the camera asked to that level there. */
  const openAt = useCallback(
    (path: string, level: number) => {
      if (path === location.pathname) return goLevel(level);
      if (level > PAGE) keep();
      kept.current = level > PAGE ? { scrollY: 0, address: path } : kept.current;
      motion.current.level = level;
      navigate(path);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, goLevel, navigate],
  );
  const openRecord = useCallback(
    (id: string, level: number) => {
      const kind = has(id);
      if (kind) openAt(recordPath(schema, kind, id), level);
    },
    [has, schema, openAt],
  );
  const openKind = useCallback(
    (kind: string, level: number) => {
      // A place that shows this kind is already its page.
      if (where.type === "place" && where.kinds.includes(kind)) return goLevel(level);
      openAt(`/${pluralSlug(schema, kind)}`, level);
    },
    [schema, where, goLevel, openAt],
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
   * A PINCH, OR CTRL AND THE WHEEL, SCRUBS THE ALTITUDE: on the page and on
   * the panel this face moves the camera itself, as far as the hand goes;
   * over the city the Scene's own hand zooms it, and the altitude is read
   * off its zoom. Nothing snaps: let go, it settles to the nearest level.
   * Escape comes down a level; a press on the page standing in the city
   * brings it back to the panel.
   */
  const latest = useRef({ now, down, goLevel });
  latest.current = { now, down, goLevel };
  useEffect(() => {
    const onPage = (target: EventTarget | null) => target instanceof Node && sheet.current?.contains(target) === true;
    const begin = () => {
      if (!latest.current.now.away) {
        keep();
        setNow((was) => (was.away ? was : { ...was, away: true }));
      }
    };
    const wheel = (event: WheelEvent) => {
      // Ctrl and the wheel (a trackpad's pinch) scrub the altitude wherever the pointer is: the one camera, never the Scene's own zoom beside it.
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      begin();
      motion.current.scrub += Math.max(-0.25, Math.min(0.25, event.deltaY * 0.006));
    };
    let pinch: number | null = null;
    const apart = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);
    const touchStart = (event: TouchEvent) => {
      motion.current.held = event.touches.length > 0;
      const mine = !latest.current.now.away || (onPage(event.touches[0]?.target ?? null) && onPage(event.touches[1]?.target ?? null));
      pinch = event.touches.length === 2 && mine ? apart(event.touches) : null;
    };
    const touchMove = (event: TouchEvent) => {
      if (pinch === null || event.touches.length !== 2) return;
      event.preventDefault();
      begin();
      const distance = apart(event.touches);
      // Fingers together is out: the altitude rises as far as they have closed.
      motion.current.scrub += Math.log(pinch / distance) * 1.6;
      pinch = distance;
    };
    const touchEnd = (event: TouchEvent) => {
      motion.current.held = event.touches.length > 0;
      if (event.touches.length < 2) pinch = null;
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || latest.current.now.level === PAGE) return;
      if (document.querySelector("[data-graview-overlay]:not([hidden])")) return;
      event.preventDefault();
      latest.current.down();
    };
    let downAt: { x: number; y: number } | null = null;
    const pointerDown = (event: PointerEvent) => {
      downAt = { x: event.clientX, y: event.clientY };
    };
    const click = (event: MouseEvent) => {
      // The page standing in the city takes no pointer (a drag over it pans the city); a press on it is the panel again.
      if (latest.current.now.level < 2 || latest.current.now.moving || !sheet.current || !downAt) return;
      if (Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 6) return;
      if ((event.target as Element | null)?.closest?.('[data-testid="one-place-ring"], [data-testid="one-place-controls"]')) return;
      const box = sheet.current.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.goLevel(PANEL);
    };
    window.addEventListener("wheel", wheel, { passive: false, capture: true });
    window.addEventListener("touchstart", touchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", touchMove, { passive: false, capture: true });
    window.addEventListener("touchend", touchEnd, { capture: true });
    window.addEventListener("touchcancel", touchEnd, { capture: true });
    window.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("click", click, true);
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel, { capture: true });
      window.removeEventListener("touchstart", touchStart, { capture: true });
      window.removeEventListener("touchmove", touchMove, { capture: true });
      window.removeEventListener("touchend", touchEnd, { capture: true });
      window.removeEventListener("touchcancel", touchEnd, { capture: true });
      window.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAltitude = useCallback((told: { level: number; away: boolean; moving: boolean }) => {
    setNow((was) => (was.level === told.level && was.away === told.away && was.moving === told.moving ? was : told));
  }, []);

  /* Out of the page, the keyboard cannot stay on what no longer takes it: it waits on the way back. */
  useLayoutEffect(() => {
    if (now.level < 2) return;
    if (sheet.current?.contains(document.activeElement) || document.activeElement === document.body) controls.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus({ preventScroll: true });
  }, [now.level]);

  const away = now.away;
  // The page as one element: in the page's own flow while it is read, the window's box and then the panel's once it moves (`one-place-city.tsx` sets its box each frame).
  const sheetStyle: CSSProperties = away
    ? {
        position: "fixed",
        left: 0,
        top: 0,
        width: view.width,
        height: view.height,
        overflowY: "auto",
        overflowX: "hidden",
        zIndex: LOCAL_LAYERS.over,
        background: "var(--graview-ground, Canvas)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.20)",
        outline: "1px solid var(--graview-edge)",
        // Standing in the city it takes no pointer: a drag over it pans the city, a press on it is the panel again.
        pointerEvents: now.level >= 2 && !now.moving ? "none" : "auto",
        willChange: "transform, left, top, width, height",
        // Its own sizes for its words: it is a narrower page as a panel.
        containerType: "inline-size",
      }
    : { display: "contents" };
  const said = saidFor(now.level, where, store);
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
  const subject = where.type === "record" ? where.id : null;
  return (
    <OnePlaceUpContext.Provider value={upValue}>
      <Suspense fallback={null}>
        <OnePlaceCity where={where} page={where} sheet={sheet} connected={connected} view={view} lessMotion={lessMotion()} resolve={resolve} openRecord={openRecord} openKind={openKind} motion={motion} onAltitude={onAltitude} />
      </Suspense>
      <div ref={sheet} data-graview-one-place={now.level} data-graview-standing-on={where.type === "record" ? where.id : where.type === "list" ? `kind:${where.kind}` : where.type} style={sheetStyle}>
        <div {...(now.level >= 2 ? { inert: true } : {})} style={away ? { minHeight: "100%", display: "flex", flexDirection: "column" } : { display: "contents" }}>
          {children}
          {/* What the record is linked to, grown into the page as it becomes the panel: its rows the lines leave from. */}
          {away && subject ? <Connected store={store} id={subject} box={connected} openRecord={openRecord} /> : null}
        </div>
      </div>
      {/* Above the page, Up and Down stand together in a corner the page and the Scene's own controls leave empty. */}
      {now.level > PAGE ? (
        <div
          ref={controls}
          role="group"
          aria-label="Altitude"
          data-testid="one-place-controls"
          data-graview-stop={now.level}
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

/**
 * CONNECTED: what the record is linked to, by relation, at the page's foot —
 * held at the foot of the panel while the page above it scrolls. Grown in as
 * the page becomes the panel (its box's height is set each frame); each row
 * is the record it names, and a line leaves it for that record's building.
 */
function Connected({ store, id, box, openRecord }: { readonly store: PageContext<AnySchema>["store"]; readonly id: string; readonly box: RefObject<HTMLDivElement | null>; readonly openRecord: (id: string, level: number) => void }) {
  const facts = useMemo(() => recordFacts(store, id), [store, id]);
  const groups = facts?.links ?? [];
  const total = groups.reduce((sum, group) => sum + group.targets.length, 0);
  return (
    <div ref={box} data-graview-connected-box="" style={{ position: "sticky", bottom: 0, marginTop: "auto", height: 0, opacity: 0, overflow: "hidden", background: "var(--graview-panel, Canvas)", borderTop: "1px solid var(--graview-edge)", flex: "0 0 auto" }}>
      <section data-graview-connected={total} aria-label="Connected" style={{ padding: "10px 18px 12px", maxHeight: "40vh", overflowY: "auto" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "0.95rem" }}>
          Connected <span style={{ fontWeight: 400, color: "var(--graview-ink-faint)" }}>· {total}</span>
        </h2>
        {total === 0 ? <p style={{ margin: 0, color: "var(--graview-ink-muted)", fontSize: "0.875rem" }}>Nothing yet.</p> : null}
        {groups.map((group) => (
          <div key={`${group.edgeKind}|${group.direction}`} style={{ marginTop: 6 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--graview-ink-muted)" }}>{group.description ?? group.edgeKind}</div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {group.targets.map((target) => (
                <li key={target.id}>
                  <button type="button" data-graview-record={target.id} onClick={() => openRecord(target.id, PANEL)} style={{ display: "block", width: "100%", textAlign: "start", padding: "4px 0", border: "none", background: "none", color: "var(--graview-ink)", font: "inherit", fontSize: "0.9rem", cursor: "pointer" }}>
                    {target.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

/** What Up and Down say at a level: where pressing each goes. Up is null at the top. */
function saidFor(level: number, where: PageWhere, store: PageContext<AnySchema>["store"]): { readonly up: string | null; readonly down: string } {
  const kind = where.type === "record" || where.type === "list" ? where.kind : null;
  const words = ["the page", "the page beside the city", kind ? `the page standing in the ${pluralOf(store, kind).toLowerCase()} district` : "the page standing in the city", "the whole city"];
  return {
    up: level < CITY ? `Up to ${words[level + 1]}` : null,
    down: where.type === "overview" ? "Down to the home page" : `Down to ${words[Math.max(0, level - 1)]}`,
  };
}
