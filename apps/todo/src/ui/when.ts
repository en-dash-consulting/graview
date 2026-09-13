/**
 * WHAT DAY IT IS, decided at the edge and threaded in.
 *
 * Never inside a rule and never inside a lens: an invariant that read the
 * clock would give a different answer every morning, could not be tested,
 * and would stop `preview` being able to say what a change would break
 * before it happened. A calendar that read it would draw a different picture
 * every morning and no harness could photograph it twice. Purity is not
 * fussiness; it is what makes both tiers answerable.
 *
 * Its own module because both the shell and the views need it, and the views
 * reaching back into the shell for it would close a cycle.
 *
 * The example data is dated, so a fixed day is what makes its rules fire for
 * a reader who opens it — but freezing the app in September is the sort of
 * thing somebody notices and mistrusts. So the real clock is the default,
 * and `?today=` overrides it for the tests and for the screenshots.
 */
export function today(): string {
  if (typeof window !== "undefined") {
    const asked = new URLSearchParams(window.location.search).get("today");
    if (asked && /^\d{4}-\d{2}-\d{2}$/.test(asked)) return asked;
  }
  return new Date().toISOString().slice(0, 10);
}

/** The day the shipped example is written around, for tests and harnesses. */
export const EXAMPLE_TODAY = "2026-09-01";
