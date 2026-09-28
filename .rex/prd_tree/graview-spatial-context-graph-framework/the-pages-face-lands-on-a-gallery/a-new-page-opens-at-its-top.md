---
id: "7b6a1f0e-3c2d-4e8f-9a1b-2c3d4e5f6a7b"
level: "task"
title: "A new page opens at its top: the routed face resets the scroll on a new address, and leaves Back to the browser"
status: "completed"
priority: "high"
tags:
  - "pages"
  - "bug"
source: "Nick, 2026-09-27: \"scroll reset in Pages views isn't working\""
startedAt: "2026-09-27T07:20:00.000Z"
completedAt: "2026-09-27T07:40:00.000Z"
endedAt: "2026-09-27T07:40:00.000Z"
resolutionType: "code-change"
resolutionDetail: "ScrollReset in PagesRoutes: on a non-POP navigation whose pathname changed, scroll the nearest scrolling ancestor (an embed's frame, a shell's region) or else the window to the top. A change of search alone does not reset. verify-pages aNewPageOpensAtItsTop: pressed from the foot of chapter sixteen's gallery, the list opens at 0 and Back returns to where the gallery was left."
acceptanceCriteria:
  - "Pressing a card or a kind pill at the foot of the gallery opens the target page scrolled to 0"
  - "Back returns to the gallery where it was left (the browser's own restoration is not overridden)"
  - "Typing into a list filter, which rewrites ?q=, does not move the page"
  - "Inside an embed the frame scrolls, not the host document"
description: "React Router keeps the window's scroll position across client-side navigations; the face never reset it, and the gallery made the home long enough for that to show."
lastModified: "2026-09-27T07:40:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
