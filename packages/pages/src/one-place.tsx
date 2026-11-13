import { OVERVIEW_PATH, ONE_FACE_LAYERS, counted, hueFor, labelOf, type AnySchema } from "@graview/core";
import { retryingImport } from "@graview/core/retry";
import { barPlaces, HOME_KEY, PastBar } from "@graview/primitives/pages";
import { lazyPart, useGraview, usePlayback } from "@graview/react/provider";
import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FocusEvent as ReactFocusEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { useHref, useLocation, useNavigate } from "react-router";
import { recordFacts } from "./facts.js";
import { useStoreTick, type PageContext } from "./page-context.js";
import { pluralOf } from "./page-typography.js";
import { kindOfSlug, recordPath, pluralSlug } from "./registry.js";
import { OneFaceContext, type OneFace } from "./one-place-control.js";
import { BOARD_ASPECT, boardFaceWidth, smallWindow, CITY, LEVEL_NAMES, nearestThatWay, PAGE, PANEL, panelBox, panelRange, PHONE, type Box, type PageWhere, type View } from "./one-place-geometry.js";

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
  /** What it is, said to a screen reader: the home, a list, a view, a record's page. */
  readonly eyebrow: string;
  /** What it is, drawn over its title: "90 species", "View · species", "Front page". */
  readonly says: string;
  /** What a list shows, live: the first few of its records' names, drawn on its sign. A view draws its own picture, so says none of them. */
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

/*
 * THE CONTROL'S TOOLTIPS, ON INTENT. A pointer passing over shows nothing:
 * a tooltip comes after the pointer has rested on a part for TIP_DELAY_MS,
 * and goes TIP_HIDE_MS after it leaves. Once one has shown, the next part
 * the pointer rests on shows its own at once, for TIP_WARM_MS after the last
 * went (the way along the stops). The keyboard's focus shows it at once; a
 * finger, only a long press.
 */
const TIP_DELAY_MS = 600;
const TIP_HIDE_MS = 100;
const TIP_WARM_MS = 300;
const TIP_PRESS_MS = 500;
/** When a tooltip of the control was last put away, for the warm window. */
let tipHiddenAt = -Infinity;
/** Until when a focus this face put on the control itself (a page with nothing else to take it) shows no tooltip. */
let quietFocusUntil = -Infinity;
/** When a pointer last went down: a focus that follows a press is the pointer's, and shows no tooltip. */
let pressedAt = -Infinity;
if (typeof document !== "undefined") document.addEventListener("pointerdown", () => (pressedAt = performance.now()), { capture: true, passive: true });

interface IntentTip {
  /** What is shown, and how far from the control's left edge; null when nothing is. */
  readonly shown: { readonly text: string; readonly left: number } | null;
  /** The handlers a part takes to have its tooltip shown on intent. */
  readonly on: (text: string) => {
    readonly onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => void;
    readonly onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void;
    readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
    readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
    readonly onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
    readonly onFocus: (event: ReactFocusEvent<HTMLElement>) => void;
    readonly onBlur: () => void;
  };
}

function useIntentTip(): IntentTip {
  const [shown, setShown] = useState<IntentTip["shown"]>(null);
  const showing = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const clear = () => window.clearTimeout(timer.current);
  useEffect(() => clear, []);
  const show = (el: HTMLElement, text: string) => {
    clear();
    const host = el.closest("[data-graview-tip-host]");
    const left = host ? Math.max(0, el.getBoundingClientRect().left - host.getBoundingClientRect().left) : 0;
    showing.current = true;
    setShown({ text, left });
  };
  const hide = (after: number) => {
    clear();
    const go = () => {
      if (showing.current) tipHiddenAt = performance.now();
      showing.current = false;
      setShown(null);
    };
    if (after > 0) timer.current = window.setTimeout(go, after);
    else go();
  };
  const on: IntentTip["on"] = (text) => ({
    onPointerEnter: (event) => {
      if (event.pointerType === "touch") return;
      const el = event.currentTarget;
      clear();
      if (showing.current || performance.now() - tipHiddenAt < TIP_WARM_MS) show(el, text);
      else timer.current = window.setTimeout(() => show(el, text), TIP_DELAY_MS);
    },
    onPointerLeave: (event) => {
      if (event.pointerType !== "touch") hide(TIP_HIDE_MS);
    },
    onPointerDown: (event) => {
      if (event.pointerType !== "touch") return;
      const el = event.currentTarget;
      clear();
      timer.current = window.setTimeout(() => show(el, text), TIP_PRESS_MS);
    },
    onPointerUp: (event) => {
      // A finger lifted: what a long press showed stays a moment to be read; a tap showed nothing.
      if (event.pointerType === "touch") hide(showing.current ? 1500 : 0);
    },
    onPointerCancel: () => hide(0),
    onFocus: (event) => {
      // The keyboard's focus (or one moved there for it), not a press's.
      if (performance.now() < quietFocusUntil) return;
      if (event.currentTarget.matches(":focus-visible") || performance.now() - pressedAt > 400) show(event.currentTarget, text);
    },
    onBlur: () => hide(0),
  });
  return { shown, on };
}

/** The tooltip itself: one for the control, over the part it is about. */
function Tip({ id, tip, said }: { readonly id: string; readonly tip: IntentTip; readonly said: string }) {
  // The level's own tooltip is the description the stop and the slider are given, and says only that; another part's words are shown in one of their own.
  const own = !tip.shown || tip.shown.text === said;
  return (
    <>
      <span id={id} role="tooltip" data-graview-one-face-tip="" data-graview-shown={tip.shown && own ? "" : undefined} style={{ left: tip.shown?.left ?? 0 }}>
        {said}
      </span>
      <span aria-hidden="true" data-graview-one-face-tip="" data-graview-shown={tip.shown && !own ? "" : undefined} style={{ left: tip.shown?.left ?? 0 }}>
        {own ? "" : tip.shown!.text}
      </span>
    </>
  );
}

/** Where this browser keeps whether the legend is shown beside the city. */
const LEGEND_KEY = "graview.one-face.legend";

/** Where this browser keeps whether the control is the three levels or a slider. */
const CONTROL_KEY = "graview.one-face.control";

/** The keys that go straight to each level, Page, Nearby and City. */
const LEVEL_KEYS = ["1", "2", "3"] as const as readonly string[];

/** Where this browser keeps whether the level's single keys are on (WCAG 2.1.4: they can be turned off). */
const KEYS_KEY = "graview.one-face.keys";
const keysOn = (): boolean => {
  try {
    return window.localStorage.getItem(KEYS_KEY) !== "off";
  } catch {
    return true;
  }
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
  /* A host that draws the bar itself (an embed's) is handed the slot, and draws its bar there. */
  const toldSlot = context.onBarSlot;
  useLayoutEffect(() => {
    if (!toldSlot) return;
    toldSlot(bar);
    return () => toldSlot(null);
  }, [bar, toldSlot]);
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
    /*
     * WHAT EACH BOARD SAYS IT IS. A view's board listed the first records of
     * its kind, as its kind's list did: ten views on a rich app drew alike,
     * and none looked like itself. A list's board says how many it holds
     * and its first; a view's says whose view it is, over its own
     * title; the home's and the connections' say what they are.
     */
    const out: Board[] = places.map((place) => {
      const where = whereOf(schema, has, place.path.split("?")[0]!, placeKinds);
      const list = where.type === "list";
      const kind = place.kind as string | undefined;
      const count = kind ? store.graph.count(kind as never) : 0;
      const says =
        place.group === "home"
          ? "Front page"
          : place.key === "connections"
            ? "The kinds, linked"
            : list && kind
              ? count === 0
                ? `No ${pluralOf(store, kind).toLowerCase()} yet`
                : counted(store.schema, kind, count)
              : kind
                ? `View · ${pluralOf(store, kind).toLowerCase()}`
                : "A view";
      return {
        key: place.key,
        label: place.label,
        path: place.path,
        eyebrow: place.group === "home" ? "home" : place.group === "lists" ? "list" : "view",
        says,
        lines: list && kind ? firstOf(store, [kind]).slice(0, 1) : [],
        kind: place.kind,
        where,
      };
    });
    if (where.type === "record") {
      const node = store.graph.getNode(where.id);
      out.push({ key: `record:${where.id}`, label: node ? labelOf(store.schema.tryDefinition(node.kind as string), node as never) : where.id, path: recordPath(schema, where.kind, where.id), eyebrow: "page", says: "", lines: [], kind: where.kind, where });
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
  /*
   * THE PAGE CHOSEN IS DRAWN FIRST, THEN IT MOVES. Asked for at the same
   * moment as the address, the level began to move the page that was being
   * left while the chosen one's route was still drawing — on a slow machine
   * one long task, which landed inside the move as a leap. The level is
   * asked once the new address has drawn and been painted.
   */
  const pendingLevel = useRef<{ readonly path: string; readonly level: number } | null>(null);
  useEffect(() => {
    const pending = pendingLevel.current;
    if (!pending || pending.path !== location.pathname) return;
    pendingLevel.current = null;
    const frame = requestAnimationFrame(() => {
      motion.current.level = pending.level;
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname]);
  const openAt = useCallback(
    (path: string, level: number) => {
      if (path.split("?")[0] === location.pathname) return goLevel(level);
      if (level > PAGE) keep();
      kept.current = level > PAGE ? { scrollY: 0, address: path } : null;
      pendingLevel.current = { path: path.split("?")[0]!, level };
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
  /** Out of the window's flow, ready for a hand to move the camera. */
  const beginAway = useCallback(() => {
    if (latest.current.now.away) return;
    latest.current.keep();
    setNow((was) => (was.away ? was : { ...was, away: true }));
  }, []);
  const onGround = useCallback(() => {
    if (latest.current.now.level === CITY && !latest.current.now.moving) latest.current.deselect();
  }, []);
  const latest = useRef({ now, rise, descend, deselect, keep, goTo });
  latest.current = { now, rise, descend, deselect, keep, goTo };
  useEffect(() => {
    const onPage = (target: EventTarget | null) => target instanceof Node && sheet.current?.contains(target) === true;
    const begin = () => {
      if (!latest.current.now.away) {
        latest.current.keep();
        setNow((was) => (was.away ? was : { ...was, away: true }));
      }
    };
    let pinch: number | null = null;
    const apart = (touches: TouchList) => Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);
    const touchStart = (event: TouchEvent) => {
      motion.current.held = event.touches.length > 0;
      /*
       * A PINCH IS THE BROWSER'S OWN ON THE PAGE: there it zooms the page's
       * words for whoever needs them larger, and a level is moved by the
       * control, its keys, or Alt and the arrows. Ctrl and the wheel, a
       * trackpad's pinch, are the browser's own over the page too. Beside the
       * city two fingers on the page scrub the altitude; over the city, and
       * at the City, the Scene's own hand zooms the camera.
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
      // Never with the browser's own chords (its zoom is Cmd or Ctrl and plus, minus, 0), never while the keys are writing, never into a view's frame.
      const target = (event.composedPath()[0] ?? event.target) as EventTarget | null;
      if (event.defaultPrevented || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.shiftKey || typingIn(target)) return;
      // Where the keys mean something of their own — a menu, a list to type into, a grid — they are theirs.
      if (target instanceof Element && target.closest('[role="menu"], [role="listbox"], [role="combobox"], [role="grid"], [role="textbox"], [role="spinbutton"], [role="tree"]')) return;
      if (document.querySelector("[data-graview-overlay]:not([hidden])")) return;
      const level = latest.current.now.level;
      // 1, 2 and 3: Page, Nearby and City. [ and ]: down and up a level — unless the keys were turned off in the legend.
      if (!event.altKey && !keysOn()) {
        if (LEVEL_KEYS.includes(event.key) || event.key === "[" || event.key === "]") return;
      }
      const stop = !event.altKey ? LEVEL_KEYS.indexOf(event.key) : -1;
      if (stop >= 0) {
        event.preventDefault();
        if (stop !== level) latest.current.goTo(stop);
        return;
      }
      const up = (event.altKey && event.key === "ArrowUp") || (!event.altKey && event.key === "]");
      // Escape at the city puts down the view the keyboard chose, and stays at the city; below it, it comes down a level.
      if (!event.altKey && event.key === "Escape" && level === CITY) {
        if (boardLayer.current?.contains(document.activeElement)) {
          event.preventDefault();
          latest.current.deselect();
        }
        return;
      }
      const down = (event.altKey && event.key === "ArrowDown") || (!event.altKey && (event.key === "Escape" || event.key === "["));
      if (up && level < CITY) {
        event.preventDefault();
        latest.current.rise();
      } else if (down && level > PAGE) {
        event.preventDefault();
        latest.current.descend();
      }
    };
    window.addEventListener("touchstart", touchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", touchMove, { passive: false, capture: true });
    window.addEventListener("touchend", touchEnd, { capture: true });
    window.addEventListener("touchcancel", touchEnd, { capture: true });
    document.addEventListener("keydown", key);
    return () => {
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
  const cameFrom = useRef(now.level);
  useLayoutEffect(() => {
    const active = document.activeElement;
    const onBoards = boardLayer.current?.contains(active) === true;
    // Only a move between levels places the keyboard: a page that opens at Page leaves it where the routed face puts it, as the derived pages do.
    const moved = cameFrom.current !== now.level;
    cameFrom.current = now.level;
    if (now.level === CITY) {
      if (now.moving || onBoards || fab.current?.contains(active) || deselected.current || bar?.contains(active)) return;
      boardEls.current.get(current)?.focus({ preventScroll: true });
      return;
    }
    chosen.current = null;
    deselected.current = false;
    if (!onBoards && (active !== document.body || !moved)) return;
    const title = sheet.current?.querySelector<HTMLElement>("main h1, h1:not([data-graview-app-bar] h1)");
    /*
     * A page with no title of its own (a view drawn in place of a record's
     * page) takes the keyboard on its main part; only a page with none of
     * that either puts it on the control — on the level it is at, its
     * tooltip quiet: the first stop lit by a focus ring, "Page (1)" up, read
     * as a second level chosen.
     */
    const landing = title ?? sheet.current?.querySelector<HTMLElement>("main, [role=main]") ?? null;
    if (landing) {
      if (!landing.hasAttribute("tabindex")) {
        landing.setAttribute("tabindex", "-1");
        if (landing !== title) landing.setAttribute("data-graview-focus-landing", "");
      }
      landing.focus({ preventScroll: true });
    } else {
      quietFocusUntil = performance.now() + 400;
      (fab.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? fab.current?.querySelector<HTMLButtonElement>("button"))?.focus({ preventScroll: true });
    }
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
      {/* THE APP'S BAR, fixed at the window's top over the page and the city alike: the shell draws it here (`page-shell.tsx`). First in the document, as the derived pages have it, so Tab reaches the bar before the page's own links at every level; its layer, not its place, sets it over the rest. */}
      <div ref={setBar} data-testid="one-place-bar" data-graview-one-face-bar="" style={{ position: "fixed", left: 0, right: 0, top: 0, zIndex: ONE_FACE_LAYERS.bar, background: "var(--graview-ground, Canvas)" }} />
      <Suspense fallback={null}>
        <OnePlaceCity where={where} out={now.away} sheet={sheet} connected={connected} boards={standing} current={current} boardEls={boardEls} boardLayer={boardLayer} fab={fab} view={view} lessMotion={lessMotion()} resolve={resolve} openRecord={openRecord} openKind={openKind} onGround={onGround} motion={motion} onAltitude={onAltitude} />
      </Suspense>
      <div ref={sheet} data-graview-one-place={now.level} data-graview-standing-on={where.type === "record" ? where.id : where.type === "list" ? `kind:${where.kind}` : where.type} style={sheetStyle}>
        <div {...(now.level >= CITY ? { inert: true } : {})} style={away ? { minHeight: "100%", display: "flex", flexDirection: "column" } : { display: "contents" }}>
          {/* Under a host's bar (an embed's, in the slot) the shell keeps no room for it: the page keeps it here. */}
          {context.embedded ? <div aria-hidden="true" data-graview-bar-room="" style={{ height: "var(--graview-one-face-bar, 0px)", flex: "0 0 auto" }} /> : null}
          {children}
          {/* What the record is linked to, grown into the page as it becomes the panel: its rows the lines leave from. */}
          {away && subject ? <Connected store={store} id={subject} box={connected} sheet={sheet} openRecord={openRecord} /> : null}
          {/* Room at the page's foot only where the control would stand over the page's last words: none where the foot is empty beside it. */}
          {away ? null : <FootRoom fab={fab} sheet={sheet} />}
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
            {board.key === current ? null : <BoardFace board={board} width={boardFaceWidth(view)} height={boardFaceWidth(view) / BOARD_ASPECT} small={smallWindow(view)} />}
          </button>
        ))}
      </div>
      {now.level === PANEL && !now.moving ? <PanelEdge view={view} size={sizePanel} keep={keepPanel} motion={motion} /> : null}
      <Altitude box={fab} level={now.level} moving={now.moving} goTo={goTo} where={where} chosen={chosen} boards={boards} current={current} store={store} motion={motion} begin={beginAway} />
      <style>{ONE_PLACE_CSS}</style>
    </OneFaceContext.Provider>
  );
}

/**
 * A BOARD'S FACE: the top of its page as the page draws it — what it is,
 * its title — at the page's own size, scaled by the city part
 * with the camera, so a board and the page that becomes one read alike.
 * A title too long for it is cut whole, with an ellipsis; the board's own
 * name (`title`, and what a screen reader is told) is the whole of it.
 */
function BoardFace({ board, width, height, small }: { readonly board: Board; readonly width: number; readonly height: number; readonly small: boolean }) {
  // A small window's face is narrower and its words fewer to a line: its title on two lines, broken where a word must be, fits the card whole.
  const sizes = small ? { pad: "16px 16px 0", says: "2.125rem", title: "2.25rem" } : { pad: "22px 34px 0", says: "2.25rem", title: "3.5rem" };
  const hue = board.kind ? `hsl(${Math.round(hueFor(board.kind))} 55% 52%)` : "var(--graview-accent)";
  const view = board.eyebrow === "view";
  return (
    <div data-graview-board-face="" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width, height, transformOrigin: "0 0", background: "var(--graview-ground, Canvas)", border: "3px solid var(--graview-edge)", borderTop: `10px solid ${hue}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 18px 40px rgba(0,0,0,0.28)", pointerEvents: "none" }}>
      {/* A view's board is drawn as a view: a band of its kind's color behind what it is, where a list's is a plain card. */}
      <div lang="en" style={{ padding: sizes.pad, ...(view ? { background: `linear-gradient(color-mix(in srgb, ${hue} 16%, transparent), transparent 85%)`, height: "100%", boxSizing: "border-box" } : {}) }}>
        <div data-graview-board-says="" style={{ fontSize: sizes.says, lineHeight: 1.2, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: view ? hue : "var(--graview-ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{board.says}</div>
        {/* Two lines before it is cut: "Connections" and "Cited facts" whole, never "Connec…". */}
        <div data-graview-board-title="" style={{ marginTop: 6, fontSize: sizes.title, lineHeight: 1.15, fontWeight: 650, color: "var(--graview-ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "break-word", hyphens: "auto" }}>{board.label}</div>
        {/* What a list shows, live: the first of its records, as its page lists them — where the card has room for it under a title on two lines. */}
        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {(small ? [] : board.lines).map((line, index) => (
            <div key={index} style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", borderRadius: 12, border: "2px solid var(--graview-edge)", fontSize: "2.125rem", color: "var(--graview-ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ flex: "0 0 auto", width: 18, height: 18, borderRadius: 9, border: `3px solid ${hue}` }} />
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{line}</span>
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
  const kept = useMemo(() => [...gone.values()].map((one) => one.board), [gone]);
  return rising ? kept : [];
}

const ONE_PLACE_CSS = `
.graview-one-place-edge::after { content: ""; position: absolute; border-radius: 3px; background: color-mix(in srgb, var(--graview-ink) 28%, transparent); transition: background 120ms; }
.graview-one-place-edge[aria-orientation="vertical"]::after { left: 5px; top: 50%; width: 4px; height: 44px; margin-top: -22px; }
.graview-one-place-edge[aria-orientation="horizontal"]::after { top: 11px; left: 50%; height: 5px; width: 40px; margin-left: -20px; }
.graview-one-place-edge:hover::after, .graview-one-place-edge:focus-visible::after { background: var(--graview-accent); }
.graview-one-place-edge:focus-visible { outline: none; }
.graview-one-place-board { touch-action: none; }
.graview-one-place-board::after { content: ""; position: absolute; left: 50%; top: 100%; width: 2px; height: var(--graview-sign-post, 10px); margin-left: -1px; background: color-mix(in srgb, var(--graview-ink) 35%, transparent); }
.graview-one-place-board::before { content: ""; position: absolute; left: 50%; top: calc(100% + var(--graview-sign-post, 10px)); width: 18px; height: 6px; margin: -3px 0 0 -9px; border-radius: 50%; background: rgba(0,0,0,0.28); }
.graview-one-place-board[data-graview-rising] { transform-origin: 50% 100%; transform: scaleY(1); transition: transform ${RISE_MS}ms cubic-bezier(.33,0,.2,1); }
@starting-style { .graview-one-place-board[data-graview-rising] { transform: scaleY(0); } }
.graview-one-place-board[data-graview-rising][data-graview-leaving] { transform: scaleY(0); pointer-events: none; }
.graview-one-place-board[aria-current] { outline: 2px solid color-mix(in srgb, var(--graview-accent) 60%, transparent); outline-offset: 3px; border-radius: 4px; }
[data-graview-past-slot] > * { pointer-events: auto; margin: 0 !important; }
[data-graview-focus-landing]:focus { outline: none; }
.graview-one-place-board:focus-visible { outline: 3px solid var(--graview-accent); outline-offset: 4px; border-radius: 6px; }
.graview-one-place-board:hover [data-graview-board-face] { border-color: var(--graview-accent); }
[data-graview-one-face-stops] { display: inline-flex; align-items: stretch; height: 32px; padding: 2px; gap: 2px; border-radius: 8px; border: 1px solid var(--graview-edge); background: var(--graview-panel, Canvas); box-shadow: 0 1px 2px rgba(0,0,0,0.12); box-sizing: border-box; }
[data-graview-one-face-stops] button { position: relative; display: inline-flex; align-items: center; justify-content: center; min-width: 52px; padding: 0 10px; border: none; border-radius: 6px; background: none; color: var(--graview-ink-muted); font: inherit; font-size: 0.8125rem; font-weight: 500; cursor: pointer; white-space: nowrap; }
[data-graview-one-face-stops] button:hover { color: var(--graview-ink); background: color-mix(in srgb, var(--graview-ink) 7%, transparent); }
[data-graview-one-face-stops] button[aria-pressed="true"] { color: var(--graview-ink); font-weight: 600; background: color-mix(in srgb, var(--graview-accent) 18%, transparent); cursor: default; }
[data-graview-one-face-stops] button[data-graview-key-stop] { min-width: 30px; padding: 0 8px; margin-left: 2px; box-shadow: -1px 0 0 0 var(--graview-edge); border-radius: 0 6px 6px 0; }
[data-graview-one-face-stops] button:focus-visible, [data-graview-one-face-slider]:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 1px; }
[data-graview-one-face-tip] { position: absolute; left: 0; bottom: calc(100% + 6px); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--graview-edge); background: var(--graview-panel, Canvas); color: var(--graview-ink); font-size: 0.75rem; white-space: nowrap; pointer-events: none; opacity: 0; }
[data-graview-one-face-tip][data-graview-shown] { opacity: 1; }
[data-graview-one-face-mini]:has([aria-expanded="true"]) > [data-graview-one-face-tip], [data-graview-one-face-stops]:has([data-testid="altitude-key"][aria-expanded="true"]) > [data-graview-one-face-tip] { opacity: 0; }
/* Put away, the same control made shorter: one row, the stops' height, border and type — the level's name, the track, and the way back to all three. */
[data-graview-one-face-mini] { display: inline-flex; align-items: stretch; height: 32px; padding: 2px; gap: 2px; border-radius: 8px; border: 1px solid var(--graview-edge); background: var(--graview-panel, Canvas); box-shadow: 0 1px 2px rgba(0,0,0,0.12); box-sizing: border-box; }
[data-graview-mini-word] { display: inline-flex; align-items: center; justify-content: center; min-width: 54px; padding: 0 4px; border: none; border-radius: 6px; background: color-mix(in srgb, var(--graview-accent) 18%, transparent); color: var(--graview-ink); font: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
[data-graview-mini-word]:hover { background: color-mix(in srgb, var(--graview-accent) 26%, transparent); }
[data-graview-mini-word]:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 1px; }
/* The chevron: a small glyph in a 24-pixel target (a thumb's 44 on a phone), reaching over the row's own padding. */
[data-graview-mini-tool] { position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 24px; height: 26px; margin: 0 -2px 0 -4px; padding: 0; border: none; border-radius: 6px; background: none; color: var(--graview-ink-muted); cursor: pointer; }
[data-graview-mini-tool]:hover { color: var(--graview-ink); }
[data-graview-mini-tool]:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: -2px; }
@media (max-width: 600px), (pointer: coarse) {
  [data-graview-one-face-stops] { height: 48px; } [data-graview-one-face-stops] button { min-width: 64px; min-height: 44px; } [data-graview-one-face-stops] button[data-graview-key-stop] { min-width: 44px; }
  [data-graview-one-face-mini] { height: 48px; }
  [data-graview-mini-word] { min-width: 60px; min-height: 44px; }
  [data-graview-mini-tool] { width: 44px; height: 44px; margin: 0; }
  [data-testid="altitude-key-pane"] { padding-right: 48px !important; }
  [data-testid="altitude-key-pane"] [data-testid="altitude-key-hide"] { width: 44px !important; height: 44px !important; top: 0 !important; right: 0 !important; }
  [data-testid="altitude-keys-turn"] { min-height: 44px !important; min-width: 44px !important; }
}
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
  motion,
  begin,
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
  readonly motion: { readonly current: Motion };
  /** The page out of the window's flow, ready to move: a drag of the slider starts there. */
  readonly begin: () => void;
}) {
  /*
   * ALL THREE LEVELS, OR ONE SLIM SLIDER. Shown whole the first time — a
   * person learns there are three levels by reading their names — and put
   * away into a slider naming only the level you are at whenever that is
   * asked for, kept in this browser.
   */
  const [small, setSmall] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CONTROL_KEY) === "slider";
    } catch {
      return false;
    }
  });
  const keepSmall = (to: boolean) => {
    setSmall(to);
    try {
      window.localStorage.setItem(CONTROL_KEY, to ? "slider" : "levels");
    } catch {
      // A browser that keeps nothing keeps the choice for this visit.
    }
  };
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
  /*
   * THE LEGEND IS A BUTTON. It starts put away — the Key, the control's
   * last stop, opens it — beside the city and on the page alike: open by
   * default it stood over a quarter of a desk's window at the City on the
   * first visit, over the districts it was there to explain. Opened beside
   * the city, it is kept open in this browser until it is put away, and
   * kept put away after; read from this browser as the control mounts, so
   * the swap of the pages' plain routes for this face keeps it.
   */
  const [legendCity, setLegendCity] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(LEGEND_KEY) === "shown";
    } catch {
      return false;
    }
  });
  const [legendPage, setLegendPage] = useState(false);
  const keyOpen = level === PAGE ? legendPage : legendCity;
  const setKeyOpen = (to: boolean | ((was: boolean) => boolean)) => {
    const next = typeof to === "function" ? to(keyOpen) : to;
    if (level === PAGE) return setLegendPage(next);
    setLegendCity(next);
    try {
      window.localStorage.setItem(LEGEND_KEY, next ? "shown" : "hidden");
    } catch {
      // Kept for this visit.
    }
  };
  const tipId = useId();
  const tip = `${LEVEL_NAMES[level]} (${LEVEL_KEYS[level]}) · [ and ] to move`;
  const intent = useIntentTip();
  const stopTips = [PAGE, PANEL, CITY].map((stop) => intent.on(stop === level ? tip : `${LEVEL_NAMES[stop]} (${LEVEL_KEYS[stop]})`));
  const keys = (stop: number): string => [LEVEL_KEYS[stop], stop === level + 1 ? "] Alt+ArrowUp" : stop === level - 1 ? "[ Alt+ArrowDown Escape" : ""].filter(Boolean).join(" ");
  return (
    <div ref={box} role="region" aria-label="Where you are" data-testid="altitude" data-graview-one-face-level={level} data-graview-foot="" style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: ONE_FACE_LAYERS.control, display: "flex", flexWrap: "wrap-reverse", alignItems: "flex-end", gap: 8, pointerEvents: "none" }}>
      {/* The legend over the control, in the same column: the room the camera keeps at the foot is theirs together. */}
      <div data-graview-one-face-dock="" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: keyOpen && !small ? 30 : 8, pointerEvents: "none" }}>
      {keyOpen ? <CityKey close={() => setKeyOpen(false)} /> : null}
      {small ? (
        <div role="group" aria-label="Level" data-graview-one-face-mini="" data-graview-tip-host="" style={{ pointerEvents: "auto", position: "relative" }}>
          {/* The level's name, in the stops' own type: pressed, it opens the legend, as the Key does when the levels are shown whole. */}
          <button type="button" data-testid="altitude-key" data-graview-mini-word="" aria-expanded={keyOpen} aria-label={`${LEVEL_NAMES[level]}: show the legend, what the city's marks mean and the keys`} {...intent.on("Legend")} onClick={() => setKeyOpen((open) => !open)} onKeyDown={(event) => {
            if (event.key !== "Escape" || !keyOpen) return;
            event.preventDefault();
            event.stopPropagation();
            setKeyOpen(false);
          }}>
            <span data-testid="altitude-mini-word">{LEVEL_NAMES[level]}</span>
          </button>
          <LevelSlider level={level} goTo={goTo} motion={motion} begin={begin} describedBy={tipId} tip={intent.on(tip)} />
          <button type="button" data-testid="altitude-size" aria-expanded={false} aria-label="Show all three levels" {...intent.on("Show all three levels")} onClick={() => keepSmall(false)} data-graview-mini-tool="">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3l3 3-3 3" /></svg>
          </button>
          <Tip id={tipId} tip={intent} said={tip} />
        </div>
      ) : (
      <div role="group" aria-label={`Altitude: ${LEVEL_NAMES[level]!.toLowerCase()}, ${level + 1} of 3`} data-graview-one-face-stops="" data-graview-tip-host="" style={{ pointerEvents: "auto", position: "relative" }}>
        {[PAGE, PANEL, CITY].map((stop) => (
          <button
            key={stop}
            type="button"
            data-testid={`altitude-stop-${stop}`}
            {...(stop === level + 1 ? { "data-graview-rise": "" } : stop === level - 1 ? { "data-graview-descend": "" } : {})}
            aria-pressed={stop === level}
            aria-label={saying(stop)}
            aria-keyshortcuts={keys(stop)}
            {...(stop === level ? { "aria-describedby": tipId } : {})}
            {...stopTips[stop]!}
            // The board the keyboard chose keeps it: a press here goes into it.
            onPointerDown={(event) => {
              event.preventDefault();
              stopTips[stop]!.onPointerDown(event);
            }}
            onClick={() => (stop === level ? undefined : goTo(stop))}
          >
            {LEVEL_NAMES[stop]}
            {/* With the Key open, each stop's key stands over it. */}
            {keyOpen ? (
              <kbd data-testid={`altitude-keycap-${stop}`} aria-hidden="true" style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", minWidth: 18, padding: "1px 5px", borderRadius: 4, border: "1px solid var(--graview-edge)", background: "var(--graview-panel, Canvas)", color: "var(--graview-ink)", font: "inherit", fontSize: "0.75rem", lineHeight: 1.4, textAlign: "center" }}>
                {LEVEL_KEYS[stop]}
              </kbd>
            ) : null}
          </button>
        ))}
        <button type="button" data-testid="altitude-key" data-graview-key-stop="" aria-expanded={keyOpen} aria-label="Key: what the city's marks mean" {...intent.on("Key: what the city's marks mean")} onClick={() => setKeyOpen((open) => !open)} onKeyDown={(event) => {
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
        <Tip id={tipId} tip={intent} said={tip} />
        <button type="button" data-testid="altitude-size" data-graview-key-stop="" aria-expanded={true} aria-label="Put the levels away into a slider" {...intent.on("Put the levels away into a slider")} onClick={() => keepSmall(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L5 6l3 3" /></svg>
        </button>
      </div>
      )}
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

/**
 * THE LEVELS AS A SLIDER: a short track with a stop for each level and a
 * thumb at the one you are at, its name beside it. Dragged, the camera
 * follows the thumb the whole way and settles at the nearest stop when it
 * is let go, as a pinch does; pressed on the track, or moved by the arrows,
 * Home and End, or 1, 2 and 3, it goes to a stop.
 */
/** The collapsed control's track, and its thumb. */
const TRACK = 64;
const THUMB = 14;

function LevelSlider({ level, goTo, motion, begin, describedBy, tip }: { readonly level: number; readonly goTo: (level: number) => void; readonly motion: { readonly current: Motion }; readonly begin: () => void; readonly describedBy: string; readonly tip: ReturnType<IntentTip["on"]> }) {
  const track = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const altitudeNow = () => Number(document.querySelector('[data-testid="one-place-city"]')?.getAttribute("data-graview-altitude-now") ?? level) || 0;
  const atPointer = (clientX: number): number => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return level;
    // The stops stand inside the track, half a thumb in from each end.
    return Math.max(0, Math.min(CITY, ((clientX - box.left - THUMB / 2) / Math.max(1, box.width - THUMB)) * CITY));
  };
  const shown = dragging ?? level;
  const named = LEVEL_NAMES[Math.round(shown)]!;
  return (
    <div
      role="slider"
      tabIndex={0}
      data-testid="altitude-slider"
      aria-label="Level"
      aria-valuemin={PAGE}
      aria-valuemax={CITY}
      aria-valuenow={level}
      aria-valuetext={LEVEL_NAMES[level]}
      aria-keyshortcuts="1 2 3 [ ]"
      aria-describedby={describedBy}
      onPointerEnter={tip.onPointerEnter}
      onPointerLeave={tip.onPointerLeave}
      onFocus={tip.onFocus}
      onBlur={tip.onBlur}
      onKeyDown={(event) => {
        const to = event.key === "ArrowLeft" || event.key === "ArrowDown" ? level - 1 : event.key === "ArrowRight" || event.key === "ArrowUp" ? level + 1 : event.key === "Home" ? PAGE : event.key === "End" ? CITY : null;
        if (to === null || event.altKey) return;
        event.preventDefault();
        event.stopPropagation();
        goTo(Math.max(PAGE, Math.min(CITY, to)));
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        motion.current.held = true;
        // Out of the page's flow and a hand on the camera from the first touch: the frame does not put the page back before the thumb moves.
        motion.current.scrubbing = true;
        moved.current = false;
        begin();
        setDragging(atPointer(event.clientX));
      }}
      onPointerMove={(event) => {
        if (dragging === null) return;
        const to = atPointer(event.clientX);
        if (Math.abs(to - (dragging ?? to)) > 0.02) moved.current = true;
        setDragging(to);
        // The camera follows the thumb: as far as it has gone since the last frame, as a pinch scrubs it.
        motion.current.scrub = to - altitudeNow();
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        const to = dragging;
        setDragging(null);
        motion.current.held = false;
        // A press without a drag goes to the stop pressed; a drag settles where the camera lets it go, at the nearest.
        if (!moved.current) {
          motion.current.scrubbing = false;
          motion.current.scrub = 0;
          if (to !== null) goTo(Math.round(to));
        }
      }}
      onPointerCancel={() => {
        setDragging(null);
        motion.current.held = false;
        motion.current.scrub = 0;
      }}
      data-graview-one-face-slider=""
      style={{ position: "relative", flex: "none", display: "inline-flex", alignItems: "center", width: TRACK, padding: 0, cursor: "pointer", touchAction: "none", outline: "none", borderRadius: 6 }}
    >
      <div ref={track} aria-hidden="true" style={{ position: "relative", width: "100%", height: 2, borderRadius: 1, background: "var(--graview-edge)" }}>
        {/* A tick on the line at each stop, and the thumb on the one you are at — all inside the track's ends. */}
        {[PAGE, PANEL, CITY].map((stop) => (
          <span key={stop} style={{ position: "absolute", left: `calc(${THUMB / 2}px + ${stop / CITY} * (100% - ${THUMB}px))`, top: "50%", width: 2, height: 8, marginLeft: -1, marginTop: -4, borderRadius: 1, background: "var(--graview-ink-muted)" }} />
        ))}
        <span data-testid="altitude-thumb" style={{ position: "absolute", left: `calc(${THUMB / 2}px + ${shown / CITY} * (100% - ${THUMB}px))`, top: "50%", width: THUMB, height: THUMB, marginLeft: -THUMB / 2, marginTop: -THUMB / 2, borderRadius: THUMB / 2, background: "var(--graview-accent)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: dragging === null ? "left 200ms ease" : "none" }} />
      </div>
      {/* While dragged the word under the thumb is said here; at rest the button beside it says it. */}
      <span data-testid="altitude-word" aria-hidden="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {named}
      </span>
    </div>
  );
}

/** What on a page a person reads or presses: a part that would be covered if the control stood over it. */
const CONTENT = "a[href], button, input, select, textarea, img, svg, video, canvas, [role=button], [role=link]";

/**
 * THE ROOM THE PAGE KEEPS AT ITS FOOT FOR THE CONTROL — only as much as
 * keeps the control off the page's content when it is scrolled to its end.
 * Every part with words or a control whose column the control stands in
 * (the control's width, and a little air) is measured where it would be at
 * the scroll's end: the room is what lifts the lowest of them clear of the
 * control's top. A footer whose words stand at its right, the control at
 * its empty left, keeps no room at all.
 */
function FootRoom({ fab, sheet }: { readonly fab: RefObject<HTMLDivElement | null>; readonly sheet: RefObject<HTMLDivElement | null> }) {
  const room = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const plane = sheet.current;
      const holder = fab.current;
      const spacer = room.current;
      if (!plane || !holder || !spacer) return;
      const parts = [holder.querySelector("[data-graview-one-face-dock]"), holder.querySelector("[data-graview-past-slot] > *")].flatMap((el) => {
        const r = el?.getBoundingClientRect();
        return r && r.width > 0 && r.height > 0 ? [r] : [];
      });
      if (parts.length === 0) return setHeight(0);
      const scrollY = window.scrollY;
      const whole = document.documentElement.scrollHeight - spacer.offsetHeight;
      const end = Math.max(0, whole - window.innerHeight);
      let lowest = -Infinity;
      for (const el of plane.querySelectorAll<HTMLElement>("*")) {
        if (el === spacer || spacer.contains(el)) continue;
        // A leaf with words, or a control or a picture: what a person reads or presses.
        const said = el.matches(CONTENT) || (el.childElementCount === 0 && (el.textContent ?? "").trim().length > 0);
        if (!said) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.bottom + scrollY < end + window.innerHeight - 400) continue;
        if (!parts.some((part) => r.right > part.left - 8 && r.left < part.right + 8)) continue;
        // Fixed to the window (a notice, a dialog): it does not scroll to the page's end.
        if (el.offsetParent === null && getComputedStyle(el).position === "fixed") continue;
        // Inside a box that scrolls or clips: where that box shows it, not where its content runs on below.
        let seen = r.bottom;
        for (let at = el.parentElement; at && at !== plane; at = at.parentElement) {
          const style = getComputedStyle(at);
          if (style.position === "fixed") {
            seen = -Infinity;
            break;
          }
          if (style.overflowY !== "visible") seen = Math.min(seen, at.getBoundingClientRect().bottom);
        }
        if (seen === -Infinity) continue;
        lowest = Math.max(lowest, seen + scrollY);
      }
      if (lowest === -Infinity) return setHeight(0);
      // The control's top where it rests, and air above it: the lowest such part ends there at the scroll's end.
      const top = Math.min(...parts.map((part) => part.top)) - 8;
      const need = Math.ceil(lowest - top + window.innerHeight - whole);
      setHeight((was) => (Math.abs(was - Math.max(0, need)) < 1 ? was : Math.max(0, need)));
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    soon();
    const sized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(soon);
    // The page is in the window's flow here (its box is the document's): the body's size is the page's.
    sized?.observe(document.body);
    if (fab.current) sized?.observe(fab.current);
    const changed = typeof MutationObserver === "undefined" ? null : new MutationObserver(soon);
    if (sheet.current) changed?.observe(sheet.current, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", soon);
    return () => {
      cancelAnimationFrame(frame);
      sized?.disconnect();
      changed?.disconnect();
      window.removeEventListener("resize", soon);
    };
  }, [fab, sheet]);
  return <div ref={room} aria-hidden="true" data-graview-altitude-room="" style={{ height }} />;
}

/** The level's keys, said as they are now, with the one button that turns them off or back on (WCAG 2.1.4). A bare checkbox read as "off" while the keys worked; the line itself says which it is. */
function KeysLine() {
  const [on, setOn] = useState(keysOn);
  const turn = () => {
    const next = !on;
    setOn(next);
    try {
      window.localStorage.setItem(KEYS_KEY, next ? "on" : "off");
    } catch {
      // Kept for this visit only.
    }
  };
  const button = (
    <button
      type="button"
      data-testid="altitude-keys-turn"
      aria-pressed={on}
      aria-label={on ? "Level keys are on: turn them off" : "Level keys are off: turn them on"}
      onClick={turn}
      style={{ display: "inline-flex", alignItems: "center", minHeight: 24, minWidth: 24, marginLeft: 6, padding: "0 4px", verticalAlign: "middle", border: "none", background: "none", color: "var(--graview-accent)", font: "inherit", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer" }}
    >
      {on ? "Turn off" : "Turn on"}
    </button>
  );
  return (
    <p data-testid="altitude-key-keys" data-graview-keys={on ? "on" : "off"} style={{ margin: "0 0 6px", color: "var(--graview-ink-muted)" }}>
      <strong style={{ fontWeight: 600, color: "var(--graview-ink)" }}>Keys</strong>
      {on ? ": 1 Page · 2 Nearby · 3 City · [ down · ] up" : " are off: Alt ↑ up · Alt ↓ down"}
      {button}
    </p>
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
      style={{ pointerEvents: "auto", position: "relative", width: "max-content", maxWidth: "calc(100vw - 32px)", padding: "8px 28px 8px 10px", borderRadius: 8, border: "1px solid var(--graview-edge)", background: "var(--graview-panel, Canvas)", color: "var(--graview-ink)", boxShadow: "0 1px 2px rgba(0,0,0,0.12)", fontSize: "0.75rem", lineHeight: 1.35 }}
    >
      <button type="button" data-testid="altitude-key-hide" aria-label="Put the legend away" onClick={close} style={{ position: "absolute", top: 2, right: 2, width: 24, height: 24, padding: 0, border: "none", borderRadius: 4, background: "none", color: "var(--graview-ink-muted)", font: "inherit", cursor: "pointer" }}>
        ×
      </button>
      <KeysLine />
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 3 }}>
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
 * CONNECTED: what the record is linked to that its page does not already
 * show — a relation the page draws as a section of its own is not said
 * again — at the page's foot, in its flow, never over its words. Grown in
 * as the page becomes the panel (its box's height is set each frame); each
 * row is the record it names, and a line leaves the page's edge level with
 * it for that record's building. Nothing at all when the page shows every
 * one. What the Scene's own record view said under the record ("why this is
 * here", "the list it is on") is here when the page does not say it.
 */
function Connected({ store, id, box, sheet, openRecord }: { readonly store: PageContext<AnySchema>["store"]; readonly id: string; readonly box: RefObject<HTMLDivElement | null>; readonly sheet: RefObject<HTMLDivElement | null>; readonly openRecord: (id: string, level: number) => void }) {
  const tick = useStoreTick(store);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const facts = useMemo(() => recordFacts(store, id), [store, id, tick]);
  /* What the page shows already: every record a part of it marks, outside this list. */
  const [onPage, setOnPage] = useState<ReadonlySet<string> | null>(null);
  useLayoutEffect(() => {
    const plane = sheet.current;
    if (!plane) return;
    const read = () => {
      const shown = new Set<string>();
      for (const part of plane.querySelectorAll("[data-graview-pick], [data-graview-record], [data-record], a[href]")) {
        if (box.current?.contains(part)) continue;
        const marked = part.getAttribute("data-graview-pick") ?? part.getAttribute("data-graview-record") ?? part.getAttribute("data-record");
        if (marked) shown.add(marked);
        else if (part instanceof HTMLAnchorElement) {
          if (part.origin !== window.location.origin) continue;
          try {
            const last = decodeURIComponent(part.pathname.split("/").filter(Boolean).at(-1) ?? "");
            if (last) shown.add(last);
          } catch {
            // An address that is no record's.
          }
        }
      }
      setOnPage((was) => (was && was.size === shown.size && [...shown].every((one) => was.has(one)) ? was : shown));
    };
    read();
    const watch = typeof MutationObserver === "undefined" ? null : new MutationObserver(read);
    watch?.observe(plane, { childList: true, subtree: true });
    return () => watch?.disconnect();
  }, [sheet, box, id, tick]);
  const groups = (facts?.links ?? []).map((group) => ({ ...group, targets: group.targets.filter((target) => !onPage?.has(target.id)) })).filter((group) => group.targets.length > 0);
  const total = groups.reduce((sum, group) => sum + group.targets.length, 0);
  if (onPage === null || total === 0) return <div ref={box} data-graview-connected-box="" hidden />;
  return (
    <div ref={box} data-graview-connected-box="" style={{ height: 0, opacity: 0, overflow: "hidden", background: "var(--graview-panel, Canvas)", borderTop: "1px solid var(--graview-edge)", flex: "0 0 auto" }}>
      <section data-graview-connected={total} aria-label="Also connected" style={{ padding: "10px 18px 12px" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "0.95rem" }}>
          Also connected <span style={{ fontWeight: 400, color: "var(--graview-ink-faint)" }}>· {total}</span>
        </h2>
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
