import { presenceName } from "@graview/core";
import type { ReactElement } from "react";
import { useGraview, type DrawnBox } from "./context.js";
import { placeOthers } from "./placement.js";
import type { RobotState } from "./robot.js";

/**
 * THE OCCUPANTS: the other bodies in the city. People and their agents,
 * drawn in an overlay OVER the stage on both renderer paths at the boxes
 * `whereIs` gives for the frame being drawn — so they ride the tween and
 * the pan for free and never enter `layout()`. Movement is a CSS
 * transition on transform: a quiet city runs nothing.
 *
 * This tab's own seat is not here. It used to stand on a pad, walk to what
 * it wrote and follow the pointer — a thing in the middle of the picture
 * that moved on its own, and nothing at all inside a full-screen lens. The
 * seat's ask field says who it is and what it is doing, at every height;
 * what it wrote is marked on the things themselves. Somebody
 * else's agent keeps its body: that is how you see them at work.
 */

export interface OccupantsProps {
  readonly width: number;
  readonly whereIs: (id: string) => DrawnBox | null;
}

/**
 * THE ROBOT, in the scene's own line vocabulary. A dome head with a visor
 * and two eyes, an antenna, and a body that is one of the city's own iso
 * blocks — the same block a district is — on two small feet. What it is
 * doing is in the drawing: the antenna lights while it follows, an arm
 * comes up with a pen while it writes, the visor sweeps while it reads,
 * the eyes drop while it is docked, and a refusal flattens the visor.
 */
export function Figure({ hue, mode }: { readonly hue: number; readonly mode: RobotState["mode"] }): ReactElement {
  const docked = mode === "docked";
  const writing = mode === "writing";
  const reading = mode === "reading";
  const refused = mode === "refused";
  void hue;
  return (
    <svg viewBox="0 0 32 38" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        {/* antenna */}
        <line x1="16" y1="3.5" x2="16" y2="7" />
        <circle cx="16" cy="2.6" r="1.5" fill="none" />
        {/* head: a dome */}
        <path d="M8 16 V12.5 C8 8.5 11.5 7 16 7 C20.5 7 24 8.5 24 12.5 V16 Z" fill="currentColor" fillOpacity="0.1" />
        {/* visor and eyes */}
        {refused ? (
          <line x1="11" y1="12.5" x2="21" y2="12.5" strokeWidth="2" />
        ) : (
          <>
            <rect x="10.2" y="10.2" width="11.6" height="4.6" rx="2.3" fill="currentColor" fillOpacity="0.14" strokeWidth="1" />
            <circle cx="13.4" cy="12.5" r="1.25" fill="currentColor" stroke="none" opacity={docked ? 0.45 : 1} />
            <circle cx="18.6" cy="12.5" r="1.25" fill="currentColor" stroke="none" opacity={docked ? 0.45 : 1} />
            {reading ? <line x1="10.2" y1="12.5" x2="21.8" y2="12.5" strokeWidth="0.8" opacity="0.7" /> : null}
          </>
        )}
        {/* neck */}
        <line x1="16" y1="16" x2="16" y2="18.5" />
        {/* body: an iso block, the city's own */}
        <polygon points="16,18.5 24,22.5 16,26.5 8,22.5" fill="currentColor" fillOpacity="0.22" />
        <polygon points="8,22.5 16,26.5 16,33.5 8,29.5" fill="currentColor" fillOpacity="0.08" />
        <polygon points="24,22.5 16,26.5 16,33.5 24,29.5" fill="currentColor" fillOpacity="0.3" />
        {/* arms */}
        {writing ? (
          <>
            <polyline points="24,24 28.5,20.5" />
            <line x1="27.5" y1="19" x2="30" y2="21.5" strokeWidth="1.8" />
          </>
        ) : (
          <line x1="24" y1="24" x2="26.5" y2="29" />
        )}
        <line x1="8" y1="24" x2="5.5" y2="29" />
        {/* feet */}
        <path d="M9.5 33.5 v2.2 h4" />
        <path d="M22.5 33.5 v2.2 h-4" />
      </g>
      <title>{`robot, ${mode}`}</title>
    </svg>
  );
}

/** A person, in the same line vocabulary: a head, shoulders, standing. */
export function PersonFigure({ hue }: { readonly hue: number }): ReactElement {
  return (
    <svg viewBox="0 0 22 24" aria-hidden="true" style={{ color: `hsl(${Math.round(hue)} 50% 48%)` }}>
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="11" cy="6" r="4.2" />
        <path d="M3 23 C3 15.5 6 13 11 13 C16 13 19 15.5 19 23" />
      </g>
      <title>somebody</title>
    </svg>
  );
}

/**
 * THE OTHERS, on this map: people as figures at the plots they are looking
 * at, their agents as robots, and the ones elsewhere as a mark at the edge.
 * Placed with this frame's own `whereIs`, so each viewer draws the same
 * people at the same plots in its own pixels.
 */
export function Occupants({ width, whereIs }: OccupantsProps): ReactElement | null {
  const { who, following, follow } = useGraview();
  const others = placeOthers([...who.values()], whereIs, width);

  if (others.length === 0) return null;

  return (
    <div className="graview-occupants" data-testid="occupants" data-graview-occupants={others.length}>
      {others.map((one, index) => {
        if (one.kind === "over") {
          return (
            <div
              key={`over:${one.presence.participant}`}
              className="graview-presence-over"
              data-testid="presence-over"
              data-graview-over-by={one.presence.participant}
              style={{ left: one.box.x - 3, top: one.box.y - 3, width: one.box.width + 6, height: one.box.height + 6, ["--graview-hue" as string]: one.presence.hue }}
            />
          );
        }
        if (one.kind === "count") {
          return (
            <span
              key={`count:${one.at}:${index}`}
              className="graview-figure-count"
              data-testid="presence-count"
              data-graview-at={one.at}
              style={{ left: one.point.x, top: one.point.y }}
              title={`${one.n} more here`}
            >
              +{one.n}
            </span>
          );
        }
        const hue = one.presence.hue;
        // "Claude, for Ada": an agent is said as itself and for whom it acts (FR-47).
        const name = presenceName(one.presence) || "somebody";
        if (one.kind === "edge") {
          return (
            <button
              key={`edge:${one.presence.participant}`}
              type="button"
              className="graview-figure-edge"
              data-testid="presence-edge"
              data-graview-person={one.presence.participant}
              style={{ left: Math.max(8, one.point.x - 120), top: one.point.y }}
              onClick={() => follow(one.presence.participant)}
              aria-label={`${name} is somewhere else — press to go where they are`}
            >
              → {name}
            </button>
          );
        }
        if (one.kind === "robot") {
          return (
            <div
              key={`robot:${one.presence.participant}`}
              className="graview-figure"
              data-graview-figure={`theirs:${one.presence.participant}`}
              data-graview-theirs=""
              data-graview-mode={one.mode}
              data-graview-at={one.presence.robot?.at ?? ""}
              style={{ transform: `translate(${one.point.x.toFixed(1)}px, ${one.point.y.toFixed(1)}px)`, ["--graview-hue" as string]: hue }}
            >
              <span className="graview-figure-body" role="img" aria-label={`${name}'s agent — ${one.mode}`} style={{ cursor: "default" }}>
                <Figure hue={hue} mode={one.mode as RobotState["mode"]} />
              </span>
              <span className="graview-figure-name">{name}'s agent</span>
            </div>
          );
        }
        const followed = following?.participant === one.presence.participant;
        return (
          <div
            key={`person:${one.presence.participant}`}
            className="graview-figure"
            data-graview-figure={one.presence.participant}
            data-graview-person=""
            data-graview-at={one.at}
            data-graview-audience={one.audience ? "" : undefined}
            data-graview-followed={followed ? "" : undefined}
            style={{ transform: `translate(${one.point.x.toFixed(1)}px, ${one.point.y.toFixed(1)}px)`, ["--graview-hue" as string]: hue }}
          >
            <button
              type="button"
              className="graview-figure-body"
              aria-label={`${name} is here${followed ? ". Press to stop following" : ". Press to go where they go"}`}
              aria-pressed={followed}
              onClick={(event) => {
                event.stopPropagation();
                follow(followed ? null : one.presence.participant);
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <PersonFigure hue={hue} />
            </button>
            <span className="graview-figure-name">{name}</span>
          </div>
        );
      })}
    </div>
  );
}
