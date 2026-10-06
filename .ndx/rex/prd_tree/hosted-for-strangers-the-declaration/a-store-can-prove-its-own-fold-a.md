---
id: "82d172be-19b2-4a98-9bff-7df8adc8499e"
level: "feature"
title: "A store can prove its own fold: a deterministic snapshot hash and store.verify()"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "operations"
source: "Nick, 2026-10-02: \"think about observability, admin portal, auto-healing, schema fixes… everything\" — Graview Cloud docs/operations.md §3"
startedAt: "2026-10-03T04:57:01.016Z"
completedAt: "2026-10-03T04:57:01.016Z"
endedAt: "2026-10-03T04:57:01.016Z"
acceptanceCriteria:
  - "Two snapshots with the same graph hash the same regardless of node or edge order"
  - "store.verify() reports agreement or the first op after which they diverge"
  - "openStore({ verify: true }) rebuilds a disagreeing snapshot from the log and says so"
description: "WHAT IS THERE NOW: a persisted store is a snapshot plus a log, and nothing checks that the snapshot is the log's fold; a torn write or a bug leaves them disagreeing silently. MISSING: a host that self-heals needs to know. POSITION: snapshotHash(snapshot) — canonical, order-independent, stable across versions that do not change the graph shape; store.verify() refolds the log from empty (or from a trusted checkpoint) and compares; openStore can verify on open and rebuild the snapshot from the log when they disagree, reporting what it did. Cloud carries an interim in its room (INTERIM FR)."
lastModified: "2026-10-03T04:57:01.109Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
