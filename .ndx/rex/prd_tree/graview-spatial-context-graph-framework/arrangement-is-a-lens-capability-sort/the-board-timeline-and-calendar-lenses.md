---
id: "1fb3d6a2-89dd-4ac8-9995-4cf45660ad57"
level: "task"
title: "The board, timeline and calendar lenses take an arrangement: filter chips on all three, sort within a board's columns and a timeline's rows, grouping where the picture has a place for it"
status: "completed"
priority: "high"
blockedBy:
  - "aeae3ab3-3959-4f0b-8358-49b42f68df2e"
startedAt: "2026-09-28T21:03:19.361Z"
completedAt: "2026-09-28T21:03:19.361Z"
endedAt: "2026-09-28T21:03:19.361Z"
resolutionType: "code-change"
resolutionDetail: "useArranging(props, {allow, lensAllows, arrangedBy, only|subject, kind}) in primitives/lens/arranging.tsx. Board: occupants found through the store, filtered/sorted, slots kept (BoardView.occupants; buildBoard orders occupants by given rank), no group. Timeline: spans filtered/sorted, no group. Calendar: filtered everywhere, agenda grouped under headings (calendar-group), no sort. Options `arranging` (name `arrange` was taken on the board) and `arrangedBy`. Rota fortnight arrangedBy held-at (harness claim theAgendaOpensByWhereEachShiftHappens holds); Things' KindList rewritten over the module (opens by list, open only, by name; harness aListYouArrangedIsALinkYouCanSend holds with list-query). Test a-lens-arranges-before-it-draws.test.tsx. Commit 734259b."
acceptanceCriteria:
  - "createBoardLens, createTimelineLens and createCalendarLens take arrange (false, or per part) and draw the shared ArrangeBar unless declined"
  - "Board: chips sort within a column and filter; timeline: rows sort, filter, and group by an edge; calendar: the agenda filters and groups by an edge, the month grid filters"
  - "An arranged lens is a stop: in.sort/in.filter/in.group travel in the fragment, Back restores them, and dragging still writes through the declared act"
  - "Things sorts tasks by due and hides done; Rota groups shifts by location; both shown in the lens tests and one harness claim"
description: "Each lens reads sort/filter/group from view.within through the shared module and draws the shared ArrangeBar in its own chrome; an option arrange: false | { sort?: false; filter?: false; group?: false } on the create*Lens options turns any part off. The board sorts within columns and filters chips; the timeline sorts and filters rows and may group rows by an edge; the calendar's agenda filters and groups entries by an edge; the month grid filters. Dragging still writes through the declared act. The demos: Things sorts tasks by due and filters done; Rota groups shifts by location."
lastModified: "2026-09-28T21:03:19.435Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
