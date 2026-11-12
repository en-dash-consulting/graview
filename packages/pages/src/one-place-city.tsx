import { labelOf, ONE_FACE_LAYERS } from "@graview/core";
import { EMPTY_VIEW, toUrl, withOverview, type ViewState } from "@graview/layout/view";
import { Scene, type SceneCamera } from "@graview/react";
import { useGraview, useNavigation } from "@graview/react/provider";
import { useEffect, useMemo, useRef } from "react";
import { aimAt, altitudeAt, anchorOf, BOARD_ASPECT, boardWidthFor, fitBeside, SIGN_GAP, SIGN_POST, signFeet, signRoom, cameraBetween, cameraPutting, CITY, cityArea, footOf, leaveFrom, routeLine, LEVEL_LIVE, levelZooms, PAGE, pageBox, PANEL, panelBox, PHONE, project, restingLevel, SHEET_ORIGIN, standingAt, standingCss, unionOf, type Box, type Live, type PageWhere, type Point } from "./one-place-geometry.js";
import type { OnePlaceCityProps } from "./one-place.js";

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
`;

const zoomNowOf = (cam: SceneCamera): string => cam.zoom().toFixed(4);

/** The most lines drawn from a page's parts: past this a list's lines are a hatch. */
const MOST_LINES = 40;
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
  /** Each district's name, where it is drawn under its plot; none where it stands above or beside it, or says nothing. */
  readonly plates: ReadonlyMap<string, Box>;
  /** Where each district's name stands, said or not: the room its views hold is laid out under it. */
  readonly named: ReadonlyMap<string, Box>;
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
   * THE GROUND KEPT FOR THE VIEWS: the city is laid out with room under each
   * district's name for the views of its kind, so they stand beside it and
   * no other district's name is placed on them (`LayoutOptions.standing`).
   */
  const roomKey = useMemo(() => {
    const counts = new Map<string, number>();
    for (const board of boards) {
      const kind = board.where.type === "record" ? null : signKindOf(board.where);
      if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    const width = boardWidthFor(view);
    return JSON.stringify([...counts].sort().map(([kind, count]) => [kind, signRoom(count, width)]));
  }, [boards, view]);
  /* And the plaza's room at the top: the views of no one kind, in rows, under the bar. */
  const plaza = useMemo(() => {
    const count = boards.filter((board) => board.where.type !== "record" && signKindOf(board.where) === null).length;
    return count === 0 ? 0 : Math.ceil(signRoom(count, boardWidthFor(view)).height + 12);
  }, [boards, view]);
  const sceneOptions = useMemo(() => ({ standing: Object.fromEntries(JSON.parse(roomKey) as [string, { width: number; height: number }][]), plaza: plaza + view.top }), [roomKey, plaza, view.top]);
  const state = useRef({ where, out, view, lessMotion, resolve, onAltitude, boards, current });
  state.current = { where, out, view, lessMotion, resolve, onAltitude, boards, current };

  useEffect(() => {
    let frame = 0;
    let world: World = { plots: new Map(), buildings: new Map(), plates: new Map(), named: new Map() };
    /** The camera between stops this frame, as painted — the last one seen while the view takes in a move just let go. */
    let painted: Live = LEVEL_LIVE;
    /** The level the camera rests at, and the altitude this frame. */
    let rest = PAGE;
    let altitude = PAGE;
    /** A move of the camera this face is making: from one camera to another, about the place. */
    let move: { from: Live; to: Live; fromAltitude: number; toAltitude: number; about: Point; start: number; foot: string; done: () => void } | null = null;
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
      const plates = new Map<string, Box>();
      const named = new Map<string, Box>();
      for (const face of holder.querySelectorAll<HTMLElement>(".graview-kind-face[data-graview-nameplate]")) {
        const said = face.getAttribute("data-graview-nameplate") ?? "none";
        const kind = kindOfId(face.closest("[data-graview-view]")?.getAttribute("data-graview-view") ?? null);
        if (!kind || said.endsWith("above") || said.endsWith("aside")) continue;
        const box = boxOf(face.getBoundingClientRect());
        if (box.width > 0 && box.height > 0) named.set(kind, box);
        if (said !== "none") plates.set(kind, box);
      }
      return { plots, buildings, plates, named };
    };

    /** What a page stands on in the picture as it is laid out. */
    const placeIn = (at: PageWhere, w: World) => ({
      building: at.type === "record" ? (w.buildings.get(at.id) ?? null) : null,
      district: at.type === "record" || at.type === "list" ? (w.plots.get(at.kind) ?? null) : null,
      districts: at.type === "place" ? at.kinds.flatMap((kind) => (w.plots.has(kind) ? [w.plots.get(kind)!] : [])) : [],
      all: [...w.plots.values()],
    });
    /**
     * WHERE EACH VIEW STANDS, in the picture as laid out: worked out again
     * whenever the picture is read. A view of one kind in the room its
     * district keeps under its name; the rest on the plaza at the city's
     * back edge; a record's own page on its building's roof. And the box
     * around all of it, which the city's camera fits.
     */
    let slots = new Map<string, Point>();
    /** The city and every view standing in it, as last read: what the city's camera fits. */
    let whole: Box | null = null;
    const standAll = (w: World, zoomNow: number) => {
      const width = boardWidthFor(state.current.view) * zoomNow;
      const height = width / BOARD_ASPECT;
      const byKind = new Map<string, string[]>();
      const plaza: string[] = [];
      const next = new Map<string, Point>();
      for (const board of state.current.boards) {
        if (board.where.type === "record") {
          const at = footOf(board.where, placeIn(board.where, w));
          if (at) next.set(board.key, at);
          continue;
        }
        const kind = signKindOf(board.where);
        if (kind && w.plots.has(kind)) byKind.set(kind, [...(byKind.get(kind) ?? []), board.key]);
        else plaza.push(board.key);
      }
      const boxes: Box[] = [...w.plots.values(), ...w.plates.values()];
      /*
       * WHAT A VIEW MAY NOT STAND ON: any district's ground and buildings,
       * any district's name, any view already stood. The room under a
       * district's name is held for its views by the layout; where that
       * room runs onto the next district (the map's lattice is the
       * declaration's, and does not move), the views stand along the
       * district's other sides instead — the first side that is clear.
       */
      const taken: Box[] = [...w.plots.values(), ...w.plates.values()];
      const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      const signBox = (foot: Point): Box => ({ x: foot.x - width / 2 - 2, y: foot.y - height - 2, width: width + 4, height: height + SIGN_POST * zoomNow + 4 });
      // The plaza first: a district's views stand clear of it.
      const city = unionOf([...w.plots.values()]);
      if (city && plaza.length > 0) {
        for (const [key, foot] of signFeet(plaza, { x: city.x + city.width / 2, y: city.y - 6 }, width, "up")) {
          next.set(key, foot);
          boxes.push({ x: foot.x - width / 2, y: foot.y - height, width, height: height + SIGN_POST * zoomNow });
          taken.push(signBox(foot));
        }
      }
      for (const [kind, keys] of byKind) {
        const tile = w.plots.get(kind)!;
        const plate = w.plates.get(kind);
        const own = [tile, ...(plate ? [plate] : [])];
        const others = taken.filter((box) => !own.includes(box));
        const rowWidth = (n: number) => n * width + (n - 1) * SIGN_GAP;
        // Under its name, said or not: the layout held that room there (`LayoutOptions.standing`).
        const name = plate ?? w.named.get(kind);
        const under = { x: tile.x + tile.width / 2, y: (name ? name.y + name.height : tile.y + tile.height) + 6 };
        // Behind the district, over the tallest of the blocks at its back corner.
        const blocks = [...w.buildings.values()].filter((one) => one.x + one.width / 2 > tile.x && one.x + one.width / 2 < tile.x + tile.width && one.y + one.height / 2 > tile.y && one.y + one.height / 2 < tile.y + tile.height);
        const back = Math.min(tile.y, ...blocks.map((one) => one.y)) - 4;
        // The room the layout holds under the name first; then behind the district, and beside it.
        const candidates: { feet: ReadonlyMap<string, Point> }[] = [
          { feet: signFeet(keys, under, width, "down") },
          { feet: signFeet(keys, { x: tile.x + tile.width / 2, y: back }, width, "up") },
          { feet: signFeet(keys, { x: tile.x - 8 - rowWidth(Math.min(keys.length, 3)) / 2, y: tile.y + tile.height / 2 - (height + SIGN_POST * zoomNow) / 2 }, width, "down") },
          { feet: signFeet(keys, { x: tile.x + tile.width + 8 + rowWidth(Math.min(keys.length, 3)) / 2, y: tile.y + tile.height / 2 - (height + SIGN_POST * zoomNow) / 2 }, width, "down") },
        ];
        // A view stands on its own district: a foot nearer another district's ground than its own reads as that one's, and weighs more than any overlap.
        const gap = (p: Point, b: Box) => Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.width)), Math.max(b.y - p.y, 0, p.y - (b.y + b.height)));
        const astray = (foot: Point) => [...w.plots.entries()].some(([other, box]) => other !== kind && gap(foot, box) <= gap(foot, tile)) ? 1e6 : 0;
        const cost = (feet: ReadonlyMap<string, Point>) => [...feet.values()].reduce((sum, foot) => sum + astray(foot) + others.concat(own.slice(1)).reduce((inner, box) => inner + overlap(signBox(foot), box), 0) + overlap(signBox(foot), tile), 0);
        const best = candidates.reduce((pick, one) => (cost(one.feet) < cost(pick.feet) - 0.5 ? one : pick));
        for (const [key, foot] of best.feet) {
          next.set(key, foot);
          boxes.push({ x: foot.x - width / 2, y: foot.y - height, width, height: height + SIGN_POST * zoomNow });
          taken.push(signBox(foot));
        }
      }
      slots = next;
      whole = unionOf(boxes);
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
          // Fitted beside what stands at the foot as it stands there at the City, its legend's rect read now.
          const fitted = fitBeside(whole, now.view, footNow().rest, 20, s);
          // Never past what the camera can be written at: a fit below its reach was painted, then put back up when written — an overshoot.
          const least = (camera.current?.range.min ?? 0) / zoomNow;
          if (fitted.s >= least) return fitted;
          const middle = { x: whole.x + whole.width / 2, y: whole.y + whole.height / 2 };
          return cameraPutting(middle, project(fitted, middle), least);
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
    const moveTo = (cam: SceneCamera, toLevel: number, anchor: Point, now: number) => {
      const from = painted;
      const to = cameraFor(toLevel, anchor, cam.zoom());
      const fromAltitude = altitude;
      if (state.current.lessMotion) {
        cam.liveTo(to);
        painted = to;
        altitude = toLevel;
        rest = toLevel;
        cityFoot = "";
        cam.commit();
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
        done: () => {
          rest = toLevel;
          altitude = toLevel;
          cityFoot = "";
          cam.commit();
          committedAt = performance.now();
          ownZoom = null;
        },
      };
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
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
         * the window or the views changed, or a while gone by (a record added
         * lays its district out again) — never every frame of a page at rest.
         */
        const readKey = `${at.view.width}x${at.view.height}|${at.boards.length}|${at.current}|${zoomNowOf(cam)}|${holder.querySelector(".graview-plots > g")?.getAttribute("transform") ?? ""}`;
        // An empty city is read again every frame until it has laid out; a pan moves the city's own transform, which is in the key.
        if (world.plots.size === 0 || readKey !== lastReadKey || committedAt > lastRead || now - lastRead > 500) {
          world = readWorld(holder);
          standAll(world, cam.zoom());
          lastRead = now;
          lastReadKey = readKey;
        }
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
      if (ready && calm && anchor && asking.level !== null && !move && !settling) {
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
          move.to = cameraFor(move.toAltitude, move.about, cam.zoom());
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
      if (rest !== PAGE && !move && !asking.scrubbing && anchor && placeKey !== lastPlace && !settling && calm && holder.querySelector("[data-graview-settled]")) {
        lastPlace = placeKey;
        // Chosen at the city — a Find result, a link — a page lands beside the city, as a view chosen there does.
        moveTo(cam, rest === CITY ? PANEL : rest, anchor, now);
      }

      /* THE PAGE: its box from the altitude, then — past the panel — moved and scaled into its board, as the camera has it this frame. */
      const a = altitude;
      // Out, or asked out and waiting for the camera to be aimed: the page is not back in until nothing asks it out.
      const away = a > 0.001 || move !== null || asking.scrubbing || (asking.level !== null && asking.level > PAGE) || asking.scrub !== 0;
      holder.style.visibility = away ? "visible" : "hidden";
      // Drawn but not yet moved out, the city takes no pointer and no keyboard.
      if (holder.inert === away) holder.inert = !away;
      holder.style.opacity = String(a >= PANEL ? 1 : ease(clamp01(a * 1.3)));
      const phone = at.view.width <= PHONE;
      const panel = panelBox(at.view);
      const pageAt = pageBox(a, at.view);
      /* The boards' size this frame: their width in the picture, carried through the camera painted now. */
      const boardWidth = boardWidthFor(at.view) * zoomNow * painted.s;
      // The view the page goes into is as wide as it will be where the move ends: held, so the page shrinks one way only.
      const intoWidth = move && move.toAltitude >= CITY ? boardWidthFor(at.view) * zoomNow * move.to.s : boardWidth;
      const ownSlot = slots.get(at.current);
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

      /* THE BOARDS: each on its slot, through this frame's camera, at the page's own size scaled. */
      const shownBoards = ease(clamp01((a - 1.25) / 0.6));
      const layer = boardLayer.current;
      if (layer) {
        const reachable = a > 1.5 && !move;
        if (layer.inert === reachable) layer.inert = !reachable;
        layer.setAttribute("data-graview-boards-shown", shownBoards.toFixed(3));
      }
      for (const [key, button] of boardEls.current ?? []) {
        const slot = slots.get(key);
        if (!slot || shownBoards <= 0.001) {
          if (button.style.opacity !== "0") button.style.opacity = "0";
          button.style.pointerEvents = "none";
          continue;
        }
        const foot = project(painted, slot);
        const w = boardWidth;
        const h = w / BOARD_ASPECT;
        button.style.left = `${(foot.x - w / 2).toFixed(2)}px`;
        button.style.top = `${(foot.y - h).toFixed(2)}px`;
        button.style.width = `${w.toFixed(2)}px`;
        button.style.height = `${h.toFixed(2)}px`;
        button.style.opacity = key === at.current ? "1" : shownBoards.toFixed(3);
        button.style.setProperty("--graview-sign-post", `${(SIGN_POST * zoomNow * painted.s).toFixed(2)}px`);
        button.style.pointerEvents = a > 1.5 && !move ? "auto" : "none";
        const face = button.firstElementChild as HTMLElement | null;
        if (face) face.style.transform = `scale(${(w / panel.width).toFixed(5)})`;
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
          const crowded = ringsAt.some((p) => Math.hypot(p.x - to.x, p.y - to.y) < 28);
          drawn.ring.style.display = crowded ? "none" : "";
          if (!crowded) ringsAt.push(to);
          drawn.ring.style.left = `${(to.x - 8).toFixed(2)}px`;
          drawn.ring.style.top = `${(to.y - 8).toFixed(2)}px`;
        } else {
          drawn.arrow.setAttribute("d", "");
          // An end under the bar, or under the control at the foot, is not offered: they stand over it.
          const under = control && to.x > control.left - 10 && to.x < control.right + 10 && to.y > control.top - 10 && to.y < control.bottom + 10;
          const crowded = ringsAt.some((p) => Math.hypot(p.x - to.x, p.y - to.y) < 28);
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
