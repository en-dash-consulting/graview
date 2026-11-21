import type { Operation } from "./ops/types.js";
import type { Principal } from "./permissions/types.js";

/*
 * WHETHER A STORE AS ITS READER HOLDS IT SAYS A RECORD'S FOUR, ASKED WITHOUT
 * THE JUDGING. What a page and a guest ask before they offer a list's sorts
 * and filters on when each record was made and touched (`offersTouches`)
 * reads only what the store says of itself: what its server said
 * (`markServed`), whether its ops stamp nothing, and whether it is the
 * host's own. Where a seat must be judged, the store answers a key with
 * its own judgment (`TOLD_TO`), the store behind a seat's view too, so this module imports
 * none of `seen.ts`: a bundler puts a whole module in every chunk that
 * reaches it, and the guest host reached the seat's sight through this.
 */

/** The key a seat's view answers with the store it is of and the seat (`seatOf`). */
export const SEAT = Symbol.for("@graview/core:seat");

/** The key a store answers with whether a seat it was given is told a record's four (`toldTouches`), judged by the store. */
export const TOLD_TO = Symbol.for("@graview/core:told-to");

/** Set on a store made from what a seat is served (`markServed`): never the host's own, whoever it was given. */
const SERVED_STORE = Symbol.for("graview.store.served");

/** Whom a store given no seat of its own acts as: the host's store, told everything, not somebody it was made for. */
export const UNSEATED: Principal = Object.freeze({ kind: "human" }) as Principal;
const givenNone = (by: Principal): boolean => by === UNSEATED;

/**
 * WHETHER A STORE AS ITS READER HOLDS IT SAYS WHEN EACH RECORD WAS MADE AND
 * TOUCHED: a seat's view only to a seat that is told them (`toldTouches`),
 * any other store always. What a list offers to sort, filter and group by
 * reads it (`arrangeable(…, { touched })`), so a seat told none of them is
 * offered no way to ask.
 */
export function offersTouches(store: object): boolean {
  const seat = (store as { readonly [SEAT]?: { readonly store: { readonly [TOLD_TO]?: (by: Principal) => boolean }; readonly principal: Principal } })[SEAT];
  if (seat !== undefined) return seat.store[TOLD_TO]?.(seat.principal) ?? false;
  // A store made from what a seat is served (a page's own): told none where its ops say they stamp nothing, or where its own policy keeps something from the seat it was given.
  const own = store as { readonly log?: { all(): readonly Operation[]; readonly length?: number }; readonly policy?: unknown; readonly by?: Principal; readonly graph?: unknown; readonly schema?: unknown; readonly [TOLD_TO]?: (by: Principal) => boolean };
  // What its server said of this seat, where it said: never judged here by a policy read against the seat's roles as the page holds them.
  const served = (store as { readonly [SERVED_STORE]?: { readonly told?: boolean } })[SERVED_STORE];
  if (typeof served?.told === "boolean") return served.told;
  const ops = own.log?.all() ?? [];
  const last = ops[ops.length - 1]?.id;
  const held = OFFERED.get(store);
  if (held && held.length === ops.length && held.last === last) return held.told;
  const host = own.by !== undefined && givenNone(own.by) && !served;
  const told = !ops.some((op) => op.stamps === false) && (own.policy === undefined || own.by === undefined || own.graph === undefined || host || (!givenNone(own.by) && (own[TOLD_TO]?.(own.by) ?? false)));
  OFFERED.set(store, { length: ops.length, last, told });
  return told;
}

/** What `offersTouches` answered of a store, while its log is as long and ends on the same op. */
const OFFERED = new WeakMap<object, { readonly length: number; readonly last: string | undefined; readonly told: boolean }>();

/** What a store's server said of whether its seat is told a record's four (`markServed`); undefined where it said nothing, or it is no served store. */
export const servedTold = (store: object): boolean | undefined => (store as { readonly [SERVED_STORE]?: { readonly told?: boolean } })[SERVED_STORE]?.told;

/**
 * Mark a store made from what a seat is served, so it is never read as the
 * host's own store (`offersTouches`); `told`, where its server said whether
 * that seat is told a record's four (`toldTouches`), is what it answers.
 */
export function markServed<T extends object>(store: T, told?: boolean): T {
  Object.defineProperty(store, SERVED_STORE, { value: typeof told === "boolean" ? { told } : {}, enumerable: false, configurable: true, writable: false });
  return store;
}
