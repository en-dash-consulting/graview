---
id: "2675b82f-f2a5-4f16-adab-2e019358df1d"
level: "task"
title: "Drive-in thumbnails and lenses draw a budget: at most 24 members to a thumbnail, mounted on screen and still; built-in lenses say '+N more'"
status: "completed"
priority: "high"
blockedBy:
  - "b5c001b9-6f4e-47e8-b46c-d73d3e18278b"
startedAt: "2026-09-29T07:22:18.548Z"
completedAt: "2026-09-29T07:32:23.685Z"
endedAt: "2026-09-29T07:32:23.685Z"
resolutionType: "code-change"
resolutionDetail: "Thumbnails: THUMBNAIL_BUDGET 12 (24 was still a 576-cell matrix), mostRelevant (flagged, then degree, own order), WhenSeen (IntersectionObserver on a real box — display:contents never intersects — plus useSceneStill; one mount per animation frame; stays mounted). Motion store in react (createMotionStore, useSceneStill; the scene sets moving from dragging || steering || frame.t < 1 — the tween frame is never === result). ViewProps.budget/total; useArranging draws no row under a budget (the row's far-end select was 1,177 options — the real cost); farEndsOf capped at FAR_ENDS 40 most connected; coverage capCoverage to the budget; board/timeline/calendar return through withMore ('+N more songs'). graview-lens skill step 7 says it. Altitude 21,335 → 1,161 elements with thumbnails drawn (theCityAtAltitudeIsLight holds); rise 21,495 → 2,493 with all four drawn. Tests: a-thumbnail-is-a-picture (3), marquee and imports tests updated."
acceptanceCriteria:
  - "the altitude home over the real catalogue is under 3,000 elements (theCityAtAltitudeIsLight)"
  - "a thumbnail never holds more than 24 members' marks, and none is mounted off screen or mid-motion"
  - "each built-in lens given a budget draws at most that many and names the rest"
  - "graview-lens carries the sentence within its budget"
description: "A drive-in thumbnail is handed at most 24 of the kind's members by relevance and is mounted only while its district is on screen and the scene is not moving. ViewProps gains budget; the built-in lenses (board, timeline, calendar, coverage, the Group view) honour it and say '+N more' in the kind's words; the graview-lens skill says what a lens does with it."
lastModified: "2026-09-29T07:32:23.751Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
