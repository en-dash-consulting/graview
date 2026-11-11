import { labelOf, LOCAL_LAYERS } from "@graview/core";
import { aggregateId, EMPTY_VIEW, kindCardId, toUrl, withFocus, withOverview, withSelection, withWithin, type ViewState } from "@graview/layout/view";
import { Scene, type SceneCamera } from "@graview/react";
import { BesideTheMap, useGraview, useNavigation } from "@graview/react/provider";
import { useEffect, useMemo, useRef, useState } from "react";
import { aimPoint, anchorOf, easedToward, IN, SHEET_ORIGIN, standingCss, standingOn, stopAtZoom, zoomAt, type Box, type PageWhere, type Point, type Standing, type Stop } from "./one-place-geometry.js";
import type { OnePlaceCityProps } from "./one-place.js";

/*
 * THE CITY UNDER THE PAGE (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Not a picture of the city: the Scene itself, in the provider the pages
 * draw with, at its overview — `layout` → `placeCity`, the plots, the
 * buildings, the streets, all the Scene's own. And ONE camera: the Scene's
 * own zoom from altitude and its pan (`SceneCamera`), the same the wheel,
 * the pinch, a drag and the zoom controls move. A stop asks that camera for
 * a zoom and a pan; the person's hand moves the same camera at any stop,
 * and a zoom past a stop's range is the next stop. Nothing is drawn over
 * the Scene's box but the page and the lines, and both are placed every
 * frame from where the Scene draws the place NOW — in the window's own
 * coordinates, read in that frame — so a city that reflows, a drag, a
 * zoom, carries the page and the lines with it.
 *
 * While the page is read the Scene is not drawn at all (`display: none`):
 * it takes no room, no scroll, no pointer and no keyboard, and nothing of
 * it is measured as part of the page.
 */

/** The most lines drawn from a page's parts: past this a list's lines are a hatch. */
const MOST_LINES = 40;
/** How long the page takes to stand on its place, or to come back in. */
const STAND_MS = 480;
/** How long the camera is given to arrive before the page is aimed at again. */
const ARRIVE_MS = 900;

interface Line {
  readonly key: string;
  readonly from: Point;
  readonly to: Point;
  readonly target: { readonly type: "record"; readonly id: string } | { readonly type: "list"; readonly kind: string };
  readonly label: string;
  /** What the line ends on: the record's building, or its district (`kind:<kind>`) where the city draws no building for it. */
  readonly on?: string;
}

const kindOfId = (id: string | null): string | null => (id === null ? null : id.startsWith("kind:") ? id.slice(5) : id.startsWith("aggregate:") && !id.includes("|") && !id.includes("+") ? id.slice(10) : null);
const boxOf = (rect: DOMRect): Box => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
const middle = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const keyOf = (where: PageWhere): string => (where.type === "record" ? `record:${where.id}` : where.type === "list" ? `list:${where.kind}` : where.type === "place" ? `place:${where.kinds.join(",")}` : where.type);
const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

export function OnePlaceCity({ where, page, stop, returning, sheet, view, lessMotion, resolve, openRecord, openKind, onStop, panel: Panel }: OnePlaceCityProps) {
  const { store } = useGraview();
  const { view: seen, go } = useNavigation();
  const box = useRef<HTMLDivElement>(null);
  const camera = useRef<SceneCamera | null>(null);
  const [lines, setLines] = useState<readonly Line[]>([]);

  /*
   * THE SCENE'S STOP: always the overview — the Scene's lens over the grid
   * and its shelf of districts are not drawn on this face; a place is a page
   * like any other. What is chosen is the page's place: its record (lit,
   * standing first in its row), its kind's district, a place's lens. At the
   * panel the Scene's own map panel shows that choice beside the city.
   */
  const subject = page.type === "record" ? page.id : null;
  const choice = page.type === "record" ? `r:${page.id}` : page.type === "list" ? `k:${page.kind}` : page.type === "place" ? `p:${page.as}:${page.kinds[0]}` : "";
  const panel = stop === "panel";
  const wanted = useMemo<ViewState>(() => {
    const overview = withOverview(EMPTY_VIEW, true);
    if (choice.startsWith("r:")) return withSelection(overview, [choice.slice(2)]);
    if (choice.startsWith("k:")) return withSelection(overview, [kindCardId(choice.slice(2))]);
    if (choice.startsWith("p:")) {
      const [, as, kind] = choice.split(":");
      // At the panel a place is its lens beside the map; elsewhere its district is chosen.
      return panel ? withWithin(withFocus(overview, aggregateId(kind!)), "view", as!) : withSelection(overview, [kindCardId(kind!)]);
    }
    return overview;
  }, [choice, panel]);
  const asked = useRef("");
  useEffect(() => {
    // The pan the camera has is kept: only what is chosen changes.
    const next = { ...wanted, ...(seen.pan ? { pan: seen.pan } : {}) };
    asked.current = toUrl(next);
    go(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  /*
   * WHAT THE PERSON DOES ON THE SCENE IS WHERE THEY GO. Its way down — a
   * record focused, a district gone into, "Open ↗" in the panel — is that
   * page; another record or district chosen (a connected row, a tile) is
   * that one in the panel, the camera flying to it; the panel closed is a
   * step out. A pan is the camera's own and is kept.
   */
  const latest = useRef({ stop, openRecord, openKind, onStop, subject });
  latest.current = { stop, openRecord, openKind, onStop, subject };
  useEffect(() => {
    const url = toUrl(seen);
    if (url === asked.current) return;
    const { pan: _pan, ...bare } = seen;
    const { pan: _wantedPan, ...want } = wanted;
    if (toUrl(bare as ViewState) === toUrl(want as ViewState)) return;
    const back = { ...wanted, ...(seen.pan ? { pan: seen.pan } : {}) };
    const restore = () => {
      asked.current = toUrl(back);
      go(back);
    };
    const now = latest.current;
    if (now.stop === "page") return restore();
    const focus = seen.focusId;
    const wentDown = !seen.overview || (focus !== null && focus !== wanted.focusId);
    if (wentDown) {
      restore();
      const record = focus && store.graph.getNode(focus) ? focus : null;
      const kind = kindOfId(focus);
      // Down from the panel is the page; down from anywhere else is that place in the panel.
      const at = now.stop === "panel" ? "page" : "panel";
      if (record) now.openRecord(record, at);
      else if (kind) now.openKind(kind, at);
      return;
    }
    const chosen = seen.selection ?? [];
    if (chosen.length === 1 && chosen[0] !== now.subject) {
      const one = chosen[0]!;
      restore();
      if (store.graph.getNode(one)) now.openRecord(one, "panel");
      else if (kindOfId(one)) now.openKind(kindOfId(one)!, "panel");
      return;
    }
    if (chosen.length === 0 && (wanted.selection?.length ?? 0) > 0 && now.stop === "panel") {
      // The panel closed: a step out, the page standing in the city.
      restore();
      now.onStop("back");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  const state = useRef({ where, page, stop, returning, view, lessMotion, resolve, onStop });
  state.current = { where, page, stop, returning, view, lessMotion, resolve, onStop };

  useEffect(() => {
    let frame = 0;
    let wroteSheet = "";
    let wroteLines = "";
    let shown: Standing = IN;
    // Where the stop's camera was asked for: which stop, which place, and how far it has got.
    let aim: { key: string; phase: "wait" | "zoom" | "pan" | "check" | "done"; since: number; zoom: number; again?: number } = { key: "", phase: "done", since: 0, zoom: 1 };
    // When the panel was first drawn: the city lays itself out again in the room beside it, and is aimed at once that has landed.
    let panelSince = 0;
    let standFrom: { at: number; from: Standing } = { at: 0, from: IN };
    let lastStop: Stop = "page";
    let lastKey = "";
    let wasResting = true;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const holder = box.current;
      const plane = sheet.current;
      const cam = camera.current;
      if (!holder || !plane) return;
      const at = state.current;
      const resting = at.stop === "page" && !at.returning;
      if (resting) {
        if (!wasResting) {
          holder.style.display = "none";
          wasResting = true;
          shown = IN;
          aim = { key: "", phase: "done", since: 0, zoom: 1 };
          if (wroteLines !== "") {
            wroteLines = "";
            setLines([]);
          }
        }
        return;
      }
      if (wasResting) {
        // Out from the page: the Scene is drawn again, and laid out before anything is measured on it.
        holder.style.display = "block";
        wasResting = false;
        standFrom = { at: now, from: IN };
        return;
      }
      const key = `${at.stop}|${keyOf(at.where)}|${at.view.width}x${at.view.height}`;
      if (at.stop !== lastStop) {
        standFrom = { at: now, from: shown };
        lastStop = at.stop;
      }

      /* WHERE THE SCENE DRAWS THE PLACE NOW, in the window's coordinates. */
      const plots = new Map<string, Box>();
      for (const plot of holder.querySelectorAll<SVGGElement>("[data-graview-plot]")) {
        const kind = kindOfId(plot.getAttribute("data-graview-plot"));
        const tile = plot.querySelector(".graview-plot-tile") ?? plot;
        if (kind) plots.set(kind, boxOf(tile.getBoundingClientRect()));
      }
      const placeAt = at.where;
      const building = placeAt.type === "record" ? holder.querySelector(`[data-graview-building="${CSS.escape(placeAt.id)}"]`) : null;
      const place = {
        building: building ? boxOf(building.getBoundingClientRect()) : null,
        district: placeAt.type === "record" || placeAt.type === "list" ? (plots.get(placeAt.kind) ?? null) : null,
        districts: placeAt.type === "place" ? placeAt.kinds.flatMap((kind) => (plots.has(kind) ? [plots.get(kind)!] : [])) : [],
        all: [...plots.values()],
      };
      const anchor = plots.size > 0 ? anchorOf(placeAt, place, at.view) : null;
      // The Scene's map panel, at the panel: beside the city on a desk, a sheet from the foot on a phone.
      const panelElement = at.stop === "panel" ? holder.querySelector<HTMLElement>('[data-testid="record-panel"], [data-testid="district-panel"], [data-testid="lens-panel"]') : null;
      const panelBox = panelElement ? boxOf(panelElement.getBoundingClientRect()) : null;
      const beside = panelBox !== null && panelBox.x > at.view.width * 0.3;
      // Where the place is aimed: the middle of the city that is seen beside the panel, else under the page's foot.
      const aimAt = (): Point => (panelBox ? (beside ? { x: panelBox.x / 2, y: at.view.height / 2 } : { x: at.view.width / 2, y: Math.max(40, panelBox.y / 2) }) : aimPoint(at.stop, placeAt, at.view));

      /*
       * THE ONE CAMERA, ASKED: arriving at a stop, the Scene's zoom about the
       * place, then its pan to bring the place under the page's foot. Once
       * there, the camera is the person's: a zoom past this stop's range is
       * the next stop, and nothing pulls the camera back.
       */
      if (cam && anchor) {
        if (key !== aim.key) {
          const placeChanged = key.split("|")[1] !== lastKey.split("|")[1];
          lastKey = key;
          aim = { key, phase: "zoom", since: now, zoom: zoomAt(at.stop, placeAt, at.view.width) };
          if (!placeChanged && aim.zoom === cam.zoom()) aim.phase = "pan";
        }
        const settled = holder.querySelector("[data-graview-settled]") !== null;
        if (!panelBox) panelSince = 0;
        else if (panelSince === 0) panelSince = now;
        const panelLanded = at.stop !== "panel" || (panelBox !== null && now - panelSince > 450) || now - aim.since > ARRIVE_MS * 2;
        if (aim.phase === "zoom") {
          cam.zoomTo(aim.zoom, anchor.x, anchor.y);
          aim = { ...aim, phase: "wait", since: now };
        } else if (aim.phase === "wait" && (((settled && Math.abs(cam.zoom() - aim.zoom) < 0.02) || now - aim.since > ARRIVE_MS) && panelLanded)) {
          aim = { ...aim, phase: "pan", since: now };
        } else if (aim.phase === "pan") {
          if (at.stop !== "city" && placeAt.type !== "home") {
            const target = aimAt();
            const dx = target.x - anchor.x;
            const dy = target.y - anchor.y;
            if (Math.hypot(dx, dy) > 3) cam.panBy(dx, dy);
          }
          aim = { ...aim, phase: "check", since: now, zoom: cam.zoom() };
        } else if (aim.phase === "check" && ((settled && now - aim.since > 300) || now - aim.since > ARRIVE_MS)) {
          // Where the pan landed, looked at again: a city that moved under it meanwhile is aimed at once more.
          const target = aimAt();
          const off = Math.hypot(target.x - anchor.x, target.y - anchor.y);
          const again = aim.again ?? 0;
          aim = off > 24 && again < 2 && at.stop !== "city" && placeAt.type !== "home" ? { ...aim, phase: "pan", since: now, again: again + 1 } : { ...aim, phase: "done", since: now, zoom: cam.zoom() };
        } else if (aim.phase === "done" && now - aim.since > ARRIVE_MS && settled) {
          // The person's zoom: past this stop's range, the next stop, the camera left where the hand put it.
          const next = stopAtZoom(cam.zoom(), at.stop, placeAt, at.view.width);
          // One level a gesture, the camera then aimed as that level asks: a hard pinch does not skip a level.
          if (next !== at.stop) {
            aim = { ...aim, since: now };
            at.onStop(next);
          }
        }
      }

      /*
       * THE PAGE ON ITS PLACE: its foot on the point, this frame. Standing
       * up or coming in, its size and turn ease over a moment; at rest it
       * is exactly where the Scene draws the place.
       */
      // At the panel the page goes into it: its box, fading as the panel holds what it said.
      const target = panelBox
        ? { x: panelBox.x + panelBox.width / 2 - at.view.width / 2, y: panelBox.y + panelBox.height - at.view.height, scale: Math.min(panelBox.width / at.view.width, panelBox.height / at.view.height), turn: 0 }
        : anchor
          ? standingOn(at.stop, placeAt, anchor, at.view)
          : at.stop === "page"
            ? IN
            : shown;
      const t = at.lessMotion ? 1 : ease((now - standFrom.at) / STAND_MS);
      shown = t >= 1 ? target : easedToward(standFrom.from, target, t);
      const css = standingCss(shown, at.view);
      if (css !== wroteSheet) {
        plane.style.transformOrigin = SHEET_ORIGIN;
        plane.style.transition = "opacity 240ms ease";
        plane.style.transform = css;
        wroteSheet = css;
      }

      /*
       * THE LINES, from this frame's positions: from each part of the page
       * that shows a record — a link to its page, a row that names it — to
       * that record's building, or to its district where the city has no
       * building for it; a kind's list to its district. The page's parts
       * are read as the browser draws them turned.
       */
      const found: Line[] = [];
      const endOf = (target: Line["target"]): Box | null => {
        if (target.type === "record") {
          const drawn = holder.querySelector(`[data-graview-building="${CSS.escape(target.id)}"]`);
          if (drawn) return boxOf(drawn.getBoundingClientRect());
          const kind = store.graph.getNode(target.id)?.kind as string | undefined;
          return kind ? (plots.get(kind) ?? null) : null;
        }
        return plots.get(target.kind) ?? null;
      };
      const onOf = (target: Line["target"]): string => {
        if (target.type !== "record") return `kind:${target.kind}`;
        if (holder.querySelector(`[data-graview-building="${CSS.escape(target.id)}"]`)) return "building";
        return `kind:${String(store.graph.getNode(target.id)?.kind ?? "")}`;
      };
      const labelFor = (target: Line["target"]) => {
        if (target.type !== "record") return target.kind;
        const node = store.graph.getNode(target.id);
        return node ? labelOf(store.schema.tryDefinition(node.kind as string), node as never) : target.id;
      };
      const subjectId = at.page.type === "record" ? at.page.id : null;
      if (at.stop === "panel" && panelElement && panelBox && t >= 1) {
        /* At the panel: from each connected row, at the panel's edge toward the city, to that record's building. */
        for (const row of panelElement.querySelectorAll<HTMLElement>("[data-graview-record]")) {
          if (found.length >= MOST_LINES) break;
          const id = row.getAttribute("data-graview-record");
          if (!id || id === subjectId || !store.graph.getNode(id) || found.some((line) => line.key === id)) continue;
          const rect = row.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (rect.height < 1 || mid < panelBox.y || mid > panelBox.y + panelBox.height) continue;
          const end = endOf({ type: "record", id });
          if (!end) continue;
          const from = beside ? { x: panelBox.x, y: mid } : { x: rect.left + rect.width / 2, y: Math.max(panelBox.y, rect.top) };
          found.push({ key: id, from, to: middle(end), target: { type: "record", id }, label: labelFor({ type: "record", id }), on: onOf({ type: "record", id }) });
        }
      }
      if (at.stop === "back" && t >= 1) {
        const sheetBox = plane.getBoundingClientRect();
        const taken = new Set<string>();
        for (const element of plane.querySelectorAll("a[href], [data-graview-record]")) {
          if (found.length >= MOST_LINES) break;
          if (element.closest("nav, header, [role=navigation], [role=banner]")) continue;
          const named = element.getAttribute("data-graview-record");
          let target: Line["target"] | null = null;
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
          if (from.x < sheetBox.left || from.x > sheetBox.right || from.y < sheetBox.top || from.y > sheetBox.bottom) continue;
          const end = endOf(target);
          if (!end) continue;
          taken.add(key);
          found.push({ key, from, to: middle(end), target, label: labelFor(target), on: onOf(target) });
        }
        // A place of several kinds: a line from where it stands to each district it shows.
        if (placeAt.type === "place") {
          for (const kind of placeAt.kinds) {
            const district = plots.get(kind);
            if (district) found.push({ key: `meet:${kind}`, from: { x: sheetBox.left + sheetBox.width / 2, y: sheetBox.bottom }, to: middle(district), target: { type: "list", kind }, label: kind });
          }
        }
      }
      const said = found.map((line) => `${line.key}@${Math.round(line.from.x)},${Math.round(line.from.y)}>${Math.round(line.to.x)},${Math.round(line.to.y)}`).join("|");
      if (said !== wroteLines) {
        wroteLines = said;
        setLines(found);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * A building pressed, at any stop but the page: its page opens, the camera
   * flying to it. The Scene's blocks take no press of their own (their tile
   * does, for the district), so the building is found by where each stands:
   * of those under the pointer, the one in front.
   */
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const pressed = (event: React.MouseEvent) => {
    if (stop === "page") return;
    // The end of a drag is the camera's, not a press on what it ended over.
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
    openRecord(id, "panel");
  };

  const resting = stop === "page" && !returning;
  return (
    <>
      <div
        ref={box}
        data-testid="one-place-city"
        aria-hidden={resting ? true : undefined}
        {...(resting ? { inert: true } : {})}
        onPointerDownCapture={(event) => {
          downAt.current = { x: event.clientX, y: event.clientY };
        }}
        onClickCapture={pressed}
        style={{ position: "fixed", inset: 0, zIndex: LOCAL_LAYERS.under, display: "none", containerType: "size" }}
      >
        {/* At the panel the city is laid out in the room beside the Scene's own map panel, which holds the page's place. */}
        <BesideTheMap.Provider value={panel}>
          <Scene renderer="dom" blur={false} camera={camera} style={{ width: "100%", height: "100%" }} />
          {/* The Scene's own map panel, as the host handed it (`sceneUnderPages: { panel }`). */}
          {panel && Panel ? <Panel /> : null}
        </BesideTheMap.Provider>
      </div>
      {lines.length > 0 ? (
        <>
          <svg aria-hidden="true" data-testid="one-place-lines" width={view.width} height={view.height} style={{ position: "fixed", left: 0, top: 0, zIndex: LOCAL_LAYERS.over + 1, pointerEvents: "none", overflow: "visible" }}>
            {lines.map((line) => {
              const bend = { x: (line.from.x + line.to.x) / 2, y: Math.min(line.from.y, line.to.y) - 30 };
              return (
                <g key={line.key} data-graview-line={line.key} data-graview-line-on={line.on ?? (line.target.type === "list" ? `kind:${line.target.kind}` : "building")} data-graview-line-to={`${line.to.x.toFixed(1)},${line.to.y.toFixed(1)}`}>
                  <path d={`M${line.from.x.toFixed(1)},${line.from.y.toFixed(1)} Q${bend.x.toFixed(1)},${bend.y.toFixed(1)} ${line.to.x.toFixed(1)},${line.to.y.toFixed(1)}`} fill="none" stroke="var(--graview-accent)" strokeWidth={1.5} strokeOpacity={0.75} strokeLinecap="round" />
                  <circle cx={line.from.x} cy={line.from.y} r={2.5} fill="var(--graview-accent)" />
                </g>
              );
            })}
          </svg>
          {/* Each line's end, a ring the keyboard and the pointer reach: that record's page. */}
          <div role="group" aria-label="What this page shows, in the city" style={{ position: "fixed", left: 0, top: 0, width: 0, height: 0, zIndex: LOCAL_LAYERS.over + 1 }}>
            {lines.map((line) => (
              <button
                key={line.key}
                type="button"
                data-testid="one-place-ring"
                data-graview-to={line.target.type === "record" ? line.target.id : `kind:${line.target.kind}`}
                aria-label={line.target.type === "record" ? `Open ${line.label}` : `Open the ${line.label} list`}
                title={line.label}
                onClick={() => (line.target.type === "record" ? openRecord(line.target.id, "panel") : openKind(line.target.kind, "panel"))}
                style={{ position: "fixed", left: line.to.x - 9, top: line.to.y - 9, width: 18, height: 18, padding: 0, borderRadius: 9, border: "2px solid var(--graview-accent)", background: "color-mix(in srgb, var(--graview-accent) 18%, transparent)", cursor: "pointer" }}
              />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

export type { PageWhere };
