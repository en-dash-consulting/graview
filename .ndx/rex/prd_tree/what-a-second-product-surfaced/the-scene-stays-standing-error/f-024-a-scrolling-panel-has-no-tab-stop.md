---
id: "8ffffacc-28bc-4864-9b74-d4e3c52bc423"
level: "task"
title: "F-024 · A scrolling panel has no tab stop"
status: "completed"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/primitives"
source: "groundskeeper-graview/docs/graview-feedback.md"
startedAt: "2026-09-14T22:39:36.019Z"
completedAt: "2026-09-14T22:39:36.019Z"
endedAt: "2026-09-14T22:39:36.019Z"
acceptanceCriteria:
  - "Panel's scroller has tabindex=0, a role and an accessible name when it overflows"
  - "axe reports no scrollable-region-focusable violation on the calendar lens at 390px"
description: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-024. axe at 390px: scrollable-region-focusable on the week and the year. Panel's overflow scroller (the one useOverflowing watches) is scrollable and not focusable."
lastModified: "2026-09-14T22:39:36.030Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
