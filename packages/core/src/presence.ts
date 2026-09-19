/*
 * WHO IS WHERE — a fact about a person at a screen, not a change to the graph.
 *
 * Presence never enters the op log. It is a payload each viewer sends about
 * itself — which stop it is on, what it is hovering, where its robot stands
 * — and each viewer draws everybody else on ITS OWN map from those facts,
 * so two windows of different sizes agree about who is at the tasks plot
 * without agreeing about a single pixel. The channel that carries it is
 * behind one interface with two implementations in `@graview/ship`: a
 * BroadcastChannel between tabs of one origin, and two routes on the served
 * store folded into the poll it already makes.
 */

export interface PresenceRobot {
  /** What the robot stands at: a node id, `kind:<kind>`, or null for its dock. */
  readonly at: string | null;
  readonly mode: string;
}

export interface Presence {
  /** `kind:id:session` — the op log's own reading of an author, so a figure and its edits agree. */
  readonly participant: string;
  /** What to call them. Absent for an anonymous viewer, who is counted rather than drawn. */
  readonly name?: string;
  readonly hue: number;
  /** Where they are: `toUrl(view)`, the complete answer. */
  readonly stop: string;
  /** What they are hovering, when they have chosen to share it. */
  readonly over?: string | null;
  /** Their seat's robot, if it has a body somewhere. */
  readonly robot?: PresenceRobot;
  /** When they last said so, ISO. */
  readonly at: string;
}

export interface PresenceChannel {
  /** Say where you are. Called on every change and on every heartbeat. */
  here(presence: Presence): void;
  /** Told who else is here, every time that changes. Returns the way to stop listening. */
  onWho(listener: (who: readonly Presence[]) => void): () => void;
  /** Say you have gone, and stop. */
  leave(): void;
}

/** How long a presence stands after its last word: three missed heartbeats at the poll's own pace. */
export const PRESENCE_TTL_MS = 2500;

/**
 * The others as they are now: what arrived, minus what has gone quiet, minus
 * yourself. Pure, so a test can ask what a viewer sees without a channel.
 */
export function foldPresence(
  known: ReadonlyMap<string, Presence>,
  arrived: readonly Presence[],
  now: number,
  ttlMs: number = PRESENCE_TTL_MS,
  self?: string,
): Map<string, Presence> {
  const next = new Map<string, Presence>();
  for (const [participant, presence] of known) {
    if (now - Date.parse(presence.at) < ttlMs) next.set(participant, presence);
  }
  for (const presence of arrived) {
    if (now - Date.parse(presence.at) >= ttlMs) {
      next.delete(presence.participant);
      continue;
    }
    const held = next.get(presence.participant);
    if (!held || Date.parse(held.at) <= Date.parse(presence.at)) next.set(presence.participant, presence);
  }
  if (self !== undefined) next.delete(self);
  return next;
}

/** Two presences that would draw the same figure in the same place. */
export function samePresence(a: Presence | undefined, b: Presence | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.participant === b.participant &&
    a.name === b.name &&
    a.hue === b.hue &&
    a.stop === b.stop &&
    (a.over ?? null) === (b.over ?? null) &&
    (a.robot?.at ?? null) === (b.robot?.at ?? null) &&
    (a.robot?.mode ?? null) === (b.robot?.mode ?? null)
  );
}
