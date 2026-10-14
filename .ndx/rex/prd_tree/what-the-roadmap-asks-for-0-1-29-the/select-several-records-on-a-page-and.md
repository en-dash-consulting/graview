---
id: "dd0e99fc-d01d-4a2d-ba1d-af9b10d8b6e4"
level: "feature"
title: "Select several records on a page and act on them at once"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.29"
  - "f-bulk-acts-pages"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
startedAt: "2026-10-13T23:40:00.000Z"
completedAt: "2026-10-14T02:15:00.000Z"
endedAt: "2026-10-14T02:15:00.000Z"
acceptanceCriteria:
  - "A selection on list, board and kind-stop pages (checkbox column on desk, long-press on a phone, Shift-click ranges, keyboard)"
  - "The acts every selected record shares are offered once and run as one batch with one undo"
  - "Refusals are named per record"
  - "Accessible: the selection is announced and keyboard operable"
description: "Every act on a page is on one record; marking six tasks done is six rounds."
lastModified: "2026-10-14T02:15:00.000Z"
resolution: "Shipped on feat/act-on-several: boxes, Shift ranges, Cmd/Ctrl-A, Space, Escape and a long press choose records on the pages list, the kind stop and a status board; a bar fetched with the first one chosen offers the acts they share (actsForSeveral) and runs one as one batch with one undo (actOnSeveral), naming each refused record while the rest apply; a seat does the same with act_on_several."
---
