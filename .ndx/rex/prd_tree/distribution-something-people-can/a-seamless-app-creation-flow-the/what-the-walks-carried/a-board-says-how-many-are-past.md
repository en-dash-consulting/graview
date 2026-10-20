---
id: "ba128186-2c75-4d59-b7d0-170d6d3e7d8b"
level: "task"
title: "A status board says how many records the lifecycle hides"
status: "completed"
priority: "medium"
tags:
  - "walkthrough"
  - "carried"
source: "ndx-capture"
startedAt: "2026-10-20T07:27:20.000Z"
completedAt: "2026-10-20T07:27:20.000Z"
endedAt: "2026-10-20T07:27:20.000Z"
resolutionType: "code-change"
resolutionDetail: "W-244: each column of the status board (packages/primitives/src/lens/columns.tsx) counts the records the kind's lifecycle keeps behind the horizon in it and says \"+N past\" where it said \"Nothing here.\" (under its cards where it has some), its region name says \"N past\" too, and one press draws them in that column. Not on a picture with a budget, nor while the line narrows. Criterion: packages/pages/tests/unit/a-board-says-how-many-are-past.test.tsx (verified failing first)."
acceptanceCriteria:
  - "a column with records hidden by the lifecycle says how many and how to see them"
description: "W-244: a status board says "Nothing here." over columns holding about 2,500 records hidden by the lifecycle, with no "+N past""
lastModified: "2026-10-20T07:27:20.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
