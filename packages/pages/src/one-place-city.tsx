import { labelOf, ONE_FACE_LAYERS } from "@graview/core";
import { EMPTY_VIEW, toUrl, withOverview, type ViewState } from "@graview/layout/view";
import { Scene, type SceneCamera } from "@graview/react";
import { useGraview, useNavigation, useViolations } from "@graview/react/provider";
import { useOneFace } from "./one-place-control.js";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { aimAt, altitudeAt, anchorOf, BOARD_ASPECT, boardFaceWidth, boardLeast, boardWidthFor, fitBeside, fitCamera, SIGN_GAP, SIGN_POST, signRoom, cameraBetween, cameraPutting, CITY, cityArea, footOf, leaveFrom, routeLine, LEVEL_LIVE, levelZooms, PAGE, pageBox, PANEL, panelBox, PHONE, project, restingLevel, SHEET_ORIGIN, standingAt, standingCss, unionOf, type Box, type Live, type PageWhere, type Point } from "./one-place-geometry.js";
import type { OnePlaceCityProps } from "./one-place.js";
import { placeSigns } from "./one-place-signs.js";
import { pluralOf } from "./page-typography.js";

/*
 * THE CITY UNDER THE PAGE, AND ONE CAMERA OVER BOTH
 * (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * The Scene itself, in the provider the pages draw with, at its overview:
 * `layout` → `placeCity`, its plots, its buildings, its streets. Over it,
 * nothing but the page the person was reading — the same element at every
 * altitude — and the lines from its parts to their buildings.
 *
 * ONE FRAME, ONE NUMBER. Each animation frame reads the Scene's own camera
 * (its committed zoom and the move between stops it is painting, `live`)
 * and turns it into the ALTITUDE — or, while this face is moving the
 * camera itself (Up, Down, a pinch on the page), sets that camera from the
 * altitude. From the altitude in that frame follow the page's box, how it
 * stands, how much of the Connected list has grown in, the city's fade,
 * and the lines: each line's building end is the building's place in the
 * picture carried through that same camera, and its page end is read from
 * the page after its own transform for that frame is written. Nothing is
 * read from a frame before.
 *
 * Between levels the camera is the Scene's move between stops, painted on
 * its layers outside React; at a level it is written into the view once,
 * and the city laid out again at that zoom.
 */

/*
 * WHAT A DRAWN PART SAYS IT SHOWS. A page, a lens and a view each mark the
 * record a part of them shows, and the line from that part to the record's
 * building is read off the mark, whatever drew it: the pick every shipped
 * lens and the Scene's own views carry (`data-graview-pick`, what a press
 * there chooses), a routed page's row (`data-graview-record`), and a view's
 * own link to a record (`data-record`). One line a record, from the first
 * of its parts in sight: a task drawn on three days of a calendar is one
 * line, not three. A part scrolled out of the page draws none.
 */
const RECORD_PARTS = "[data-graview-pick], [data-graview-record], [data-record]";
const recordShownBy = (element: Element): string | null => element.getAttribute("data-graview-pick") ?? element.getAttribute("data-graview-record") ?? element.getAttribute("data-record");

/*
 * THE CITY ON THIS FACE. The Scene's own zoom and its signs past the edge
 * are not this face's: the control at the foot and the camera are. Nor are
 * the Scene's lines and words from a chosen record to what it is linked
 * to: the page beside the city says those, and its lines leave from where
 * it says them. The record the page is about stands out from the rest —
 * lifted off its plot and lit in the accent — while what it is linked to
 * stays lit as the Scene lights it, and everything else is quiet.
 */
const CITY_CSS = `
[data-testid="one-place-city"] .graview-zoom, [data-testid="one-place-city"] .graview-edge-sign, [data-testid="one-place-city"] .graview-record-links, [data-testid="one-place-city"] .graview-drive-in { display: none; }
[data-testid="one-place-city"] .graview-building[data-graview-here] { translate: 0 -7px; }
[data-testid="one-place-city"] .graview-building[data-graview-here] .graview-iso-roof { fill: var(--graview-accent); }
[data-testid="one-place-city"] .graview-building[data-graview-here] .graview-iso-left { fill: color-mix(in srgb, var(--graview-accent) 55%, black); }
[data-testid="one-place-city"] .graview-building[data-graview-here] .graview-iso-right { fill: color-mix(in srgb, var(--graview-accent) 72%, black); }
[data-testid="one-place-city"] .graview-kind-face { filter: opacity(var(--graview-one-face-plates, 1)); }
[data-testid="one-place-city"][data-graview-names-said] .graview-kind-face { visibility: hidden !important; pointer-events: none !important; }
.graview-one-place-district { position: fixed; left: 0; top: 0; display: flex; gap: 4px; align-items: stretch; width: max-content; max-width: none; font-size: 0.75rem; line-height: 1.4; white-space: nowrap; }
.graview-one-place-district > button { touch-action: none; display: inline-flex; align-items: center; gap: 0.4em; box-sizing: border-box; min-height: 24px; min-width: 24px; margin: 0; padding: 1px 6px 2px; border: 1px solid var(--graview-edge); border-radius: 5px; background: var(--graview-panel, Canvas); color: var(--graview-ink); font: inherit; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.25); cursor: pointer; }
.graview-one-place-district > button:hover { border-color: var(--graview-accent); }
.graview-one-place-district > button:focus-visible { outline: 2px solid var(--graview-accent); outline-offset: 1px; }
.graview-one-place-district > [data-graview-district-problems] { color: var(--graview-warn); font-weight: 600; letter-spacing: 0; font-variant-numeric: tabular-nums; }
.graview-one-place-district [data-graview-district-tag-count] { color: var(--graview-ink-muted); font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
@media (max-width: 600px) { .graview-one-place-district { font-size: 0.5625rem; } .graview-one-place-district > button { padding: 0 4px 1px; letter-spacing: 0.04em; } }
`;

const zoomNowOf = (cam: SceneCamera): string => cam.zoom().toFixed(4);

/** The most lines drawn from a page's parts: past this a list's lines are a hatch. */
const MOST_LINES = 40;
/** What a district's "+n" is kept under among the picture's buildings: never a record's id. */
const REST_KEY = "\u0000rest:";
/** How long one level's move takes. A person who asked for less motion is cut straight there. */
export const MOVE_MS = 560;
/** A hand that has stopped zooming for this long has let go: the altitude settles to the nearest level. */
const LET_GO_MS = 240;
const NS = "http://www.w3.org/2000/svg";

const kindOfId = (id: string | null): string | null => (id === null ? null : id.startsWith("kind:") ? id.slice(5) : id.startsWith("aggregate:") && !id.includes("|") && !id.includes("+") ? id.slice(10) : null);
const boxOf = (rect: DOMRect): Box => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
const middle = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const keyOf = (where: PageWhere): string => (where.type === "record" ? `record:${where.id}` : where.type === "list" ? `list:${where.kind}` : where.type === "place" ? `place:${where.kinds.join(",")}` : where.type);
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const level = (live: Live) => Math.abs(live.s - 1) < 1e-4 && Math.abs(live.x) < 0.05 && Math.abs(live.y) < 0.05;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** The city as it is laid out, read when the camera is at a level: each district's tile and each building, in the picture's own pixels. */
interface World {
  readonly plots: ReadonlyMap<string, Box>;
  readonly buildings: ReadonlyMap<string, Box>;
}

/** What one line joins, in this frame. */
interface Drawn {
  readonly key: string;
  readonly from: Point;
  readonly to: Point;
  /** The line ends at the page's edge, the building under the page: the arrow points this way. */
  readonly under: Point | null;
  /** The curve's control point, out from the page's edge, inside the city's part. */
  readonly bend: Point;
  readonly on: string;
  readonly target: { readonly type: "record"; readonly id: string } | { readonly type: "list"; readonly kind: string };
  readonly label: string;
}

export function OnePlaceCity({ where, out, sheet, connected, boards, current, boardEls, boardLayer, fab, view, lessMotion, resolve, openRecord, openKind, onGround, motion, onAltitude }: OnePlaceCityProps) {
  const { store } = useGraview();
  const { view: seen, go } = useNavigation();
  const box = useRef<HTMLDivElement>(null);
  const overlay = useRef<SVGSVGElement>(null);
  const rings = useRef<HTMLDivElement>(null);
  const camera = useRef<SceneCamera | null>(null);

  /*
   * THE SCENE'S STOP: always the overview — its lens over the grid and its
   * shelf of districts are not drawn on this face — and nothing chosen on
   * it, so it draws no lines of its own from a choice and no outline of
   * one: this face draws the one set of lines. (A record its plot has no
   * room to draw — one of a "+415" — stands on its district.)
   */
  const wanted = useMemo<ViewState>(() => withOverview(EMPTY_VIEW, true), []);
  const asked = useRef("");
  /*
   * ONLY ONCE THE PAGE GOES OUT. While it is read, the view the provider
   * holds is the page's own (what the page's quick ask is about, say), and
   * the Scene is not drawn; out, the Scene's view is the overview; in
   * again, the page's own view comes back.
   */
  const kept = useRef<ViewState | null>(null);
  useEffect(() => {
    if (out) {
      kept.current ??= seen;
      const next = { ...wanted, ...(seen.overview && seen.pan ? { pan: seen.pan } : {}) };
      asked.current = toUrl(next);
      go(next);
      return;
    }
    if (kept.current) {
      const back = kept.current;
      kept.current = null;
      asked.current = toUrl(back);
      go(back);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [out]);

  /* The Scene's own way down — a record focused, a district gone into — is that place, in the panel. A pan is the camera's own and is kept. */
  const latestOut = useRef(out);
  latestOut.current = out;
  const latest = useRef({ openRecord, openKind });
  latest.current = { openRecord, openKind };
  useEffect(() => {
    // While the page is read the view is the page's own, and none of this is the Scene's.
    if (!latestOut.current || toUrl(seen) === asked.current) return;
    if (seen.overview && seen.focusId === null) return;
    const focus = seen.focusId;
    const back = { ...wanted, ...(seen.pan ? { pan: seen.pan } : {}) };
    asked.current = toUrl(back);
    go(back);
    const record = focus && store.graph.getNode(focus) ? focus : null;
    const kind = kindOfId(focus);
    // A record chosen in the city is its own page, beside the city: never a view of the Scene's own about it.
    if (record) latest.current.openRecord(record, PANEL);
    else if (kind) latest.current.openKind(kind, PANEL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  /*
   * THE PLAZA'S ROOM AT THE TOP: the views of no one kind, in rows, under
   * the bar. A kind's views find their own room beside its district
   * (`placeSigns`), clear of every name the face says there.
   */
  const plaza = useMemo(() => {
    const count = boards.filter((board) => board.where.type !== "record" && signKindOf(board.where) === null).length;
    return count === 0 ? 0 : Math.ceil(signRoom(count, boardWidthFor(view)).height + 12);
  }, [boards, view]);
  const sceneOptions = useMemo(() => ({ plaza: plaza + view.top }), [plaza, view.top]);
  /*
   * EACH DISTRICT'S NAME, said by this face: its kind's plural and how many
   * it holds, a size on the screen at every level, placed with the views so
   * nothing stands on it (`placeSigns`). The Scene's own names stand down
   * as these come up: they were laid out for the Scene's own fit, and at
   * this face's City most of them said nothing.
   */
  const violations = useViolations();
  const face = useOneFace();
  // A district's problems: each broken rule that names one of its records, once.
  const problemsOf = useMemo(() => {
    const out = new Map<string, number>();
    for (const violation of violations) {
      const kinds = new Set(violation.nodeIds.flatMap((id) => { const node = store.graph.getNode(id); return node ? [node.kind as string] : []; }));
      for (const kind of kinds) out.set(kind, (out.get(kind) ?? 0) + 1);
    }
    return out;
  }, [violations, store]);
  const districtNames = (store.schema.kinds as readonly string[]).map((kind) => ({ kind, plural: pluralOf(store, kind), count: store.graph.count(kind as never), problems: problemsOf.get(kind) ?? 0 }));
  const tagEls = useRef(new Map<string, HTMLElement>());
  const tagLayer = useRef<HTMLDivElement>(null);
  const state = useRef({ where, out, view, lessMotion, resolve, onAltitude, boards, current });
  /*
   * WHAT THE FRAME READS IS WHAT IS DRAWN. Written as the render ran, a
   * render React paused part way (a route drawn as a transition) handed the
   * frame a place whose page was not yet on the screen: the move began from
   * the new place's board while the old page still stood there, and the new
   * page came in a long task later, a leap inside the move. Written once the
   * render is committed, the frame moves only what is drawn.
   */
  useLayoutEffect(() => {
    state.current = { where, out, view, lessMotion, resolve, onAltitude, boards, current };
  });

  useEffect(() => {
    let frame = 0;
    let world: World = { plots: new Map(), buildings: new Map() };
    /** The camera between stops this frame, as painted — the last one seen while the view takes in a move just let go. */
    let painted: Live = LEVEL_LIVE;
    /** The level the camera rests at, and the altitude this frame. */
    let rest = PAGE;
    let altitude = PAGE;
    /** A move of the camera this face is making: from one camera to another, about the place. */
    let move: { from: Live; to: Live; fromAltitude: number; toAltitude: number; about: Point; start: number; foot: string; names: ReadonlyMap<string, Box>; slots: ReadonlyMap<string, Point>; done: () => void } | null = null;
    /** What stood at the foot when the City was last fitted: the legend opened or put away there fits it again. */
    let cityFoot = "";
    /** Where the camera stood when it came to rest at the City: a hand that moved it since keeps it. */
    let cityAt = "";
    /** A zoom the person's own hand made on the Scene, and when it last moved. */
    let handZoom = 0;
    /*
     * THE ZOOM THIS FACE LAST LEFT THE CAMERA AT. Only a zoom that differs
     * from it is a hand's: a new address at rest asks the camera for a
     * different zoom for the same level (a list's, not a record's), and read
     * against that level's zoom it looked like a pinch — the altitude was
     * read off it and settled to another level: the page came down to the
     * page after Back, or went back up to the city after a view was chosen.
     */
    let ownZoom: number | null = null;
    /** The panel as it was last frame, and whether a hand has moved it since the camera was written. */
    let lastPanel = "";
    /** When the city was last read, and what it was read for. */
    let lastRead = -Infinity;
    let lastReadKey = "";
    let resized = false;

    let handSince = 0;
    let lastPlace = "";
    let lastReported = "";
    /* When the camera was last written into the view: the Scene settles what is painted a beat after (its wheel's rule), so nothing new is painted until that beat has passed. */
    let committedAt = -Infinity;
    /** When the last frame was drawn: a move does not count a stall between two as time gone by. */
    let lastTick = 0;
    /*
     * THE PAGE CHOSEN IS DRAWN BEFORE IT MOVES. A new place's page is drawn
     * by its route — on a slow machine, in tasks long enough to stall the
     * frames after it — so a move to another place begins only once two
     * frames running have come quickly (or a while has gone by, whatever the
     * page is still doing): the page's drawing lands before the move, not
     * inside it.
     */
    let calmRun = 0;
    /** The page a board was last placed for at once: one with no place to stand is not placed again every frame. */
    let placedFor = "";
    let placeSeenAt = 0;
    let placeSeen = "";
    const drawnSince = (placeKey: string, now: number): boolean => {
      if (placeKey !== placeSeen) {
        placeSeen = placeKey;
        placeSeenAt = now;
        calmRun = 0;
      }
      return calmRun >= 2 || now - placeSeenAt > 700;
    };
    /*
     * A PLACE READ AGAIN AT REST IS GONE TO, NOT JUMPED TO. Once the camera
     * is written the Scene lays the city out again at that zoom, and a board
     * or a name placed from it may stand a little elsewhere: it goes there
     * over a moment, from where it was drawn.
     */
    let settle: { slots: ReadonlyMap<string, Point>; names: ReadonlyMap<string, Box>; start: number } | null = null;
    /** A camera written in the frame before: what stood where the move ended is carried into the new pixels as this frame begins, the view drawing them now. */
    let rebaseNext: Live | null = null;
    const SETTLE_MS = 300;
    /*
     * A name's box is carried whole: its size too, which differs between
     * levels (a size on the screen is many times wider in the picture far
     * out). Carried with the size it is going to, a box caught part way —
     * a move begun again when what stands at the foot changed — had its
     * middle moved by half the difference in one frame: a name leapt a
     * hundred pixels sideways.
     */
    const blend = <T extends Point>(from: T | undefined, to: T | undefined, t: number): T | undefined => {
      if (!to || !from) return to;
      const at = { ...to, x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      if ("width" in to && "width" in from && "height" in to && "height" in from) {
        const [a, b] = [from as unknown as Box, to as unknown as Box];
        return { ...at, width: a.width + (b.width - a.width) * t, height: a.height + (b.height - a.height) * t };
      }
      return at;
    };
    /** How far a move or a settle has gone, this frame: 1 when nothing is under way. */
    const goneAt = (now: number): { readonly t: number; readonly slots: ReadonlyMap<string, Point> | null; readonly names: ReadonlyMap<string, Box> | null } =>
      move ? { t: ease(clamp01((now - move.start) / MOVE_MS)), slots: move.slots, names: move.names } : settle && now - settle.start < SETTLE_MS ? { t: ease((now - settle.start) / SETTLE_MS), slots: settle.slots, names: settle.names } : { t: 1, slots: null, names: null };
    /** Every board and name where it is drawn this frame. */
    const drawnSlots = (now: number) => { const g = goneAt(now); return new Map([...slots].map(([key, at]) => [key, blend(g.slots?.get(key), at, g.t) ?? at] as const)); };
    const drawnNames = (now: number) => { const g = goneAt(now); return new Map([...names].map(([key, at]) => [key, blend(g.names?.get(key), at, g.t) ?? at] as const)); };
    const QUIET_MS = 220;
    const lines = new Map<string, { g: SVGGElement; path: SVGPathElement; dot: SVGCircleElement; arrow: SVGPathElement; ring: HTMLButtonElement }>();

    /** The picture as laid out now, read while nothing is painted over it. */
    const readWorld = (holder: HTMLElement): World => {
      const plots = new Map<string, Box>();
      for (const plot of holder.querySelectorAll<SVGGElement>("[data-graview-plot]")) {
        const kind = kindOfId(plot.getAttribute("data-graview-plot"));
        const tile = plot.querySelector(".graview-plot-tile") ?? plot;
        if (kind) plots.set(kind, boxOf(tile.getBoundingClientRect()));
      }
      const buildings = new Map<string, Box>();
      for (const building of holder.querySelectorAll("[data-graview-building]")) buildings.set(building.getAttribute("data-graview-building")!, boxOf(building.getBoundingClientRect()));
      /*
       * A district's "+n" — the buildings its plot has no room for — is words
       * in the picture, as a building's name is: stood clear of as a building
       * is, so no district's name runs into it ("+43PLANTS 10").
       */
      holder.querySelectorAll(".graview-village-rest").forEach((rest, i) => {
        const box = boxOf(rest.getBoundingClientRect());
        if (box.width > 0) buildings.set(`${REST_KEY}${i}`, box);
      });
      return { plots, buildings };
    };

    /** What a page stands on in the picture as it is laid out. */
    const placeIn = (at: PageWhere, w: World) => ({
      building: at.type === "record" ? (w.buildings.get(at.id) ?? null) : null,
      district: at.type === "record" || at.type === "list" ? (w.plots.get(at.kind) ?? null) : null,
      districts: at.type === "place" ? at.kinds.flatMap((kind) => (w.plots.has(kind) ? [w.plots.get(kind)!] : [])) : [],
      all: [...w.plots.values()],
    });
    /**
     * WHERE EACH VIEW AND EACH DISTRICT'S NAME STANDS (`placeSigns`): a view
     * of one kind on its district, its post coming down onto its ground, the
     * rest on the plaza at the city's back edge, a record's own page on its
     * building; each district's name beside it or under it. And the box
     * around all of it, which the city's camera fits.
     *
     * PLACED ON THE SCREEN AS THE CAMERA WILL HAVE IT. Names and boards are a
     * size on the screen, so the picture is carried through the camera the
     * level is headed for (`cam`, against the view's own zoom; none at rest)
     * and placed there, in the screen's own pixels, then carried back: the
     * place a move heads for and the place read again once it has arrived
     * are one answer, never a second that the boards then jump to.
     *
     * AND ONCE. The same city, the same window and the same views place the
     * same way: kept, and carried along a pan (a pan moves the camera, not
     * the city) until what is placed changes or the pan has gone far enough
     * to change what is in sight.
     */
    let slots = new Map<string, Point>();
    let posts = new Map<string, number>();
    let scales = new Map<string, number>();
    let names = new Map<string, Box>();
    /** The city and every view standing in it, as last read: what the city's camera fits. */
    let whole: Box | null = null;
    let kept: { key: string; origin: Point; placed: ReturnType<typeof placeSigns> } | null = null;
    /** A window too small for a board beside every district: a phone, or one turned on its side. */
    const cramped = () => state.current.view.width <= PHONE || state.current.view.height <= 600;
    const standAll = (w: World, zoomNow: number, cam: Live, bounds: Box | undefined, lvl: number) => {
      const view = state.current.view;
      const onScreen = (box: Box): Box => ({ x: box.x * cam.s + cam.x, y: box.y * cam.s + cam.y, width: box.width * cam.s, height: box.height * cam.s });
      const tiles = new Map([...w.plots].map(([kind, box]) => [kind, onScreen(box)] as const));
      const city = unionOf([...tiles.values()]);
      const origin = city ? { x: city.x, y: city.y } : { x: 0, y: 0 };
      // A size on the screen at most, and on a small window at least: what it says is read.
      const natural = boardWidthFor(view) * zoomNow * cam.s;
      const width = Math.max(Math.min(natural, boardWidthFor(view)), boardLeast(view));
      const k = width / Math.max(1e-6, natural);
      const sizes = new Map<string, { width: number; height: number }>();
      for (const [kind, el] of tagEls.current) {
        if (!tiles.has(kind) || el.offsetWidth === 0) continue;
        sizes.set(kind, { width: el.offsetWidth, height: el.offsetHeight });
      }
      const signs = state.current.boards.map((board) => ({
        key: board.key,
        kind: board.where.type === "record" ? board.where.kind : signKindOf(board.where),
        building: board.where.type === "record" && w.buildings.has(board.where.id) ? onScreen(w.buildings.get(board.where.id)!) : null,
      }));
      const reserved = footNow().now.map((box) => ({ x: box.x - 6, y: box.y - 6, width: box.width + 12, height: box.height + 12 }));
      const round = (n: number) => Math.round(n / 2) * 2;
      const rel = (box: Box) => [round(box.x - origin.x), round(box.y - origin.y), round(box.width), round(box.height)];
      const buildingsOnScreen = [...w.buildings.values()].map(onScreen);
      const restsOnScreen = [...w.buildings].filter(([key]) => key.startsWith(REST_KEY)).map(([, box]) => onScreen(box));
      // What decides the placing, the city's own lattice taken from where it stands: a pan of fewer than 24 pixels places nothing again.
      const key = JSON.stringify([lvl, view.width, view.height, round(width), [...tiles].map(([kind, box]) => [kind, ...rel(box)]), buildingsOnScreen.length, buildingsOnScreen.reduce((sum, box) => sum + rel(box)[0]! + rel(box)[1]! * 3, 0), [...sizes].map(([kind, size]) => [kind, size.width, size.height]), signs.map((one) => [one.key, one.kind, one.building ? rel(one.building) : null]), bounds ? [Math.round((bounds.x - origin.x) / 24), Math.round((bounds.y - origin.y) / 24), Math.round(bounds.width / 24), Math.round(bounds.height / 24)] : null, reserved.map((box) => rel(box).map((n) => Math.round(n / 12)))]);
      let placed: ReturnType<typeof placeSigns>;
      let shift = { x: 0, y: 0 };
      if (kept && kept.key === key) {
        placed = kept.placed;
        shift = { x: origin.x - kept.origin.x, y: origin.y - kept.origin.y };
      } else {
        placed = placeSigns({
          tiles,
          buildings: buildingsOnScreen,
          names: sizes,
          words: restsOnScreen,
          signs,
          board: { width, height: width / BOARD_ASPECT, post: SIGN_POST * zoomNow * cam.s * k, gap: SIGN_GAP * zoomNow * cam.s * k },
          ...(bounds ? { bounds } : {}),
          // Nor under what stands at the foot: the control, the legend over it and the timeline.
          reserved,
          // Beside the page on a small window a board too small to read, or with no clear place on its district, is not drawn: the bar reaches every view.
          // Beside a page a board with no clear place on its district stands nowhere: the City stands every view, on a small window as high over its district as it takes (the City pans there).
          dropCovered: lvl === PANEL,
          reach: lvl === CITY ? (cramped() ? 30 : 16) : 12,
          // On a small window a board is never drawn smaller than its words can be read.
          shrink: !cramped(),
          // Beside the page the plaza is behind the city: only the views that stand on a district stand there.
          plaza: lvl !== PANEL,
        });
        kept = { key, origin, placed };
      }
      // Back into the picture's own pixels, as the view lays it out now.
      const back = (p: Point): Point => ({ x: (p.x + shift.x - cam.x) / cam.s, y: (p.y + shift.y - cam.y) / cam.s });
      const backBox = (box: Box): Box => ({ ...back(box), width: box.width / cam.s, height: box.height / cam.s });
      const next = new Map([...placed.feet].map(([one, foot]) => [one, back(foot)] as const));
      // A record's page whose building is not drawn stands where its district is.
      for (const board of state.current.boards) {
        if (next.has(board.key) || board.where.type !== "record") continue;
        const at = footOf(board.where, placeIn(board.where, w));
        if (at) next.set(board.key, at);
      }
      slots = next;
      posts = new Map([...placed.posts].map(([one, length]) => [one, length / cam.s] as const));
      scales = new Map(placed.scales);
      names = new Map([...placed.names].map(([kind, box]) => [kind, backBox(box)] as const));
      whole = placed.whole ? backBox(placed.whole) : null;
    };

    /*
     * WHAT STANDS AT THE FOOT: the control, the legend over it when it is
     * open, and the timeline beside them — each its own rect, read in the
     * frame that uses it. `now` is where they are this frame (a phone's
     * control rides on the sheet at Nearby); `rest` is where they stand at
     * the window's foot, which is where they are at the City.
     */
    const footNow = (): { readonly now: readonly Box[]; readonly rest: readonly Box[]; readonly key: string } => {
      const holder = fab.current;
      if (!holder) return { now: [], rest: [], key: "" };
      const bottom = holder.getBoundingClientRect().bottom;
      const height = state.current.view.height;
      const now = [holder.querySelector("[data-graview-one-face-dock]"), holder.querySelector("[data-graview-past-slot] > *")].flatMap((el) => {
        const r = el?.getBoundingClientRect();
        return r && r.width > 0 && r.height > 0 ? [boxOf(r)] : [];
      });
      // At rest the region stands 16 pixels off the window's foot: each rect where it would be there.
      const rest = now.map((box) => ({ ...box, y: height - 16 - (bottom - box.y) }));
      // What changes the fit: the control and the legend over it (the first rect). The timeline's width follows the window's, and a resize refits on its own.
      const dock = rest[0];
      return { now, rest, key: dock ? `${Math.round(dock.x)},${Math.round(dock.y)},${Math.round(dock.width)},${Math.round(dock.height)}` : "" };
    };
    /** The part of the window the City is seen in, at rest there: under the bar, over what stands at the foot. */
    const cityShown = (): Box => {
      const view = state.current.view;
      const top = (view.top ?? 0) + 12;
      const foot = Math.min(view.height, ...footNow().rest.map((box) => box.y)) - 12;
      return { x: 12, y: top, width: view.width - 24, height: Math.max(1, foot - top) };
    };
    /** And the part it is seen in beside the page, at Nearby: left of the panel on a desk, over the sheet on a phone. */
    const nearbyShown = (): Box => {
      const view = state.current.view;
      const panel = panelBox(view);
      const top = (view.top ?? 0) + 8;
      // On a phone the control rides above the sheet at Nearby: the city is seen above both.
      if (view.width <= PHONE) return { x: 8, y: top, width: view.width - 16, height: Math.max(1, panel.y - footRoom() - 8 - top) };
      return { x: 8, y: top, width: Math.max(1, panel.x - 16), height: Math.max(1, view.height - 8 - top) };
    };
    /** What everything is placed inside, at a level: at the City on a small window, nothing — the City pans there rather than shrink its words past reading. */
    const shownAt = (lvl: number): Box | undefined => (lvl === CITY ? (cramped() ? undefined : cityShown()) : lvl === PANEL ? nearbyShown() : undefined);
    /** Placed for where a move ends, through the camera it ends at: the same answer as read again there. */
    const placeFor = (lvl: number, to: Live, zoomNow: number) => {
      if (lvl === PAGE) return;
      standAll(world, zoomNow, to, shownAt(lvl), lvl);
    };
    /** How much of the window above a phone's sheet the control and the legend keep, at Nearby. */
    const footRoom = (): number => {
      const dock = fab.current?.querySelector("[data-graview-one-face-dock]")?.getBoundingClientRect();
      return dock ? dock.height + 24 : 72;
    };

    /** The place the page stands on, in the picture. */
    const anchorIn = (at: PageWhere, w: World): Point | null =>
      anchorOf(at, {
        building: at.type === "record" ? (w.buildings.get(at.id) ?? null) : null,
        district: at.type === "record" || at.type === "list" ? (w.plots.get(at.kind) ?? null) : null,
        districts: at.type === "place" ? at.kinds.flatMap((kind) => (w.plots.has(kind) ? [w.plots.get(kind)!] : [])) : [],
        all: [...w.plots.values()],
      });

    /** The camera a level asks for, against the view's own: how much closer than now, and the place where that level aims it. */
    const cameraFor = (lvl: number, anchor: Point, zoomNow: number): Live => {
      const now = state.current;
      const zooms = levelZooms(now.where, now.view);
      const s = zooms[lvl]! / zoomNow;
      if (lvl === CITY) {
        /*
         * THE CITY AT ITS OWN FIT (zoom 1: the Scene's, with room kept under
         * each name for its views and at the top for the plaza), its middle
         * and the plaza above it in the middle of what the bar and the
         * control at the foot leave. Worked out once, before the move, and
         * held: the camera goes straight there and stops.
         */
        if (whole) {
          /*
           * The names are a size on the screen: at the City they take less of
           * the picture than where it was read. Placed again for the City's
           * own scale, and fitted again, until the two agree.
           */
          let fitted = fitBeside(whole, now.view, footNow().rest, 20, s);
          for (let again = 0; again < 2; again++) {
            standAll(world, zoomNow, fitted, undefined, CITY);
            if (!whole) break;
            fitted = fitBeside(whole, now.view, footNow().rest, 20, s);
          }
          if (!whole) return fitted;
          // Never past what the camera can be written at: a fit below its reach was painted, then put back up when written — an overshoot.
          const least = (camera.current?.range.min ?? 0) / zoomNow;
          if (fitted.s >= least) return fitted;
          /*
           * AS FAR OUT AS THE CAMERA GOES, AND EVERYTHING INSIDE WHAT IT SHOWS
           * from there: the city in the middle of the window's part for it,
           * and the names and views placed again inside that part — closer
           * together, rather than past the window's edge (a phone's City).
           */
          const city = unionOf([...world.plots.values()]) ?? whole;
          const area = cityShown();
          const at = cameraPutting(middle(city), middle(area), least);
          standAll(world, zoomNow, at, shownAt(CITY), CITY);
          return at;
        }
      }
      /*
       * THE HOME BESIDE THE CITY: the city framed in the part the page leaves
       * it — left of the panel on a desk, over the sheet on a phone — never
       * the whole window, where the districts nearest the page stood behind it.
       */
      if (lvl === PANEL && (now.where.type === "home" || now.where.type === "overview")) {
        const city = unionOf([...world.plots.values()]);
        if (city) {
          const shown = nearbyShown();
          return fitCamera(city, shown, 16, s);
        }
      }
      if (lvl === CITY || now.where.type === "home" || now.where.type === "overview") {
        const city = unionOf([...world.plots.values()]);
        const middleOfCity = city ? middle(city) : anchor;
        return cameraPutting(middleOfCity, aimAt(CITY, now.view), s);
      }
      return cameraPutting(anchor, aimAt(lvl === PAGE ? PANEL : lvl, now.view, footRoom()), s);
    };

    /** Start a move of the camera to a level. */
    /*
     * THE CAMERA WRITTEN, THE PICTURE'S PIXELS ARE NEW: the Scene lays the
     * city out again at the zoom written, and what stood where the move
     * ended — through the camera it ended at — stands there in the new
     * pixels: carried over at once, so the frame after the move draws every
     * board and name where the frame before did.
     */
    const rebase = (to: Live) => {
      const at = (p: Point): Point => project(to, p);
      const box = (b: Box): Box => ({ ...at(b), width: b.width * to.s, height: b.height * to.s });
      slots = new Map([...slots].map(([key, p]) => [key, at(p)] as const));
      posts = new Map([...posts].map(([key, length]) => [key, length * to.s] as const));
      names = new Map([...names].map(([key, b]) => [key, box(b)] as const));
      whole = whole ? box(whole) : null;
      settle = null;
      world = { plots: new Map([...world.plots].map(([key, b]) => [key, box(b)] as const)), buildings: new Map([...world.buildings].map(([key, b]) => [key, box(b)] as const)) };
    };
    const moveTo = (cam: SceneCamera, toLevel: number, anchor: Point, now: number) => {
      const from = painted;
      /*
       * A PAGE CHOSEN AT REST LEAVES FROM WHERE ITS BOARD STANDS THERE. A
       * building pressed at the City makes its record the page, and that page's
       * board was placed nowhere yet: it would have started from where it will
       * stand beside the page, forty pixels from the building pressed. Placed
       * first where the camera rests, so the move carries it from there.
       */
      // Where everything is drawn now is where it moves from: the page's own board, placed only now, joins them from where it stands at rest.
      const namesFrom = drawnNames(now);
      const slotsFrom = drawnSlots(now);
      const own = state.current.current;
      if (rest !== PAGE && !move && !slots.has(own) && level(painted)) {
        standAll(world, cam.zoom(), LEVEL_LIVE, shownAt(rest), rest);
        const at = slots.get(own);
        if (at) slotsFrom.set(own, at);
      }
      settle = null;
      const to = cameraFor(toLevel, anchor, cam.zoom());
      placeFor(toLevel, to, cam.zoom());
      const fromAltitude = altitude;
      if (state.current.lessMotion) {
        cam.liveTo(to);
        painted = to;
        altitude = toLevel;
        rest = toLevel;
        cityFoot = "";
        cam.commit();
        rebaseNext = to;
        committedAt = performance.now();
        ownZoom = cam.zoom();
        return;
      }
      move = {
        from,
        to,
        fromAltitude,
        toAltitude: toLevel,
        about: anchor,
        start: now,
        foot: footNow().key,
        names: namesFrom,
        slots: slotsFrom,
        done: () => {
          rest = toLevel;
          altitude = toLevel;
          cityFoot = "";
          cam.commit();
          rebaseNext = to;
          committedAt = performance.now();
          ownZoom = null;
        },
      };
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      /*
       * A STALL IS NOT A LEAP. A move is clocked by the wall, and a frame the
       * page could not draw (a chosen page's route drawn in one long task)
       * left the next to catch the whole stall up at once: the page leapt a
       * third of its way. A gap past 34 ms is taken out of the move's clock,
       * so the move slows through it rather than jumps.
       */
      if (lastTick > 0 && now - lastTick > 34) {
        // And a settle after a re-read the same way: on a slow machine it goes over as many frames as on a quick one.
        const lost = now - lastTick - 1000 / 60;
        if (move) move.start += lost;
        if (settle) settle.start += lost;
      }
      calmRun = lastTick > 0 && now - lastTick < 50 ? calmRun + 1 : 0;
      lastTick = now;
      if (rebaseNext) {
        rebase(rebaseNext);
        rebaseNext = null;
      }
      const holder = box.current;
      const plane = sheet.current;
      const cam = camera.current;
      if (!holder || !plane || !cam) return;
      const at = state.current;
      const asking = motion.current;

      /*
       * WHILE THE PAGE IS READ the Scene is not drawn at all: no room, no
       * scroll, no pointer, no keyboard. Asked out, it is drawn a frame
       * before anything moves, laid out, and the camera aimed out of sight
       * where stepping out begins; only then does the page move.
       */
      const drawn = at.out || rest !== PAGE || move !== null || asking.scrubbing || altitude > 0.001;
      if (!drawn) {
        if (holder.style.display !== "none") {
          holder.style.display = "none";
          holder.style.visibility = "hidden";
          plane.style.transform = "";
          plane.style.opacity = "";
          plane.style.borderRadius = "";
          draw([], 0);
        }
        return;
      }
      if (holder.style.display === "none") {
        holder.style.display = "block";
        return;
      }

      /* THE CAMERA AS IT IS: a move between stops painted now, or the view's own. */
      const live = cam.live();
      const between = !level(live);
      // Settling: a move written into the view not yet laid out, or written too recently for a new one to be painted safely.
      const settling = cam.moving() && !between;
      // Written too recently for a new move to be painted safely: the Scene settles what is painted a beat after a commit.
      const calm = now - committedAt >= QUIET_MS;
      if (between) painted = live;
      else if (!settling) {
        painted = LEVEL_LIVE;
        /*
         * THE CITY READ AGAIN ONLY WHEN IT MAY HAVE MOVED: a camera written,
         * the window, the views or what stands at the foot changed, or a while gone by (a record added
         * lays its district out again) — never every frame of a page at rest.
         */
        const readKey = `${at.view.width}x${at.view.height}|${at.boards.length}|${at.current}|${zoomNowOf(cam)}|${holder.querySelector(".graview-plots > g")?.getAttribute("transform") ?? ""}|${footNow().key}`;
        // An empty city is read again every frame until it has laid out; a pan moves the city's own transform, which is in the key.
        /*
         * NEVER PLACED AGAIN FOR WHERE A MOVE LEFT. The first frame of a move
         * paints the camera it starts from, which is a level's: read again
         * there (a slow machine's frame long past the half-second), the
         * level being left was placed again over the one headed for, without
         * the part beside the page it is placed inside — and the names, slid
         * along to stay in it, leapt sideways. Under way, the city is placed
         * only for where the move ends.
         */
        if (world.plots.size === 0 || (!move && (readKey !== lastReadKey || committedAt > lastRead || now - lastRead > 500))) {
          world = readWorld(holder);
          if (move) placeFor(move.toAltitude, move.to, cam.zoom());
          else {
            const drawnBefore = { slots: drawnSlots(now), names: drawnNames(now) };
            // At the City everything stands inside what the camera shows; the camera was fitted to it.
            standAll(world, cam.zoom(), LEVEL_LIVE, shownAt(rest), rest);
            settle = { ...drawnBefore, start: now };
          }
          lastRead = now;
          lastReadKey = readKey;
        }
      }
      /*
       * A NEW PAGE'S BOARD IS PLACED THE FRAME IT IS DRAWN. Chosen by Find, a
       * link or a building, the page is its own board until it moves — and
       * with no place yet it stood a frame on its district's middle, then on
       * its board: a jump before the move began. Placed at once, where the
       * camera rests.
       */
      if (world.plots.size > 0 && rest !== PAGE && !move && level(painted) && !slots.has(at.current) && placedFor !== at.current) {
        placedFor = at.current;
        standAll(world, cam.zoom(), LEVEL_LIVE, shownAt(rest), rest);
      }
      const anchor = world.plots.size > 0 ? anchorIn(at.where, world) : null;
      const zooms = levelZooms(at.where, at.view);
      const zoomNow = cam.zoom();
      const placeKey = `${keyOf(at.where)}|${at.view.width}x${at.view.height}`;

      /* At the page, the camera waits where stepping out begins: aimed for each place before anything moves. */
      let ready = rest !== PAGE || move !== null || asking.scrubbing;
      if (!ready && anchor && !settling) {
        // Painted, not written into the view: the move starts from it in this same frame, and only its end is written.
        const want = cameraFor(PAGE, anchor, zoomNow);
        if (Math.hypot(want.x - painted.x, want.y - painted.y) + Math.abs(want.s - painted.s) * 100 > 0.5) {
          cam.liveTo(want);
          painted = want;
        }
        ready = true;
      }

      /* WHAT IS ASKED: a level (Up, Down, a press), or a scrub of the altitude by a hand on the page. */
      if (ready && calm && anchor && asking.level !== null && !move && !settling && (placeKey === lastPlace || drawnSince(placeKey, now))) {
        const toLevel = asking.level;
        asking.level = null;
        if (toLevel !== rest || placeKey !== lastPlace) moveTo(cam, toLevel, anchor, now);
        lastPlace = placeKey;
      }
      if (ready && calm && anchor && asking.scrub !== 0 && !settling) {
        // As far as the hand has gone, but no more than a step a frame: a hand ahead of the camera is caught up with, never jumped to.
        const delta = Math.max(-0.12, Math.min(0.12, asking.scrub));
        asking.scrub -= delta;
        move = null;
        const target = Math.max(PAGE, Math.min(CITY, altitude + delta));
        // The cameras of the levels either side, the one rested at as it is (a pan the person made is kept).
        const lower = Math.floor(target);
        const upper = Math.min(CITY, lower + 1);
        const camOf = (lvl: number) => (lvl === rest ? cameraFor(rest, anchor, zoomNow) : cameraFor(lvl, anchor, zoomNow));
        const placed = cameraBetween(camOf(lower), camOf(upper), anchor, target - lower);
        cam.liveTo(placed);
        painted = placed;
        altitude = target;
        handSince = now;
        asking.scrubbing = true;
      }
      if (asking.scrubbing && !asking.held && now - handSince > LET_GO_MS && !settling && calm) {
        asking.scrubbing = false;
        if (anchor) moveTo(cam, restingLevel(altitude), anchor, now);
      }

      /* A MOVE UNDER WAY: the camera set from how far it has got. */
      if (move) {
        /*
         * WHAT STANDS AT THE FOOT CHANGED UNDER WAY — the legend opens as the
         * level it is shown at is headed for — and the camera's end is
         * worked out again from it, in this frame: the fit and the aim read
         * the rects as they are, never as they were when the move began.
         */
        const foot = footNow().key;
        if (foot !== move.foot) {
          // From where the camera is painted now, toward the new end: never a jump in the middle of the move.
          move.foot = foot;
          move.from = painted;
          move.fromAltitude = altitude;
          move.start = now;
          move.names = drawnNames(now);
          move.slots = drawnSlots(now);
          move.to = cameraFor(move.toAltitude, move.about, cam.zoom());
          placeFor(move.toAltitude, move.to, cam.zoom());
        }
        const t = clamp01((now - move.start) / MOVE_MS);
        const e = ease(t);
        const placed = cameraBetween(move.from, move.to, move.about, e);
        cam.liveTo(placed);
        painted = placed;
        altitude = move.fromAltitude + (move.toAltitude - move.fromAltitude) * e;
        if (t >= 1) {
          const finished = move;
          move = null;
          finished.done();
        }
      } else if (!asking.scrubbing && !settling) {
        /*
         * AT REST, OR THE PERSON'S OWN HAND ON THE SCENE: a pinch or a
         * ctrl+wheel over the city zooms its camera, and the altitude is
         * where that zoom is — every step of it. Let go, it settles to the
         * nearest level.
         */
        const effective = zoomNow * painted.s;
        const atZoom = altitudeAt(effective, zooms);
        // The zoom a move just written into the view settles a beat later: it is the face's own once it is still.
        if (ownZoom === null && calm) ownZoom = effective;
        /*
         * AT THE CITY THE CAMERA IS FREE. A pinch or a wheel there moves
         * closer to whatever is under the hand and back out — the views
         * standing there seen nearer — and never goes down into one: that is
         * choosing a view, or the control. The Scene keeps the camera within
         * its reach, so the city is never lost.
         */
        if (rest === CITY && !move) {
          altitude = CITY;
          /*
           * The legend opened or put away at the City: the city is fitted
           * again beside it — unless the person has moved the camera there
           * since it came to the City, which is theirs to keep.
           */
          const foot = footNow().key;
          const where = `${zoomNowOf(cam)}|${holder.querySelector(".graview-plots > g")?.getAttribute("transform") ?? ""}`;
          if (cityFoot === "") {
            // Recorded once the camera written at the City has settled.
            if (calm) {
              cityFoot = foot;
              cityAt = where;
            }
          } else if (foot !== cityFoot && calm && anchor) {
            cityFoot = foot;
            if (where === cityAt) moveTo(cam, CITY, anchor, now);
          }
          if (ownZoom !== null && Math.abs(Math.log(effective / ownZoom)) > 0.001) ownZoom = effective;
        } else if (rest !== PAGE && ownZoom !== null && Math.abs(Math.log(effective / ownZoom)) > 0.03) {
          if (handZoom !== effective) {
            handZoom = effective;
            handSince = now;
          }
          altitude = atZoom;
          if (now - handSince > LET_GO_MS && !asking.held && anchor && calm) moveTo(cam, restingLevel(atZoom), anchor, now);
        } else if (!(rest !== PAGE && placeKey !== lastPlace)) altitude = rest;
      }

      /*
       * THE PANEL SIZED BY HAND: the city beside it follows on the one
       * camera in the same frame — painted while the edge moves, written
       * into the view once when it is let go, never fitted again after.
       */
      const panelNow = `${panelBox(at.view).x},${panelBox(at.view).y},${panelBox(at.view).width}`;
      if (rest === PANEL && !move && !asking.scrubbing && anchor && !settling && panelNow !== lastPanel) {
        if (lastPanel !== "") {
          const want = cameraFor(PANEL, anchor, zoomNow);
          cam.liveTo(want);
          painted = want;
          resized = true;
        }
        lastPanel = panelNow;
      } else if (rest !== PANEL) lastPanel = "";
      if (resized && !asking.resizing && !move && rest === PANEL) {
        resized = false;
        cam.commit();
        committedAt = performance.now();
        ownZoom = null;
      }

      // Moving to another place at a level above the page: the camera flies there and stays at that level.
      if (rest !== PAGE && !move && !asking.scrubbing && anchor && placeKey !== lastPlace && !settling && calm && holder.querySelector("[data-graview-settled]") && drawnSince(placeKey, now)) {
        lastPlace = placeKey;
        // Chosen at the city — a Find result, a link — a page lands beside the city, as a view chosen there does.
        moveTo(cam, rest === CITY ? PANEL : rest, anchor, now);
      }

      /* THE PAGE: its box from the altitude, then — past the panel — moved and scaled into its board, as the camera has it this frame. */
      const a = altitude;
      // Out, or asked out and waiting for the camera to be aimed: the page is not back in until nothing asks it out.
      const away = a > 0.001 || move !== null || asking.scrubbing || (asking.level !== null && asking.level > PAGE) || asking.scrub !== 0;
      holder.style.visibility = away ? "visible" : "hidden";
      // Drawn but not yet moved out, or on its way between levels, the city takes no pointer and no keyboard, as the boards do not: a press lands where the move ends.
      const reachable = away && !move && !(rest === PAGE && !asking.scrubbing);
      if (holder.inert === reachable) holder.inert = !reachable;
      holder.style.opacity = String(a >= PANEL ? 1 : ease(clamp01(a * 1.3)));
      const phone = at.view.width <= PHONE;
      const panel = panelBox(at.view);
      const pageAt = pageBox(a, at.view);
      /* The boards' size this frame: their width in the picture, carried through the camera painted now. */
      // A size on the screen at most, as `standAll` placed them: at Nearby the camera is close.
      const boardWidth = Math.max(Math.min(boardWidthFor(at.view) * zoomNow * painted.s, boardWidthFor(at.view)), boardLeast(at.view));
      // The view the page goes into is as wide as it will be where the move ends: held, so the page shrinks one way only.
      const intoWidth = move && move.toAltitude >= CITY ? Math.max(Math.min(boardWidthFor(at.view) * zoomNow * move.to.s, boardWidthFor(at.view)), boardLeast(at.view)) : boardWidth;
      // Across a move, each board goes from where it stood to where it will stand, as the names do: the page's own with them, so a page chosen at the City leaves from the board pressed.
      const gone = goneAt(now);
      const carried = gone.t;
      const slotNow = (key: string): Point | undefined => blend(gone.slots?.get(key), slots.get(key), carried);
      const ownSlot = slotNow(at.current);
      const ownFoot = ownSlot ? project(painted, ownSlot) : anchor ? project(painted, anchor) : { x: at.view.width / 2, y: at.view.height / 2 };
      const standing = away && a > PANEL ? standingAt(a, panel, ownFoot, intoWidth) : null;
      if (away) {
        plane.style.left = `${pageAt.x.toFixed(2)}px`;
        plane.style.top = `${pageAt.y.toFixed(2)}px`;
        plane.style.width = `${pageAt.width.toFixed(2)}px`;
        plane.style.height = `${(standing ? standing.height : pageAt.height).toFixed(2)}px`;
        plane.style.transformOrigin = SHEET_ORIGIN;
        plane.style.transform = standing ? standingCss(standing) : "none";
        plane.style.opacity = "1";
        // As a board its corners are a board's, the camera's scale undone.
        plane.style.borderRadius = `${(a >= PANEL ? 10 / (standing?.scale ?? 1) : 10 * a).toFixed(2)}px`;
        if (standing && plane.scrollTop !== 0 && a > 1.9) plane.scrollTop = 0;
      } else {
        plane.style.transform = "";
        plane.style.opacity = "";
        plane.style.borderRadius = "";
      }
      /* The Connected list grows into the page as it becomes the panel, and folds away as the page becomes its board. */
      const grown = a <= PANEL ? clamp01((a - 0.55) / 0.45) : 1 - clamp01((a - PANEL) / 0.4);
      const list = connected.current;
      if (list) {
        const inner = list.firstElementChild as HTMLElement | null;
        list.style.height = `${((inner?.scrollHeight ?? 0) * ease(grown)).toFixed(2)}px`;
        list.style.opacity = String(ease(grown));
      }

      /*
       * THE BOARDS: each on its slot, through this frame's camera, at the
       * page's own size scaled — a size on the screen at most. The views
       * stand at Nearby as at the City; the page's own board is the page
       * itself, and is drawn only once the page has become it.
       */
      const shownBoards = a >= PANEL ? 1 : ease(clamp01((a - 0.6) / 0.4));
      const shownOwn = ease(clamp01((a - 1.25) / 0.6));
      const layer = boardLayer.current;
      if (layer) {
        const reachable = a > 0.95 && !move;
        if (layer.inert === reachable) layer.inert = !reachable;
        layer.setAttribute("data-graview-boards-shown", shownBoards.toFixed(3));
      }
      /*
       * NOTHING OF THE CITY'S UNDER THE BAR, THE PAGE OR THE LEVEL CONTROL —
       * after a hand's pan too, which carries what was placed with the city
       * until it is placed again: a board or a district's name that a pan
       * has brought under one of them is put away (unseen, unreached) until
       * it comes out again.
       */
      const dockRect = fab.current?.querySelector("[data-graview-one-face-dock]")?.getBoundingClientRect();
      const keepOut: Box[] = move
        ? []
        : [
            { x: 0, y: 0, width: at.view.width, height: at.view.top ?? 0 },
            ...(a > 0.5 && a < 1.5 ? [boxOf(plane.getBoundingClientRect())] : []),
            ...(dockRect && dockRect.width > 0 ? [boxOf(dockRect)] : []),
          ];
      const under = (b: Box) => keepOut.some((k) => Math.min(b.x + b.width, k.x + k.width) - Math.max(b.x, k.x) > 1 && Math.min(b.y + b.height, k.y + k.height) - Math.max(b.y, k.y) > 1);
      // Every board and name a press reaches this frame: a line's ring under or against one of them is not offered.
      pressable.length = 0;
      for (const [key, button] of boardEls.current ?? []) {
        /*
         * A board that had no place where the move began (its district out
         * of sight) comes up where it will stand as the move goes on, and one
         * that will have none goes down where it stood: never one frame from
         * nowhere to full.
         */
        const goal = slots.get(key);
        const was = gone.slots?.get(key);
        const arriving = gone.slots !== null && goal !== undefined && was === undefined ? carried : 1;
        const leaving = gone.slots !== null && goal === undefined && was !== undefined ? 1 - carried : 1;
        const slot = goal ? slotNow(key) : gone.slots && was ? was : undefined;
        const w = boardWidth * (scales.get(key) ?? 1);
        const h = w / BOARD_ASPECT;
        const footAt = slot ? project(painted, slot) : null;
        const covered = key !== at.current && footAt !== null && under({ x: footAt.x - w / 2, y: footAt.y - h, width: w, height: h });
        // Put away under the bar or the control by a pan (a phone's City is panned to reach it): said, for whoever reads the page.
        button.toggleAttribute("data-graview-under", covered);
        const seen = slot && !covered ? (key === at.current ? shownOwn : shownBoards) * arriving * leaving : 0;
        // Not seen, it is not reached: out of the keyboard's order and the pointer's, as a board going away is.
        const reached = seen > 0.5 && (key === at.current ? a > 1.5 : a > 0.95) && !move;
        if (button.inert === reached) button.inert = !reached;
        if (!slot || seen <= 0.001) {
          if (button.style.opacity !== "0") button.style.opacity = "0";
          button.style.pointerEvents = "none";
          continue;
        }
        const foot = footAt ?? project(painted, slot);
        button.style.left = `${(foot.x - w / 2).toFixed(2)}px`;
        button.style.top = `${(foot.y - h).toFixed(2)}px`;
        button.style.width = `${w.toFixed(2)}px`;
        button.style.height = `${h.toFixed(2)}px`;
        button.style.opacity = key === at.current ? (shownOwn > 0.001 ? "1" : "0") : seen.toFixed(3);
        button.style.setProperty("--graview-sign-post", `${((posts.get(key) ?? SIGN_POST * zoomNow) * painted.s).toFixed(2)}px`);
        button.style.pointerEvents = reached ? "auto" : "none";
        if (reached) pressable.push({ x: foot.x - w / 2, y: foot.y - h, width: w, height: h });
        const face = button.firstElementChild as HTMLElement | null;
        if (face) face.style.transform = `scale(${(w / boardFaceWidth(at.view)).toFixed(5)})`;
      }
      /*
       * THE DISTRICTS' NAMES come up with the views, and the Scene's own
       * names stand down as they do: one name a district at every altitude.
       * Each is placed through this frame's camera, a size on the screen.
       */
      const shownNames = a >= PANEL ? 1 : ease(clamp01((a - 0.6) / 0.4));
      holder.style.setProperty("--graview-one-face-plates", (1 - shownNames).toFixed(3));
      holder.toggleAttribute("data-graview-names-said", shownNames > 0.999);
      // Across a move, each name goes from where it stood to where it will stand, as far as the camera has gone: never a jump; one with nowhere to come from comes up where it stands, one going away goes down where it stood.
      const along = gone.t;
      for (const [kind, el] of tagEls.current) {
        const goal = names.get(kind);
        const from = gone.names?.get(kind);
        const was = from ?? goal;
        const fade = gone.names && goal && !from ? along : gone.names && !goal && from ? 1 - along : 1;
        const place = goal ?? (gone.names ? from : undefined);
        const seen = place ? shownNames * fade : 0;
        const reached = seen > 0.95 && !move && a > 0.95;
        if (el.inert === reached) el.inert = !reached;
        if (!place || !was || seen <= 0.001) {
          if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";
        el.style.opacity = seen.toFixed(3);
        /*
         * The name's middle goes from where it was to where it will be. Its box
         * at the end of a move is the size it is in the picture there — a size
         * on the screen taken through a camera much further out is many times
         * wider in the picture — so the middle is carried, never the left edge
         * with the width at the end: that put a name a hundred pixels off in
         * the first frame of a move to the City.
         */
        const top = project(painted, { x: was.x + was.width / 2 + (place.x + place.width / 2 - (was.x + was.width / 2)) * along, y: was.y + (place.y - was.y) * along });
        el.style.left = `${(top.x - el.offsetWidth / 2).toFixed(2)}px`;
        el.style.top = `${top.y.toFixed(2)}px`;
        const covered = under({ x: top.x - el.offsetWidth / 2, y: top.y, width: el.offsetWidth, height: el.offsetHeight });
        el.toggleAttribute("data-graview-under", covered);
        if (!covered && reached) pressable.push({ x: top.x - el.offsetWidth / 2, y: top.y, width: el.offsetWidth, height: el.offsetHeight });
        if (covered) {
          el.style.visibility = "hidden";
          el.inert = true;
        }
      }
      /* The button that moves a level: on a phone it rides above the sheet while the page is one, and comes back to the foot at the city. */
      const button = fab.current;
      if (button) {
        const lift = phone ? (a <= PANEL ? ease(a) : 1 - ease(clamp01(a - PANEL))) : 0;
        button.style.bottom = `${(16 + lift * Math.max(0, at.view.height - panel.y + 10 - 16)).toFixed(2)}px`;
      }

      /* THE LINES, from this frame's numbers. */
      const shown = a <= PANEL ? ease(clamp01((a - 0.6) / 0.4)) : 1 - ease(clamp01((a - PANEL) / 0.45));
      const found: Drawn[] = [];
      if (shown > 0.01) {
        const pageRect = boxOf(plane.getBoundingClientRect());
        const controlRect = fab.current?.querySelector('[data-graview-one-face-dock]')?.getBoundingClientRect();
        const area = cityArea(pageRect, at.view, controlRect ? boxOf(controlRect) : null, phone);
        // Everything that stands at the foot this frame, each its own rect: no line runs under any of them.
        const reserved = footNow().now;
        const subjectId = at.where.type === "record" ? at.where.id : null;
        const taken = new Set<string>();
        // A district the Scene draws in this frame: one it has let go of off the window has no end to give.
        const drawnPlot = (kind: string) => holder.querySelector(`[data-graview-plot="kind:${CSS.escape(kind)}"]`) !== null;
        const endOf = (target: Drawn["target"]): { at: Point; on: string } | null => {
          if (target.type === "record") {
            // Still standing in this frame (a plot shows fewer buildings as it changes): its place in the picture; else its district.
            const building = holder.querySelector(`[data-graview-building="${CSS.escape(target.id)}"]`) ? world.buildings.get(target.id) : undefined;
            if (building) return { at: project(painted, { x: building.x + building.width / 2, y: building.y + building.height / 2 }), on: "building" };
            const kind = store.graph.getNode(target.id)?.kind as string | undefined;
            const district = kind && drawnPlot(kind) ? world.plots.get(kind) : undefined;
            return district ? { at: project(painted, middle(district)), on: `kind:${kind}` } : null;
          }
          const district = drawnPlot(target.kind) ? world.plots.get(target.kind) : undefined;
          return district ? { at: project(painted, middle(district)), on: `kind:${target.kind}` } : null;
        };
        const labelFor = (target: Drawn["target"]) => {
          if (target.type !== "record") return target.kind;
          const node = store.graph.getNode(target.id);
          return node ? labelOf(store.schema.tryDefinition(node.kind as string), node as never) : target.id;
        };
        // The page's own parts first — a link to a record's page, a row that names one — then the Connected rows for what the page does not show.
        const parts = [...plane.querySelectorAll<HTMLElement>(`a[href], ${RECORD_PARTS}`)].sort((x, y) => Number(x.closest("[data-graview-connected]") !== null) - Number(y.closest("[data-graview-connected]") !== null));
        for (const element of parts) {
          if (found.length >= MOST_LINES) break;
          if (element.closest("nav, header, [role=navigation], [role=banner]")) continue;
          const named = recordShownBy(element);
          let target: Drawn["target"] | null = null;
          if (named !== null && store.graph.getNode(named)) target = { type: "record", id: named };
          else if (element instanceof HTMLAnchorElement && element.href) {
            const resolved = at.resolve(element.pathname);
            target = resolved?.type === "record" ? { type: "record", id: resolved.id } : resolved?.type === "list" ? { type: "list", kind: resolved.kind } : null;
          }
          if (!target || (target.type === "record" && target.id === subjectId)) continue;
          const key = target.type === "record" ? target.id : `kind:${target.kind}`;
          if (taken.has(key)) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) continue;
          const part = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          // Only what is in sight on the page: a part scrolled past, or under the page's own edge, draws none.
          const port = element.closest("[data-graview-one-place]");
          const visible = port ? port.getBoundingClientRect() : null;
          if (!visible || part.x < visible.left || part.x > visible.right || part.y < visible.top || part.y > visible.bottom) continue;
          // The line leaves the page's edge that faces the city, level with the part: never across the page's words.
          const from = leaveFrom(part, pageRect, phone);
          const end = endOf(target);
          if (!end) continue;
          taken.add(key);
          const route = routeLine(from, end.at, area, phone, reserved);
          if (!route) continue;
          found.push({ key, from: route.from, to: route.to, bend: route.bend, under: route.toward, on: end.on, target, label: labelFor(target) });
        }
      }
      draw(found, shown);

      /* Told what the frame says, when it changes: the level rested at or headed for, and whether the page is out of the window. */
      const said = `${move ? move.toAltitude : restingLevel(a)}|${away ? 1 : 0}|${move || asking.scrubbing ? 1 : 0}`;
      if (said !== lastReported) {
        lastReported = said;
        at.onAltitude({ level: move ? move.toAltitude : restingLevel(a), away, moving: move !== null || asking.scrubbing });
      }
      /* The record the page is about, marked where it stands: the one building that is "you are here". */
      const hereId = at.where.type === "record" ? at.where.id : null;
      const marked = holder.querySelector("[data-graview-here]");
      if (marked && marked.getAttribute("data-graview-building") !== hereId) marked.removeAttribute("data-graview-here");
      if (hereId && (!marked || marked.getAttribute("data-graview-building") !== hereId)) holder.querySelector(`[data-graview-building="${CSS.escape(hereId)}"]`)?.setAttribute("data-graview-here", "");
      holder.setAttribute("data-graview-altitude-now", a.toFixed(3));
      // The camera's zoom as painted in this frame, for a reader of the move (the harness holds it to going one way).
      holder.setAttribute("data-graview-camera-zoom", (zoomNow * painted.s).toFixed(4));
    };

    /*
     * A RING IS NEVER UNDER A BOARD OR A NAME, NOR AGAINST ONE: a line's end
     * that a board or a district's name stands over (or within a fingertip
     * of) offers no ring of its own — a press there landed on the board, and
     * one beside it was a small target crowded by a larger one. The line
     * still ends there; the board or the name is what is pressed.
     */
    const pressable: Box[] = [];
    const besidePressable = (to: Point): boolean => pressable.some((b) => to.x > b.x - 20 && to.x < b.x + b.width + 20 && to.y > b.y - 20 && to.y < b.y + b.height + 20);
    /* The overlay, written in the frame it is measured in: no React state per frame. */
    const draw = (found: readonly Drawn[], opacity: number) => {
      const control = fab.current?.querySelector('[data-graview-one-face-dock]')?.getBoundingClientRect() ?? null;
      const svg = overlay.current;
      const ringLayer = rings.current;
      if (!svg || !ringLayer) return;
      svg.style.opacity = String(opacity);
      ringLayer.style.opacity = String(opacity);
      // No lines, no group of their ends: nothing of it outside the page's landmarks while the page is read.
      ringLayer.hidden = found.length === 0;
      const keep = new Set(found.map((line) => line.key));
      for (const [key, drawn] of lines) {
        if (keep.has(key)) continue;
        drawn.g.remove();
        drawn.ring.remove();
        lines.delete(key);
      }
      /* One marker where several lines end together: the first one's, the rest drawn without a ring of their own. */
      const ringsAt: Point[] = [];
      for (const line of found) {
        let drawn = lines.get(line.key);
        if (!drawn) {
          const g = document.createElementNS(NS, "g");
          const path = document.createElementNS(NS, "path");
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "var(--graview-accent)");
          path.setAttribute("stroke-width", "1.5");
          path.setAttribute("stroke-opacity", "0.8");
          path.setAttribute("stroke-linecap", "round");
          const dot = document.createElementNS(NS, "circle");
          dot.setAttribute("r", "2.5");
          dot.setAttribute("fill", "var(--graview-accent)");
          const arrow = document.createElementNS(NS, "path");
          arrow.setAttribute("fill", "var(--graview-accent)");
          g.append(path, dot, arrow);
          svg.append(g);
          const ring = document.createElement("button");
          ring.type = "button";
          ring.setAttribute("data-testid", "one-place-ring");
          ring.style.cssText = "position:fixed;width:16px;height:16px;padding:0;border-radius:8px;border:2px solid var(--graview-accent);background:color-mix(in srgb, var(--graview-accent) 18%, transparent);cursor:pointer;";
          const target = line.target;
          ring.addEventListener("click", () => (target.type === "record" ? latest.current.openRecord(target.id, PANEL) : latest.current.openKind(target.kind, PANEL)));
          ringLayer.append(ring);
          drawn = { g, path, dot, arrow, ring };
          lines.set(line.key, drawn);
        }
        const { from, to } = line;
        const bend = line.bend;
        drawn.g.setAttribute("data-graview-line", line.key);
        drawn.g.setAttribute("data-graview-line-on", line.on);
        drawn.g.toggleAttribute("data-graview-line-under", line.under !== null);
        drawn.g.setAttribute("data-graview-line-from", `${from.x.toFixed(2)},${from.y.toFixed(2)}`);
        drawn.g.setAttribute("data-graview-line-to", `${to.x.toFixed(2)},${to.y.toFixed(2)}`);
        drawn.g.setAttribute("data-graview-line-bend", `${bend.x.toFixed(2)},${bend.y.toFixed(2)}`);
        if (line.under) drawn.g.setAttribute("data-graview-line-toward", `${line.under.x.toFixed(2)},${line.under.y.toFixed(2)}`);
        else drawn.g.removeAttribute("data-graview-line-toward");
        drawn.path.setAttribute("d", `M${from.x.toFixed(2)},${from.y.toFixed(2)} Q${bend.x.toFixed(2)},${bend.y.toFixed(2)} ${to.x.toFixed(2)},${to.y.toFixed(2)}`);
        drawn.dot.setAttribute("cx", from.x.toFixed(2));
        drawn.dot.setAttribute("cy", from.y.toFixed(2));
        if (line.under) {
          // An arrow at the page's edge, pointing on toward the building under the page.
          const angle = Math.atan2(line.under.y - to.y, line.under.x - to.x);
          const tip = { x: to.x + Math.cos(angle) * 7, y: to.y + Math.sin(angle) * 7 };
          const left = { x: to.x + Math.cos(angle + 2.4) * 6, y: to.y + Math.sin(angle + 2.4) * 6 };
          const right = { x: to.x + Math.cos(angle - 2.4) * 6, y: to.y + Math.sin(angle - 2.4) * 6 };
          drawn.arrow.setAttribute("d", `M${tip.x.toFixed(2)},${tip.y.toFixed(2)} L${left.x.toFixed(2)},${left.y.toFixed(2)} L${right.x.toFixed(2)},${right.y.toFixed(2)} Z`);
          // The marker toward a building out of sight is the way to it: its name said, a press flies there.
          const crowded = ringsAt.some((p) => Math.hypot(p.x - to.x, p.y - to.y) < 28) || besidePressable(to);
          drawn.ring.style.display = crowded ? "none" : "";
          if (!crowded) ringsAt.push(to);
          drawn.ring.style.left = `${(to.x - 8).toFixed(2)}px`;
          drawn.ring.style.top = `${(to.y - 8).toFixed(2)}px`;
        } else {
          drawn.arrow.setAttribute("d", "");
          // An end under the bar, or under the control at the foot, is not offered: they stand over it.
          const under = control && to.x > control.left - 10 && to.x < control.right + 10 && to.y > control.top - 10 && to.y < control.bottom + 10;
          const crowded = ringsAt.some((p) => Math.hypot(p.x - to.x, p.y - to.y) < 28) || besidePressable(to);
          drawn.ring.style.display = to.y < (state.current.view.top ?? 0) + 8 || under || crowded ? "none" : "";
          if (!crowded) ringsAt.push(to);
          drawn.ring.style.left = `${(to.x - 8).toFixed(2)}px`;
          drawn.ring.style.top = `${(to.y - 8).toFixed(2)}px`;
        }
        drawn.ring.setAttribute("data-graview-to", line.target.type === "record" ? line.target.id : `kind:${line.target.kind}`);
        drawn.ring.setAttribute("aria-label", line.target.type === "record" ? `Open ${line.label}` : `Open the ${line.label} list`);
        drawn.ring.title = line.label;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      for (const drawn of lines.values()) {
        drawn.g.remove();
        drawn.ring.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * A HAND ON A SIGN MOVES THE CITY. The boards, the districts' names and
   * their chips, and the rings at the lines' ends stand over the city in a
   * layer of their own, so a drag, a wheel or a pinch that began on one of
   * them reached nothing: the city stalled under the pointer. Begun there, a
   * drag past a few pixels pans the city's own camera by as far as the hand
   * goes (and the press that began it opens nothing), two fingers zoom it
   * about their middle, and the wheel pans or, with ctrl, zooms it — as over
   * open ground. A press that does not move still opens what it is on.
   */
  useEffect(() => {
    const layers = [boardLayer.current, tagLayer.current, rings.current].filter((el): el is HTMLDivElement => el !== null);
    const DRAG = 6;
    const down = new Map<number, { x: number; y: number }>();
    let dragging = false;
    let pinchFrom: number | null = null;
    let swallow = false;
    const spread = () => {
      const [a, b] = [...down.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      down.set(event.pointerId, { x: event.clientX, y: event.clientY });
      dragging = false;
      pinchFrom = down.size === 2 ? spread() : null;
    };
    const onMove = (event: PointerEvent) => {
      const was = down.get(event.pointerId);
      const cam = camera.current;
      if (!was || !cam) return;
      const dx = event.clientX - was.x;
      const dy = event.clientY - was.y;
      if (down.size >= 2) {
        down.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const now = spread();
        if (pinchFrom && now > 0) {
          const [a, b] = [...down.values()];
          cam.zoomTo(cam.zoom() * (now / pinchFrom), (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
          pinchFrom = now;
          dragging = true;
        }
        return;
      }
      if (!dragging && Math.hypot(dx, dy) < DRAG) return;
      if (!dragging) {
        dragging = true;
        try {
          (event.target as Element | null)?.setPointerCapture?.(event.pointerId);
        } catch {
          // A pointer the page did not see go down keeps no capture; the moves still come here.
        }
      }
      cam.panBy(dx, dy);
      down.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const onUp = (event: PointerEvent) => {
      if (!down.has(event.pointerId)) return;
      down.delete(event.pointerId);
      if (dragging) swallow = true;
      if (down.size === 0) {
        dragging = false;
        pinchFrom = null;
      }
    };
    // The press that ended a drag opens nothing.
    const onClick = (event: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onWheel = (event: WheelEvent) => {
      const cam = camera.current;
      if (!cam) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      if (event.ctrlKey || event.metaKey) cam.zoomTo(cam.zoom() * Math.exp(-event.deltaY * unit * 0.01), event.clientX, event.clientY);
      else cam.panBy(-event.deltaX * unit, -event.deltaY * unit);
    };
    for (const layer of layers) {
      layer.addEventListener("pointerdown", onDown, true);
      layer.addEventListener("pointermove", onMove, true);
      layer.addEventListener("pointerup", onUp, true);
      layer.addEventListener("pointercancel", onUp, true);
      layer.addEventListener("click", onClick, true);
      layer.addEventListener("wheel", onWheel, { passive: false });
    }
    return () => {
      for (const layer of layers) {
        layer.removeEventListener("pointerdown", onDown, true);
        layer.removeEventListener("pointermove", onMove, true);
        layer.removeEventListener("pointerup", onUp, true);
        layer.removeEventListener("pointercancel", onUp, true);
        layer.removeEventListener("click", onClick, true);
        layer.removeEventListener("wheel", onWheel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * A building pressed, above the page: its record, in the panel, the camera
   * flying to it. The Scene's blocks take no press of their own (their tile
   * does, for the district), so the building is found by where each stands.
   * The end of a drag is the camera's, not a press.
   */
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const pressed = (event: React.MouseEvent) => {
    const from = downAt.current;
    if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > 6) return;
    let id: string | null = null;
    let front = -Infinity;
    for (const building of box.current?.querySelectorAll("[data-graview-building]") ?? []) {
      const r = building.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) continue;
      if (r.bottom > front) {
        front = r.bottom;
        id = building.getAttribute("data-graview-building");
      }
    }
    if (!id || !store.graph.getNode(id)) {
      // Bare ground, or a district's own tile, which the Scene takes: at the city, no view is chosen any more.
      if (!(event.target as Element | null)?.closest?.("[data-graview-plot], .graview-kind-card, button, a")) onGround();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    // A building is a record: its own page, beside the city, the camera coming down to it.
    openRecord(id, PANEL);
  };

  return (
    <>
      <div
        ref={box}
        data-testid="one-place-city"
        onPointerDownCapture={(event) => {
          downAt.current = { x: event.clientX, y: event.clientY };
        }}
        onClickCapture={pressed}
        /*
         * While the page is read the city is laid out, out of sight, so the
         * first frame out has it to move: no pointer, no keyboard, no room
         * in the page — and what of it reaches past the window is inside a
         * box that scrolls, as a phone's sideways row would be.
         */
        style={{ position: "fixed", inset: 0, zIndex: ONE_FACE_LAYERS.city, display: "none", visibility: "hidden", overflow: "hidden", containerType: "size" }}
      >
        {/* One set of lines on this face: nothing is chosen on the Scene, so it draws no lines of its own from a choice and no outline of one. */}
        {/* The Scene's own zoom and its signs past the edge are not this face's: the control at the foot and the camera are. */}
        <style>{CITY_CSS}</style>
        <Scene renderer="dom" blur={false} animate={false} camera={camera} options={sceneOptions} style={{ width: "100%", height: "100%" }} />
      </div>
      <svg ref={overlay} aria-hidden="true" data-testid="one-place-lines" width={view.width} height={view.height} style={{ position: "fixed", left: 0, top: 0, zIndex: ONE_FACE_LAYERS.marks, pointerEvents: "none", overflow: "visible", opacity: 0 }} />
      {/* Each line's end, a ring the keyboard and the pointer reach: that record, in the panel. */}
      <div ref={rings} hidden role="group" aria-label="What this page shows, in the city" style={{ position: "fixed", left: 0, top: 0, width: 0, height: 0, zIndex: ONE_FACE_LAYERS.marks, opacity: 0 }} />
      {/*
        * EACH DISTRICT'S NAME, AND ITS OWN CONTROLS: the name opens the
        * district's list beside the city; its problems, where it has any,
        * are a chip beside it that opens them — what the Scene's district
        * card offered, said by this face where it stands.
        */}
      <div ref={tagLayer} role="group" aria-label="The districts" data-testid="one-place-names" style={{ position: "fixed", left: 0, top: 0, width: 0, height: 0, zIndex: ONE_FACE_LAYERS.marks }}>
        {districtNames.map((one) => (
          <span
            key={one.kind}
            ref={(el) => {
              if (el) tagEls.current.set(one.kind, el);
              else tagEls.current.delete(one.kind);
            }}
            data-graview-district-tag={one.kind}
            className="graview-one-place-district"
            style={{ visibility: "hidden" }}
          >
            <button type="button" data-graview-district-open={one.kind} aria-label={`${one.plural}, ${one.count === 0 ? "none yet" : one.count.toLocaleString()}: open the list`} title={`${one.plural}, ${one.count}`} onClick={() => openKind(one.kind, PANEL)}>
              <span data-graview-district-tag-name="">{one.plural}</span> <span data-graview-district-tag-count="">{one.count === 0 ? "none yet" : one.count.toLocaleString()}</span>
            </button>
            {one.problems > 0 ? (
              <button type="button" data-graview-district-problems={one.kind} aria-label={`${one.problems} ${one.problems === 1 ? "problem" : "problems"} in ${one.plural}`} title={`${one.problems} ${one.problems === 1 ? "problem" : "problems"} in ${one.plural}: press to see them`} onClick={() => face?.openPath("/problems", PANEL)}>
                ⚠ {one.problems}
              </button>
            ) : null}
          </span>
        ))}
      </div>
    </>
  );
}

export type { PageWhere };

/** The one kind a view stands on: a kind's list, or a view of one kind; null for the home, a view of several kinds and the connections. */
export function signKindOf(where: PageWhere): string | null {
  if (where.type === "list") return where.kind;
  if (where.type === "place" && where.kinds.length === 1) return where.kinds[0]!;
  return null;
}
