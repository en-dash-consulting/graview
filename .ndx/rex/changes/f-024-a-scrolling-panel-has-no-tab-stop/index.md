---
id: "8ffffacc-28bc-4864-9b74-d4e3c52bc423"
type: "change"
title: "F-024 · A scrolling panel has no tab stop"
slug: "f-024-a-scrolling-panel-has-no-tab-stop"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-024. axe at 390px: scrollable-region-focusable on the week and the year. Panel's overflow scroller (the one useOverflowing watches) is scrollable and not focusable."
acceptanceCriteria:
  - "Panel's scroller has tabindex=0, a role and an accessible name when it overflows"
  - "axe reports no scrollable-region-focusable violation on the calendar lens at 390px"
touches:
  - "4382c67b-1055-4623-b8fb-62b9be3fa330"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/primitives"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
