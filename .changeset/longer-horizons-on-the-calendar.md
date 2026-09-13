---
"@graview/primitives": patch
"@graview/seedbed": patch
"@graview/rota": patch
"@graview/launcher": patch
---

Longer horizons on the calendar lens: a quarter, a year, and a span of years the app names.

The calendar topped out at a month, so anything further out than four weeks was off the end of every picture the framework could draw: a planting sown in March and lifted in July, a plot on a rotation, a quarter's coverage, a lease, a review cycle. An app whose subject was years had no lens at all — it had a month grid it could page through twelve times.

The same lens now draws a quarter, a year, and a multi-year horizon **whose span the app names** — three years, five, ten — rather than a "5yr" button the framework guessed at. One binding and no new declaration: a lens declared once draws at every horizon, and `graview check` reads exactly the binding it already read.

The cell coarsens with the horizon — a week per cell at a quarter, a month per cell at a year and beyond — and `spanOf` now answers with CELLS rather than days, because a day cell and a month cell differ in how much ground they cover and in nothing else. An entry spanning cells is drawn across them the way a fortnight is already drawn across days, keeping its name where it begins and again wherever a row does, which is what a wall calendar does. Above a month, listing everything stops being a picture, so each cell carries what fits at full fidelity and the rest as a count with the rules' own flag on it.

Each range is an addressable stop, and `lens.at(range)` registers one as a titled place of its own: `places()` lists it, the URL names which one you are in, pressing a cell opens one level finer, and Back returns to the year you left. Rescheduling is unchanged — the declaration's own act, judged by `store.permits`, refused in the policy's words — with one new honesty: dropping onto a cell coarser than the date the act writes says which day it wrote, rather than rounding silently.

The demos exercise them, which is the only way anyone finds out whether they are any good. Seedbed gains a sixteenth chapter: a `rotation` kind, one act, and four years of two beds turning through four families — the first thing in the garden whose subject is years rather than one season — plus a year over the plantings. Rota gains a quarter over its shifts, which is how a roster is actually planned. `verify-calendar.mjs` drives all of it in a real browser: forty-eight cells over four named years, a rotation drawn across the eight months it runs, drilling into 2028 and coming back, a coarse drop saying what date it wrote, axe clean at 390 and 1280 in both schemes, no spill at 200% text, and the reader's motion setting honoured.
