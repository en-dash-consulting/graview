import { isVisitorAuthor, seesId, type AnySchema, type Principal, type Store } from "@graview/core";
import { changedTelling, curatesOnly, tellingChange, tellingOf, tellsOnly, toldFor, toldSeenBy, type Telling, type TellingDraft, type ToldStore } from "@graview/core/told";

/**
 * WHAT PEOPLE TELL GRAVIEW, ON THE WIRE (Roadmap f-menu-learns): one route,
 * `/graview/told`, the door `toldOver(url)` asks.
 *
 *   POST   `{ telling }`          keeps one, its author the session's, never the body's: 201
 *   PATCH  `/<id>` `{ change }`   its teller changes how it ended, its rating, what it should have done; an owner pins or excludes it
 *   DELETE `/<id>`                its teller or an owner deletes it: 204
 *   GET                           what the asker may read: an owner every telling, anybody else their own and the
 *                                 others' that worked where `minPeople` people agree (`toldFor`) — and of either,
 *                                 only those about records the asker sees (`toldSeenBy`)
 *
 * A visitor is never kept (202) and reads nothing (403). Over
 * `TOLD_MAX_BYTES` is `limit` (413); more than `perMinute` posts and changes
 * from one person in a minute is `busy` (429). A host that keeps none
 * answers 410, and a page stops asking. Nothing here reaches a `node:`
 * builtin.
 */
export { TOLD_PATH } from "@graview/core/told";

/** The most a post or a change may carry, in characters. */
export const TOLD_MAX_BYTES = 16_384;
/** How many posts and changes one person may send in a minute, unsaid. */
export const TOLD_PER_MINUTE = 60;

export interface ToldDoorOptions {
  readonly store: ToldStore;
  /** The app's store: a telling is read back only by somebody who sees every record it names. */
  readonly app?: Store<AnySchema> | (() => Store<AnySchema>);
  /** Who may read every telling, pin, exclude and delete any: unsaid, nobody but each teller of their own. */
  readonly curates?: (seat: Principal) => boolean;
  /** The fewest distinct people whose tellings agree before one is served to somebody else: 2 unsaid. */
  readonly minPeople?: number;
  readonly perMinute?: number;
}

export interface ToldAnswer {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

const personKey = (seat: Principal): string => {
  const person = seat.onBehalfOf ?? seat;
  return person.id !== undefined ? `${person.kind}:${person.id}` : `${person.kind}:?`;
};

/** The route's answer, `rest` the path after `TOLD_PATH` (`""` or `/<id>`), the rate held in this closure, per person. */
export function toldDoor(options: ToldDoorOptions): (method: string, rest: string, text: string, seat: Principal) => Promise<ToldAnswer> {
  const perMinute = options.perMinute ?? TOLD_PER_MINUTE;
  let window = { started: Date.now(), counts: new Map<string, number>() };
  const find = async (id: string): Promise<Telling | undefined> => (await options.store.list()).find((one) => one.id === id);
  return async (method, rest, text, seat) => {
    if (isVisitorAuthor(seat)) return method === "POST" ? { status: 202, body: { kept: false } } : { status: 403, body: { error: "A visitor reads and changes nothing of what people told Graview here.", reason: "forbidden" } };
    const curator = options.curates?.(seat) === true;
    const id = decodeURIComponent(rest.replace(/^\//, ""));
    if (method === "GET" && id === "") {
      const all = await options.store.list();
      const served = toldFor(all, seat, { curator, ...(options.minPeople !== undefined ? { minPeople: options.minPeople } : {}) });
      const app = typeof options.app === "function" ? options.app() : options.app;
      return { status: 200, body: { tellings: app ? toldSeenBy(served, seesId(app as never, seat)) : served } };
    }
    if (text.length > TOLD_MAX_BYTES) return { status: 413, body: { error: `One telling is at most ${TOLD_MAX_BYTES} characters.`, reason: "limit" } };
    const now = Date.now();
    if (now - window.started >= 60_000) window = { started: now, counts: new Map() };
    const key = personKey(seat);
    const used = window.counts.get(key) ?? 0;
    if (used >= perMinute) {
      const wait = Math.max(1, Math.ceil((window.started + 60_000 - now) / 1000));
      return { status: 429, body: { error: "Too many at once: this is kept again in a moment.", reason: "busy", retryAfter: wait * 1000 }, headers: { "retry-after": String(wait) } };
    }
    window.counts.set(key, used + 1);
    let asked: Record<string, unknown> = {};
    try {
      asked = text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>);
    } catch {
      return { status: 400, body: { error: "Send JSON.", reason: "invalid" } };
    }
    if (method === "POST" && id === "") {
      // The author is the session's: whatever the body says of who is not read.
      const telling = tellingOf(asked["telling"] as TellingDraft, seat);
      if (!telling) return { status: 400, body: { error: "Say what was told: { telling: { words, target: { on, kind?, id? }, decided: { type }, outcome } }.", reason: "invalid" } };
      // An id taken by somebody else's telling is not theirs to write over.
      const had = await find(telling.id);
      if (had && personKey(had.by) !== key) return { status: 409, body: { error: "That telling is somebody else's.", reason: "conflict" } };
      await options.store.add(telling);
      return { status: 201, body: { kept: true, id: telling.id } };
    }
    if (id === "") return { status: 405, body: { error: "/graview/told is read with GET and added to with POST; a telling is changed with PATCH and deleted with DELETE at /graview/told/<id>.", reason: "invalid" } };
    const telling = await find(id);
    const own = telling !== undefined && personKey(telling.by) === key;
    if (!telling || (!own && !curator)) return { status: 404, body: { error: "No telling of yours is kept by that id.", reason: "missing" } };
    if (method === "DELETE") {
      await options.store.remove(id);
      return { status: 204, body: null };
    }
    if (method !== "PATCH") return { status: 405, body: { error: "A telling is changed with PATCH and deleted with DELETE.", reason: "invalid" } };
    const change = tellingChange(asked["change"]);
    if (!change) return { status: 400, body: { error: "Say what changed: { change: { outcome?, rating?, should?, pinned?, excluded? } }.", reason: "invalid" } };
    if (curatesOnly(change) && !curator) return { status: 403, body: { error: "Only somebody who keeps the app marks a telling a good example or excludes it.", reason: "forbidden" } };
    if (tellsOnly(change) && !own) return { status: 403, body: { error: "Only who told it says how it ended and how it was.", reason: "forbidden" } };
    await options.store.change(id, change);
    return { status: 200, body: { telling: changedTelling(telling, change) } };
  };
}
