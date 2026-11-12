import { OVERVIEW_PATH, ONE_FACE_LAYERS, hueFor, labelOf, type AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { barPlaces, HOME_KEY, PastBar } from "@graview/primitives/pages";
import { lazyPart, useGraview, usePlayback } from "@graview/react/provider";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { useHref, useLocation, useNavigate } from "react-router";
import { recordFacts } from "./facts.js";
import { useStoreTick, type PageContext } from "./page-context.js";
import { pluralOf } from "./page-typography.js";
import { kindOfSlug, recordPath, pluralSlug } from "./registry.js";
import { OneFaceContext, type OneFace } from "./one-place-control.js";
import { boardCut, CITY, LEVEL_NAMES, nearestThatWay, PAGE, PANEL, panelBox, panelRange, PHONE, type Box, type PageWhere, type View } from "./one-place-geometry.js";

/**
 * PAGES AND THE SCENE ARE ONE PLACE (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * The routed page is read over the Scene's own city — the `Scene` of
 * `@graview/react`, mounted underneath in the same provider the pages draw
 * with — and altitude is the Scene's own camera. There is one face: no
 * switch between a scene and the pages, and no record "drive-in" of the
 * Scene's own. The page the person is reading is the one element that
 * moves, continuously, every step drawn:
 *
 * - L0, THE PAGE: the routed page, the whole window; the city not seen.
 * - L1, BESIDE THE CITY: the same page, its box narrowed to a column beside
 *   the city (a sheet from the foot on a phone), the camera pulled back to
 *   its place, and a Connected list grown into its foot — what the record
 *   is linked to, each row with a line to its building.
 * - L2, THE CITY: every page and view of the app a board standing on its
 *   place — the home, each kind's list, each lens — and this page among
 *   them, shrunk into its own board. Choosing a board (a press, Enter, or
 *   the button that comes down) comes down to that page beside the city.
 *
 * One button at the window's bottom left rises and comes down a level and
 * says which level this is; Alt and the arrows, and Escape for down, do the
 * same from the keyboard; a pinch or ctrl and the wheel scrub the camera,
 * and the page with it, as far as the hand goes, settling to the nearest
 * level when let go. A drag pans the camera. The address is the page's
 * route at every level, so Back and Forward work.
 *
 * The city's part (`one-place-city.tsx`) — the Scene, the camera, the
 * lines, the boards' places — is fetched as the page first draws.
 */
const OnePlaceCity = lazyPart(retryingImport(() => import("./one-place-city.js").then((module) => ({ default: module.OnePlaceCity }))));

const lessMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const windowSize = () => ({ width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight });

/** What the frame asks the camera for, read by the city part each frame. */
export interface Motion {
  /** A level to move to (the button, a key, a press), taken when it is read. */
  level: number | null;
  /** How far a hand on the page has scrubbed the altitude since the last frame. */
  scrub: number;
  /** A scrub under way, until the hand lets go. */
  scrubbing: boolean;
  /** Fingers on the glass: nothing settles while they are. */
  held: boolean;
  /** The panel's edge being dragged: the camera follows it, and is written into the view when let go. */
  resizing: boolean;
}

/** One of the app's pages and views, as it stands in the city: a board. */
export interface Board {
  readonly key: string;
  readonly label: string;
  /** Its path on this face. */
  readonly path: string;
  /** What it is, said over its title: the home, a list, a view, a record. */
  /** What it is, said to a screen reader: the home, a list, a view, a record's page. */
  readonly eyebrow: string;
  /** What it shows, live: the first few of its records' names, drawn on its sign. */
  readonly lines: readonly string[];
  readonly kind?: string | undefined;
  readonly where: PageWhere;
}

/** What the city part is handed. */
export interface OnePlaceCityProps {
  /** The place the page stands on. */
  readonly where: PageWhere;
  /** Whether the page has left the window (or is asked to): the Scene is drawn, and its view is the overview, only then. */
  readonly out: boolean;
  /** The page's own element: the one thing that moves between the levels. */
  readonly sheet: RefObject<HTMLDivElement | null>;
  /** The Connected list's box in the page, grown as the page becomes the panel. */
  readonly connected: RefObject<HTMLDivElement | null>;
  /** The boards, and which is this page's. */
  readonly boards: readonly Board[];
  readonly current: string;
  /** Each board's button, by key, and the layer that holds them. */
  readonly boardEls: RefObject<Map<string, HTMLButtonElement>>;
  readonly boardLayer: RefObject<HTMLDivElement | null>;
  /** The button that moves a level: a phone's rides above the sheet. */
  readonly fab: RefObject<HTMLDivElement | null>;
  readonly view: { readonly width: number; readonly height: number; readonly top: number; readonly panel?: number };
  readonly lessMotion: boolean;
  /** What an address on the page is: a record, a kind's list, or nothing of the city's. */
  readonly resolve: (pathname: string) => PageWhere | null;
  /** That record (or that kind's list), at a level. */
  readonly openRecord: (id: string, level: number) => void;
  readonly openKind: (kind: string, level: number) => void;
  /** A press on bare ground: at the city, no view chosen. */
  readonly onGround: () => void;
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

/** The first few names a view of these kinds lists, for its sign. */
function firstOf(store: PageContext<AnySchema>["store"], kinds: readonly string[]): readonly string[] {
  const names: string[] = [];
  for (const kind of kinds) {
    for (const node of store.graph.nodesOfKind(kind as never)) {
      if (names.length >= 3) return names;
      names.push(labelOf(store.schema.tryDefinition(kind), node as never));
    }
  }
  return names;
}

/** Which board a place is. */
const boardKeyOf = (where: PageWhere, boards: readonly Board[]): string => {
  if (where.type === "record") return `record:${where.id}`;
  const found = boards.find((board) =>
    where.type === "home" || where.type === "overview"
      ? board.where.type === "home"
      : where.type === "list"
        ? board.where.type === "list" && board.where.kind === where.kind
        : board.where.type === "place" && board.where.as === where.as,
  );
  return found?.key ?? HOME_KEY;
};

/** Typing somewhere: the keys are the field's, not the altitude's. */
const typingIn = (target: EventTarget | null): boolean => target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);

export function OnePlace<S extends AnySchema>({ context, children }: { readonly context: PageContext<S>; readonly children: ReactNode }) {
  const { views } = useGraview<S>();
  const store = context.store as unknown as PageContext<AnySchema>["store"];
  const schema = store.schema as AnySchema;
  // The views' signs say what their records are now: drawn again as the store changes.
  const tick = useStoreTick(store);
  const location = useLocation();
  const navigate = useNavigate();
  const base = useHref("/").replace(/\/$/, "");
  const address = `${location.pathname}${location.search}`;
  const has = useCallback((id: string) => store.graph.getNode(id)?.kind as string | undefined, [store]);
  const placeKinds = useCallback((as: string) => [...new Set(views.places().filter((place) => place.as === as).flatMap((place) => (place.kind ? [place.kind as string] : [])))], [views]);
  const where = useMemo(() => whereOf(schema, has, location.pathname, placeKinds), [schema, has, location.pathname, placeKinds]);
  const [size, setView] = useState(() => (typeof window === "undefined" ? { width: 1280, height: 800 } : windowSize()));
  /* The app's bar, fixed at the window's top at every level: its slot, and how tall it stands. */
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  useEffect(() => {
    if (!bar || typeof ResizeObserver === "undefined") return;
    const measure = () => setBarHeight(Math.ceil(bar.getBoundingClientRect().height));
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(bar);
    return () => watch.disconnect();
  }, [bar]);
  /*
   * THE PANEL AS THE PERSON SIZED IT: dragged by its inner edge, or stepped
   * by the arrow keys there — a desk's panel's width, a phone's sheet's
   * height (the share of the window above it). Kept in this browser, for
   * the moves between levels to start and end from.
   */
  const phoneNow = size.width <= PHONE;
  const panelKey = `graview.one-face.panel.${phoneNow ? "phone" : "desk"}`;
  const [panelSize, setPanelSize] = useState<number | undefined>(() => {
    try {
      const kept = typeof window === "undefined" ? null : window.localStorage.getItem(`graview.one-face.panel.${windowSize().width <= PHONE ? "phone" : "desk"}`);
      return kept === null ? undefined : Number(kept) || undefined;
    } catch {
      return undefined;
    }
  });
  // Across the phone's width the size is the other device's: read again for it.
  useEffect(() => {
    try {
      const kept = window.localStorage.getItem(panelKey);
      setPanelSize(kept === null ? undefined : Number(kept) || undefined);
    } catch {
      setPanelSize(undefined);
    }
  }, [panelKey]);
  /** The size, now; kept in this browser once the hand lets go (`keepPanel`), not on every move. */
  const sizePanel = useCallback((to: number | undefined) => setPanelSize(to), []);
  const panelHeld = useRef(panelSize);
  panelHeld.current = panelSize;
  const keepPanel = useCallback(() => {
    try {
      const to = panelHeld.current;
      if (to === undefined) window.localStorage.removeItem(panelKey);
      else window.localStorage.setItem(panelKey, String(Math.round(to * 1000) / 1000));
    } catch {
      // A browser that keeps nothing keeps the size for this visit.
    }
  }, [panelKey]);
  const view = useMemo(() => ({ ...size, top: barHeight, ...(panelSize !== undefined ? { panel: panelSize } : {}) }), [size, barHeight, panelSize]);
  const motion = useRef<Motion>({ level: where.type === "overview" ? CITY : null, scrub: 0, scrubbing: false, held: false, resizing: false });
  // What the camera says: the level rested at or headed for, and whether the page is out of the window.
  const [now, setNow] = useState<{ level: number; away: boolean; moving: boolean }>({ level: PAGE, away: where.type === "overview", moving: false });
  const sheet = useRef<HTMLDivElement>(null);
  const connected = useRef<HTMLDivElement>(null);
  const fab = useRef<HTMLDivElement>(null);
  const boardLayer = useRef<HTMLDivElement>(null);
  const boardEls = useRef(new Map<string, HTMLButtonElement>());
  /** The board last given the keyboard at the city: the button that comes down goes into it. */
  const chosen = useRef<string | null>(null);
  /** Put down at the city by a press on the ground or Escape: the keyboard is not put back on a view until a level is moved. */
  const deselected = useRef(false);
  const kept = useRef<{ readonly scrollY: number; readonly address: string } | null>(null);

  useEffect(() => {
    const resized = () => setView(windowSize());
    window.addEventListener("resize", resized);
    return () => window.removeEventListener("resize", resized);
  }, []);

  /*
   * THE BOARDS: every page and view the app offers — its home, each kind's
   * list, each lens, as the bar's places list them, lists and lenses alike
   * — and, on a record's page, that record's own.
   */
  const boards = useMemo<readonly Board[]>(() => {
    const places = barPlaces({ store: store as never, principal: context.principal, views: context.views }).filter((place) => !place.hidden);
    const out: Board[] = places.map((place) => ({
      key: place.key,
      label: place.label,
      path: place.path,
      eyebrow: place.group === "home" ? "home" : place.group === "lists" ? "list" : "view",
      lines: firstOf(store, place.kind ? [place.kind] : (store.schema.kinds as readonly string[]).slice(0, 1)),
      kind: place.kind,
      where: whereOf(schema, has, place.path.split("?")[0]!, placeKinds),
    }));
    if (where.type === "record") {
      const node = store.graph.getNode(where.id);
      out.push({ key: `record:${where.id}`, label: node ? labelOf(store.schema.tryDefinition(node.kind as string), node as never) : where.id, path: recordPath(schema, where.kind, where.id), eyebrow: "page", lines: [], kind: where.kind, where });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, context.principal, context.views, schema, has, placeKinds, where, tick]);
  const current = boardKeyOf(where, boards);
  /* While the history is played, a view that comes into being rises out of the city, and one that goes sinks back into it. */
  const rising = Boolean(usePlayback()?.open) && !lessMotion();
  const leaving = useLeavingBoards(boards, rising);
  const standing = useMemo(() => (leaving.length > 0 ? [...boards, ...leaving] : boards), [boards, leaving]);

  /** Out of the window: where the page was scrolled, for the page as it moves and for the way back in. */
  const keep = () => {
    if (!now.away && !kept.current) kept.current = { scrollY: window.scrollY, address };
  };
  const goLevel = useCallback(
    (level: number) => {
      const to = Math.max(PAGE, Math.min(CITY, level));
      if (to > PAGE) keep();
      motion.current.level = to;
      // The page leaves the window in this commit, so the first frame of the move draws it where it was.
      if (to > PAGE) setNow((was) => (was.away ? was : { ...was, away: true }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now.away, address],
  );

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

  /* The overview's own address is the city, standing over the home: the address the home's. */
  useEffect(() => {
    if (where.type !== "overview") return;
    motion.current.level = CITY;
    setNow((was) => ({ ...was, away: true }));
    navigate(`/${location.search}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [where.type]);

  /** Another place, at a level: its address, and the camera asked to that level there. */
  const openAt = useCallback(
    (path: string, level: number) => {
      if (path.split("?")[0] === location.pathname) return goLevel(level);
      if (level > PAGE) keep();
      kept.current = level > PAGE ? { scrollY: 0, address: path } : null;
      motion.current.level = level;
      if (level > PAGE) setNow((was) => (was.away ? was : { ...was, away: true }));
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

  /** Into a board, beside the city: this page's own, or another's. */
  const intoBoard = useCallback(
    (key: string) => {
      const board = boards.find((one) => one.key === key);
      if (!board || key === current) return goLevel(PANEL);
      openAt(board.path, PANEL);
    },
    [boards, current, goLevel, openAt],
  );
  /** To a level from here: from the city down, into the board the keyboard chose, if it chose another. */
  const goTo = useCallback(
    (level: number) => {
      const to = Math.max(PAGE, Math.min(CITY, level));
      if (now.level === CITY && to < CITY && chosen.current && chosen.current !== current) {
        const board = boards.find((one) => one.key === chosen.current);
        if (board) return openAt(board.path, to);
      }
      goLevel(to);
    },
    [now.level, current, boards, goLevel, openAt],
  );
  const rise = useCallback(() => goTo(now.level + 1), [goTo, now.level]);
  const descend = useCallback(() => goTo(now.level - 1), [goTo, now.level]);

  /*
   * A PINCH, OR CTRL AND THE WHEEL, SCRUBS THE ALTITUDE: on the page and on
   * the panel this face moves the camera itself, as far as the hand goes;
   * over the city the Scene's own hand zooms it, and the altitude is read
   * off its zoom. Nothing snaps: let go, it settles to the nearest level.
   * Alt and the up arrow rise a level, Alt and the down arrow (or Escape)
   * come down one — never while the keys are writing in a field.
   */
  /**
   * NO VIEW CHOSEN: the keyboard off every view, onto the views' own group,
   * and the city as it is. A press on bare ground at the city does it, and
   * Escape there.
   */
  const deselect = useCallback(() => {
    chosen.current = null;
    deselected.current = true;
    boardLayer.current?.focus({ preventScroll: true });
  }, []);
  const onGround = useCallback(() => {
    if (latest.current.now.level === CITY && !latest.current.now.moving) latest.current.deselect();
  }, []);
  const latest = useRef({ now, rise, descend, deselect, keep });
  latest.current = { now, rise, descend, deselect, keep };
  useEffect(() => {
    const onPage = (target: EventTarget | null) => target instanceof Node && sheet.current?.contains(target) === true;
    const begin = () => {
      if (!latest.current.now.away) {
        latest.current.keep();
        setNow((was) => (was.away ? was : { ...was, away: true }));
      }
    };
    const wheel = (event: WheelEvent) => {
      // Ctrl and the wheel (a trackpad's pinch) scrub the altitude wherever the pointer is: the one camera, never the Scene's own zoom beside it.
      if (!event.ctrlKey) return;
      // At the city the camera is free: the Scene's own hand zooms it, toward what is under the pointer, and nothing goes down a level.
      if (latest.current.now.level === CITY && !latest.current.now.moving) return;
      event.preventDefault();
      event.stopPropagation();
      begin();
      motion.current.scrub += Math.max(-0.25, Math.min(0.25, event.deltaY * 0.006));
    };
    let pinch: number | null = null;
    const apart = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);
    const touchStart = (event: TouchEvent) => {
      motion.current.held = event.touches.length > 0;
      /*
       * A PINCH IS THE BROWSER'S OWN ON THE PAGE: there it zooms the page's
       * words for whoever needs them larger, and a level is moved by the
       * control, Alt and the arrows, or ctrl and the wheel. Beside the city
       * a pinch on the page scrubs the altitude; over the city, and at the
       * City, the Scene's own hand zooms the camera.
       */
      const nearby = latest.current.now.level === PANEL && latest.current.now.away && !latest.current.now.moving;
      const mine = nearby && onPage(event.touches[0]?.target ?? null) && onPage(event.touches[1]?.target ?? null);
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
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || typingIn(event.target)) return;
      if (document.querySelector("[data-graview-overlay]:not([hidden])")) return;
      const level = latest.current.now.level;
      const up = event.altKey && event.key === "ArrowUp";
      // Escape at the city puts down the view the keyboard chose, and stays at the city; below it, it comes down a level.
      if (!event.altKey && event.key === "Escape" && level === CITY) {
        if (boardLayer.current?.contains(document.activeElement)) {
          event.preventDefault();
          latest.current.deselect();
        }
        return;
      }
      const down = (event.altKey && event.key === "ArrowDown") || (!event.altKey && event.key === "Escape");
      if (up && level < CITY) {
        event.preventDefault();
        latest.current.rise();
      } else if (down && level > PAGE) {
        event.preventDefault();
        latest.current.descend();
      }
    };
    window.addEventListener("wheel", wheel, { passive: false, capture: true });
    window.addEventListener("touchstart", touchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", touchMove, { passive: false, capture: true });
    window.addEventListener("touchend", touchEnd, { capture: true });
    window.addEventListener("touchcancel", touchEnd, { capture: true });
    document.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel, { capture: true });
      window.removeEventListener("touchstart", touchStart, { capture: true });
      window.removeEventListener("touchmove", touchMove, { capture: true });
      window.removeEventListener("touchend", touchEnd, { capture: true });
      window.removeEventListener("touchcancel", touchEnd, { capture: true });
      document.removeEventListener("keydown", key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAltitude = useCallback((told: { level: number; away: boolean; moving: boolean }) => {
    setNow((was) => (was.level === told.level && was.away === told.away && was.moving === told.moving ? was : told));
  }, []);

  /*
   * WHERE THE KEYBOARD WAITS. At the city the page takes none: it waits on
   * this page's own board, laid over it, unless it is already on a board or
   * the button. Headed back down, a keyboard left on a board (going out of
   * reach) goes to the page's title.
   */
  useLayoutEffect(() => {
    const active = document.activeElement;
    const onBoards = boardLayer.current?.contains(active) === true;
    if (now.level === CITY) {
      if (now.moving || onBoards || fab.current?.contains(active) || deselected.current || bar?.contains(active)) return;
      boardEls.current.get(current)?.focus({ preventScroll: true });
      return;
    }
    chosen.current = null;
    deselected.current = false;
    if (!onBoards && active !== document.body) return;
    const title = sheet.current?.querySelector<HTMLElement>("main h1, h1:not([data-graview-app-bar] h1)");
    if (title) {
      if (!title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
      title.focus({ preventScroll: true });
    } else fab.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.level, now.moving, current, bar]);

  const face = useMemo<OneFace>(() => ({ level: now.level, goLevel, openRecord, openPath: openAt, bar }), [now.level, goLevel, openRecord, openAt, bar]);

  const away = now.away;
  // The page as one element: in the page's own flow while it is read, the window's box and then the panel's once it moves (`one-place-city.tsx` sets its box each frame).
  const sheetStyle: CSSProperties = away
    ? {
        position: "fixed",
        left: 0,
        top: view.top,
        width: view.width,
        height: view.height - view.top,
        overflowY: "auto",
        overflowX: "hidden",
        zIndex: ONE_FACE_LAYERS.page,
        background: "var(--graview-ground, Canvas)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.20)",
        outline: "1px solid var(--graview-edge)",
        // At the city it takes no pointer: its board, laid over it, does.
        pointerEvents: now.level >= CITY || now.moving ? "none" : "auto",
        willChange: "transform, left, top, width, height",
        // Its own sizes for its words: it is a narrower page as a panel.
        containerType: "inline-size",
        // Out of the window's flow the page is under the bar already: the room it kept for it is none.
        ["--graview-one-face-bar" as string]: "0px",
      }
    : { display: "contents", ["--graview-one-face-bar" as string]: `${barHeight}px` };
  const subject = where.type === "record" ? where.id : null;
  const panel = panelBox(view);

  /* The arrow keys among the boards: the nearest that way. */
  const boardKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const ways: Record<string, "left" | "right" | "up" | "down"> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    const way = ways[event.key];
    if (!way || event.altKey || event.metaKey || event.ctrlKey) return;
    const at = (event.target as Element).closest<HTMLButtonElement>("[data-graview-board]");
    if (!at) return;
    const boxOf = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    };
    const others = [...boardEls.current.entries()].filter(([, el]) => el !== at && Number(el.style.opacity || 0) > 0.5 && el.getBoundingClientRect().width > 0).map(([key, el]) => ({ key, box: boxOf(el) }));
    const next = nearestThatWay(boxOf(at), others, way);
    event.preventDefault();
    if (next) boardEls.current.get(next)?.focus({ preventScroll: true });
  };

  return (
    <OneFaceContext.Provider value={face}>
      <Suspense fallback={null}>
        <OnePlaceCity where={where} out={now.away} sheet={sheet} connected={connected} boards={standing} current={current} boardEls={boardEls} boardLayer={boardLayer} fab={fab} view={view} lessMotion={lessMotion()} resolve={resolve} openRecord={openRecord} openKind={openKind} onGround={onGround} motion={motion} onAltitude={onAltitude} />
      </Suspense>
      <div ref={sheet} data-graview-one-place={now.level} data-graview-standing-on={where.type === "record" ? where.id : where.type === "list" ? `kind:${where.kind}` : where.type} style={sheetStyle}>
        <div {...(now.level >= CITY ? { inert: true } : {})} style={away ? { minHeight: "100%", display: "flex", flexDirection: "column" } : { display: "contents" }}>
          {children}
          {/* What the record is linked to, grown into the page as it becomes the panel: its rows the lines leave from. */}
          {away && subject ? <Connected store={store} id={subject} box={connected} openRecord={openRecord} /> : null}
          {/* Room at the page's foot for the button that moves a level, so it never sits over the last of the page. */}
          {away ? null : <div aria-hidden="true" data-graview-altitude-room="" style={{ height: "calc(var(--graview-altitude-room, 100px) + 28px)" }} />}
        </div>
      </div>
      {/*
        * THE BOARDS: every page and view of the app, standing on its place
        * at the city. Placed each frame by the city part; this page's own
        * is laid over the page as it stands there, clear, so the keyboard
        * and a press reach it.
        */}
      <div ref={boardLayer} role="group" aria-label="The app's views" data-testid="one-place-boards" tabIndex={-1} onKeyDown={boardKeys} hidden={now.level < PANEL && !now.moving} style={{ position: "fixed", left: 0, top: 0, width: 0, height: 0, zIndex: ONE_FACE_LAYERS.marks }}>
        {standing.map((board) => (
          <button
            key={board.key}
            ref={(el) => {
              if (el) boardEls.current.set(board.key, el);
              else boardEls.current.delete(board.key);
            }}
            type="button"
            data-graview-board={board.key}
            {...(rising ? { "data-graview-rising": "" } : {})}
            {...(leaving.includes(board) ? { "data-graview-leaving": "", tabIndex: -1, "aria-hidden": true } : {})}
            data-graview-board-path={board.path}
            {...(board.key === current ? { "aria-current": "page" as const } : {})}
            aria-label={`${board.label}, ${board.eyebrow}${board.key === current ? ", the one you were on" : ""}`}
            title={board.label}
            onClick={() => intoBoard(board.key)}
            onFocus={() => {
              chosen.current = board.key;
            }}
            className="graview-one-place-board"
            style={{ position: "fixed", left: 0, top: 0, width: 0, height: 0, padding: 0, margin: 0, border: "none", background: "none", cursor: "pointer", overflow: "visible", display: "block", opacity: 0, color: "inherit", font: "inherit", textAlign: "start" }}
          >
            {board.key === current ? null : <BoardFace board={board} width={panel.width} height={boardCut(panel)} />}
          </button>
        ))}
      </div>
      {/* THE APP'S BAR, fixed at the window's top over the page and the city alike: the shell draws it here (`page-shell.tsx`). */}
      <div ref={setBar} data-testid="one-place-bar" style={{ position: "fixed", left: 0, right: 0, top: 0, zIndex: ONE_FACE_LAYERS.bar, background: "var(--graview-ground, Canvas)" }} />
      {now.level === PANEL && !now.moving ? <PanelEdge view={view} size={sizePanel} keep={keepPanel} motion={motion} /> : null}
      <Altitude box={fab} level={now.level} moving={now.moving} goTo={goTo} where={where} chosen={chosen} boards={boards} current={current} store={store} />
      <style>{ONE_PLACE_CSS}</style>
    </OneFaceContext.Provider>
  );
}

/**
 * A BOARD'S FACE: the top of its page as the page draws it — what it is,
 * its title — at the page's own size, scaled by the city part
 * with the camera, so a board and the page that becomes one read alike.
 */
function BoardFace({ board, width, height }: { readonly board: Board; readonly width: number; readonly height: number }) {
  const hue = board.kind ? `hsl(${Math.round(hueFor(board.kind))} 55% 52%)` : "var(--graview-accent)";
  return (
    <div data-graview-board-face="" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width, height, transformOrigin: "0 0", background: "var(--graview-ground, Canvas)", border: "3px solid var(--graview-edge)", borderTop: `10px solid ${hue}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 18px 40px rgba(0,0,0,0.28)", pointerEvents: "none" }}>
      <div style={{ padding: "26px 34px 0" }}>
        <div style={{ fontSize: "4rem", lineHeight: 1.08, fontWeight: 650, color: "var(--graview-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{board.label}</div>
        {/* What it shows, live: the first of its records, as a page would list them. */}
        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {board.lines.map((line, index) => (
            <div key={index} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", borderRadius: 12, border: "2px solid var(--graview-edge)", fontSize: "2.125rem", color: "var(--graview-ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ flex: "0 0 auto", width: 18, height: 18, borderRadius: 9, border: `3px solid ${hue}` }} />
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** How long a board takes to rise out of the city or sink into it, as a building does while the history plays. */
const RISE_MS = 420;

/**
 * The views going while the history is played: kept as they were for as
 * long as they take to sink, unless they come back first. Worked out as
 * the list changes, in the render that changes it (state set from the
 * last render's list, as React has it), so a view going keeps its element.
 */
function useLeavingBoards(boards: readonly Board[], rising: boolean): readonly Board[] {
  const key = boards.map((board) => board.key).join("\n");
  const [seen, setSeen] = useState({ key, boards });
  const [gone, setGone] = useState<ReadonlyMap<string, { readonly board: Board; readonly until: number }>>(new Map());
  if (seen.key !== key) {
    setSeen({ key, boards });
    const here = new Set(boards.map((board) => board.key));
    const next = new Map([...gone].filter(([one]) => !here.has(one)));
    if (rising) for (const board of seen.boards) if (!here.has(board.key) && board.where.type !== "record" && !next.has(board.key)) next.set(board.key, { board, until: performance.now() + RISE_MS });
    setGone(next);
  }
  useEffect(() => {
    if (!rising && gone.size > 0) return setGone(new Map());
    if (gone.size === 0) return;
    const next = Math.min(...[...gone.values()].map((one) => one.until));
    const timer = window.setTimeout(() => setGone((was) => new Map([...was].filter(([, one]) => one.until > performance.now() + 4))), Math.max(0, next - performance.now()) + 8);
    return () => window.clearTimeout(timer);
  }, [gone, rising]);
  return useMemo(() => [...gone.values()].map((one) => one.board), [gone]);
}

const ONE_PLACE_CSS = `
.graview-one-place-edge::after { content: ""; position: absolute; border-radius: 3px; background: color-mix(in srgb, var(--graview-ink) 28%, transparent); transition: background 120ms; }
.graview-one-place-edge[aria-orientation="vertical"]::after { left: 5px; top: 50%; width: 4px; height: 44px; margin-top: -22px; }
.graview-one-place-edge[aria-orientation="horizontal"]::after { top: 11px; left: 50%; height: 5px; width: 40px; margin-left: -20px; }
.graview-one-place-edge:hover::after, .graview-one-place-edge:focus-visible::after { background: var(--graview-accent); }
.graview-one-place-edge:focus-visible { outline: none; }
.graview-one-place-board::after { content: ""; position: absolute; left: 50%; top: 100%; width: 2px; height: var(--graview-sign-post, 10px); margin-left: -1px; background: color-mix(in srgb, var(--graview-ink) 35%, transparent); }
.graview-one-place-board::before { content: ""; position: absolute; left: 50%; top: calc(100% + var(--graview-sign-post, 10px)); width: 18px; height: 6px; margin: -3px 0 0 -9px; border-radius: 50%; background: rgba(0,0,0,0.28); }
.graview-one-place-board[data-graview-rising] { transform-origin: 50% 100%; transform: scaleY(1); transition: transform ${RISE_MS}ms cubic-bezier(.33,0,.2,1); }
@starting-style { .graview-one-place-board[data-graview-rising] { transform: scaleY(0); } }
.graview-one-place-board[data-graview-rising][data-graview-leaving] { transform: scaleY(0); pointer-events: none; }
.graview-one-place-board[aria-current] { outline: 2px solid color-mix(in srgb, var(--graview-accent) 60%, transparent); outline-offset: 3px; border-radius: 4px; }
[data-graview-past-slot] > * { pointer-events: auto; margin: 0 !important; }
.graview-one-place-board:focus-visible { outline: 3px solid var(--graview-accent); outline-offset: 4px; border-radius: 6px; }
.graview-one-place-board:hover [data-graview-board-face] { border-color: var(--graview-accent); }
[data-graview-one-face-stops] { display: inline-flex; align-items: stretch; height: 32px; padding: 2px; gap: 2px; border-radius: 8px; border: 1px solid var(--graview-edge); background: var(--graview-panel, Canvas); box-shadow: 0 1px 2px rgba(0,0,0,0.12); box-sizing: border-box; }
[data-graview-one-face-stops] button { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; padding: 0 10px; border: none; border-radius: 6px; background: none; color: var(--graview-ink-muted); font: inherit; font-size: 0.8125rem; font-weight: 500; cursor: pointer; white-space: nowrap; }
[data-graview-one-face-stops] button:hover { color: var(--graview-ink); background: color-mix(in srgb, var(--graview-ink) 7%, transparent); }
[data-graview-one-face-stops] button[aria-pressed="true"] { color: var(--graview-ink); font-weight: 600; background: color-mix(in srgb, var(--graview-accent) 18%, transparent); cursor: default; }
[data-graview-one-face-stops] button[data-graview-key-stop] { min-width: 30px; padding: 0 8px; margin-left: 2px; box-shadow: -1px 0 0 0 var(--graview-edge); border-radius: 0 6px 6px 0; }
[data-graview-one-face-stops] button:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 1px; }
@media (max-width: 600px), (pointer: coarse) { [data-graview-one-face-stops] { height: 48px; } [data-graview-one-face-stops] button { min-width: 64px; min-height: 44px; } [data-graview-one-face-stops] button[data-graview-key-stop] { min-width: 44px; } }
`;

/**
 * WHERE YOU ARE, AND THE WAY UP AND DOWN: one slim control at the window's
 * bottom left, the bar's own size and manner — three stops, named, Page ·
 * Nearby · City, the one you are at lit, and a press on another going
 * there, every step drawn. Up and down are the stops either side; Alt and
 * the arrows (and Escape, down) move one from the keyboard. Where the city
 * is in sight, its Key is the control's last stop, opening above it. The
 * level is said aloud as it changes.
 */
function Altitude({
  box,
  level,
  moving,
  goTo,
  where,
  chosen,
  boards,
  current,
  store,
}: {
  readonly box: RefObject<HTMLDivElement | null>;
  readonly level: number;
  readonly moving: boolean;
  /** Go to a level: down from the city into the board the keyboard chose, if it chose one. */
  readonly goTo: (level: number) => void;
  readonly where: PageWhere;
  readonly chosen: RefObject<string | null>;
  readonly boards: readonly Board[];
  readonly current: string;
  readonly store: PageContext<AnySchema>["store"];
}) {
  useEffect(() => {
    // A notice placed above what stands at the foot places itself again: this has changed its width.
    if (!moving) window.dispatchEvent(new Event("graview:foot-moved"));
  }, [level, moving]);
  const kind = where.type === "record" || where.type === "list" ? where.kind : null;
  const into = boards.find((board) => board.key === (chosen.current ?? current));
  /** What a press on each stop does, said. */
  const saying = (stop: number): string => {
    if (stop === level) return `${LEVEL_NAMES[stop]}: you are here`;
    if (stop === PAGE) return level === CITY && into && into.key !== current ? `Page: “${into.label}”, alone` : "Page: this page alone";
    if (stop === PANEL) return level === CITY ? `Nearby: ${into ? `“${into.label}”` : "this page"} beside its place in the city` : `Nearby: this page beside ${kind ? `the ${pluralOf(store, kind).toLowerCase()} district` : "the city"}`;
    return "City: every page and view of the app";
  };
  /* How much of the window's foot this stands over — the control, and the timeline beside it — for the room the page keeps at its foot. */
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => document.documentElement.style.setProperty("--graview-altitude-room", `${Math.ceil(el.getBoundingClientRect().height + 16)}px`);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      watch.disconnect();
      document.documentElement.style.removeProperty("--graview-altitude-room");
    };
  }, [box]);
  const [keyOpen, setKeyOpen] = useState(false);
  useEffect(() => {
    if (level === PAGE) setKeyOpen(false);
  }, [level]);
  const keys = (stop: number): string | undefined => (stop === level + 1 ? "Alt+ArrowUp" : stop === level - 1 ? "Alt+ArrowDown Escape" : undefined);
  return (
    <div ref={box} data-testid="altitude" data-graview-one-face-level={level} data-graview-foot="" style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: ONE_FACE_LAYERS.control, display: "flex", flexWrap: "wrap-reverse", alignItems: "flex-end", gap: 8, pointerEvents: "none" }}>
      <div role="group" aria-label={`Altitude: ${LEVEL_NAMES[level]!.toLowerCase()}, ${level + 1} of 3`} data-graview-one-face-stops="" style={{ pointerEvents: "auto", position: "relative" }}>
        {[PAGE, PANEL, CITY].map((stop) => (
          <button
            key={stop}
            type="button"
            data-testid={`altitude-stop-${stop}`}
            {...(stop === level + 1 ? { "data-graview-rise": "" } : stop === level - 1 ? { "data-graview-descend": "" } : {})}
            aria-pressed={stop === level}
            aria-label={saying(stop)}
            {...(keys(stop) ? { "aria-keyshortcuts": keys(stop) } : {})}
            title={`${saying(stop)}${stop === level + 1 ? " (Alt+↑)" : stop === level - 1 ? " (Alt+↓)" : ""}`}
            // The board the keyboard chose keeps it: a press here goes into it.
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => (stop === level ? undefined : goTo(stop))}
          >
            {LEVEL_NAMES[stop]}
          </button>
        ))}
        {level >= PANEL ? (
          <button type="button" data-testid="altitude-key" data-graview-key-stop="" aria-expanded={keyOpen} aria-label="Key: what the city's marks mean" title="Key: what the city's marks mean" onClick={() => setKeyOpen((open) => !open)} onKeyDown={(event) => {
              // The Key's Escape is the Key's: it puts the Key away, and nothing moves a level.
              if (event.key !== "Escape" || !keyOpen) return;
              event.preventDefault();
              event.stopPropagation();
              setKeyOpen(false);
            }}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <circle cx="7" cy="7" r="5.6" />
              <path d="M7 6.4v3.4" />
              <circle cx="7" cy="4.3" r="0.4" fill="currentColor" />
            </svg>
          </button>
        ) : null}
        {keyOpen && level >= PANEL ? <CityKey close={() => setKeyOpen(false)} /> : null}
      </div>
      {/* THE APP AS IT WAS, played at every level: the timeline stands beside the control (above it, where the window is narrow), so a scrub moves the city at the city and the page beside it. */}
      <div data-graview-past-slot="" style={{ flex: "1 1 300px", minWidth: 0, maxWidth: 720, pointerEvents: "none" }}>
        <PastBar face="pages" />
      </div>
      <span role="status" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {moving ? "" : LEVEL_NAMES[level]}
      </span>
    </div>
  );
}

/** What the city's marks mean, as this face draws them: nothing it does not draw. */
function CityKey({ close }: { readonly close: () => void }) {
  const swatch = (inner: ReactNode) => <span aria-hidden="true" style={{ display: "inline-flex", width: 18, height: 14, alignItems: "center", justifyContent: "center" }}>{inner}</span>;
  const rows: readonly (readonly [ReactNode, string, string])[] = [
    [swatch(<span style={{ width: 14, height: 10, borderRadius: 2, border: "1.5px solid var(--graview-edge)", borderTopWidth: 3, borderTopColor: "var(--graview-accent)", background: "var(--graview-ground)" }} />), "View", "a page of the app. Click to open it."],
    [swatch(<svg width="18" height="12" viewBox="0 0 18 12"><path d="M9 1 17 6 9 11 1 6Z" fill="none" stroke="var(--graview-edge)" strokeWidth="1.4" /></svg>), "District", "all the records of one kind."],
    [swatch(<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1 13 4 7 7 1 4Z" fill="color-mix(in srgb, var(--graview-ink) 30%, var(--graview-panel))" /><path d="M1 4v6l6 3V7Z" fill="color-mix(in srgb, var(--graview-ink) 18%, var(--graview-panel))" /><path d="M13 4v6l-6 3V7Z" fill="color-mix(in srgb, var(--graview-ink) 24%, var(--graview-panel))" /></svg>), "Building", "one record."],
    [swatch(<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1 13 4 7 7 1 4Z" fill="var(--graview-warn)" /><path d="M1 4v6l6 3V7Z" fill="color-mix(in srgb, var(--graview-warn) 70%, black)" /><path d="M13 4v6l-6 3V7Z" fill="color-mix(in srgb, var(--graview-warn) 85%, black)" /></svg>), "Orange roof", "needs your attention."],
    [swatch(<svg width="18" height="12" viewBox="0 0 18 12"><path d="M1 11 Q9 1 17 6" fill="none" stroke="var(--graview-accent)" strokeWidth="1.5" /></svg>), "Line", "links something on the page to its record."],
    [swatch(<span style={{ width: 18, height: 3, borderRadius: 2, background: "var(--graview-edge)" }} />), "Road", "these kinds are linked."],
  ];
  return (
    <div
      role="region"
      aria-label="What the city's marks mean"
      data-testid="altitude-key-pane"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close();
      }}
      style={{ position: "absolute", left: 0, bottom: "calc(100% + 8px)", width: "max-content", maxWidth: "calc(100vw - 32px)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--graview-edge)", background: "var(--graview-panel, Canvas)", color: "var(--graview-ink)", boxShadow: "0 12px 32px rgba(0,0,0,0.24)", fontSize: "0.85rem" }}
    >
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {rows.map(([mark, term, words]) => (
          <li key={term} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 10, alignItems: "start", lineHeight: "18px" }}>
            {/* The swatch centered on the first line of its words. */}
            <span style={{ display: "flex", height: 18, alignItems: "center" }}>{mark}</span>
            <span>
              <strong style={{ fontWeight: 600 }}>{term}</strong>: {words}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * CONNECTED: what the record is linked to, by relation, at the page's foot —
 * held at the foot of the panel while the page above it scrolls. Grown in as
 * the page becomes the panel (its box's height is set each frame); each row
 * is the record it names, and a line leaves the page's edge level with it
 * for that record's building. What the Scene's own record view said under
 * the record ("why this is here", "the list it is on") is here, said by
 * each relation's own words.
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
                  <button type="button" data-graview-record={target.id} onClick={() => openRecord(target.id, PANEL)} style={{ display: "block", width: "100%", textAlign: "start", padding: "4px 0", border: "none", background: "none", color: "var(--graview-ink)", font: "inherit", fontSize: "0.9rem", cursor: "pointer", minHeight: 32 }}>
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

export { PHONE };

/**
 * THE PANEL'S INNER EDGE, TO DRAG: a desk's panel wider or narrower by its
 * left edge, a phone's sheet higher or lower by its top. A separator the
 * keyboard reaches: the arrows step it, Home and End go to its least and
 * most, a double press puts it back. The city beside it follows on the one
 * camera as it moves (`one-place-city.tsx`).
 */
function PanelEdge({ view, size, keep, motion }: { readonly view: View; readonly size: (to: number | undefined) => void; readonly keep: () => void; readonly motion: { readonly current: Motion } }) {
  const phone = view.width <= PHONE;
  const range = panelRange(view);
  const panel = panelBox(view);
  const now = view.panel ?? range.default;
  const clamp = (value: number) => Math.max(range.min, Math.min(range.max, value));
  const bar = view.top ?? 0;
  const fromPointer = (event: { clientX: number; clientY: number }) => (phone ? (event.clientY - bar) / Math.max(1, view.height - bar) : view.width - 12 - event.clientX);
  const step = phone ? 0.04 : 24;
  const said = phone ? `${Math.round((1 - now) * 100)}% of the window` : `${Math.round(now)} pixels wide`;
  return (
    <div
      role="separator"
      aria-orientation={phone ? "horizontal" : "vertical"}
      aria-label={phone ? "The sheet's height" : "The panel's width"}
      // A phone's sheet is said by how much of the window it takes: the more, the higher its top.
      aria-valuenow={Math.round(phone ? (1 - now) * 100 : now)}
      aria-valuemin={Math.round(phone ? (1 - range.max) * 100 : range.min)}
      aria-valuemax={Math.round(phone ? (1 - range.min) * 100 : range.max)}
      aria-valuetext={said}
      tabIndex={0}
      data-testid="one-place-panel-edge"
      title="Drag to size the panel; double-click to put it back"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        motion.current.resizing = true;
      }}
      onPointerMove={(event) => {
        if (!motion.current.resizing) return;
        size(clamp(fromPointer(event)));
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        motion.current.resizing = false;
        keep();
      }}
      onPointerCancel={() => {
        motion.current.resizing = false;
      }}
      onDoubleClick={() => {
        size(undefined);
        requestAnimationFrame(keep);
      }}
      onKeyDown={(event) => {
        // A phone's sheet grows as its top goes up: the share above it shrinks.
        const grow = phone ? -step : step;
        const to =
          event.key === "Home" ? (phone ? range.max : range.min) : event.key === "End" ? (phone ? range.min : range.max) : event.key === (phone ? "ArrowUp" : "ArrowLeft") ? now + grow : event.key === (phone ? "ArrowDown" : "ArrowRight") ? now - grow : null;
        if (to === null) return;
        event.preventDefault();
        size(clamp(to));
        requestAnimationFrame(keep);
      }}
      className="graview-one-place-edge"
      style={
        phone
          ? { position: "fixed", left: panel.x + panel.width / 2 - 32, top: panel.y - 14, width: 64, height: 28, zIndex: ONE_FACE_LAYERS.edge, cursor: "row-resize", touchAction: "none" }
          : { position: "fixed", left: panel.x - 8, top: panel.y + 16, width: 14, height: panel.height - 32, zIndex: ONE_FACE_LAYERS.edge, cursor: "col-resize", touchAction: "none" }
      }
    />
  );
}
