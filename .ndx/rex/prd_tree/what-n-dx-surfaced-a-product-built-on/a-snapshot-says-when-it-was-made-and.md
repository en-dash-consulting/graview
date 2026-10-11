---
id: "b493c452-7a87-4405-8704-e3b29e0bd291"
level: "feature"
title: "A snapshot says when it was made and what it holds, and can load by kind"
status: "completed"
priority: "high"
tags:
  - "n-dx"
  - "ship"
  - "snapshot"
source: "n-dx's Graview projection notepad, 2026-10-10 (../n-dx, packages/graview and packages/graview-face)"
startedAt: "2026-10-10T22:05:00.000Z"
completedAt: "2026-10-10T23:10:00.000Z"
endedAt: "2026-10-10T23:10:00.000Z"
acceptanceCriteria:
  - "A snapshot header with generatedAt and per-kind counts"
  - "A line-delimited or kind-partitioned body the adapter can load lazily"
  - "Old snapshots still load"
description: "n-dx's 3.3 MB snapshot loads whole into a memory adapter on every page load; nothing says how stale it is or what kinds it holds."
lastModified: "2026-10-10T23:10:00.000Z"
resolution: "Done in #198: @graview/core/snapshot writes a header line (generatedAt, records and links per kind, where each kind's lines are) and a record per line; readSnapshot and fetchSnapshot take only the kinds asked for, an old { nodes, edges } file reads as format 1, and every --seed reads either."
---
