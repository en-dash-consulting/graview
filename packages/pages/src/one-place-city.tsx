import { labelOf, LOCAL_LAYERS } from "@graview/core";
import { EMPTY_VIEW, toUrl, withOverview, withSelection, type ViewState } from "@graview/layout/view";
import { Scene } from "@graview/react";
import { useGraview, useNavigation } from "@graview/react/provider";
import { useEffect, useMemo, useRef, useState } from "react";
import { cameraAt, cameraCss, sheetTransform, SHEET_ORIGIN, standingPoint, unionOf, type Box, type Camera, type PageWhere, type Point, type Stop } from "./one-place-geometry.js";
import type { OnePlaceCityProps } from "./one-place.js";

/*
 * THE CITY UNDER THE PAGE (Graview HQ feature:f-page-zooms-out-to-the-city).
 *
 * Not a picture of the city: the Scene itself, in the provider the pages
 * draw with, at its overview — `layout` → `placeCity`, the plots, the
 * buildings, the streets, all the Scene's own. What is added is a camera
 * over it (one transform on the box the Scene is drawn in) and the page
 * standing on the place its address is. Both are worked out each frame
 * from where the Scene draws that place NOW, so a city that reflows — a
 * record added, a window turned — carries the page with it, and the camera
 * eases after it.
 *
 * At the city stop the camera is level and nothing stands over the Scene:
 * it is the Scene, its hand, its zoom, its keyboard. Its own way down — a
 * record focused, a district gone into — opens that place's page.
 */

/** The most lines drawn from a page's parts: past this a list's lines are a hatch. */
const MOST_LINES = 40;

interface Line {
  readonly key: string;
  readonly from: Point;
  readonly to: Point;
  readonly target: { readonly type: "record"; readonly id: string } | { readonly type: "list"; readonly kind: string };
  readonly label: string;
}

const kindOfId = (id: string | null): string | null => (id === null ? null : id.startsWith("kind:") ? id.slice(5) : id.startsWith("aggregate:") && !id.includes("|") && !id.includes("+") ? id.slice(10) : null);
const middle = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const sameCamera = (a: Camera, b: Camera) => Math.abs(a.scale - b.scale) < 0.002 && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

export function OnePlaceCity({ where, page, stop, returning, sheet, view, lessMotion, resolve, openRecord, openKind }: OnePlaceCityProps) {
  const { store } = useGraview();
  const { view: seen, go } = useNavigation();
  const box = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<readonly Line[]>([]);

  /*
   * THE SCENE'S STOP: the overview, the page's record chosen — lit, standing
   * first in its row, its own links drawn by the Scene. Set here, and only
   * here; what the person does at the city changes it, and is read below.
   */
  const subject = page.type === "record" ? page.id : null;
  const wanted = useMemo<ViewState>(() => withSelection(withOverview(EMPTY_VIEW, true), subject ? [subject] : []), [subject]);
  const asked = useRef("");
  useEffect(() => {
    asked.current = toUrl(wanted);
    go(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  /* THE SCENE'S OWN WAY DOWN IS THE PAGE: a record it focuses opens that record's page, a district it goes into opens its list. */
  const latest = useRef({ stop, openRecord, openKind });
  latest.current = { stop, openRecord, openKind };
  useEffect(() => {
    if (toUrl(seen) === asked.current) return;
    // Only a way down is read: what else the Scene keeps of its stop (a pan, a district opened) is its own.
    if (seen.overview && seen.focusId === null) return;
    const focus = seen.focusId;
    const record = focus && store.graph.getNode(focus) ? focus : null;
    const kind = kindOfId(focus);
    if (latest.current.stop === "page") {
      asked.current = toUrl(wanted);
      go(wanted);
      return;
    }
    if (record) {
      asked.current = toUrl(wanted);
      go(wanted);
      latest.current.openRecord(record);
      return;
    }
    if (kind) {
      asked.current = toUrl(wanted);
      go(wanted);
      latest.current.openKind(kind);
      return;
    }
    // Down to the planes, which here are pages: back to the overview.
    asked.current = toUrl(wanted);
    go(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  /*
   * EACH FRAME: where the place stands in the Scene, measured on the Scene
   * and taken back through the camera it is seen in now (mid-travel too);
   * the camera that stop asks for; the page standing on it; the lines.
   */
  const state = useRef({ where, page, stop, returning, view, lessMotion, resolve });
  state.current = { where, page, stop, returning, view, lessMotion, resolve };
  const entering = useRef(0);
  const lastStop = useRef<Stop>(stop);
  if (lastStop.current !== stop) {
    if (lastStop.current === "page" && !returning) entering.current = 2;
    lastStop.current = stop;
  }
  useEffect(() => {
    let frame = 0;
    let wrote = { camera: "", sheet: "", lines: "" };
    let shown: Camera | null = null;
    let count = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const holder = box.current;
      const page = sheet.current;
      if (!holder) return;
      const now = state.current;
      const resting = now.stop === "page" && !now.returning && entering.current === 0;
      // While the page is read, the camera is kept where the next step back begins, a few times a second.
      count += 1;
      if (resting && count % 12 !== 0 && wrote.camera !== "") return;
      holder.style.visibility = resting ? "hidden" : "visible";
      // The ground past the city's edge is the Scene's own ground's color.
      const ground = holder.querySelector(".graview-ground");
      if (ground && backdrop.current && !backdrop.current.style.backgroundColor) {
        const color = getComputedStyle(ground).backgroundColor;
        if (color && color !== "rgba(0, 0, 0, 0)") backdrop.current.style.backgroundColor = color;
      }
      if (resting) {
        if (wrote.lines !== "") {
          wrote.lines = "";
          setLines([]);
        }
      }
      const style = getComputedStyle(holder);
      const seenThrough = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
      const back = seenThrough.inverse();
      const unseen = (rect: DOMRect): Box => {
        const a = back.transformPoint(new DOMPoint(rect.left, rect.top));
        const b = back.transformPoint(new DOMPoint(rect.right, rect.bottom));
        return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
      };
      const plots = new Map<string, Box>();
      for (const plot of holder.querySelectorAll<SVGGElement>("[data-graview-plot]")) {
        const kind = kindOfId(plot.getAttribute("data-graview-plot"));
        const tile = plot.querySelector(".graview-plot-tile") ?? plot;
        if (kind) plots.set(kind, unseen(tile.getBoundingClientRect()));
      }
      const buildingOf = (id: string): Box | null => {
        const found = holder.querySelector(`[data-graview-building="${CSS.escape(id)}"]`);
        return found ? unseen(found.getBoundingClientRect()) : null;
      };
      const all = [...plots.values()];
      const city = unionOf(all);
      const at = now.where;
      const place = {
        building: at.type === "record" ? buildingOf(at.id) : null,
        district: at.type === "record" || at.type === "list" ? (plots.get(at.kind) ?? null) : null,
        districts: at.type === "place" ? at.kinds.flatMap((kind) => (plots.has(kind) ? [plots.get(kind)!] : [])) : [],
        all,
        city,
      };
      const camera = cameraAt(now.stop, at, now.view, place);
      const instant = now.lessMotion || entering.current > 0 || resting;
      const cameraText = cameraCss(camera);
      if (cameraText !== wrote.camera && (shown === null || !sameCamera(shown, camera))) {
        holder.style.transition = instant ? "none" : "transform 520ms cubic-bezier(.2,.7,.2,1)";
        holder.style.transform = cameraText;
        wrote.camera = cameraText;
        shown = camera;
      }
      if (!page) return;
      // The page stands where the camera will put the place: it rides the same travel.
      const foot = standingPoint(now.stop, at, camera, place, now.view);
      const stood = entering.current === 2 ? "none" : sheetTransform(now.stop, at, foot, now.view);
      if (stood !== wrote.sheet) {
        page.style.transformOrigin = SHEET_ORIGIN;
        page.style.transition = now.lessMotion || entering.current === 2 ? "none" : "transform 520ms cubic-bezier(.2,.7,.2,1), opacity 300ms ease";
        page.style.transform = stood;
        wrote.sheet = stood;
      }
      if (entering.current > 0) entering.current -= 1;
      if (resting) return;
      /*
       * THE LINES: from each part of the page that shows a record — a link
       * to its page, a row that names it — to that record's building, or to
       * its district where the city has no building for it; a kind's list
       * to its district. Read where the page's parts stand now, through the
       * page's own turn (the boxes the browser gives are already turned).
       */
      const drawing = now.stop === "back" || now.stop === "district";
      const found: Line[] = [];
      if (drawing) {
        const sheetBox = page.getBoundingClientRect();
        const subjectId = now.page.type === "record" ? now.page.id : null;
        const taken = new Set<string>();
        for (const element of page.querySelectorAll("a[href], [data-graview-record]")) {
          if (found.length >= MOST_LINES) break;
          const named = element.getAttribute("data-graview-record");
          const target: Line["target"] | null = named !== null && store.graph.getNode(named) ? { type: "record", id: named } : element instanceof HTMLAnchorElement && element.href ? (() => {
            const resolved = now.resolve(element.pathname);
            return resolved?.type === "record" ? { type: "record" as const, id: resolved.id } : resolved?.type === "list" ? { type: "list" as const, kind: resolved.kind } : null;
          })() : null;
          if (!target || element.closest("nav, header, [role=navigation], [role=banner]")) continue;
          if (target.type === "record" && target.id === subjectId) continue;
          const key = target.type === "record" ? target.id : `kind:${target.kind}`;
          if (taken.has(key)) continue;
          const rect = element.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) continue;
          const from = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          if (from.x < sheetBox.left || from.x > sheetBox.right || from.y < sheetBox.top || from.y > sheetBox.bottom) continue;
          let end: Box | null = null;
          let label = "";
          if (target.type === "record") {
            const building = holder.querySelector(`[data-graview-building="${CSS.escape(target.id)}"]`);
            const kind = store.graph.getNode(target.id)?.kind as string | undefined;
            const district = kind ? holder.querySelector(`[data-graview-plot="kind:${CSS.escape(kind)}"] .graview-plot-tile`) : null;
            const drawn = building ?? district;
            if (drawn) {
              const r = drawn.getBoundingClientRect();
              end = { x: r.left, y: r.top, width: r.width, height: r.height };
            }
            const node = store.graph.getNode(target.id);
            label = node ? labelOf(store.schema.tryDefinition(node.kind as string), node as never) : target.id;
          } else {
            const district = holder.querySelector(`[data-graview-plot="kind:${CSS.escape(target.kind)}"] .graview-plot-tile`);
            if (district) {
              const r = district.getBoundingClientRect();
              end = { x: r.left, y: r.top, width: r.width, height: r.height };
            }
            label = target.kind;
          }
          if (!end) continue;
          taken.add(key);
          found.push({ key, from, to: middle(end), target, label });
        }
        // A place of several kinds: a line from where it stands to each district it shows.
        if (now.where.type === "place") {
          for (const kind of now.where.kinds) {
            const district = holder.querySelector(`[data-graview-plot="kind:${CSS.escape(kind)}"] .graview-plot-tile`);
            if (!district) continue;
            const r = district.getBoundingClientRect();
            found.push({ key: `meet:${kind}`, from: { x: sheetBox.left + sheetBox.width / 2, y: sheetBox.bottom }, to: middle({ x: r.left, y: r.top, width: r.width, height: r.height }), target: { type: "list", kind }, label: kind });
          }
        }
      }
      const said = found.map((line) => `${line.key}@${Math.round(line.from.x)},${Math.round(line.from.y)}>${Math.round(line.to.x)},${Math.round(line.to.y)}`).join("|");
      if (said !== wrote.lines) {
        wrote.lines = said;
        setLines(found);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A building pressed, at any stop but the page: the camera flies to it and its page opens. */
  const pressed = (event: React.MouseEvent) => {
    if (stop === "page") return;
    /*
     * The building under the pointer. The Scene's blocks take no press of
     * their own (their tile does, for the district), so it is found by
     * where each stands: of those under the pointer, the one in front.
     */
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
    openRecord(id);
  };

  const resting = stop === "page" && !returning;
  return (
    <>
      {/* The ground past the city's edge, where the camera has moved the Scene's box aside. */}
      <div ref={backdrop} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: LOCAL_LAYERS.under, visibility: resting ? "hidden" : "visible", background: "var(--graview-ground-deep, var(--graview-ground))" }} />
      <div
        ref={box}
        data-testid="one-place-city"
        aria-hidden={resting ? true : undefined}
        {...(resting ? { inert: true } : {})}
        onClickCapture={pressed}
        style={{ position: "fixed", left: 0, top: 0, width: view.width, height: view.height, transformOrigin: "0 0", zIndex: LOCAL_LAYERS.under, visibility: "hidden", background: "var(--graview-ground-deep, var(--graview-ground))" }}
      >
        <Scene renderer="dom" blur={false} style={{ width: "100%", height: "100%" }} />
      </div>
      {lines.length > 0 ? (
        <>
          <svg aria-hidden="true" data-testid="one-place-lines" width={view.width} height={view.height} style={{ position: "fixed", left: 0, top: 0, zIndex: LOCAL_LAYERS.over + 1, pointerEvents: "none", overflow: "visible" }}>
            {lines.map((line) => {
              const bend = { x: (line.from.x + line.to.x) / 2, y: Math.min(line.from.y, line.to.y) - 30 };
              return (
                <g key={line.key} data-graview-line={line.key}>
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
                onClick={() => (line.target.type === "record" ? openRecord(line.target.id) : openKind(line.target.kind))}
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
