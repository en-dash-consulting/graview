import type { Violation } from "./invariants/types.js";

/*
 * THE DAY TURNING (FR-176): the day a store is ticked to, when the next
 * midnight is, and a timer that ticks a store at each. What reads the
 * clock is `clock-readers.ts`' (`@graview/core/check`).
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

/** A moment, or a day, as the day the rule language reads as `today()`: the UTC date, as `isoToday` reads the clock. */
export function dayOf(now: Date | string | number): string {
  if (typeof now === "string" && /^\d{4}-\d{2}-\d{2}$/.test(now)) return now;
  const at = new Date(now);
  if (Number.isNaN(at.getTime())) throw new Error(`Not a day: ${String(now)}`);
  return at.toISOString().slice(0, 10);
}

/** How long from `now` until the day `today()` reads turns (the next midnight, UTC), in milliseconds. */
export function untilTheDayTurns(now: Date | number = Date.now()): number {
  const at = new Date(now).getTime();
  const next = new Date(at);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - at;
}

/**
 * TICKS A STORE AT EVERY TURN OF THE DAY, for as long as it is asked to:
 * just after each midnight by the clock `today()` reads (UTC). Until the
 * first, the store judges on the clock as it reads it, which is the same
 * day. Answers the way to stop. The timer never holds a process open
 * (`unref`). What `@graview/ship`'s `openStore` and `openRemote` do for
 * the stores they open; a host that keeps a store some other way — a
 * Durable Object, which sleeps through timers — calls `store.tick(now)`
 * from its own alarm.
 */
export function tickEachDay(store: { tick(now?: Date): Tick }, onTick?: (tick: Tick) => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const wait = () => {
    // A second past midnight: a timer that fires a hair early would tick to the day that is ending.
    timer = setTimeout(() => {
      const ticked = store.tick(new Date());
      wait();
      onTick?.(ticked);
    }, untilTheDayTurns() + 1000);
    (timer as { unref?: () => void }).unref?.();
  };
  wait();
  return () => clearTimeout(timer);
}
