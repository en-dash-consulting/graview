import { BLOCK, hueFor, toIso } from "@graview/core";
import { kindCardId, type InterpolatedLayout } from "@graview/layout";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { useGraview, useScenePointer, type DrawnBox } from "./context.js";
import { pickedFrom } from "./picking.js";
import { placeOthers } from "./presence.js";
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
/** How close a hand has to come for a following robot to stand still. */
const CATCH_REACH = 34;
const BODY_ABOVE = 38;
const NAME_BELOW = 16;
const BODY_HALF = 18;
function onGround(point: { x: number; y: number }, width: number, height: number): { x: number; y: number } {
  const on = point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height;
  if (!on || width < BODY_HALF * 2 || height < BODY_ABOVE + NAME_BELOW) return point;
  return {
    x: Math.min(Math.max(point.x, BODY_HALF), width - BODY_HALF),
    y: Math.min(Math.max(point.y, BODY_ABOVE), height - NAME_BELOW),
  };
}

/*
 * ONE COMPONENT NOW. There used to be two, so the pointer store was
 * subscribed to only while a robot was following — and nothing follows any
 * more: the seat lives on the frame, in the companion, and its subject is
 * read there.
 */
export function Occupants(props: OccupantsProps): ReactElement | null {
  return <OccupantsBody {...props} />;
}

function OccupantsBody({ frame, width, height, whereIs, stageRef, pan }: OccupantsProps): ReactElement | null {
  const { robots, noteSeat, principal, store, administered, who, following, follow } = useGraview();
  /*
   * THE OTHERS, on this map. Placed here with this frame's own whereIs, so
   * each viewer draws the same people at the same plots in its own pixels.
   */
  const others = placeOthers([...who.values()], whereIs, width, height);

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
        const name = one.presence.name ?? "somebody";
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
      {/*
        * THE SEAT HAS NO BODY IN THE PICTURE ANY MORE.
        *
        * It stood on a pad when idle, walked to what it wrote, and followed
        * the pointer when pressed, with the chat anchored beside it as a
        * bubble — a thing in the middle of the picture that moved on its
        * own, and nothing at all inside a full-screen lens, where there is
        * no ground to walk on. The companion on the frame says who the seat
        * is, what it is about and what it is doing, at every height and in
        * every mode. What it WROTE is marked on the things themselves.
        *
        * Other people's agents keep their figures: a body in the picture is
        * how you see somebody else at work, which is the whole point of
        * presence.
        */}
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
