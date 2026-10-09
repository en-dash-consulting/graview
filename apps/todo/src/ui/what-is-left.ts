import { dayAsRead } from "@graview/core";

/** A task as the picture reads it: the record's own values, as stored. */
export interface DatedTask {
  readonly done: boolean;
  readonly due?: string;
}

/** One day that has something due, and how much is still open on it or after it. */
export interface DayLeft {
  /** The day as the record keeps it: `2026-08-26`. */
  readonly day: string;
  /** The day as a person reads it: "26 Aug", with the year only when the days cross one. */
  readonly said: string;
  /** Tasks still open that are due on this day or later. */
  readonly left: number;
}

export interface WhatIsLeft {
  readonly days: readonly DayLeft[];
  /** The most left on any day: the top of the scale. */
  readonly peak: number;
  /** Tasks with a date still open. */
  readonly open: number;
  /** Tasks with a date that are done. */
  readonly done: number;
  /** Tasks still open with no date, which no day can show. */
  readonly undated: number;
}

/**
 * WHAT IS LEFT, AS NUMBERS: one point per day that has anything due, and how
 * many open tasks are due on it or later — the work still ahead as each day
 * arrives, falling to what the last day holds.
 *
 * Pure, so the picture and its test read the same numbers; `done` is read
 * as the boolean it is stored as.
 */
export function whatIsLeft(tasks: readonly DatedTask[]): WhatIsLeft {
  const dated = tasks.filter((task) => typeof task.due === "string" && task.due !== "");
  const open = dated.filter((task) => task.done !== true);
  const days = [...new Set(dated.map((task) => task.due!))].sort();
  const years = new Set(days.map((day) => day.slice(0, 4)));
  const said = (day: string) => (years.size > 1 ? dayAsRead(day) : dayAsRead(day).replace(/ \d{4}$/, ""));
  const points = days.map((day) => ({ day, said: said(day), left: open.filter((task) => task.due! >= day).length }));
  return {
    days: points,
    peak: Math.max(0, ...points.map((point) => point.left)),
    open: open.length,
    done: dated.length - open.length,
    undated: tasks.filter((task) => task.done !== true && !(typeof task.due === "string" && task.due !== "")).length,
  };
}

/**
 * WHICH DAY LABELS FIT under the line: the first always, then each one that
 * starts clear of the last kept, and the last day in place of whichever
 * kept label it would overlap. `xs` are the labels' centers, `width` says
 * how wide one is drawn, `gap` the room between two.
 */
export function labelsThatFit(xs: readonly number[], width: (index: number) => number, gap: number): number[] {
  if (xs.length === 0) return [];
  const clear = (a: number, b: number) => xs[b]! - width(b) / 2 - (xs[a]! + width(a) / 2) >= gap;
  const kept = [0];
  for (let index = 1; index < xs.length; index += 1) if (clear(kept[kept.length - 1]!, index)) kept.push(index);
  const last = xs.length - 1;
  if (kept[kept.length - 1] !== last) {
    while (kept.length > 1 && !clear(kept[kept.length - 1]!, last)) kept.pop();
    if (kept.length > 1 || clear(0, last)) kept.push(last);
  }
  return kept;
}
