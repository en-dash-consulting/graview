/**
 * THE CALENDAR LENS: day, week, month, quarter, year and a named horizon.
 *
 * The timeline binds a start and an end in minutes of a day and a named
 * column, which is a week grid and nothing more: it cannot show a due date
 * next month, a shift on the 14th, a planting sown in March and harvested
 * in July, or what is on today across every list. Scheduled things need a
 * calendar, and a calendar needs actual dates.
 *
 * Bound by ROLES, like every other starter. This lens has never heard of a
 * task, a shift or a planting; an app says which of its own fields is the
 * start, which the end, which says a thing takes the whole day and which
 * names it — and gets every range, spans drawn across the cells they cover,
 * overflow that opens the cell rather than hiding it, and every entry a real
 * node the scene can select and a rule can flag.
 *
 * THE CELL COARSENS WITH THE HORIZON. It topped out at a month, so anything
 * further out than four weeks was off the end of every picture the framework
 * could draw: a planting sown in March and lifted in July, a plot on a
 * rotation, a quarter's coverage, a lease, a review cycle. An app whose
 * subject is years had no lens at all — it had a month grid it could page
 * through twelve times. So a quarter draws a week per cell, a year and
 * anything beyond it a month per cell, and an entry that spans cells is
 * drawn across them exactly as a fortnight is already drawn across days.
 *
 * HOW FAR OUT IS THE APP'S TO SAY. Some domains think in three years and
 * some in ten; a framework shipping a "5yr" button has guessed. The horizon
 * is declared with its own span and its own name, or there is no horizon.
 *
 * Dates are ISO strings, because that is what an app's declaration holds and
 * what `isoDate` already validates. A date-time ("2026-09-14T09:30") places
 * the entry at a time within its day; a bare date is an all-day entry. The
 * lens does no timezone arithmetic and no recurrence: both belong to the app
 * that owns the domain, and a framework that guessed at either would be
 * wrong in a different way for every app.
 */

export * from "./calendar-options.js";
export * from "./calendar-dates.js";
export * from "./calendar-placing.js";
export * from "./calendar-view.js";
export * from "./calendar-spans.js";
export * from "./calendar-drawing.js";
