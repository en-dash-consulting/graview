import { BLOCK, hueFor, toIso } from "@graview/core";
import { kindCardId, type InterpolatedLayout } from "@graview/layout";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { useGraview, useScenePointer, type DrawnBox } from "./context.js";
import { pickedFrom } from "./picking.js";
import type { RobotState } from "./robot.js";

/**
 * THE OCCUPANTS: the bodies in the city. One robot per agent participant,
 * drawn in an overlay OVER the stage on both renderer paths, positioned
 * from the frame being drawn — so it rides the tween and the pan for free
 * and never enters `layout()`. Where it stands is the fold's business
 * (`robot.ts`); this only draws what the fold says, where `whereIs` says
 * that is.
 *
 * Movement is a CSS transition on transform. A quiet city runs nothing:
 * no frame loop, no pointer listener — the pointer store attaches one
 * only while a robot is following.
 */

export interface OccupantsProps {
  readonly frame: InterpolatedLayout;
  readonly width: number;
  readonly height: number;
  readonly whereIs: (id: string) => DrawnBox | null;
  readonly stageRef: { readonly current: HTMLElement | null };
  /** The pan baked into the frame, so the dock can be placed on the lattice. */
  readonly pan: { readonly x: number; readonly y: number };
}

/** The robot, in the scene's own line vocabulary: an iso box body, a visor, two feet. */
export function Figure({ hue, mode }: { readonly hue: number; readonly mode: RobotState["mode"] }): ReactElement {
  const busy = mode === "reading" || mode === "writing";
  return (
    <svg viewBox="0 0 28 30" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        {/* head: an iso block */}
        <polygon points="14,2 24,7 14,12 4,7" />
        <polyline points="4,7 4,15 14,20 24,15 24,7" />
        <line x1="14" y1="12" x2="14" y2="20" />
        {/* visor */}
        <line x1="7" y1="10.5" x2="12" y2="13" />
        {mode === "asking" ? <circle cx="20" cy="12" r="1.2" fill="currentColor" stroke="none" /> : null}
        {/* body and feet */}
        <polyline points="9,20 9,25 12,26.5 12,29" />
        <polyline points="19,20 19,25 16,26.5 16,29" />
        {busy ? <line x1="24" y1="11" x2="27" y2="9" /> : null}
      </g>
      <title>{`robot, ${mode}`}</title>
    </svg>
  );
}

/** A point on the ground for the pad: the street corner of the origin block. */
function padAt(frame: InterpolatedLayout, pan: { x: number; y: number }): { x: number; y: number } | null {
  if (!frame.city) return null;
  const cell = toIso(BLOCK - 1 + 0.5, BLOCK - 1 + 0.5, frame.city.cell);
  return { x: frame.city.originX + cell.x + pan.x, y: frame.city.originY + cell.y + pan.y };
}

const footOf = (box: DrawnBox): { x: number; y: number } => ({ x: box.x + box.width / 2, y: box.y + box.height - 4 });

/*
 * A BODY STANDS WHERE IT CAN BE SEEN WHOLE. The figure is thirty pixels
 * above its foot and its name a dozen below, so a foot at the very edge of
 * the stage — a district in the last row of the stack, whose own foot IS
 * the stage's — put the name eight pixels past an edge that clips, which
 * the survey reported as the cut it was. A foot that is on the ground at
 * all is drawn far enough in for the whole body; one that is off the ground
 * is left where it is, so the edge marker still says which way it went.
 */
const BODY_ABOVE = 30;
const NAME_BELOW = 16;
const BODY_HALF = 16;
function onGround(point: { x: number; y: number }, width: number, height: number): { x: number; y: number } {
  const on = point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
  if (!on || width < BODY_HALF * 2 || height < BODY_ABOVE + NAME_BELOW) return point;
  return {
    x: Math.min(Math.max(point.x, BODY_HALF), width - BODY_HALF),
    y: Math.min(Math.max(point.y, BODY_ABOVE), height - NAME_BELOW),
  };
}

/*
 * Two components, so the pointer store is subscribed to ONLY while a robot
 * is following: hooks cannot be conditional, but a component boundary can.
 */
export function Occupants(props: OccupantsProps): ReactElement | null {
  const { robots } = useGraview();
  const following = [...robots.values()].some((robot) => robot.mode === "following");
  return following ? <FollowingOccupants {...props} /> : <OccupantsBody {...props} pointer={null} />;
}

function FollowingOccupants(props: OccupantsProps): ReactElement | null {
  const pointer = useScenePointer();
  const { robots, noteSeat } = useGraview();
  /* ESCAPE RELEASES from anywhere — the person called it over; the same key sends it back. Only while following. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const robot of robots.values()) {
        if (robot.mode === "following") noteSeat({ type: "release", author: authorOf(robot) });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [robots, noteSeat]);
  return <OccupantsBody {...props} pointer={pointer} />;
}

function OccupantsBody({ frame, width, height, whereIs, stageRef, pan, pointer }: OccupantsProps & { readonly pointer: { x: number; y: number } | null }): ReactElement | null {
  const { robots, noteSeat, principal, store, administered } = useGraview();
  const [trails, setTrails] = useState<Record<string, readonly { x: number; y: number }[]>>({});
  const lastAt = useRef<Record<string, string | null>>({});

  /*
   * THE DOCK: the seated person's own building when the installation is
   * shown and they have a node; else the pad at the origin cell. Both are
   * real places on the lattice — the robot is never parked in a corner
   * of the window.
   */
  const dock = useMemo((): { at: string | null; point: { x: number; y: number } | null; pad: boolean } => {
    const shown = administered.some((module) => module.shown);
    const own = principal.id ? store.graph.getNode(principal.id) : undefined;
    if (shown && own) {
      const box = whereIs(own.id) ?? whereIs(kindCardId(own.kind as string));
      if (box) return { at: own.id, point: footOf(box), pad: false };
    }
    const pad = padAt(frame, pan);
    if (pad) return { at: null, point: pad, pad: true };
    // No city drawn (inside the stack): the robot stands under the shelf's first district.
    const first = frame.nodes.find((node) => Math.round(node.plane) === 2);
    const box = first ? whereIs(first.id) : null;
    return { at: null, point: box ? { x: box.x + box.width / 2, y: box.y - 6 } : { x: width / 2, y: height - 40 }, pad: false };
  }, [administered, principal.id, store, whereIs, frame, pan, width, height]);

  const placed = [...robots.values()].map((robot) => {
    let point: { x: number; y: number } | null = null;
    let over: string | null = null;
    if (robot.mode === "following" && pointer) {
      // Trailing the pointer, offset so it never sits under the cursor.
      point = { x: pointer.x + 22, y: pointer.y + 26 };
      over = overAt(stageRef.current, pointer);
    } else if (robot.at !== null) {
      const box = whereIs(robot.at);
      point = box ? footOf(box) : dock.point;
    } else {
      point = dock.point;
    }
    return { robot, point: point ? onGround(point, width, height) : point, over };
  });

  /* What is under the pointer while following reaches the fold, so "this" in chat means it. */
  useEffect(() => {
    for (const { robot, over } of placed) {
      if (robot.mode !== "following") continue;
      if ((robot.over ?? null) !== over) {
        noteSeat({ type: "over", author: authorOf(robot), over });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointer?.x, pointer?.y, robots]);

  /* The trail: where it has been this turn, a dotted line that fades. */
  useEffect(() => {
    setTrails((current) => {
      const next: Record<string, readonly { x: number; y: number }[]> = {};
      for (const { robot, point } of placed) {
        if (!point) continue;
        const was = lastAt.current[robot.participant];
        const moved = was !== robot.at;
        lastAt.current[robot.participant] = robot.at;
        if (robot.mode === "docked") continue;
        const held = current[robot.participant] ?? [];
        next[robot.participant] = moved ? [...held, point].slice(-12) : held;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robots]);

  if (placed.length === 0) return null;

  return (
    <div className="graview-occupants" data-testid="occupants" data-graview-occupants={placed.length}>
      {placed.map(({ robot, point }) => {
        if (!point) return null;
        const hue = hueFor(robot.who);
        const visible = point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
        const style: CSSProperties = { transform: `translate(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px)`, ["--graview-hue" as string]: hue };
        const author = authorOf(robot);
        const toggleFollow = () =>
          noteSeat(robot.mode === "following" ? { type: "release", author } : { type: "follow", author });
        const label = robot.caption ?? robot.who;
        const status = robot.say ?? (robot.mode === "docked" ? "at its dock" : robot.mode === "following" ? "following you" : robot.mode);
        const trail = trails[robot.participant] ?? [];
        return (
          <div key={robot.participant}>
            {trail.length > 1 && robot.mode !== "docked" ? (
              <svg className="graview-figure-trail" width={width} height={height} aria-hidden="true">
                <path key={trail.length} d={trail.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")} />
              </svg>
            ) : null}
            {dock.pad && robot.mode === "docked" && dock.point ? (
              <div className="graview-figure-pad" style={{ transform: `translate(${dock.point.x.toFixed(1)}px, ${dock.point.y.toFixed(1)}px)` }} />
            ) : null}
            <div
              className="graview-figure"
              data-graview-figure={robot.participant}
              data-graview-mode={robot.mode}
              data-graview-at={robot.at ?? ""}
              style={style}
            >
              <button
                type="button"
                className="graview-figure-body"
                aria-label={`${label} — ${status}${robot.mode === "following" ? ". Press to release" : ". Press to have it follow you"}`}
                aria-pressed={robot.mode === "following"}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleFollow();
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && robot.mode === "following") {
                    event.stopPropagation();
                    noteSeat({ type: "release", author });
                  }
                }}
              >
                <Figure hue={hue} mode={robot.mode} />
              </button>
              <span className="graview-figure-name">{label}</span>
              {robot.say || robot.mode === "refused" || robot.mode === "asking" ? (
                <p className="graview-figure-bubble" data-testid="figure-bubble" aria-live="polite">
                  {robot.say}
                  {robot.confidence !== undefined ? <small>{Math.round(robot.confidence * 100)}% sure</small> : null}
                </p>
              ) : (
                <span className="graview-visually-hidden" aria-live="polite">{`${label}: ${status}`}</span>
              )}
            </div>
            {!visible ? (
              <button
                type="button"
                className="graview-figure-edge"
                data-testid="figure-edge"
                style={{
                  left: Math.max(8, Math.min(width - 120, point.x)),
                  top: Math.max(8, Math.min(height - 28, point.y)),
                }}
                onClick={toggleFollow}
                aria-label={`${label} is off the visible ground — ${status}`}
              >
                {robot.mode === "following" ? "↖" : point.x < 0 ? "←" : point.x > width ? "→" : point.y < 0 ? "↑" : "↓"} {label}: {status}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** The seat's author, rebuilt from the participant key the fold keeps. */
function authorOf(robot: RobotState): { kind: "agent"; id: string; session: string } {
  const [, id = "", session = ""] = robot.participant.split(":");
  return { kind: "agent", id, session };
}

/** The pick target under a scene point, read from the DOM the way a click would. */
function overAt(stage: HTMLElement | null, point: { x: number; y: number }): string | null {
  if (!stage || typeof document === "undefined") return null;
  const rect = stage.getBoundingClientRect();
  const el = document.elementFromPoint(rect.left + point.x, rect.top + point.y);
  return pickedFrom(el);
}
