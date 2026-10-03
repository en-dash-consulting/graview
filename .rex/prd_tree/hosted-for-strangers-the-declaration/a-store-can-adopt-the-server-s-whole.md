---
id: "505388a9-8cd1-4c15-9697-08a16fc7b610"
level: "feature"
title: "A store can adopt the server's whole state, with pending batches applied again on top (FR-53)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-53"
source: "Graview Cloud FR-53, 2026-10-03 (brief after 0.1.2)"
startedAt: "2026-10-03T19:14:33.479Z"
completedAt: "2026-10-03T19:14:33.479Z"
endedAt: "2026-10-03T19:14:33.479Z"
acceptanceCriteria:
  - "store.adopt({ snapshot, log, epochs?, horizon? }) (or rebase({ replace })) swaps graph and log, re-applies pending batches as rebase does, and notifies once"
  - "Cloud's client adopt() no longer reaches into the log's private array"
description: "After a resync (a drifted copy, or a gap past what since serves) a client must take the server's log and graph wholesale; the log has no public way to be replaced."
lastModified: "2026-10-03T19:14:33.570Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
