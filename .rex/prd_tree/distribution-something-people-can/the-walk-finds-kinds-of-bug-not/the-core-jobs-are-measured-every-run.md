---
id: "ceeba87c-ee86-4028-b737-1a815713a7e7"
level: "task"
title: "The core jobs are measured every run, and their friction is the work"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
  - "usability"
  - "harness"
completedAt: "2026-10-01T06:23:18.000Z"
endedAt: "2026-10-01T06:23:18.000Z"
resolutionType: "code-change"
resolutionDetail: "scripts/verify-journeys.mjs derives each app's core jobs from its declaration (make one, find one, change one, relate two, take it back, see what is wrong and repair it, be refused before the press) and drives each in both faces, at 1440 and 390, by keyboard and by pointer, counting presses and naming dead ends; docs/journeys.json keeps the baseline and a ranked friction list; a job that stops being done or costs 30% more fails the run. First baseline over five apps in 281 s; its top blockers (undo on the pages, rota's pages without Find, Find rows that do not say their kind, gauntlet dead ends) are being fixed."
acceptanceCriteria:
  - "the jobs are derived from the declaration, not written per app"
  - "a regression in a job fails the run; new friction is the backlog"
lastModified: "2026-10-01T06:23:18.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
