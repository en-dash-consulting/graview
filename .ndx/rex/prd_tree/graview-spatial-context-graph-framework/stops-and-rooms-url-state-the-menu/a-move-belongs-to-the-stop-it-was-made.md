---
id: "fef02523-41fc-45ac-a2ab-abc95ea0abe8"
level: "task"
title: "A move belongs to the stop it was made at"
status: "completed"
priority: "high"
tags:
  - "layout"
  - "url-state"
source: "claude-code session 2026-09-10"
startedAt: "2026-09-10T14:59:38.821Z"
completedAt: "2026-09-10T14:59:38.821Z"
endedAt: "2026-09-10T14:59:38.821Z"
resolutionType: "code-change"
resolutionDetail: "packages/layout/src/view-state.ts leavingTheStop and agg: short form; commits a9a6210, 992ac22"
acceptanceCriteria: []
description: "Pins and pan are stored by node id in canvas pixels and were carried to the next stop, holding the card you had dragged as the focus at coordinates that meant nothing there, drawn over the new focus. Changing the focus, rising or descending, and zooming now start where the layout puts things; the old stop keeps its arrangement in its own address so Back returns to it. Also: `focus=agg:<kind>` is a stop's short form, understood by the URL codec."
lastModified: "2026-09-10T14:59:38.835Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
