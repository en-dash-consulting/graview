---
id: "f89ca8e2-e7ad-4507-976e-079f44e0794b"
type: "change"
title: "Right click opens the actions at the pointer"
slug: "right-click-opens-the-actions-at-the"
intent: "Once selection stops moving the view, the actions want to be near the thing rather than only in a strip at the bottom. Right click selects the thing under the pointer and opens its derived actions there. Same affordances, same arguments, no second rendering of an action."
acceptanceCriteria:
  - "Right click on a pick target or a view selects it and opens a menu at the pointer"
  - "The menu lists the same derived affordances the strip does, including ones needing arguments"
  - "Escape or a click away closes it; the browser's own menu is suppressed only where Graview handles it"
  - "The menu is reachable by keyboard (context-menu key or Shift+F10 equivalent is not required, but focus must not be trapped)"
touches:
  - "2b687f3c-6253-4b93-86cf-0e592ae9fcdf"
priority: "high"
blockedBy:
  - "18cd933f-c725-47d6-8a41-58b89967f169"
---
