---
id: "3743a68e-4447-4527-aadd-d4a309934b54"
level: "task"
title: "The pages' resting-pointer chips test holds under full-suite load"
status: "completed"
priority: "medium"
tags:
  - "walkthrough"
  - "carried"
source: "ndx-capture"
startedAt: "2026-10-20T07:18:11.000Z"
completedAt: "2026-10-20T07:18:11.000Z"
endedAt: "2026-10-20T07:18:11.000Z"
resolutionType: "code-change"
resolutionDetail: "W-246: the resting-pointer chips test and its neighbors in several-chosen-and-a-resting-pointer-ask-only-the-fast-slot.test.tsx wait for the state each claim judges (the one chip, about the record its offer names; the Fast slot asked; the bar's offer) through until(), with a five-second deadline, instead of 180 ms against a 150 ms dwell. Absences still wait a settle. Held in three loaded full-suite runs."
acceptanceCriteria:
  - "the test waits for the state it judges, not a time; it holds in three loaded full runs"
description: "W-246: the pages resting-pointer chips test fails under full-suite load and passes alone"
lastModified: "2026-10-20T07:18:11.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
