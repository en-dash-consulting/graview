import { createViews, type ViewComponent, type ViewProps } from "@graview/react";
import { createCalendarLens, createCoverageLens, registerDefaultViews } from "@graview/primitives";
import { gauntletSchema, type GauntletSchema } from "../domain/schema.js";

type S = GauntletSchema;

/** The day the programme's calendar opens on: the first day of the latest edition. */
export const PROGRAMME_TODAY = "2026-09-28";

/**
 * THE TIMETABLE: talks and workshops on one calendar, each by its own start
 * (W-144). It opens on the week of the latest edition — two hundred talks in
 * three days — and looks out over the ten years.
 */
export const timetable = createCalendarLens<S>({
  bindings: { talk: { start: "startsAt" }, workshop: { start: "startsAt" } },
  today: PROGRAMME_TODAY,
  range: "week",
  horizon: { years: 10, title: "Ten editions" },
});

/** What the talks are about: thousands of rows, forty-eight columns (W-122). */
export const aboutLens = createCoverageLens<S>({ rows: "talk", columns: "topic", link: "about" });

const TimetableView = ((props: ViewProps<S>) => <timetable.View {...props} label="The timetable" />) as ViewComponent<S>;
const AboutView = ((props: ViewProps<S>) => <aboutLens.View {...props} label="What the talks are about" />) as ViewComponent<S>;

export function views() {
  return registerDefaultViews(gauntletSchema, createViews(gauntletSchema))
    .register("talk", { cardinality: "many", fidelity: "full" }, AboutView, { title: "What the talks are about" })
    .register("talk", { cardinality: "many", fidelity: "summary" }, AboutView, { title: "What the talks are about" })
    .register("talk", { cardinality: "many", fidelity: "full" }, TimetableView, { title: "The timetable" })
    .register("talk", { cardinality: "many", fidelity: "summary" }, TimetableView, { title: "The timetable" })
    .register("workshop", { cardinality: "many", fidelity: "full" }, TimetableView, { title: "The timetable" })
    .register("workshop", { cardinality: "many", fidelity: "summary" }, TimetableView, { title: "The timetable" });
}
