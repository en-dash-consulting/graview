---
id: "97dabb47-b317-4f3b-8d95-73e67e38e669"
level: "feature"
title: "A calendar lens in the framework: month, week, day and agenda over real dates, with the demos scheduling through it"
status: "pending"
priority: "high"
tags:
  - "lens"
  - "calendar"
  - "dates"
  - "primitives"
  - "demo"
  - "scheduling"
blockedBy:
  - "d1e36350-e5ba-4c82-843d-87b32aac15b2"
source: "Nick, 2026-09-13: \"/ndx-capture add a more robust calendar view than the Weekly so that it accommodates scheduled dates a bit better. bring as much into the core framework and then use in demo apps where sensible\""
acceptanceCriteria:
  - "createCalendarLens in @graview/primitives binds a kind, a start date or date-time, an optional end and all-day flag and a label by role, and graview check reads the binding like the other starters' (lens-binding-* findings apply)"
  - "month, week, day and agenda ranges; multi-day spans drawn across days; overflow in a month cell says +N more and opens the day; all-day entries in a strip; navigation and the range live in the stop so Back returns to the month you left"
  - "every entry is a pick target and a node: selection lights it in the scene, a flagged entry carries the mark, done and overdue read where declared, moments carry their name"
  - "dragging an entry to a day or picking a date on its record applies the act that writes the date through store.permits, refused with the policy's sentence where it may not, and undo takes it back"
  - "registered with a title it is a place; it works over a group at full fidelity and as a summary; axe is clean at 390 and 1280 in both schemes; the reader's text size and reduced motion are honoured"
  - "Things shows tasks by due date in a month beside the week, Seedbed a season over plantings, Rota its shifts by date; audit-ui and survey carry a calendar state for each, and the launcher lists the calendar among the lenses"
description: "The timeline starter binds a start and an end in minutes of a day and a named column, which is a week grid and nothing more: it cannot show a due date next month, a shift on the 14th, a planting sown in March and harvested in July, or what is on today across every list. Scheduled things need a calendar. This feature adds a calendar lens to @graview/primitives beside coverage, board and timeline, bound by roles the way the others are — a kind, a date or date-time field for the start, an optional end, an optional all-day flag, a label — and offering the ranges a calendar owes: a month grid with multi-day spans drawn across days and overflow said as \"+N more\" that opens the day; a week with timed entries in columns and all-day entries in a strip; a day; and an agenda list grouped by day. Navigation — previous, next, today, and the range — is part of the stop, so a month you were looking at is a URL the trail remembers and Back returns to. Every entry is a pick target and a real node: selecting lights it in the scene, a flagged one carries the rule's mark, done and overdue read as such where the app declares them, and moments carry their name (from the timeline). Rescheduling is an act: dragging an entry to another day, or picking a date on its record, applies the act that writes the date (a declared one, or the derived edit) through store.permits, refused with the policy's sentence where a seat may not. The lens is registered with a title so it is a place, works over a group at full fidelity and as a summary, honours the reader's text size and reduced motion, passes axe, and is declared like the other starters so the checker can read its binding. Then the demos schedule through it where it makes sense: Things gets a month over tasks by due date beside the week, Seedbed a season calendar over plantings sown and harvested, Rota its shifts by date — and the launcher lists the calendar among the lenses. Source: Nick, 2026-09-13: \"add a more robust calendar view than the Weekly so that it accommodates scheduled dates a bit better. bring as much into the core framework and then use in demo apps where sensible\"."
lastModified: "2026-09-13T05:04:44.641Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
