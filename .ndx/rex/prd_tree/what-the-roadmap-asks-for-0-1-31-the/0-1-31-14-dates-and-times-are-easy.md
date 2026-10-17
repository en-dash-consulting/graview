---
id: "67ca62d1-9578-49e1-bcdc-c96cdd198dd3"
level: "task"
title: "0.1.31 · 14: Dates and times are easy to enter and change: a real date and date-time editor built in"
status: "completed"
startedAt: "2026-10-16T17:20:00.000Z"
completedAt: "2026-10-16T18:36:32.000Z"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.31"
source: "conversation"
acceptanceCriteria:
  - "a date and a date-time field get a calendar picker and typed entry that understands what people say (tomorrow 3pm, Fri 10:30, 17 Oct) on the record page, a card's inline edit and an act's form, on both faces"
  - "a date-time is stored as an instant and shown in the viewer's zone, with the zone said, and an end moves with its start"
  - "the editor is keyboard and screen-reader complete and fits a phone, held by a browser harness"
description: "Roadmap f-date-inputs (Nick, 2026-10-16: 'dates and datetimes should have way better built-in input/editing interface'), seen while adding meetings in the calendar demo. Reuse the words parser on @graview/core/words for typed dates."
lastModified: "2026-10-16T18:36:32.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-16 — done on feat/0-1-31-date-inputs.

What it was: a document's `datetime` described itself as text (`describeArg` saw only a refine), so the meetings demo asked for Starts and Ends with bare text boxes wanting `2026-10-17T15:00:00Z`; a code-declared date got the browser's native date or datetime-local box. Now `describeArg` reads `isMoment` (and `z.iso.datetime()`) as `{ type: "date", time: true, instant: true }`, and a form's date field carries `instant`.

One editor, every surface: `WhenInput` (primitives `when-input.tsx`, behind `when-input-door.tsx`; exported from `@graview/primitives` and `/pages` with `prefetchWhenInput`) replaces the native box in `EditableValue` (a record's page and a card, both faces), `DerivedForm`'s `Control` (an act's form on the pages) and `AnswerArgs` (the scene's ask). It reads typed words with `readWhenTyped` on `@graview/core/words` (pure, tested: today/tomorrow/yesterday/tonight, weekdays and "next", "17 Oct"/"Oct 17th 2027", digits in the locale's order, ISO, "in N days/weeks", "next week", times as 3pm/3:30 p.m./15:30/noon/"at 3"), says back what it read with the zone, and sets custom validity on unreadable words so no form sends them. The month (`when-picker.tsx`, its own door) is an APG-style grid: roving tab stop, arrows, Page Up/Down (+Shift for a year), Home/End, Enter, Escape back to its button; Alt+Down opens it from the box. It sits in the flow, `min(100%, 20rem)` wide.

Decisions: an instant field stores UTC with `Z` (what `z.iso.datetime()` accepts and the calendar demo writes); a field whose pattern takes bare `YYYY-MM-DDTHH:MM` keeps wall time (gauntlet's). `momentAsRead` now says an instant with its short zone ("3:00 PM EDT"); the calendar lens reads an instant's day and minutes on the reader's clock (`calendar-dates.ts`), which put evening meetings on the next UTC day before. End-follows-start uses `startAndEndOf` (the `start`/`end` roles, else names like starts/ends, from/until) and `endAfterStartMoved` (keeps the gap; a first start gets an end an hour on for times; a day's empty end is left alone); in place it is one `applyAll` batch, one undo. The parser and the wall-time helpers are split (`when-typed.ts`, `wall-time.ts`) so the calendar and the in-place value carry only the latter.

Budgets: up front +42 B; the scene face before drawn 954,856 B (+7,245), literal raised 926 → 933 KB with a note; raises `scripts/budget-raises/dates-said-as-people-say-them-{pages-face,every-face,studio}.json` (HEAD measured every face 31 B gzipped over already; the raise covers it and says so).

Held by: `packages/core/tests/unit/a-date-is-typed-as-people-say-it.test.ts`, `packages/pages/tests/unit/a-meeting-is-set-by-saying-when.test.tsx`, and `pnpm verify date-inputs` (new; port `date-inputs` in ports.mjs; 11 claims, green in Chromium and WebKit: phrases, zone and instant, end an hour on, record page, keyboard month, Escape, screen-reader names, scene card, scene ask, 390-px phone, no page error). `scripts/lib/journeys.mjs` learned the editor (a text box in `[data-graview-when]` takes a day or a moment) and waits for it to arrive.

Left: the skills are not updated (graview-node-kind and graview-lists are at 10,984 and 10,998 of 11,000 characters); a `time`-only field type does not exist and is not touched; Firefox not run for date-inputs. Pre-existing reds not from this task: `tests/every-harness-honors-the-port-base.test.ts` and the spelling test both flag `scripts/calendar-sync-demo.mjs` (from c0571230); journeys' six desk-width keyboard press counts (W-225).
