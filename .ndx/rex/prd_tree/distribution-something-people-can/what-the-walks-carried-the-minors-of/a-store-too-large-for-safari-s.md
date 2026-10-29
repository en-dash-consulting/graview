---
id: "781dbbe0-20ae-4543-abad-1ef1da73d2f7"
level: "task"
title: "A store too large for Safari's localStorage persists, in IndexedDB"
status: "completed"
startedAt: "2026-10-20T07:50:00.000Z"
completedAt: "2026-10-20T08:36:00.000Z"
endedAt: "2026-10-20T08:36:00.000Z"
priority: "medium"
tags:
  - "engines"
source: "ndx-capture"
acceptanceCriteria:
  - "the browser adapter keeps a store past localStorage's limit (IndexedDB), in all three engines"
  - "the gauntlet in WebKit reloads with its edits"
description: "Found fixing the Nightly's engines leg (#330): WebKit's 5 MB localStorage cannot hold the gauntlet's 2.8 MB seed; since #330 the store opens and reports the failed write, but nothing is kept"
lastModified: "2026-10-20T08:36:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
