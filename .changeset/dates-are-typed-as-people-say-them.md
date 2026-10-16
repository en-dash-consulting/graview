---
"@graview/core": patch
"@graview/primitives": patch
"@graview/pages": patch
---

A date and a date and time are given as people give them (Roadmap f-date-inputs). Every place a person gives one — a record's value changed in place on its page or its card, an act's form on the pages, the scene's ask — draws one editor (`WhenInput`, on `@graview/primitives` and `/pages`): a text box that reads "tomorrow 3pm", "Fri 10:30", "17 Oct", "in 2 weeks", "next Mon" or "10/17" (in the reader's order of digits), says back in words the day it read and the zone it reads it in, and refuses words that name no day rather than guessing, so the form it is in will not send them. Beside it a button (or Alt with the down arrow) opens a month to pick from, a grid the keyboard walks — arrows, Page Up and Page Down, Home and End, Enter, Escape back to the button — with each day named in full; it sits under the box, so on a phone it never runs off the screen. The editor and its month are fetched when first asked for, and a date that can be changed fetches its editor while the page is idle. A value opened to change is chosen whole, so what is typed replaces it.

A document's `datetime` was asked for as a bare text box that wanted `2026-10-17T15:00:00Z`; `describeArg` now reads it, and `z.iso.datetime()`, as a date with a time that names an instant (`{ type: "date", time: true, instant: true }`, and `instant` on a form's date field). Such a moment is typed on the reader's clock and kept in UTC with its `Z`; a field whose own pattern takes a bare `YYYY-MM-DDTHH:MM` keeps the wall time as written. An instant is said on the reader's clock with its zone ("Oct 17, 2026, 3:00 PM EDT", `momentAsRead`), and a calendar places it on the reader's day and hour rather than UTC's.

An end moves with its start: where a kind (or an act) has a start and an end — its `start` and `end` roles, else fields named for them (`starts`/`ends`, `from`/`until`, …) — a start moved in place carries the end as far, in one change with one undo; in a form or the scene's ask, a first start puts an empty end an hour after it, and a start moved carries the end it had. `@graview/core/words` gains `readWhenTyped`, `storedOfWall`, `wallOfStored`, `wallNow`, `namesInstant`, `zoneSaid`, `endAfterStartMoved` and `startAndEndOf`. `pnpm verify date-inputs` holds it on both faces and a 390-pixel phone.

Nothing up front changes on a hosted page but 42 bytes; the scene face before it draws is 7.2 KB larger (954,856 bytes), and the embed's budgets are raised in `scripts/budget-raises/`.

Compatibility: derived tool names and input schemas — no tool name or input schema changes; a form's date field (`ScalarField`) gains an optional `instant`, and a document's `datetime` argument describes itself as a date with a time instead of as text, so a form and the scene ask for it with the date editor.
