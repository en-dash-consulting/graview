---
id: "e38fd489-8ac8-4ac4-8c27-49742a28c76c"
level: "task"
title: "An edge reads from the end you stand on, and the checker demands both readings"
status: "completed"
priority: "high"
tags:
  - "schema"
  - "check"
  - "words"
source: "claude-code session 2026-09-10"
startedAt: "2026-09-10T14:59:37.316Z"
completedAt: "2026-09-10T14:59:37.316Z"
endedAt: "2026-09-10T14:59:37.316Z"
resolutionType: "code-change"
resolutionDetail: "packages/layout/src/layout.ts edgeReading, packages/core/src/cli/check.ts edge-without-inverse; commit 08befa1"
acceptanceCriteria: []
description: "The scene's caption over a neighbour took the declaring side's words in both directions, so a gardener's plot read \"who looks after it\" as though the plot looked after her. The layout now reads the declaration's `inverse` along an incoming edge, as the pages and the connections panel already did. `graview check` warns `edge-without-inverse` for an edge declared with one reading or none, naming what the far end would be captioned with. The seedbed, launcher, scaffold, skill example and test fixtures declare both readings; fixtures written from the wrong side were turned around."
lastModified: "2026-09-10T14:59:37.330Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
