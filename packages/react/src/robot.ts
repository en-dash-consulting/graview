import { participantKey, type Author } from "@graview/core";

/**
 * THE SEAT IS A ROBOT IN THE CITY, and where it stands is DERIVED.
 *
 * A seat's body is not decoration: it stands where the seat read, where it
 * wrote, at the gate of the plot it may not enter, on the doorstep of the
 * node it is asking about — and at its dock when it has nothing to do.
 * Every one of those is a fact the interface already sees: the runtime's
 * calls, the log's ops, the store's refusals, the seat's own replies. This
 * fold turns them into one state per participant and nothing else decides
 * it. Pure, so it can be tested like `markActivity`.
 *
 * A participant is `kind:id:session` — the same key the op log attributes
 * to — so the body and the log can never disagree about who moved.
 */

/**
 * What the seat is doing. `following` retired with the figure that walked
 * the ground: the seat lives on the frame now, and what it is about is the
 * companion's subject, not a body trailing the pointer. `docked` stays as
 * the resting state the rail says "listening" for.
 */
export type RobotMode = "docked" | "reading" | "writing" | "refused" | "asking";

export interface RobotState {
  readonly participant: string;
  /** The seat's own name, for its label. */
  readonly who: string;
  /** What it stands at: a node id, `kind:<kind>` for a whole neighborhood, or null for its dock. */
  readonly at: string | null;
  readonly mode: RobotMode;
  /** What it is saying, if anything: a reply, a refusal, a question, a stop reason. */
  readonly say?: string;
  /** How sure, when the seat decided rather than talked. */
  readonly confidence?: number;
  /** A run's own name, when the figure is a run rather than the tab's seat. */
  readonly caption?: string;
  /** The pick target under the pointer while following. */
  readonly over?: string | null;
  /** When it last did anything, in ms. */
  readonly since: number;
  /** Where it has been this turn, most recent last — the trail. */
  readonly trail: readonly string[];
}

export type RobotEvent =
  | { readonly type: "read"; readonly author: Author; readonly ids: readonly string[]; readonly at: number }
  | { readonly type: "write"; readonly author: Author; readonly ids: readonly string[]; readonly at: number }
  | { readonly type: "about-to-write"; readonly author: Author; readonly ids: readonly string[]; readonly at: number }
  | { readonly type: "refused"; readonly author: Author; readonly at: number; readonly where: string | null; readonly say: string }
  | { readonly type: "asking"; readonly author: Author; readonly at: number; readonly where: string | null; readonly say: string; readonly confidence?: number }
  | { readonly type: "said"; readonly author: Author; readonly at: number; readonly say: string; readonly confidence?: number; readonly caption?: string }
  | { readonly type: "over"; readonly author: Author; readonly at: number; readonly over: string | null }
  | { readonly type: "home"; readonly author: Author; readonly at: number }
  | { readonly type: "rest"; readonly at: number; readonly holdMs: number };

/** An event as a surface tells it: the time is filled in on arrival. Distributive over the union, or TypeScript keeps only the common keys. */
export type SeatNote = RobotEvent extends infer E ? (E extends RobotEvent ? Omit<E, "at"> & { readonly at?: number } : never) : never;

/** One participant's identity across a window — the op log's own reading of an author. */
export function participantOf(author: Author): string {
  return participantKey(author);
}

const TRAIL = 12;

/** How many targets a turn visits one by one before it stands at the kind instead. */
export const VISIT_EACH_UP_TO = 4;

function stateOf(robots: ReadonlyMap<string, RobotState>, author: Author, at: number): RobotState {
  const participant = participantOf(author);
  return (
    robots.get(participant) ?? {
      participant,
      who: author.id ?? author.kind,
      at: null,
      mode: "docked",
      since: at,
      trail: [],
    }
  );
}

const walked = (trail: readonly string[], at: string | null): readonly string[] =>
  at === null || trail[trail.length - 1] === at ? trail : [...trail, at].slice(-TRAIL);

/**
 * Where a set of ids puts the robot: the one thing, or — past a handful —
 * the neighborhood, because a figure sprinting between eleven cards says
 * less than one standing where the work is. `kindOf` reads a node's kind so
 * a set of one kind becomes that kind's plot.
 */
export function standingFor(ids: readonly string[], kindOf: (id: string) => string | undefined): string | null {
  const real = ids.filter((id) => id.length > 0);
  if (real.length === 0) return null;
  if (real.length <= VISIT_EACH_UP_TO) return real[0]!;
  const kinds = new Set(real.map((id) => kindOf(id)).filter((kind): kind is string => kind !== undefined));
  if (kinds.size === 1) return `kind:${[...kinds][0]!}`;
  return real[0]!;
}

/**
 * Folds one event into the robots. Only agents have bodies: a person is at
 * the keyboard, a rule is the store's own, a system is elsewhere. A
 * following robot stays following through reads and writes — the person
 * asked it to come — until released or a turn is over.
 */
export function foldRobots(
  robots: ReadonlyMap<string, RobotState>,
  event: RobotEvent,
  kindOf: (id: string) => string | undefined,
): Map<string, RobotState> {
  const next = new Map(robots);
  if (event.type === "rest") {
    for (const [key, robot] of robots) {
      if (robot.mode === "asking") continue;
      if (robot.mode !== "docked" && event.at - robot.since >= event.holdMs) {
        next.set(key, { ...robot, mode: "docked", at: null, trail: [], say: undefined, confidence: undefined });
      }
    }
    return next;
  }
  if (event.author.kind !== "agent") return next;
  const robot = stateOf(robots, event.author, event.at);
  const put = (patch: Partial<RobotState>) => next.set(robot.participant, { ...robot, ...patch, since: event.at });
  switch (event.type) {
    case "read": {
      const at = standingFor(event.ids, kindOf);
      put({ at, mode: "reading", trail: walked(robot.trail, at) });
      return next;
    }
    case "about-to-write":
    case "write": {
      const at = standingFor(event.ids, kindOf);
      put({ at, mode: "writing", trail: walked(robot.trail, at), say: undefined, confidence: undefined });
      return next;
    }
    case "refused":
      put({ at: event.where, mode: "refused", say: event.say, confidence: undefined, trail: walked(robot.trail, event.where) });
      return next;
    case "asking":
      put({ at: event.where ?? robot.at, mode: "asking", say: event.say, ...(event.confidence !== undefined ? { confidence: event.confidence } : { confidence: undefined }), trail: walked(robot.trail, event.where) });
      return next;
    case "said":
      put({ say: event.say, ...(event.confidence !== undefined ? { confidence: event.confidence } : { confidence: undefined }), ...(event.caption ? { caption: event.caption } : {}) });
      return next;
    case "over":
      // What the pointer is on, for a surface that wants it — the companion
      // reads its own subject, but a presence figure still says where a
      // teammate's agent is looking.
      put({ over: event.over });
      return next;
    case "home":
      put({ at: null, mode: "docked", trail: [], say: undefined, confidence: undefined, over: null });
      return next;
    default:
      return next;
  }
}
