import type { AnySchema, NodeOfSchema } from "@graview/core";
import { areaOf, boxOf, fitLabel, overlaps, spanAt, type FittedLabel, type LabelBox } from "@graview/layout";
import { hueFor } from "../default-views.js";
import { Chip, Panel } from "../primitives/index.js";
import { useDrawnSize, useGraview, useTextMeasure, type ViewProps } from "@graview/react";
import { useMemo, useRef, useState, type MouseEvent, type ReactElement } from "react";
import { type MapPoint, type PlanLensOptions, type PlanLensState, buildPlanLens } from "./plan-state.js";


/**
 * THE SAME GROUND AS A LIST — what a map says when it cannot be drawn.
 *
 * A picture is not the only honest way to show ground, and below a certain
 * size it stops being one at all. This is what the summary fidelity draws,
 * and what the full one falls back to when the scene hands it a hundred and
 * thirty-six pixels: every area, what is standing in it, and what was named
 * and never drawn. Denser than the map, and at that size, more.
 */
function Roster({
  map,
  options,
  implicated,
  flagged,
}: {
  readonly map: PlanLensState;
  readonly options: PlanLensOptions;
  readonly implicated?: readonly string[];
  readonly flagged?: readonly string[];
}) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: ".25rem" }}>
      {map.regions.map((region) => {
        const emphasis = emphasisOf(region.id, implicated, flagged);
        return (
          <li
            key={region.id}
            data-graview-pick={region.id}
            {...(emphasis ? { "data-graview-emphasis": emphasis } : {})}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: ".5rem",
              justifyContent: "space-between",
              minWidth: 0,
              padding: ".25rem .4rem",
              borderRadius: ".35rem",
              background: emphasis === "flagged" ? fillFor(region.what, emphasis, options.hues) : undefined,
            }}
          >
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{region.label}</span>
            <span style={{ opacity: 0.7, whiteSpace: "nowrap" }}>
              {region.what ? `${region.what} · ` : ""}
              {region.markers.length}
            </span>
          </li>
        );
      })}
      {map.undrawn.map((region) => (
        <li
          key={region.id}
          data-graview-pick={region.id}
          style={{ display: "flex", gap: ".5rem", opacity: 0.7, padding: ".25rem .4rem" }}
        >
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{region.label}</span>
          <span style={{ whiteSpace: "nowrap" }}>{options.undrawnLabel ?? "not drawn"}</span>
        </li>
      ))}
    </ul>
  );
}

/** The viewBox is in hundredths, so every number below reads as a percent. */
const W = 1000;
/** A marker's hit radius, in canvas units. Twice the dot it draws. */
const HIT = 0.022;

type Emphasis = "implicated" | "flagged" | undefined;

/** A tool button: a control, never a pick target, and never under 24px. */
const TOOL = {
  minHeight: "1.9rem",
  padding: ".25rem .65rem",
  borderRadius: ".35rem",
  border: "1px solid var(--graview-edge)",
  background: "var(--graview-panel)",
  color: "var(--graview-ink)",
  font: "inherit",
  fontSize: "0.9375rem",
  cursor: "pointer",
} as const;

const emphasisOf = (
  id: string,
  implicated: readonly string[] | undefined,
  flagged: readonly string[] | undefined,
): Emphasis => {
  if (flagged?.includes(id)) return "flagged";
  if (implicated?.includes(id)) return "implicated";
  return undefined;
};

/** A hue for a category: the app's declared degrees, or the framework's stable hash (degrees since F-014). */
const degrees = (what: string | undefined, hues: PlanLensOptions["hues"]) => {
  const named = what === undefined ? undefined : hues?.[what];
  return named ?? hueFor(what ?? "region");
};

const fillFor = (what: string | undefined, emphasis: Emphasis, hues: PlanLensOptions["hues"]) =>
  emphasis === "flagged"
    ? "color-mix(in oklab, var(--graview-warn) 26%, var(--graview-panel))"
    : `color-mix(in oklab, hsl(${degrees(what, hues)} 52% 48%) 24%, var(--graview-panel))`;

const strokeFor = (what: string | undefined, emphasis: Emphasis, hues: PlanLensOptions["hues"]) =>
  emphasis === "flagged"
    ? "var(--graview-warn)"
    : `color-mix(in oklab, hsl(${degrees(what, hues)} 48% 42%) 78%, var(--graview-ink))`;

/** Where a click landed, 0..1 across and down the drawn site. */
function pointOf(event: MouseEvent<SVGSVGElement>): MapPoint {
  const box = event.currentTarget.getBoundingClientRect();
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 1000) / 1000;
  return {
    x: clamp(box.width === 0 ? 0 : (event.clientX - box.left) / box.width),
    y: clamp(box.height === 0 ? 0 : (event.clientY - box.top) / box.height),
  };
}

type Drawing =
  | { readonly kind: "region"; readonly id: string; readonly label: string; readonly corners: readonly MapPoint[] }
  | { readonly kind: "marker"; readonly id: string; readonly label: string };

export interface PlanViewProps<S extends AnySchema> extends ViewProps<S> {
  readonly schema?: S;
  readonly options: PlanLensOptions;
}

export function PlanView<S extends AnySchema>({
  schema,
  options,
  nodes,
  label,
  fidelity,
  selected,
  implicated,
  flagged,
}: PlanViewProps<S>): ReactElement | null {
  const { store } = useGraview<S>();
  const edges = store.graph.allEdges() as readonly { kind: string; from: string; to: string }[];
  /*
   * REGIONS COME FROM THE GROUP; MARKERS CANNOT.
   *
   * Registered over the region kind's `many` cell, this view is handed
   * `nodes` — that kind's members, already filtered by the horizon. The
   * markers are a DIFFERENT kind, so they are never in that array, and
   * building from `nodes` alone drew every piece of ground with nothing
   * standing in it. Reading the whole graph and narrowing the regions back
   * to what the group gave keeps both: the scene's filtering, and the
   * things that stand on the filtered ground.
   */
  const everything = store.graph.allNodes() as readonly NodeOfSchema<S>[];
  const shown = nodes === undefined ? undefined : new Set(nodes.map((node) => node.id));
  const visible =
    shown === undefined
      ? everything
      : everything.filter((node) => node.kind !== options.regions || shown.has(node.id));
  const map = buildPlanLens<S>(visible, edges, options, schema);

  const drawn = map.regions.length;
  const things = map.regions.reduce((n, region) => n + region.markers.length, 0);

  /*
   * A CHIP. Standing in for the whole map at the smallest fidelity, the
   * useful thing to say is how much ground there is — and, when some of it
   * is not drawn, that there is ground this picture is not showing.
   */
  if (fidelity === "glyph") {
    return (
      <Chip
        label={`${label ?? "Ground"} · ${drawn}`}
        {...(map.undrawn.length > 0 ? { meta: `+${map.undrawn.length} undrawn` } : {})}
        selected={selected}
      />
    );
  }

  /*
   * A SUMMARY IS DENSER CONTENT, NOT THE PICTURE SCALED DOWN. A map at a
   * third of its size is a map with no legible labels, which answers
   * nothing; a roster of the same ground with what stands in it and what is
   * wrong with it answers several things in the same space.
   */
  if (fidelity === "summary") {
    return (
      <Panel title={label ?? "The plan"} subtitle={`${drawn} drawn · ${things} standing in them`}>
        <Roster map={map} options={options} {...(implicated ? { implicated } : {})} {...(flagged ? { flagged } : {})} />
      </Panel>
    );
  }

  /*
   * THE DRAWING TAKES ITS PROPORTIONS FROM WHAT WAS DRAWN.
   *
   * The canvas used to be a fixed 1.45 to 1 and the coordinate space was
   * "0–1 across and 0–1 down" — which is not a space, it is two independent
   * scales, and it cannot say that a property is three times as long as it
   * is wide. A surveyed town lot, deep and narrow, came back as squat
   * horizontal bands: every shape stretched sideways to fill a canvas whose
   * shape had nothing to do with the ground.
   *
   * So one unit across is one unit down — a SQUARE space, in which a long
   * lot simply uses less of one axis — and the picture is cropped to what
   * is actually in it. The canvas is then the shape of the property, and a
   * lawn twice as long as it is wide is drawn twice as long as it is wide.
   *
   * `aspect` remains as an override for a domain that knows better, and is
   * no longer a default that quietly lies.
   */
  const extent = useMemo(() => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const see = (p: MapPoint) => {
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    };
    for (const region of map.regions) {
      for (const corner of region.outline) see(corner);
      for (const marker of region.markers) see(marker.at);
    }
    if (!Number.isFinite(x0) || x1 - x0 <= 0 || y1 - y0 <= 0) return { x0: 0, y0: 0, x1: 1, y1: 1 };
    /* A margin, so nothing is drawn against the frame. */
    const pad = Math.max(x1 - x0, y1 - y0) * 0.04;
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }, [map.regions]);

  /*
   * Clamped, because a property really can be ten to one and a picture that
   * is ten to one is a ribbon nothing is legible in. Past the clamp the
   * drawing stops being true rather than stops being readable, and the true
   * one nobody can read is the worse of the two.
   */
  const raw = (extent.x1 - extent.x0) / (extent.y1 - extent.y0);
  const aspect = options.aspect ?? Math.min(3.2, Math.max(0.55, raw));
  /* U is the scale of the square space; the view is the window onto it. */
  const U = Math.round(W / (extent.x1 - extent.x0));
  const viewW = Math.round(U * (extent.x1 - extent.x0));
  const viewH = Math.round(viewW / aspect);
  const view = {
    x: extent.x0 * U,
    y: extent.y0 * U - (viewH - U * (extent.y1 - extent.y0)) / 2,
    w: viewW,
    h: viewH,
  };
  /*
   * Two scales, and keeping them apart is the whole of this.
   *
   * `U` turns a coordinate into a place: it is how many units of the
   * drawing one unit of the square space is worth, and it grows as the
   * window narrows. `S` is how big a thing should LOOK — a font, a dot, a
   * margin — and it is a fraction of the window, so a name on a narrow lot
   * is the same size on screen as a name on a square one. Using the space's
   * scale for sizes is how a long thin property ends up with enormous type.
   */
  const H = U;
  const S = view.w;
  const anyEmphasis = (implicated?.length ?? 0) > 0 || (flagged?.length ?? 0) > 0;

  /*
   * WHAT CAN BE WRITTEN ON THE PICTURE, worked out before any of it is
   * drawn — because whether a name fits decides whether the key below has
   * to say it, and a component cannot find that out while rendering.
   *
   * Regions first and markers into the gaps left over: a marker is a dot
   * with a name beside it, and the dot is the thing that carries the
   * meaning. A name that will not fit is dropped rather than overlapped,
   * which is the whole difference between a plan and a pile of words.
   */
  /*
   * WHETHER THIS IS A CONTROL SURFACE, A PICTURE, OR NEITHER.
   *
   * The framework asks this now — `useDrawnSize` — because it turned out
   * not to be a question about grounds. A drawing written in its own units
   * and handed whatever room the page has hides it: at THIS size, is what
   * I am drawing still a thing a person can read, or press? The scene lays
   * this panel out at 136 pixels on a phone, where the answer is no twice.
   */
  const canvas = useRef<SVGSVGElement>(null);
  const { touchable, legible: drawable } = useDrawnSize(canvas, { units: view.w, target: S * HIT * 2 });
  const display = useTextMeasure("--graview-font-display", "serif");
  const body = useTextMeasure("--graview-font-body", "sans-serif");

  const { named, placed, tagged } = useMemo(() => {
    const taken: LabelBox[] = [];
    /*
     * THE NAME GOES IN THE CORNER, NOT ACROSS THE MIDDLE.
     *
     * A name set large and centered looks like a title and behaves like a
     * wall: it owns the widest part of the shape, which is exactly where
     * the things standing in that shape are, so twenty-two markers had
     * nowhere to put their own names and went unlabeled. Every site plan
     * ever drawn does the opposite — the area is named quietly along its
     * top edge, and the middle is left for what is in it.
     */
    const inset = S * 0.012;
    /* A hair of air: two names that merely touch read as one long word. */
    const air = W * 0.004;
    const clear = (box: LabelBox, mine?: LabelBox) =>
      !taken.some(
        (other) =>
          other !== mine &&
          overlaps({ x0: box.x0 - air, y0: box.y0 - air, x1: box.x1 + air, y1: box.y1 + air }, other),
      );

    /*
     * BIGGEST GROUND FIRST. Where two names cannot both be drawn, the one
     * that keeps its place should be the one with more room to keep it in —
     * and the one that loses goes to the key, which is a demotion a small
     * shape can afford and a large one cannot.
     */
    const byRoom = [...map.regions].sort((a, b) => areaOf(b.outline) - areaOf(a.outline));
    const named = new Map<string, FittedLabel | null>();
    const placed = new Map<string, { readonly x: number; readonly y: number }>();
    for (const region of byRoom) {
      const box = boxOf(region.outline);
      const height = Math.max(0, (box.bottom - box.top) * H * 0.55);
      /*
       * Down the inside of the top edge, looking for a line with room. Two
       * areas that overlap — which a survey produces more often than
       * anybody would like — have their top edges close together, and a
       * name drawn over another name belongs to neither of them.
       */
      let put: { fitted: FittedLabel; x: number; y: number } | null = null;
      for (const down of [0.12, 0.26, 0.42, 0.6, 0.78]) {
        const y = box.top + down * (box.bottom - box.top);
        const span = spanAt(region.outline, y);
        const room = Math.max(0, (span.x1 - span.x0) * U - inset * 2);
        const fitted = fitLabel(region.label, {
          room,
          height,
          size: S * 0.023,
          floor: S * 0.015,
          measure: display,
        });
        if (fitted === null) continue;
        const wide = Math.max(...fitted.lines.map((line) => display(line, fitted.fontSize)));
        const tall = fitted.lines.length * fitted.fontSize * 1.15;
        /*
         * OFF THE EDGE IT IS DRAWN ON. A short band's tenth-of-the-way-down
         * is a couple of pixels, so the first row of names came back with
         * the outline stroke ruled straight through them — a name on a
         * boundary reads as belonging to whichever side you looked at first.
         */
        const top = box.top * H + inset + tall / 2;
        const bottom = box.bottom * H - inset - tall / 2;
        const mid = bottom < top ? ((box.top + box.bottom) * H) / 2 : Math.min(Math.max(y * H, top), bottom);

        /*
         * AND MEASURED WHERE IT IS ACTUALLY DRAWN.
         *
         * The room was measured at `y` and the clamp above moves the label
         * to `mid`, which is a different height — and a shape is a
         * different width at a different height. That is how "The Tree Bed"
         * came to be lettered across the patio next door: the widest run at
         * the height it was measured, drawn at a height where the bed is
         * not. So the span is re-asked where the words will land, and a
         * label that does not fit THERE tries the next line down instead.
         */
        const here = spanAt(region.outline, mid / H);
        const x = here.x0 * U + inset;
        if (wide > (here.x1 - here.x0) * U - inset * 2) continue;

        const candidate = { x0: x, y0: mid - tall / 2, x1: x + wide, y1: mid + tall / 2 };
        if (!clear(candidate)) continue;
        taken.push(candidate);
        put = { fitted, x, y: mid };
        break;
      }
      named.set(region.id, put?.fitted ?? null);
      if (put !== null) placed.set(region.id, { x: put.x, y: put.y });
    }

    /*
     * TWENTY-TWO COLORED DOTS AND NO WORDS is not a map of anything. The
     * first survey drew exactly that, and every one of them was reachable,
     * announced and pickable — and unreadable, because knowing a thing is
     * THERE is not knowing what it is.
     *
     * A marker's name dodges everything already on the picture, including
     * the area names. Letting them overlap was tried and is worse than
     * silence: "Cedar ra…" under "Perimeter raised" reads as one damaged
     * sentence rather than as two things. What buys the room is the area
     * names moving out of the middle, above.
     */
    const size = S * 0.018;
    const tagged = new Map<string, { readonly at: MapPoint; readonly anchor: "start" | "end"; readonly size: number }>();
    /*
     * THE DOTS ARE IN THE WAY TOO.
     *
     * Names dodged other names and sailed straight over the marks they
     * belong to: "Back Fence Beds" written across the alley gate's dot,
     * "Deck Shrub" across the drain's. A dot is the thing carrying the
     * meaning — the name is only there to say which dot — so a name over
     * somebody else's dot mislabels it, which is worse than the dot having
     * no name at all. Every mark goes into the set before any name does.
     */
    const dot = S * 0.011 + S * 0.004;
    const marks = new Map<string, LabelBox>();
    for (const region of map.regions) {
      for (const marker of region.markers) {
        const box = {
          x0: marker.at.x * U - dot,
          y0: marker.at.y * H - dot,
          x1: marker.at.x * U + dot,
          y1: marker.at.y * H + dot,
        };
        marks.set(marker.id, box);
        taken.push(box);
      }
    }
    /*
     * And none of them at all when the drawing is too small to press,
     * because it is then also too small to read: at phone width this canvas
     * lands in about a hundred and forty pixels, where an eighteen-unit
     * name renders at two and a half. Two-and-a-half-pixel words are not a
     * smaller version of the information; they are a texture. The key
     * carries every marker at that size, in rows a finger can hit.
     */
    for (const region of touchable ? map.regions : []) {
      for (const marker of region.markers) {
        const gap = S * 0.018;
        const wide = body(marker.label, size);
        const cx = marker.at.x * U;
        const cy = marker.at.y * H;
        const rise = size * 1.15;
        /*
         * EIGHT PLACES TO TRY, not one.
         *
         * The first version put every name to the right of its dot and gave
         * up if that was taken — so on a real plan, where twenty-two things
         * stand in eight small areas, it gave up twenty-two times and the
         * drawing was dots. A name beside its dot is worth a good deal of
         * looking for: right first because it reads most naturally, then
         * left, then the diagonals, then straight above and below.
         */
        const tries: { x: number; y: number; anchor: "start" | "end" }[] = [
          { x: cx + gap, y: cy, anchor: "start" },
          { x: cx - gap, y: cy, anchor: "end" },
          { x: cx + gap * 0.7, y: cy - rise, anchor: "start" },
          { x: cx - gap * 0.7, y: cy - rise, anchor: "end" },
          { x: cx + gap * 0.7, y: cy + rise, anchor: "start" },
          { x: cx - gap * 0.7, y: cy + rise, anchor: "end" },
          { x: cx, y: cy - rise * 1.1, anchor: "start" },
          { x: cx, y: cy + rise * 1.1, anchor: "start" },
        ];
        for (const put of tries) {
          const x0 = put.anchor === "start" ? put.x : put.x - wide;
          const box = { x0, y0: put.y - size * 0.62, x1: x0 + wide, y1: put.y + size * 0.62 };
          if (x0 < view.x + 4 || x0 + wide > view.x + view.w - 4) continue;
          if (box.y0 < view.y + 2 || box.y1 > view.y + view.h - 2) continue;
          /*
           * A MARK DOES NOT BLOCK ITS OWN NAME.
           *
           * Every dot went into the set so that no name would be written
           * across somebody else's — and then every name was written
           * eighteen units from a dot whose blocked square reaches fifteen,
           * with four units of air between labels on top. Nineteen against
           * eighteen: each of the twenty-two names was refused by the one
           * mark it belongs to, and the drawing came back as dots with a
           * key of everything on it.
           */
          if (!clear(box, marks.get(marker.id))) continue;
          taken.push(box);
          tagged.set(marker.id, { at: { x: put.x, y: put.y }, anchor: put.anchor, size });
          break;
        }
      }
    }
    return { named, placed, tagged };
  }, [map.regions, W, H, touchable, display, body]);

  /** Everything the drawing could not say for itself, in the order it is drawn. */
  const unsaid = useMemo(() => {
    const out: { id: string; label: string; what: string | undefined; round: boolean }[] = [];
    for (const region of map.regions) {
      if ((named.get(region.id)?.whole ?? false) === false) {
        out.push({ id: region.id, label: region.label, what: region.what, round: false });
      }
    }
    for (const region of map.regions) {
      for (const marker of region.markers) {
        /* Everything, when the drawing is too small to be pressed: the key
           is then not a footnote about what would not fit, it is the only
           way to reach anything standing on the ground. */
        if (!touchable || !tagged.has(marker.id)) {
          out.push({ id: marker.id, label: marker.label, what: marker.what, round: true });
        }
      }
    }
    return out;
  }, [map.regions, named, tagged, touchable]);

  /*
   * STAKING OUT, ON THE MAP ITSELF.
   *
   * The vision's sentence was "dragging corners on a sketch", and the first
   * real survey — seven areas, none drawn — landed a person on an empty
   * rectangle with a paragraph of names under it. This is where drawing
   * belongs: choose an area, click its corners, done. Each finished outline
   * is the domain's own act through the store, authored by whoever is in
   * the seat, so it lands in the log and undoes like anything else.
   */
  const { principal } = useGraview<S>();
  const [drawing, setDrawing] = useState<Drawing | null>(null);


  const canDraw = options.draw !== undefined;
  const canPlace = options.place !== undefined;

  const onCanvasClick = (event: MouseEvent<SVGSVGElement>) => {
    if (drawing === null) return;
    // A click that is laying a corner must not also select or travel.
    event.stopPropagation();
    const point = pointOf(event);
    if (drawing.kind === "marker") {
      store.apply(
        { name: options.place!.act, args: { [options.place!.id]: drawing.id, [options.place!.at]: point } },
        { author: principal, intent: `Placed ${drawing.label} on the map` },
      );
      setDrawing(null);
      return;
    }
    setDrawing({ ...drawing, corners: [...drawing.corners, point] });
  };

  const finishRegion = () => {
    if (drawing === null || drawing.kind !== "region" || drawing.corners.length < 3) return;
    store.apply(
      {
        name: options.draw!.act,
        args: { [options.draw!.id]: drawing.id, [options.draw!.outline]: drawing.corners },
      },
      { author: principal, intent: `Drew ${drawing.label} on the map — ${drawing.corners.length} corners` },
    );
    setDrawing(null);
  };

  const hint =
    drawing === null
      ? map.regions.length === 0
        ? "Nothing drawn yet. Choose an area below, then click its corners here."
        : null
      : drawing.kind === "marker"
        ? `Click where ${drawing.label} stands.`
        : drawing.corners.length < 3
          ? `Click the corners of ${drawing.label} — ${3 - drawing.corners.length} more to make an area.`
          : `${drawing.corners.length} corners. Keep clicking, or press Done.`;

  if (!drawable) {
    return (
      <Panel
        title={label ?? "The plan"}
        subtitle={`${drawn} drawn · ${things} standing in them`}
        selected={selected}
      >
        <Roster map={map} options={options} {...(implicated ? { implicated } : {})} {...(flagged ? { flagged } : {})} />
      </Panel>
    );
  }

  return (
    <Panel
      title={label ?? "The plan"}
      subtitle={`${drawn} drawn · ${things} standing in them`}
      {...(map.undrawn.length > 0
        ? { meta: `${map.undrawn.length} ${options.undrawnLabel ?? "not drawn yet"}` }
        : {})}
      selected={selected}
      fit
    >
      {/*
        * A BOX THAT OWNS THE SHAPE, and a canvas that fills it.
        *
        * `width="100%"` with `height:auto` is the usual way to make an
        * SVG responsive and it depends on the parent agreeing. At phone
        * width the scene lays this panel out at 136 pixels and something
        * in that chain resolved the canvas to 138 by TWO — at which point
        * the drawing did not scale down, it OVERFLOWED: a thousand units
        * of ground painted across the page, region names ending nine
        * hundred pixels past the right edge of a 390-pixel screen,
        * invisible because they sat behind everything else and caught
        * only because a harness measures where text actually lands.
        *
        * So the aspect ratio lives on a plain block that nothing argues
        * with, and the canvas is pinned to its inside.
        */}
      <div style={{ position: "relative", width: "100%", aspectRatio: `${view.w} / ${view.h}`, overflow: "hidden" }}>
      <svg
        ref={canvas}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        /*
         * A DRAWING WHOSE PARTS ARE CONTROLS IS NOT AN IMAGE.
         *
         * `role="img"` is a leaf: it promises a screen reader that what
         * is inside is decoration described by the label, so a focusable
         * shape in there is a control the reader has been told is not
         * there. axe calls it nested-interactive and it is right. Every
         * area here is a button, so this is a group — and an image only
         * when the picture is too small to have given anything a target,
         * which is exactly when it IS decoration.
         */
        role={drawing !== null ? "application" : touchable ? "group" : "img"}
        aria-label={
          drawing === null
            ? `${label ?? "The plan"}: ${drawn} drawn, ${things} standing in them`
            : hint ?? "Drawing"
        }
        onClick={onCanvasClick}
        data-testid="plan-canvas"
        style={{
          display: "block",
          position: "absolute",
          inset: 0,
          /*
           * THE PICTURE STAYS INSIDE ITS BOX.
           *
           * At phone width the scene lays this panel out at 136 pixels and
           * something in that chain resolved the canvas to 138 by TWO — at
           * which point the drawing did not scale down, it OVERFLOWED: a
           * thousand units of ground painted across the page, region names
           * ending nine hundred pixels past the right edge of a 390-pixel
           * screen, invisible because they sat behind everything else and
           * caught only because a harness measures where text actually
           * lands. `aspect-ratio` makes the height follow the width even
           * where a flex parent would rather it did not, and `overflow`
           * makes the escape impossible rather than unlikely.
           */
          cursor: drawing === null ? undefined : "crosshair",
          // A dashed edge and a faint grid: a sheet to draw on, not a void.
          border: `1px dashed color-mix(in oklab, var(--graview-edge) 80%, transparent)`,
          borderRadius: ".4rem",
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--graview-edge) 35%, transparent) 1px, transparent 1px)," +
            "linear-gradient(90deg, color-mix(in oklab, var(--graview-edge) 35%, transparent) 1px, transparent 1px)",
          backgroundSize: "10% 10%",
        }}
      >
        {/* North, so the drawing has an orientation somebody can agree on. */}
        <text x={view.x + view.w - S * 0.028} y={view.y + S * 0.034} fontSize={S * 0.022} textAnchor="middle" fill="var(--graview-ink)" opacity={0.55}>
          N
        </text>
        {/* Center-canvas only while the canvas is empty; over a drawn site
            the same words go in the tool row rather than across the labels. */}
        {hint !== null && map.regions.length === 0 ? (
          <text
            x={view.x + view.w / 2}
            y={view.y + view.h / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={S * 0.026}
            fill="var(--graview-ink)"
            opacity={0.7}
            style={{ pointerEvents: "none", fontFamily: "var(--graview-font-body)" }}
          >
            {hint}
          </text>
        ) : null}
        {drawing !== null && drawing.kind === "region" && drawing.corners.length > 0 ? (
          <g style={{ pointerEvents: "none" }}>
            <polyline
              points={drawing.corners.map((p) => `${p.x * U},${p.y * H}`).join(" ")}
              fill={drawing.corners.length >= 3 ? "color-mix(in oklab, var(--graview-accent) 22%, transparent)" : "none"}
              stroke="var(--graview-accent)"
              strokeWidth={3}
              strokeDasharray="8 6"
            />
            {drawing.corners.map((p, index) => (
              <circle key={index} cx={p.x * U} cy={p.y * H} r={S * 0.008} fill="var(--graview-accent)" />
            ))}
          </g>
        ) : null}
        {map.regions.map((region) => {
          const emphasis = emphasisOf(region.id, implicated, flagged);
          const dim = anyEmphasis && emphasis === undefined ? 0.34 : 1;
          const points = region.outline.map((p) => `${p.x * U},${p.y * H}`).join(" ");
          return (
            <g
              key={region.id}
              data-graview-pick={region.id}
              {...(emphasis ? { "data-graview-emphasis": emphasis } : {})}
              /*
               * The host's `usePickTargets` gives every pick target a tab
               * stop, but it only grants `role="button"` to a closed set of
               * generic HTML tags — no SVG element is on it. So an SVG
               * target would be focusable and announced as nothing at all.
               * Saying it here is the fix; the host leaves an attribute
               * alone once it is set. (docs/graview-feedback.md F-013.)
               */
              role="button"
              aria-label={`${region.label}${region.what ? `, ${region.what}` : ""}, ${region.markers.length} standing in it`}
              style={{ opacity: dim, cursor: "pointer" }}
            >
              <polygon
                points={points}
                fill={fillFor(region.what, emphasis, options.hues)}
                stroke={strokeFor(region.what, emphasis, options.hues)}
                strokeWidth={emphasis === "flagged" ? 5 : 2.5}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        {map.regions.flatMap((region) =>
          region.markers.map((marker) => {
            const emphasis = emphasisOf(marker.id, implicated, flagged);
            const dim = anyEmphasis && emphasis === undefined ? 0.34 : 1;
            return (
              <g
                key={marker.id}
                {...(touchable
                  ? {
                      "data-graview-pick": marker.id,
                      role: "button",
                      "aria-label": `${marker.label}${marker.what ? `, ${marker.what}` : ""}, in ${region.label}`,
                    }
                  : { "aria-hidden": true })}
                {...(emphasis ? { "data-graview-emphasis": emphasis } : {})}
                style={{ opacity: dim, cursor: touchable ? "pointer" : "default" }}
              >
                {/* Transparent, and twice the dot: the thing a finger has to
                    land on is bigger than the thing an eye has to see. */}
                {touchable ? (
                  <circle cx={marker.at.x * U} cy={marker.at.y * H} r={S * HIT} fill="transparent" />
                ) : null}
                <circle
                  cx={marker.at.x * U}
                  cy={marker.at.y * H}
                  r={S * 0.011}
                  fill={
                    emphasis === "flagged"
                      ? "var(--graview-warn)"
                      : `hsl(${degrees(marker.what, options.hues)} 55% 45%)`
                  }
                  stroke="var(--graview-panel)"
                  strokeWidth={S * 0.004}
                />
                {tagged.has(marker.id) ? (
                  <text
                    x={tagged.get(marker.id)!.at.x}
                    y={tagged.get(marker.id)!.at.y}
                    textAnchor={tagged.get(marker.id)!.anchor}
                    dominantBaseline="middle"
                    fontSize={tagged.get(marker.id)!.size}
                    fill="var(--graview-ink)"
                    stroke="var(--graview-panel)"
                    strokeWidth={Math.max(2, tagged.get(marker.id)!.size * 0.3)}
                    paintOrder="stroke"
                    data-testid={`marker-label-${marker.id}`}
                    style={{ pointerEvents: "none", fontFamily: "var(--graview-font-body)" }}
                  >
                    {marker.label}
                  </text>
                ) : null}
              </g>
            );
          }),
        )}
        {/*
          * THE NAMES, LAST — so nothing can take the first letter off one.
          *
          * They were drawn inside each region's own group, which put every
          * later region and all twenty-two markers on top of them: the
          * picture came back reading "rick patio with gravel joints" and
          * "louse elevation", with a colored dot sitting exactly where the
          * B and the H should have been. A name is the one thing on this
          * drawing that must survive everything else, so it is painted
          * after everything else.
          */}
        {map.regions.map((region) => {
          const fitted = named.get(region.id);
          const at = placed.get(region.id);
          if (!fitted || at === undefined) return null;
          const emphasis = emphasisOf(region.id, implicated, flagged);
          return (
            <text
              key={`label-${region.id}`}
              x={at.x}
              y={at.y - ((fitted.lines.length - 1) * fitted.fontSize * 1.15) / 2}
              textAnchor="start"
              dominantBaseline="middle"
              fontSize={fitted.fontSize}
              fill="var(--graview-ink)"
              opacity={anyEmphasis && emphasis === undefined ? 0.34 : 1}
              /* Painted stroke-first so a label stays legible wherever it
                 lands — over a dark fill, over a neighbor's edge, over
                 another label. Without it the name of the ground is the
                 first thing the picture loses. */
              stroke="var(--graview-panel)"
              strokeWidth={Math.max(2, fitted.fontSize * 0.26)}
              paintOrder="stroke"
              data-testid={`region-label-${region.id}`}
              style={{ pointerEvents: "none", fontFamily: "var(--graview-font-display)" }}
            >
              {fitted.lines.map((line, index) => (
                <tspan key={line + String(index)} x={at.x} dy={index === 0 ? 0 : fitted.fontSize * 1.15}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
      </div>
      {/*
        * SAID, NOT HIDDEN. Ground nobody drew and things standing nowhere
        * are the two absences this picture exists to surface, and a map that
        * silently omits them is a map that lies by being tidy. They are NOT
        * given pick targets here: the summary list above already reaches
        * every region, and a second tab stop for the same node puts extra
        * stops between a keyboard user and the rest of the page.
        */}
      {/*
        * THE KEY — for whatever the picture could not say itself.
        *
        * A map that truncates a name has not lost it, so long as something
        * under the picture still says it in full; a map that truncates a
        * name and says nothing has renamed somebody's ground. And a dense
        * corner where three things stand within a few pixels of each other
        * will always have markers that could not be named without writing
        * over their neighbors — so those are here too, by the color they
        * were drawn in.
        *
        * Only those. A key repeating seven names already legible on the
        * shapes is furniture, and it is the first thing a person stops
        * reading.
        */}
      {unsaid.length > 0 ? (
        <ul
          data-testid="map-key"
          style={{
            margin: ".5rem 0 0",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexWrap: "wrap",
            gap: ".2rem .75rem",
            fontSize: "0.875rem",
          }}
        >
          {unsaid.map((one) => (
            <li
              key={one.id}
              data-graview-pick={one.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: ".35rem",
                minWidth: 0,
                /* A row in the key is a real target, because for a marker
                   on a small screen it is the only one there is. */
                minHeight: "max(1.5rem, 24px)",
                padding: "0 .15rem",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: one.round ? ".55rem" : ".7rem",
                  height: one.round ? ".55rem" : ".7rem",
                  flex: "0 0 auto",
                  borderRadius: one.round ? "50%" : ".15rem",
                  background: one.round
                    ? `hsl(${degrees(one.what, options.hues)} 55% 45%)`
                    : fillFor(one.what, undefined, options.hues),
                  border: one.round ? undefined : `1px solid ${strokeFor(one.what, undefined, options.hues)}`,
                }}
              />
              <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{one.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {/*
        * THE TOOLS. What is not drawn is a list of things to draw, one press
        * each; what is not placed is a list of things to place. These are
        * controls rather than pick targets — pressing "Draw the Back Lawn"
        * starts drawing it, and does not travel to it.
        */}
      {drawing !== null ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", marginTop: ".5rem", alignItems: "center" }}>
          {map.regions.length > 0 && hint !== null ? (
            <span style={{ fontSize: "0.9375rem", opacity: 0.8, flexBasis: "100%" }} aria-live="polite">
              {hint}
            </span>
          ) : null}
          {drawing.kind === "region" ? (
            <button
              type="button"
              onClick={finishRegion}
              disabled={drawing.corners.length < 3}
              data-testid="draw-done"
              style={{ ...TOOL, background: "var(--graview-accent)", color: "var(--graview-accent-ink)", borderColor: "transparent" }}
            >
              Done — keep {drawing.label}
            </button>
          ) : null}
          {drawing.kind === "region" && drawing.corners.length > 0 ? (
            <button
              type="button"
              onClick={() => setDrawing({ ...drawing, corners: drawing.corners.slice(0, -1) })}
              style={TOOL}
            >
              Undo a corner
            </button>
          ) : null}
          <button type="button" onClick={() => setDrawing(null)} style={TOOL} data-testid="draw-cancel">
            Stop
          </button>
        </div>
      ) : (
        <>
          {canDraw && map.undrawn.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", marginTop: ".5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", opacity: 0.75 }}>{options.undrawnLabel ?? "Not drawn yet"}:</span>
              {map.undrawn.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  style={TOOL}
                  onClick={() => setDrawing({ kind: "region", id: region.id, label: region.label, corners: [] })}
                  data-testid={`draw-${region.id}`}
                >
                  Draw {region.label}
                </button>
              ))}
            </div>
          ) : null}
          {canPlace && map.strays.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", marginTop: ".5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.875rem", opacity: 0.75 }}>{options.strayLabel ?? "Not placed"}:</span>
              {map.strays.map((stray) => (
                <button
                  key={stray.id}
                  type="button"
                  style={TOOL}
                  onClick={() => setDrawing({ kind: "marker", id: stray.id, label: stray.label })}
                  data-testid={`place-${stray.id}`}
                >
                  Place {stray.label}
                </button>
              ))}
            </div>
          ) : null}
          {options.help !== undefined && (map.undrawn.length > 0 || map.strays.length > 0) ? (
            <p style={{ margin: ".5rem 0 0", fontSize: "0.875rem" }}>
              <a href={options.help.href} data-testid="map-help">
                {options.help.label}
              </a>
            </p>
          ) : null}
          {!canDraw && (map.undrawn.length > 0 || map.strays.length > 0) ? (
            <p style={{ margin: ".5rem 0 0", fontSize: "0.875rem", opacity: 0.75 }}>
              {map.undrawn.map((r) => r.label).join(", ")}
              {map.undrawn.length > 0 ? ` — ${options.undrawnLabel ?? "not drawn yet"}. ` : ""}
              {map.strays.map((s) => s.label).join(", ")}
              {map.strays.length > 0 ? ` — ${options.strayLabel ?? "not placed"}.` : ""}
            </p>
          ) : null}
        </>
      )}
    </Panel>
  );
}
