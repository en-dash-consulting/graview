---
id: "1fb3d6a2-89dd-4ac8-9995-4cf45660ad57"
type: "change"
title: "The board, timeline and calendar lenses take an arrangement: filter chips on all three, sort within a board's columns and a timeline's rows, grouping where the picture has a place for it"
slug: "the-board-timeline-and-calendar-lenses"
intent: "Each lens reads sort/filter/group from view.within through the shared module and draws the shared ArrangeBar in its own chrome; an option arrange: false | { sort?: false; filter?: false; group?: false } on the create*Lens options turns any part off. The board sorts within columns and filters chips; the timeline sorts and filters rows and may group rows by an edge; the calendar's agenda filters and groups entries by an edge; the month grid filters. Dragging still writes through the declared act. The demos: Things sorts tasks by due and filters done; Rota groups shifts by location."
acceptanceCriteria:
  - "createBoardLens, createTimelineLens and createCalendarLens take arrange (false, or per part) and draw the shared ArrangeBar unless declined"
  - "Board: chips sort within a column and filter; timeline: rows sort, filter, and group by an edge; calendar: the agenda filters and groups by an edge, the month grid filters"
  - "An arranged lens is a stop: in.sort/in.filter/in.group travel in the fragment, Back restores them, and dragging still writes through the declared act"
  - "Things sorts tasks by due and hides done; Rota groups shifts by location; both shown in the lens tests and one harness claim"
touches:
  - "403807ea-da01-4875-a566-d8ba92d1dd0c"
priority: "high"
blockedBy:
  - "aeae3ab3-3959-4f0b-8358-49b42f68df2e"
---
