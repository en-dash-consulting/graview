---
id: "f89ca8e2-e7ad-4507-976e-079f44e0794b"
level: "task"
title: "Right click opens the actions at the pointer"
status: "completed"
priority: "high"
blockedBy:
  - "18cd933f-c725-47d6-8a41-58b89967f169"
startedAt: "2026-08-31T02:50:02.425Z"
completedAt: "2026-08-31T02:50:02.425Z"
endedAt: "2026-08-31T02:50:02.425Z"
resolutionType: "code-change"
resolutionDetail: "Right click selects what is under the pointer and opens the same derived affordances there — verified to be the same list the strip renders, arguments included, and to close on Escape."
acceptanceCriteria:
  - "Right click on a pick target or a view selects it and opens a menu at the pointer"
  - "The menu lists the same derived affordances the strip does, including ones needing arguments"
  - "Escape or a click away closes it; the browser's own menu is suppressed only where Graview handles it"
  - "The menu is reachable by keyboard (context-menu key or Shift+F10 equivalent is not required, but focus must not be trapped)"
description: "Once selection stops moving the view, the actions want to be near the thing rather than only in a strip at the bottom. Right click selects the thing under the pointer and opens its derived actions there. Same affordances, same arguments, no second rendering of an action."
---
