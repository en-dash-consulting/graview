---
id: "61efdb16-34fe-497a-af77-f7926ac614b7"
level: "task"
title: "Three harnesses are failing on main and nobody is being told"
status: "completed"
priority: "high"
tags:
  - "harness"
  - "quality"
source: "Found while verifying 5c901c77, ba5b28d8 and a2bd5497 on 2026-09-22."
startedAt: "2026-09-22T13:51:58.898Z"
completedAt: "2026-09-22T13:51:58.898Z"
endedAt: "2026-09-22T13:51:58.898Z"
resolutionType: "code-change"
resolutionDetail: "pnpm verify runs all eighteen browser harnesses with one verdict — 18 of 18 hold. Four stale harnesses fixed or retired with the reason written where each stood, including one the new chain found that was my own regression from the commit before."
acceptanceCriteria:
  - "verify-menu passes, or the claim it is making is corrected and the harness says the new thing"
  - "The two audit timeouts are fixed, or excluded deliberately with the reason written where the exclusion is"
  - "No committed report under docs/ contains an error it is treating as normal"
  - "There is one command that runs the browser harnesses and gives one verdict, so a failure is visible without knowing which file to open"
description: "Found while running the full chain on 2026-09-22. None were caused by that day's work — each was confirmed by stashing the changes and watching it fail identically. (1) `verify-menu` exits 1: `TimeoutError` waiting for `[aria-label=\"Clear selection\"]`, while the committed `docs/menu.json` records `passed: true`, so it broke at some point since that file was written and the file was never refreshed. (2) `audit-ui` is 37 of 39: `todo/following` and `seedbed/askedNarrow` both time out on a click, and the committed `docs/audit.json` carries the same two errors — a baseline that records its own failures rather than a run that regressed. A report checked in with errors inside it is a report nobody reads. The deeper problem is that a failing harness leaves no mark anybody trips over: `pnpm test` is green, and the browser harnesses are each a separate command nobody is required to run. Worth deciding whether the chain runs as one command with one verdict."
lastModified: "2026-09-22T13:51:58.957Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
