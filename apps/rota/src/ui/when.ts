/**
 * The day the roster is judged and drawn against — read at the edge and
 * threaded in, never from inside a rule or a lens. The shipped example is
 * written around a particular fortnight, so a fixed day is what makes it
 * legible to somebody opening it; `?today=` overrides it for the harnesses.
 *
 * The real clock is never read here: on the real week the example's
 * fortnight is long past, and the week every page opened on was empty. The
 * store is made with this day (`createRotaUiStore`), so `store.today()` —
 * which the calendars, the rules and the pages read — says it too.
 */
export function today(): string {
  if (typeof window !== "undefined") {
    const asked = new URLSearchParams(window.location.search).get("today");
    if (asked && /^\d{4}-\d{2}-\d{2}$/.test(asked)) return asked;
  }
  return EXAMPLE_TODAY;
}

/** The Monday the shipped roster opens on. */
export const EXAMPLE_TODAY = "2026-09-14";
