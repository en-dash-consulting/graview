import { dayZoneFor, instantIn, isoToday } from "./days.js";
import type { Violation } from "./invariants/types.js";

/*
 * THE DAY TURNING (FR-176): the day a store is ticked to, when the next
 * midnight is, and a timer that ticks a store at each. What reads the
 * clock is `clock-readers.ts`' (`@graview/core/check`). The day is the
 * app's (Roadmap f-app-time-zone): the date in its `brand.timeZone`, else
 * the UTC date.
 */

/** What a tick found: the day the rules are now judged on, and the problems the day turning made and mended. */
export interface Tick {
  /** The day the store's rules are judged on from now (YYYY-MM-DD). */
  readonly day: string;
  /** The day they were judged on before, when the store knew one. */
  readonly was?: string;
  /** Problems that stand now and did not before. */
  readonly appeared: readonly Violation[];
  /** Problems that stood before and do not now. */
  readonly cleared: readonly Violation[];
}

/**
 * A moment, or a day, as the day the rule language reads as `today()`: the
 * date in the app's zone (`timeZone`, else the page's app's), else the UTC
 * date, as `isoToday` reads the clock.
 */
export function dayOf(now: Date | string | number, timeZone?: string): string {
  if (typeof now === "string" && /^\d{4}-\d{2}-\d{2}$/.test(now)) return now;
  const at = new Date(now).getTime();
  if (Number.isNaN(at)) throw new Error(`Not a day: ${String(now)}`);
  return isoToday(timeZone, at);
}

const QUARTER = 15 * 60_000;

/**
 * How long from `now` until the day `today()` reads turns, in milliseconds:
 * the next midnight in the app's zone (`timeZone`, else the page's app's),
 * else the next midnight UTC. A day the clock changes on is as long as it
 * is there — 23 hours in spring, 25 in the fall — and where midnight never
 * happens (a zone that springs forward at 24:00), the day's first moment.
 */
export function untilTheDayTurns(now: Date | number = Date.now(), timeZone?: string): number {
  const at = new Date(now).getTime();
  const zone = dayZoneFor(timeZone);
  const today = isoToday(zone, at);
  const next = new Date(Date.parse(`${today}T00:00:00Z`));
  next.setUTCDate(next.getUTCDate() + 1);
  if (!zone) return next.getTime() - at;
  let turn = instantIn(next.toISOString().slice(0, 10), 0, zone);
  // A midnight the clock skips lands either side of the change: the day begins at the first quarter hour whose date is tomorrow.
  while (isoToday(zone, turn) === today) turn += QUARTER;
  while (isoToday(zone, turn - QUARTER) !== today) turn -= QUARTER;
  return turn - at;
}

/**
 * TICKS A STORE AT EVERY TURN OF THE DAY, for as long as it is asked to:
 * just after each midnight by the clock `today()` reads — in the store's
 * `timeZone`, the app's, else UTC. Until the first, the store judges on the
 * clock as it reads it, which is the same day. Answers the way to stop.
 * The timer never holds a process open (`unref`). What `@graview/ship`'s
 * `openStore` and `openRemote` do for the stores they open; a host that
 * keeps a store some other way — a Durable Object, which sleeps through
 * timers — calls `store.tick(now)` from its own alarm, set
 * `untilTheDayTurns(now, store.timeZone)` ahead.
 */
export function tickEachDay(store: { tick(now?: Date): Tick; readonly timeZone?: string | undefined }, onTick?: (tick: Tick) => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const wait = () => {
    // A second past midnight: a timer that fires a hair early would tick to the day that is ending.
    timer = setTimeout(() => {
      const ticked = store.tick(new Date());
      wait();
      onTick?.(ticked);
    }, untilTheDayTurns(Date.now(), store.timeZone) + 1000);
    (timer as { unref?: () => void }).unref?.();
  };
  wait();
  return () => clearTimeout(timer);
}
