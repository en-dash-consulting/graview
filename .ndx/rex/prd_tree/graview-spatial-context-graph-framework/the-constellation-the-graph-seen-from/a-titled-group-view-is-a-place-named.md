---
id: "e5be736d-c421-46c5-ab28-b7c6e6db539e"
level: "task"
title: "A titled group view is a place: named lenses in the bar and the embed strip"
status: "completed"
priority: "high"
tags:
  - "lens"
  - "navigation"
source: "claude-code session 2026-09-10"
startedAt: "2026-09-10T14:59:35.518Z"
completedAt: "2026-09-10T14:59:35.518Z"
endedAt: "2026-09-10T14:59:35.518Z"
resolutionType: "code-change"
resolutionDetail: "packages/core/src/views/types.ts places(), packages/primitives/src/places.tsx, embed strip; commit a10c8d0"
acceptanceCriteria: []
description: "`register(kind, cell, view, { title })` names a group view; `views.places()` lists the names; the `Places` primitive shows them as pills in the Shell bar and on the embed strip, pressed while the group is the focus on the ground. A lens over the gardeners was only reachable by focusing that group; click into a member and it was gone with nothing on screen to say it existed. The registration's title is also the picture's label. The lens skill teaches the title."
lastModified: "2026-09-10T14:59:35.530Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
