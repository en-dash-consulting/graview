---
id: "a038f6be-a30c-4f1d-9b53-d31d26ab7193"
level: "task"
title: "Two stack overflows the survey found on 2026-09-19: the shelf's iso block hangs 9px below the stage, and the launcher's matrix is cut at row 10"
status: "completed"
priority: "medium"
tags:
  - "survey"
  - "layout"
  - "stack"
source: "survey harness 2026-09-19, during the city map task 22731804"
startedAt: "2026-09-19T07:25:54.056Z"
completedAt: "2026-09-19T07:49:47.590Z"
endedAt: "2026-09-19T07:49:47.590Z"
acceptanceCriteria:
  - "pnpm survey reports 34 of 34 screens clean at 1560x940 in both schemes"
  - "In the stack no district's iso block extends below its card face"
  - "The launcher's capability matrix is reachable to its last row (scrolls or fits)"
description: "Re-recording the survey after the city landed (baseline was 2026-09-13) flagged three overflows; two are in the STACK and predate the city. (1) todo keeper/reach at 1560x940: the DOM stage (883 tall) has scrollHeight 892 — the `.graview-kind-block` svg of the bottom-row district cards (kind:invitation, kind:user) sits at 829–892 while its card face sits at 827–878, i.e. the block, styled `bottom: 2px`, still ends 14px below the card and 9px below the stage. Measured with the plane-2 host at scale 0.902. The block is invisible in the stack (opacity rides --graview-altitude) but still clips. Either the block should not extend past the face in the stack, or the shelf band (contextY 0.918 / contextH 0.082) should leave the block's overhang. (2) launcher home: the focus host `aggregate:app+capability` (the coverage lens, 26 rows) has content 1516 tall in a box that ends 14px above the last row; the matrix is cut at row 10 with nothing to scroll. A lens taller than its focus box should scroll within its Panel (the harness excludes overflowY auto/scroll) or the focus band should grow for a plain group. Both were recorded as-is in docs/survey.json on 2026-09-19 (26 of 34 screens clean); the third overflow (todo graview, the TASKS district 39px past the stage) was the city's and was fixed by scoring the city's shift for on-canvas area."
lastModified: "2026-09-19T07:49:47.602Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
