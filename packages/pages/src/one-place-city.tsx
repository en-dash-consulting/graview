import { labelOf, LOCAL_LAYERS } from "@graview/core";
import { EMPTY_VIEW, toUrl, withOverview, type ViewState } from "@graview/layout/view";
import { Scene, type SceneCamera } from "@graview/react";
import { useGraview, useNavigation } from "@graview/react/provider";
import { useEffect, useMemo, useRef } from "react";
import { aimAt, altitudeAt, anchorOf, AS_IT_IS, cameraBetween, cameraPutting, CITY, edgeToward, LEVEL_LIVE, levelZooms, PAGE, pageBox, PANEL, project, restingLevel, SHEET_ORIGIN, standingAt, standingCss, unionOf, type Box, type Live, type PageWhere, type Point } from "./one-place-geometry.js";
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
}

/** What one line joins, in this frame. */
interface Drawn {
  readonly key: string;
  readonly from: Point;
  readonly to: Point;
  /** The line ends at the page's edge, the building under the page: the arrow points this way. */
  readonly under: Point | null;
  readonly on: string;
  readonly target: { readonly type: "record"; readonly id: string } | { readonly type: "list"; readonly kind: string };
  readonly label: string;
}

export function OnePlaceCity({ where, page, sheet, connected, view, lessMotion, resolve, openRecord, openKind, motion, onAltitude }: OnePlaceCityProps) {
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
  useEffect(() => {
    const next = { ...wanted, ...(seen.pan ? { pan: seen.pan } : {}) };
    asked.current = toUrl(next);
    go(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  /* The Scene's own way down — a record focused, a district gone into — is that place, in the panel. A pan is the camera's own and is kept. */
  const latest = useRef({ openRecord, openKind });
  latest.current = { openRecord, openKind };
  useEffect(() => {
    if (toUrl(seen) === asked.current) return;
    if (seen.overview && seen.focusId === null) return;
    const focus = seen.focusId;
    const back = { ...wanted, ...(seen.pan ? { pan: seen.pan } : {}) };
    asked.current = toUrl(back);
    go(back);
    const record = focus && store.graph.getNode(focus) ? focus : null;
    const kind = kindOfId(focus);
    if (record) latest.current.openRecord(record, PANEL);
    else if (kind) latest.current.openKind(kind, PANEL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  const state = useRef({ where, page, view, lessMotion, resolve, onAltitude });
  state.current = { where, page, view, lessMotion, resolve, onAltitude };

  useEffect(() => {
    let frame = 0;
    let world: World = { plots: new Map(), buildings: new Map() };
    /** The camera between stops this frame, as painted — the last one seen while the view takes in a move just let go. */
    let painted: Live = LEVEL_LIVE;
    /** The level the camera rests at, and the altitude this frame. */
    let rest = PAGE;
    let altitude = PAGE;
    /** A move of the camera this face is making: from one camera to another, about the place. */
    let move: { from: Live; to: Live; fromAltitude: number; toAltitude: number; about: Point; start: number; done: () => void } | null = null;
    /** Where the place was aimed for while the page is read: its key and the window's size. */
    let aimedFor = "";
    let aimTries = 0;
    /** A zoom the person's own hand made on the Scene, and when it last moved. */
    let handZoom = 0;
    let handSince = 0;
    let lastPlace = "";
    let lastReported = "";
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
      return { plots, buildings };
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
      if (lvl === CITY || now.where.type === "home" || now.where.type === "overview") {
        const city = unionOf([...world.plots.values()]);
        const middleOfCity = city ? middle(city) : anchor;
        return cameraPutting(middleOfCity, aimAt(CITY, now.view), s);
      }
      return cameraPutting(anchor, aimAt(lvl === PAGE ? PANEL : lvl, now.view), s);
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
        cam.commit();
        return;
      }
      move = {
        from,
        to,
        fromAltitude,
        toAltitude: toLevel,
        about: anchor,
        start: now,
        done: () => {
          rest = toLevel;
          altitude = toLevel;
          cam.commit();
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

      /* THE CAMERA AS IT IS: a move between stops painted now, or the view's own. */
      const live = cam.live();
      const between = !level(live);
      const settling = cam.moving() && !between;
      if (between) painted = live;
      else if (!settling) {
        painted = LEVEL_LIVE;
        world = readWorld(holder);
      }
      const anchor = world.plots.size > 0 ? anchorIn(at.where, world) : null;
      const zooms = levelZooms(at.where, at.view);
      const zoomNow = cam.zoom();
      const placeKey = `${keyOf(at.where)}|${at.view.width}x${at.view.height}`;

      /* WHAT IS ASKED: a level (Up, Down, a press), or a scrub of the altitude by a hand on the page. */
      if (anchor && asking.level !== null && !move && !settling) {
        const toLevel = asking.level;
        asking.level = null;
        if (toLevel !== rest || placeKey !== lastPlace) moveTo(cam, toLevel, anchor, now);
        lastPlace = placeKey;
      }
      if (anchor && asking.scrub !== 0 && !settling) {
        const delta = asking.scrub;
        asking.scrub = 0;
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
      if (asking.scrubbing && !asking.held && now - handSince > LET_GO_MS && !settling) {
        asking.scrubbing = false;
        if (anchor) moveTo(cam, restingLevel(altitude), anchor, now);
      }

      /* A MOVE UNDER WAY: the camera set from how far it has got. */
      if (move) {
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
        const expected = zooms[rest]!;
        if (rest !== PAGE && Math.abs(Math.log(effective / expected)) > 0.03) {
          if (handZoom !== effective) {
            handZoom = effective;
            handSince = now;
          }
          altitude = atZoom;
          if (now - handSince > LET_GO_MS && !asking.held && anchor) moveTo(cam, restingLevel(atZoom), anchor, now);
        } else altitude = rest;
      }

      /* WHILE THE PAGE IS READ, the camera waits where stepping out begins: aimed once for each place, out of sight. */
      if (rest === PAGE && !move && !asking.scrubbing && anchor && !settling) {
        if (aimedFor !== placeKey) {
          aimedFor = placeKey;
          aimTries = 0;
        }
        const want = cameraFor(PAGE, anchor, zoomNow);
        if (!level(want) && aimTries < 4 && Math.hypot(want.x, want.y) + Math.abs(want.s - 1) * 100 > 2) {
          aimTries += 1;
          cam.liveTo(want);
          cam.commit();
        }
      }
      // Moving to another place at a level above the page: the camera flies there and stays at that level.
      if (rest !== PAGE && !move && !asking.scrubbing && anchor && placeKey !== lastPlace && !settling && holder.querySelector("[data-graview-settled]")) {
        lastPlace = placeKey;
        moveTo(cam, rest, anchor, now);
      }

      /* THE PAGE: its box from the altitude, then how it stands on the place as the camera has it this frame. */
      const a = altitude;
      const away = a > 0.001 || move !== null || asking.scrubbing;
      holder.style.visibility = away ? "visible" : "hidden";
      // Read, the city is out of reach and out of the page's measure; out, it is the picture, and nothing of it scrolls.
      if (holder.inert === away) holder.inert = !away;
      const overflow = away ? "hidden" : "auto";
      if (holder.style.overflow !== overflow) {
        holder.style.overflow = overflow;
        holder.scrollTop = 0;
        holder.scrollLeft = 0;
      }
      holder.style.opacity = String(a >= PANEL ? 1 : ease(clamp01(a * 1.3)));
      const pageAt = pageBox(a, at.view);
      // Into or out of the panel, the page makes straight for the roof where the move leaves it (or comes from), not after a roof still on its way.
      const stoodRoof = move && anchor && Math.min(move.fromAltitude, move.toAltitude) >= PANEL - 0.001 && Math.max(move.fromAltitude, move.toAltitude) <= 2.001 ? project(move.toAltitude > move.fromAltitude ? move.to : move.from, anchor) : null;
      const roof = stoodRoof ?? (anchor ? project(painted, anchor) : { x: at.view.width / 2, y: at.view.height / 2 });
      const standing = away ? standingAt(a, roof, pageAt, at.view) : AS_IT_IS;
      if (away) {
        plane.style.left = `${pageAt.x.toFixed(2)}px`;
        plane.style.top = `${pageAt.y.toFixed(2)}px`;
        plane.style.width = `${pageAt.width.toFixed(2)}px`;
        plane.style.height = `${pageAt.height.toFixed(2)}px`;
        plane.style.transformOrigin = SHEET_ORIGIN;
        plane.style.transform = standingCss(standing, at.view);
        plane.style.opacity = String(standing.opacity);
        plane.style.borderRadius = `${(a >= PANEL ? 10 : 10 * a).toFixed(2)}px`;
      } else {
        plane.style.transform = "";
        plane.style.opacity = "";
        plane.style.borderRadius = "";
      }
      /* The Connected list grows into the page as it becomes the panel. */
      const grown = clamp01((a - 0.55) / 0.45);
      const list = connected.current;
      if (list) {
        const inner = list.firstElementChild as HTMLElement | null;
        list.style.height = `${((inner?.scrollHeight ?? 0) * ease(grown)).toFixed(2)}px`;
        list.style.opacity = String(ease(grown));
      }

      /* THE LINES, from this frame's numbers. */
      const shown = a >= PANEL ? Math.min(1, standing.opacity * 1.2) : ease(clamp01((a - 0.6) / 0.4));
      const found: Drawn[] = [];
      if (shown > 0.01) {
        const pageRect = boxOf(plane.getBoundingClientRect());
        const subjectId = at.page.type === "record" ? at.page.id : null;
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
        const parts = [...plane.querySelectorAll<HTMLElement>("a[href], [data-graview-record]")].sort((x, y) => Number(x.closest("[data-graview-connected]") !== null) - Number(y.closest("[data-graview-connected]") !== null));
        for (const element of parts) {
          if (found.length >= MOST_LINES) break;
          if (element.closest("nav, header, [role=navigation], [role=banner]")) continue;
          const named = element.getAttribute("data-graview-record");
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
          const from = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          // Only what is in sight on the page: a part scrolled past, or under the page's own edge, draws none.
          const port = element.closest("[data-graview-one-place]");
          const visible = port ? port.getBoundingClientRect() : null;
          if (!visible || from.x < visible.left || from.x > visible.right || from.y < visible.top || from.y > visible.bottom) continue;
          const end = endOf(target);
          if (!end) continue;
          taken.add(key);
          const under = edgeToward(end.at, pageRect);
          found.push({ key, from, to: under ?? end.at, under: under ? end.at : null, on: end.on, target, label: labelFor(target) });
        }
      }
      draw(found, shown);

      /* Told what the frame says, when it changes: the level rested at or headed for, and whether the page is out of the window. */
      const said = `${move ? move.toAltitude : restingLevel(a)}|${away ? 1 : 0}|${move || asking.scrubbing ? 1 : 0}`;
      if (said !== lastReported) {
        lastReported = said;
        at.onAltitude({ level: move ? move.toAltitude : restingLevel(a), away, moving: move !== null || asking.scrubbing });
      }
      holder.setAttribute("data-graview-altitude-now", a.toFixed(3));
    };

    /* The overlay, written in the frame it is measured in: no React state per frame. */
    const draw = (found: readonly Drawn[], opacity: number) => {
      const svg = overlay.current;
      const ringLayer = rings.current;
      if (!svg || !ringLayer) return;
      svg.style.opacity = String(opacity);
      ringLayer.style.opacity = String(opacity);
      const keep = new Set(found.map((line) => line.key));
      for (const [key, drawn] of lines) {
        if (keep.has(key)) continue;
        drawn.g.remove();
        drawn.ring.remove();
        lines.delete(key);
      }
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
        const bend = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 24 };
        drawn.g.setAttribute("data-graview-line", line.key);
        drawn.g.setAttribute("data-graview-line-on", line.on);
        drawn.g.toggleAttribute("data-graview-line-under", line.under !== null);
        drawn.g.setAttribute("data-graview-line-from", `${from.x.toFixed(2)},${from.y.toFixed(2)}`);
        drawn.g.setAttribute("data-graview-line-to", `${to.x.toFixed(2)},${to.y.toFixed(2)}`);
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
          drawn.ring.style.display = "none";
        } else {
          drawn.arrow.setAttribute("d", "");
          drawn.ring.style.display = "";
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
    if (!id || !store.graph.getNode(id)) return;
    event.preventDefault();
    event.stopPropagation();
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
        style={{ position: "fixed", inset: 0, zIndex: LOCAL_LAYERS.under, visibility: "hidden", overflow: "auto", scrollbarWidth: "none", containerType: "size" }}
      >
        {/* One set of lines on this face: nothing is chosen on the Scene, so it draws no lines of its own from a choice and no outline of one. */}
        <Scene renderer="dom" blur={false} camera={camera} style={{ width: "100%", height: "100%" }} />
      </div>
      <svg ref={overlay} aria-hidden="true" data-testid="one-place-lines" width={view.width} height={view.height} style={{ position: "fixed", left: 0, top: 0, zIndex: LOCAL_LAYERS.over + 1, pointerEvents: "none", overflow: "visible", opacity: 0 }} />
      {/* Each line's end, a ring the keyboard and the pointer reach: that record, in the panel. */}
      <div ref={rings} role="group" aria-label="What this page shows, in the city" style={{ position: "fixed", left: 0, top: 0, width: 0, height: 0, zIndex: LOCAL_LAYERS.over + 1, opacity: 0 }} />
    </>
  );
}

export type { PageWhere };
