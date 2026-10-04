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
  /** What they are: a person, an agent, a rule, a system. A server says it from the seat (FR-47); absent from an older word, read the key. */
  readonly kind?: Participant["kind"];
  /** What to call them. Absent for an anonymous viewer, who is counted rather than drawn. */
  readonly name?: string;
  /** The id of the person an agent acts for (FR-47), from its seat — never from what a client claims. */
  readonly onBehalfOf?: string;
  /** What to call that person: "Claude, for Ada". Withheld with `onBehalfOf` from a seat that may not see them. */
  readonly onBehalfOfName?: string;
  readonly hue: number;
  /** Where they are: `toUrl(view)`, the complete answer. */
  readonly stop: string;
  /** What they are hovering, when they have chosen to share it. */
  readonly over?: string | null;
  /** Their seat's robot, if it has a body somewhere. */
  readonly robot?: PresenceRobot;
  /** When they last said so, ISO. */
  readonly at: string;
  /**
   * When an ANNOUNCED visitor goes, ISO (FR-47): an agent acting over MCP or
   * an RPC, a polling tab — somebody without a socket, stamped by a host.
   * Until then they stand without a heartbeat; after it, they are gone.
   */
  readonly until?: string;
  /**
   * HELD BY AN OPEN SOCKET, as the server says it — never a client: this
   * presence stands as long as the server lists it, whatever its `at`. The
   * server drops it the moment the socket closes, so it needs no heartbeat
   * to stay, and a client holding a list it was told does not expire it.
   */
  readonly held?: "socket";
}

export interface PresenceChannel {
  /**
   * Say where you are. Called on every change and on every heartbeat; a
   * channel whose server holds it by socket says it again only on a change.
   */
  here(presence: Presence): void;
  /** Told who else is here, every time that changes. Returns the way to stop listening. */
  onWho(listener: (who: readonly Presence[]) => void): () => void;
  /** Say you have gone, and stop. */
  leave(): void;
}

/** How long a presence stands after its last word: three missed heartbeats at the poll's own pace. */
export const PRESENCE_TTL_MS = 2500;

/**
 * HOW LONG A PRESENCE FROM SOMEWHERE ELSE STANDS (FR-13). A list that came
 * over a wire was stamped by a server's clock and read by a browser's, and
 * it arrives at the poll's pace rather than the heartbeat's, so it is given
 * four times a tab's own grace. Past it a participant is gone whether or
 * not the channel ever said so: a host's channel that forgets to drop
 * somebody does not keep them on the map.
 */
export const REMOTE_PRESENCE_TTL_MS = PRESENCE_TTL_MS * 4;

/**
 * HOW LONG AN ANNOUNCED VISITOR STANDS (FR-47) when a host does not say:
 * an agent between two calls is thinking, not gone.
 */
export const VISITOR_PRESENCE_TTL_MS = 30_000;

/**
 * WHAT TO CALL THEM, in a room: "Claude, for Ada" for an agent whose
 * person may be named, the name alone otherwise, and "" for an anonymous
 * viewer, who is counted rather than drawn.
 */
export function presenceName(presence: Presence): string {
  const name = presence.name ?? "";
  return name && presence.onBehalfOfName ? `${name}, for ${presence.onBehalfOfName}` : name;
}

/**
 * Whether a presence still stands at `now`: while a socket holds it, until
 * its announced time, or within the TTL of its last word.
 */
export function presenceStands(presence: Presence, now: number, ttlMs: number = PRESENCE_TTL_MS): boolean {
  if (presence.held === "socket") return true;
  if (presence.until !== undefined) return now < Date.parse(presence.until);
  return now - Date.parse(presence.at) < ttlMs;
}

/** The parts of a participant key: who, and which tab of theirs. */
export interface Participant {
  readonly kind: "human" | "agent" | "rule" | "system";
  readonly id?: string;
  readonly session?: string;
}

const PARTICIPANT_KINDS: ReadonlySet<string> = new Set(["human", "agent", "rule", "system"]);

/**
 * THE ONE DIALECT. A participant is `kind:id:session`: the op log's own
 * reading of an author (`Author.kind`, `.id`, `.session`), a figure's key on
 * the map, and what the wire's presence routes carry, so a figure and its
 * edits are the same person by construction. A host that says who is here
 * from its own server writes this, and only this.
 */
export function participantKey(participant: Participant): string {
  return `${participant.kind}:${participant.id ?? ""}:${participant.session ?? ""}`;
}

/**
 * A participant key read back. The kind is everything before the first
 * colon and the session everything after the last, so an id that holds a
 * colon (`mcp:claude`) survives. Null for anything that is not a key.
 */
export function parseParticipant(key: string): (Participant & { readonly session: string }) | null {
  const first = key.indexOf(":");
  const last = key.lastIndexOf(":");
  if (first < 0 || last === first) return null;
  const kind = key.slice(0, first);
  if (!PARTICIPANT_KINDS.has(kind)) return null;
  const id = key.slice(first + 1, last);
  return { kind: kind as Participant["kind"], ...(id ? { id } : {}), session: key.slice(last + 1) };
}

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
    if (presenceStands(presence, now, ttlMs)) next.set(participant, presence);
  }
  for (const presence of arrived) {
    if (!presenceStands(presence, now, ttlMs)) {
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
    a.kind === b.kind &&
    a.name === b.name &&
    a.onBehalfOf === b.onBehalfOf &&
    a.onBehalfOfName === b.onBehalfOfName &&
    a.until === b.until &&
    a.held === b.held &&
    a.hue === b.hue &&
    a.stop === b.stop &&
    (a.over ?? null) === (b.over ?? null) &&
    (a.robot?.at ?? null) === (b.robot?.at ?? null) &&
    (a.robot?.mode ?? null) === (b.robot?.mode ?? null)
  );
}
