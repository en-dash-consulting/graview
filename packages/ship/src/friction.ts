import { isVisitorAuthor, type Principal } from "@graview/core";
import { FRICTION_RETENTION_DAYS, frictionEvent, frictionOf, keptFriction, ownFriction, type FrictionDraft, type FrictionStore } from "@graview/core/friction";
import { FRICTION_PATH } from "./remote-friction.js";

/**
 * THE FRICTION LOG ON THE WIRE (Roadmap f-friction-log): one route,
 * `/graview/friction`. `POST { event }` keeps one thing the asking seat
 * could not do — a search that found nothing, a question left unanswered,
 * an act refused, a tool call refused as invalid — its author the
 * session's, as an act's is, never the body's. `GET` answers the asker's
 * own events and the counts across people (`frictionOf`: never who, and
 * words fewer than two people OTHER than the asker used not said — the
 * asker's own events are left out of the counts, so posting a guess can
 * never confirm what one other person typed).
 *
 * A visitor is never recorded (202, nothing kept) and reads nothing (403).
 * A post over `FRICTION_MAX_BYTES` is refused `limit` (413); more than
 * `perMinute` from one person in a minute is told `busy` (429, with
 * `Retry-After`). A host that keeps none answers 410, and a client stops
 * asking. Nothing here reaches a `node:` builtin.
 */
export { FRICTION_PATH } from "./remote-friction.js";

/** The most a post may carry, in characters. */
export const FRICTION_MAX_BYTES = 2048;
/** How many events one person may post in a minute, unsaid. */
export const FRICTION_PER_MINUTE = 30;

export interface FrictionDoorOptions {
  readonly store: FrictionStore;
  readonly perMinute?: number;
  /** How long events are kept and read back, in days: `FRICTION_RETENTION_DAYS` (90) unsaid. */
  readonly retentionDays?: number;
  /** The fewest distinct people a counted group is said for: 2 unsaid. */
  readonly minPeople?: number;
}

export interface FrictionAnswer {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

const personKey = (seat: Principal): string => {
  const person = seat.onBehalfOf ?? seat;
  return person.id !== undefined ? `${person.kind}:${person.id}` : `${person.kind}:?`;
};

/** The route's answer, with the rate held in this closure, per person. */
export function frictionDoor(options: FrictionDoorOptions): (method: string, text: string, seat: Principal) => Promise<FrictionAnswer> {
  const perMinute = options.perMinute ?? FRICTION_PER_MINUTE;
  const retentionDays = options.retentionDays ?? FRICTION_RETENTION_DAYS;
  let window = { started: Date.now(), counts: new Map<string, number>() };
  return async (method, text, seat) => {
    if (method === "GET") {
      if (isVisitorAuthor(seat)) return { status: 403, body: { error: "A visitor reads nothing of what people could not do here.", reason: "forbidden" } };
      const all = keptFriction(await options.store.list(), { retentionDays });
      return { status: 200, body: { mine: ownFriction(all, seat), counts: frictionOf(all, { reader: seat, ...(options.minPeople !== undefined ? { minPeople: options.minPeople } : {}) }) } };
    }
    if (method !== "POST") return { status: 405, body: { error: `${FRICTION_PATH} is read with GET and added to with POST.`, reason: "invalid" } };
    if (text.length > FRICTION_MAX_BYTES) return { status: 413, body: { error: `One event is at most ${FRICTION_MAX_BYTES} characters.`, reason: "limit" } };
    // Never a visitor's, and a visitor is not told why: there is nothing to tell.
    if (isVisitorAuthor(seat)) return { status: 202, body: { kept: false } };
    const now = Date.now();
    if (now - window.started >= 60_000) window = { started: now, counts: new Map() };
    const key = personKey(seat);
    const used = window.counts.get(key) ?? 0;
    if (used >= perMinute) {
      const wait = Math.max(1, Math.ceil((window.started + 60_000 - now) / 1000));
      return { status: 429, body: { error: "Too many at once: this is kept again in a moment.", reason: "busy", retryAfter: wait * 1000 }, headers: { "retry-after": String(wait) } };
    }
    let asked: unknown;
    try {
      asked = text.length === 0 ? {} : JSON.parse(text);
    } catch {
      asked = undefined;
    }
    const draft = (asked as { event?: unknown } | undefined)?.event;
    // The author is the session's: whatever the body says of who is not read.
    const event = draft && typeof draft === "object" ? frictionEvent(draft as FrictionDraft, seat) : undefined;
    if (!event) {
      return { status: 400, body: { error: 'Say what could not be done: { event: { type: "search-miss", words } | { type: "unanswered", question, place? } | { type: "refused", act, code } | { type: "tool-invalid", tool, act?, message, then? } }.', reason: "invalid" } };
    }
    window.counts.set(key, used + 1);
    await options.store.add(event);
    return { status: 201, body: { kept: true } };
  };
}
