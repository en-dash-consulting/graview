import { createViews, type ViewComponent, type ViewProps } from "@graview/react";
import {
  createCalendarLens,
  createCoverageLens,
  createTimelineLens,
  reachLens,
  registerDefaultViews,
} from "@graview/primitives";
import { rotaSchema, type RotaSchema } from "../domain/schema.js";
import { EXAMPLE_TODAY } from "./when.js";

type S = RotaSchema;

/**
 * THREE PICTURES OF ONE ROSTER, and not one of them written here.
 *
 * The coverage grid came from a requirements matrix, the week from a
 * household's calendar, the month from the framework's own calendar lens.
 * This app says which of ITS kinds, fields and edges answer each lens's
 * roles, and that is the whole integration — a claim worth seeing in the
 * app that looks most like something somebody would ship.
 */

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * WHO IS COVERING WHAT: shifts down, volunteers across, the edge in the cell.
 *
 * Rows are the things that must be covered, which is the shifts; columns are
 * the things that do the covering. The edge is declared shift → volunteer,
 * which is the other way round from the lens's first domain — and the lens
 * reads the DECLARATION for the direction rather than assuming one, so this
 * binding needs no adapter and no reversed edge.
 */
export const coverage = createCoverageLens<S>({
  rows: "shift",
  columns: "volunteer",
  link: "covered-by",
});

/** The week, in minutes of a day. */
export const week = createTimelineLens<S>({
  bindings: { shift: { start: "from", end: "until", column: "day" } },
  columns: DAYS.map((id) => ({ id, label: id.toUpperCase() })),
  extent: 1440,
  format: (at) => `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`,
});

/** And the month, over the dates the shifts actually fall on. */
export const month = createCalendarLens<S>({
  bindings: { shift: { start: "on", label: "label" } },
  today: EXAMPLE_TODAY,
  range: "month",
});

const CoverageView = ((props: ViewProps<S>) => (
  <coverage.View {...props} label="Who is covering what" />
)) as ViewComponent<S>;
const WeekView = ((props: ViewProps<S>) => (
  <week.View {...props} label="The week" />
)) as ViewComponent<S>;
const MonthView = ((props: ViewProps<S>) => (
  <month.View {...props} label="The fortnight" />
)) as ViewComponent<S>;
/*
 * AND THE QUARTER, which is how a rota is actually planned.
 *
 * Nobody schedules volunteers a fortnight at a time: cover is worked out a
 * season ahead, and a month grid you page through three times cannot show
 * whether March is thinner than April. The same lens, the same binding, one
 * grain coarser — a week per cell, thirteen of them.
 */
const QuarterCalendar = month.at("quarter");
const QuarterView = ((props: ViewProps<S>) => (
  <QuarterCalendar {...props} label="The quarter" />
)) as ViewComponent<S>;

export function rotaViews() {
  return (
    registerDefaultViews(rotaSchema, createViews(rotaSchema))
      /*
       * FOUR PLACES OVER TWO GROUPS. The week is registered last over the
       * shifts, so it is what the district draws when the address names no
       * picture — the quarter, the month and the coverage grid are one press
       * away and say so on the bar.
       */
      .register("shift", { cardinality: "many", fidelity: "full" }, QuarterView, { title: "The quarter" })
      .register("shift", { cardinality: "many", fidelity: "summary" }, QuarterView, { title: "The quarter" })
      .register("shift", { cardinality: "many", fidelity: "full" }, MonthView, { title: "The fortnight" })
      .register("shift", { cardinality: "many", fidelity: "summary" }, MonthView, { title: "The fortnight" })
      .register("shift", { cardinality: "many", fidelity: "full" }, WeekView, { title: "The week" })
      .register("shift", { cardinality: "many", fidelity: "summary" }, WeekView, { title: "The week" })
      .register("volunteer", { cardinality: "many", fidelity: "full" }, CoverageView, { title: "Who is covering what" })
      .register("volunteer", { cardinality: "many", fidelity: "summary" }, CoverageView, { title: "Who is covering what" })
      /* And what each role reaches, for the seat that keeps the installation. */
      .register("user" as never, { cardinality: "many", fidelity: "full" }, reachLens.View as ViewComponent<S>, { title: "Who may do what" })
      .register("user" as never, { cardinality: "many", fidelity: "summary" }, reachLens.View as ViewComponent<S>, { title: "Who may do what" })
  );
}
