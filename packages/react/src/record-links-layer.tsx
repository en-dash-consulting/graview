import { counted, labelOf, SCENE_LAYERS, type AnySchema } from "@graview/core";
import type { InterpolatedLayout } from "@graview/layout";
import { useLayoutEffect, useMemo, useState, type ReactElement } from "react";
import { linksOfRecords, placeLabels, type LinkOfRecord } from "./record-links.js";
import { mapChoice } from "./map-choice.js";

/** The most records chosen at once whose links are drawn: past it the picture is a hairball, and the panel lists them. */
const DRAWN_FOR_AT_MOST = 4;

type Drawn = {
  readonly key: string;
  readonly link: LinkOfRecord;
  readonly d: string;
  readonly end: { x: number; y: number };
  readonly said: string;
  /** What a link made less than sure was based on (FR-172), until a person keeps it. */
  readonly unsure?: string;
};

/**
 * THE CHOSEN RECORD'S LINKS, FROM ALTITUDE (see `linksOfRecords`).
 *
 * One manner per meaning, and the Key says which: a solid line ending in a
 * dot reaches a record the map draws on its own — its building, or its chip
 * in an opened district; a dashed line reaches a district, for the records
 * in it the map does not draw one by one, and says how many. Every line says
 * its relation at its far end, in the chosen record's kind's words. Lines
 * pass under the districts' names rather than over them, and everything the
 * chosen record does not reach recedes.
 *
 * Measured after commit, against the DOM the frame drew, for the reason the
 * ties are: a building is where the plot layer put it, not where the layout
 * last said.
 */
export interface RecordLinksProps {
  readonly frame: InterpolatedLayout;
  readonly width: number;
  readonly height: number;
  readonly stageRef: { current: HTMLElement | null };
  /** Bumped after a scroll or a resize: measure again. */
  readonly tick: number;
  /*
   * WHAT THE SCENE KNOWS, HANDED IN: this layer is fetched the first time
   * a record is chosen from altitude, and a part fetched apart that reached
   * into the provider's own modules would split the page's first chunks.
   */
  readonly store: { readonly schema: AnySchema; readonly graph: { allEdges(): Iterable<{ readonly kind: string; readonly from: string; readonly to: string }>; getNode(id: string): ({ readonly id: string; readonly kind: string } & Record<string, unknown>) | undefined } };
  readonly graphVersion: unknown;
  readonly selection: readonly string[];
  readonly view: { readonly overview?: boolean | undefined; readonly focusId: string | null };
  /** The scene's own rulers: what of an element shows in the stage, and the runs of a curve outside some boxes. */
  readonly rulers: {
    readonly visibleRect: (el: Element, stage: HTMLElement) => Box | null;
    readonly clipQuadratic: (curve: { p0: Point; c: Point; p1: Point }, boxes: readonly Box[]) => { p0: Point; c: Point; p1: Point }[];
    /** A link still provisional (FR-172): what its maker based it on, by the edge it is; and the manner the scene draws such a link in. */
    readonly unsureOf?: (edge: string, from: string, to: string) => string | undefined;
    readonly unsureDash: string;
    readonly unsureOpacity: number;
  };
}

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

export function RecordLinks({ frame, width, height, stageRef, tick, store, graphVersion: nodes, selection, view, rulers: { visibleRect, clipQuadratic, unsureOf, unsureDash, unsureOpacity } }: RecordLinksProps): ReactElement | null {
  const kindOf = (id: string) => store.graph.getNode(id)?.kind as string | undefined;
  const choice = mapChoice(selection, view, kindOf);
  const records = choice.lens === null && choice.records.length <= DRAWN_FOR_AT_MOST ? choice.records : [];
  const recordsKey = records.join("\n");
  const [drawn, setDrawn] = useState<{ lines: Drawn[]; labels: Map<string, { x: number; y: number }>; reached: string[]; districts: string[] } | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!view.overview || records.length === 0 || !stage || typeof document === "undefined" || frame.t < 1) {
      setDrawn(null);
      return;
    }
    const s = stage.getBoundingClientRect();
    const rel = (r: DOMRect): Box => ({ x: r.left - s.left, y: r.top - s.top, width: r.width, height: r.height });
    const own = new Map<string, Box | null>();
    const chosenCards = records.map((id) => `[data-graview-view="${CSS.escape(id)}"]`).join(",");
    /* Where a record is drawn on its own: a chip or card in the scene, else its building on the plot. */
    const ownBox = (id: string): Box | null => {
      if (own.has(id)) return own.get(id)!;
      let box: Box | null = null;
      for (const el of stage.querySelectorAll(`[data-graview-pick="${CSS.escape(id)}"], [data-graview-view="${CSS.escape(id)}"]`)) {
        if (el.closest("[data-graview-offstage], [data-graview-screen]")) continue;
        // A chip inside a chosen record's own card is that card saying it, not the far record drawn: a line from the card to it would run from the card to itself.
        if (!records.includes(id) && el.closest(chosenCards)) continue;
        box = visibleRect(el, stage);
        if (box) break;
      }
      if (!box) {
        const building = stage.querySelector(`[data-graview-building="${CSS.escape(id)}"]`);
        if (building) box = rel(building.getBoundingClientRect());
      }
      own.set(id, box);
      return box;
    };
    const districtBox = (kind: string): Box | null => {
      const tile = stage.querySelector(`[data-graview-plot="kind:${CSS.escape(kind)}"] .graview-plot-tile`);
      return tile ? rel(tile.getBoundingClientRect()) : null;
    };
    const links = linksOfRecords(records, store.graph.allEdges(), kindOf, (id) => ownBox(id) !== null, store.schema);
    /* The districts' names are not crossed: a line passes under each one. */
    const names: Box[] = [];
    for (const el of stage.querySelectorAll('[data-graview-view^="kind:"]')) {
      const box = visibleRect(el, stage);
      if (box) names.push(box);
    }
    const center = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const lines: Drawn[] = [];
    const reached = new Set<string>(records);
    const districts = new Set<string>();
    for (const link of links) {
      const selfKind = kindOf(link.self);
      const fromBox = ownBox(link.self) ?? (selfKind ? districtBox(selfKind) : null);
      const toBox = link.lands === "record" ? ownBox(link.others[0]!) : districtBox(link.kind);
      if (!fromBox || !toBox) continue;
      for (const other of link.others) reached.add(other);
      districts.add(link.kind);
      if (selfKind) districts.add(selfKind);
      const p0 = center(fromBox);
      const p1 = center(toBox);
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (dist < 6) continue;
      // A gentle bow, so two lines into one district are two lines.
      const bow = Math.min(40, dist * 0.12) * (lines.length % 2 === 0 ? 1 : -1);
      const c = { x: (p0.x + p1.x) / 2 - ((p1.y - p0.y) / dist) * bow, y: (p0.y + p1.y) / 2 + ((p1.x - p0.x) / dist) * bow };
      const runs = clipQuadratic({ p0, c, p1 }, names);
      if (runs.length === 0) continue;
      const d = runs.map((run) => `M ${run.p0.x.toFixed(1)} ${run.p0.y.toFixed(1)} Q ${run.c.x.toFixed(1)} ${run.c.y.toFixed(1)} ${run.p1.x.toFixed(1)} ${run.p1.y.toFixed(1)}`).join(" ");
      const named = (id: string) => {
        const node = store.graph.getNode(id);
        return node ? labelOf(store.schema.tryDefinition(node.kind), node as never) : id;
      };
      const said = link.lands === "record" ? `${link.words}: ${named(link.others[0]!)}` : `${link.words}: ${counted(store.schema, link.kind, link.others.length)}`;
      // A link to one record made less than sure stays so in the line the chosen record draws: one manner, and its basis on hover.
      const other = link.others[0]!;
      const unsure = link.lands === "record" ? unsureOf?.(link.edge, link.direction === "out" ? link.self : other, link.direction === "out" ? other : link.self) : undefined;
      lines.push({ key: `${link.self}|${link.edge}|${link.direction}|${link.lands}|${other}`, link, d, end: p1, said: unsure !== undefined ? `${said} · unsure` : said, ...(unsure !== undefined ? { unsure } : {}) });
    }
    /* A link's words never stand on a district's name: the names under the plots are placed first. */
    const plates: Box[] = [];
    for (const el of stage.querySelectorAll(".graview-kind-face[data-graview-nameplate]")) {
      const box = visibleRect(el, stage);
      if (box) plates.push(box);
    }
    const labels = placeLabels(lines.map((line) => ({ key: line.key, x: line.end.x, y: line.end.y - 6, width: Math.min(260, 14 + line.said.length * 6.6), height: 20 })), plates);
    setDrawn({ lines, labels, reached: [...reached], districts: [...districts] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsKey, view.overview, frame, nodes, tick, width, height, stageRef, store]);

  const dimming = useMemo(() => {
    if (!drawn) return "";
    const ids = drawn.reached.map((id) => `[data-graview-building="${CSS.escape(id)}"]`).join(",");
    const plots = drawn.districts.map((kind) => `[data-graview-plot="kind:${CSS.escape(kind)}"]`).join(",");
    return [
      `.graview-ground[data-graview-altitude] .graview-building { opacity: 0.22; }`,
      ids ? `.graview-ground[data-graview-altitude] .graview-building:is(${ids}) { opacity: 1; }` : "",
      plots ? `.graview-ground[data-graview-altitude] .graview-plot:not(:is(${plots})) .graview-plot-tile { opacity: 0.4; }` : "",
    ].join("\n");
  }, [drawn]);

  if (!drawn || drawn.lines.length === 0) return dimming ? <style>{dimming}</style> : null;
  return (
    <>
      <style>{dimming}</style>
      <svg
        className="graview-record-links"
        data-graview-world=""
        data-graview-record-links={drawn.lines.length}
        aria-hidden="true"
        width={width}
        height={height}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: SCENE_LAYERS.lines }}
      >
        {drawn.lines.map((line) => (
          <g key={line.key} className="graview-record-link" data-graview-link={line.link.edge} data-graview-lands={line.link.lands} data-graview-direction={line.link.direction} data-graview-provisional={line.unsure !== undefined || undefined}>
            <path className="graview-record-link-line" d={line.d} {...(line.unsure !== undefined ? { strokeDasharray: unsureDash, strokeOpacity: unsureOpacity } : {})} />
            {line.link.lands === "record" ? <circle className="graview-record-link-end" cx={line.end.x} cy={line.end.y} r={3} /> : null}
          </g>
        ))}
      </svg>
      <div aria-hidden="true" data-graview-world="" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: SCENE_LAYERS.tieLabels }}>
        {drawn.lines.map((line) => {
          const at = drawn.labels.get(line.key);
          return at ? (
            <span
              key={line.key}
              className="graview-record-link-said"
              data-graview-link-said={line.link.edge}
              data-graview-lands={line.link.lands}
              // What it was based on, where the line says it is unsure: the one place a pointer is taken.
              {...(line.unsure !== undefined ? { title: line.unsure } : {})}
              style={{ position: "absolute", left: at.x, top: at.y, ...(line.unsure !== undefined ? { pointerEvents: "auto" as const } : {}) }}
            >
              {line.said}
            </span>
          ) : null;
        })}
      </div>
    </>
  );
}
