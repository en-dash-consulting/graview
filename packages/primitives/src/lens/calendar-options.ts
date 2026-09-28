import type { ArrangeOption, Arrangement } from "@graview/core";

export interface CalendarRoles {
  /** Field holding the date (or date-time) the entry starts. */
  readonly start: string;
  /** Field holding the date it ends. Absent or equal to `start` is a single day. */
  readonly end?: string;
  /** Field that is true when the entry takes the whole day whatever its times say. */
  readonly allDay?: string;
  /** Field holding the entry's own name, where the kind's label is not it. */
  readonly label?: string;
  /**
   * When the entry is finished, so it can read as done — struck and receded.
   *
   * A bare field name means "true when this field is `true`". A predicate —
   * `{ field: "status", is: ["done", "skipped"] }` — means "true when this
   * field holds one of these", which is the shape `lifecycle` already takes
   * and the shape most domains are actually in: the framework spends its
   * whole design arguing that states are enums with names rather than flags,
   * and then the one role that reads completion accepted only a boolean. An
   * app whose task is `open | done | skipped` had to add a second field that
   * duplicates the first and can drift out of step with it, or give up the
   * lens. Both were worse than the lens.
   */
  readonly done?: string | FieldIs;
}

/**
 * A field and the values that make it true — the same shape `lifecycle`
 * takes, so a role that reads a state reads it the way the declaration
 * already writes it.
 */
export interface FieldIs {
  readonly field: string;
  readonly is: readonly unknown[];
}

/** Whether a record satisfies a role bound as a boolean field or a predicate. */
export function holds(record: Readonly<Record<string, unknown>>, role: string | FieldIs | undefined): boolean {
  if (role === undefined) return false;
  if (typeof role === "string") return record[role] === true;
  return role.is.includes(record[role.field]);
}

export const CALENDAR_REQUIRED_ROLES = ["start"] as const;

export type CalendarBindings = Readonly<Record<string, CalendarRoles>>;

/** Which stretch of time the calendar is showing. */
export type CalendarRange = "day" | "week" | "month" | "quarter" | "year" | "years" | "agenda";

/** How coarse one cell of the grid is. */
export type CalendarGrain = "day" | "week" | "month";

/**
 * A SPAN OF YEARS THE APP NAMES.
 *
 * Three years, five, ten — the number is a domain fact, and so is what to
 * call it on a button. A framework that picked either would be answering a
 * question it was never asked.
 */
export interface CalendarHorizon {
  readonly years: number;
  /** What the app calls it: "Five years", "The rotation", "The decade". */
  readonly title: string;
}

export const CALENDAR_RANGES: readonly CalendarRange[] = ["day", "week", "month", "quarter", "year", "agenda"];

/** The ranges this lens offers: every one, plus the horizon where the app named one. */
export function rangesOf(options: { readonly horizon?: CalendarHorizon }): readonly CalendarRange[] {
  return options.horizon ? ["day", "week", "month", "quarter", "year", "years", "agenda"] : CALENDAR_RANGES;
}

/** What a range is called where a person reads it — a button, a place, a title. */
export function titleOf(range: CalendarRange, horizon?: CalendarHorizon): string {
  return range === "years" ? (horizon?.title ?? "Years") : `The ${range}`;
}

export interface CalendarOptions {
  readonly bindings: CalendarBindings;
  /**
   * The day the calendar opens on and calls "today", as `YYYY-MM-DD`.
   *
   * The app's, never the clock's — the same discipline the invariants keep.
   * A lens that read `new Date()` would draw a different picture every
   * morning, and no harness could photograph it twice.
   */
  readonly today: string;
  /** Which range it opens in. Month, unless an app knows better. */
  readonly range?: CalendarRange;
  /**
   * How far out this app ever looks, and what it calls that. Absent means
   * the lens stops at a year, which is the honest answer for an app whose
   * subject never runs longer than one.
   */
  readonly horizon?: CalendarHorizon;
  /** The day a week starts on, 0 = Sunday. Monday, unless an app says otherwise. */
  readonly weekStartsOn?: number;
  /** Hue for an entry, in degrees. Defaults to the node's kind. */
  readonly hueOf?: (entry: PlacedEntry) => number;
  /** How many entries a cell shows before the rest become a count. Per grain, by default. */
  readonly perCell?: number;
  /**
   * Whether the entries may be filtered — and, in the agenda, grouped —
   * from the picture. On unless declined; a calendar's order is its dates,
   * so sorting is never offered. `arrangedBy` is what it opens arranged by.
   */
  readonly arranging?: ArrangeOption;
  readonly arrangedBy?: Arrangement;
}

export interface PlacedEntry {
  readonly id: string;
  readonly kind: string;
  readonly label: string;
  /** `YYYY-MM-DD`, the first day it occupies. */
  readonly from: string;
  /** `YYYY-MM-DD`, the last day it occupies. Equal to `from` for one day. */
  readonly to: string;
  /** Minutes from midnight, where the start named a time. */
  readonly at: number | null;
  readonly allDay: boolean;
  readonly done: boolean;
}
