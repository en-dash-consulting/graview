/*
 * THE DEVICE'S OWN PACE (Roadmap f-view-budget-fits-device).
 *
 * A view's time per push (`pushMs`) and the page's time drawing it
 * (`drawMs`) were fixed numbers, so the slowest devices lost their views
 * first: a home view that draws well inside a second on a laptop fell back
 * to the app's own page in a car's browser as "took longer than 1,000 ms".
 * The page measures how long its first worker took to start — from
 * `new Worker` to its runtime's ready, which is the device making a thread,
 * then parsing and running the view's runtime — once, and keeps it: every
 * view on the page is then given its budget times the pace. A fast start
 * (60 ms or under) is pace 1, today's guard; a start four times that or
 * slower is the ceiling, 4. What counts rather than times — the messages a
 * second, the nodes, the bytes — never scales: a flood is a flood on any
 * device.
 */

/** A start this fast, or faster, is a fast device: pace 1. */
export const FAST_START_MS = 60;
/** However slow the start, the budget is never more than this many times its base. */
export const PACE_CEILING = 4;

/** The pace a measured start says, to a tenth: 1 for a fast start, up to the ceiling. */
export function paceOf(startMs: number): number {
  if (!Number.isFinite(startMs) || startMs <= FAST_START_MS) return 1;
  return Math.min(PACE_CEILING, Math.round((startMs / FAST_START_MS) * 10) / 10);
}

/** The time budgets at a pace: whole milliseconds, the base times the pace. */
export function fitBudget<T extends { readonly pushMs: number; readonly drawMs: number }>(base: T, pace: number): T {
  return { ...base, pushMs: Math.round(base.pushMs * pace), drawMs: Math.round(base.drawMs * pace) };
}

/* The first worker's start, kept per page (its window): the second view on the page needs no measuring. */
const starts = new WeakMap<object, number>();

/**
 * Keep the page's first measured start, and answer the one kept: the first
 * measured wins, so a later view's start, fast or slow, changes nothing.
 */
export function keepStart(page: object, startMs: number): number {
  const kept = starts.get(page);
  if (kept !== undefined) return kept;
  starts.set(page, startMs);
  return startMs;
}

/** The start the page kept, if a worker has said ready on it. */
export function keptStart(page: object): number | undefined {
  return starts.get(page);
}

/** Forget the page's start, so the next worker measures again: for tests, which share one window. */
export function forgetStart(page: object): void {
  starts.delete(page);
}
