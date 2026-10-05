---
id: "3df1812f-c910-46bc-978b-9ccb7c6b60dc"
level: "feature"
title: "A batch preview is judged as the batch would be: author, via and admit, and the ops as they would be logged (FR-56)"
status: "completed"
startedAt: "2026-10-04T15:31:00.000Z"
completedAt: "2026-10-04T15:31:00.000Z"
endedAt: "2026-10-04T15:31:00.000Z"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-56"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
acceptanceCriteria:
  - "store.previewAll(calls, { author, via, admit }) (or applyAll(calls, { …, dryRun: true })) refuses exactly when applyAll with the same options would: role, sight, guard, and whatever admit throws"
  - "It returns the ops as they would be logged (ids and seq marked as not kept) with violationsAfter"
  - "It writes, logs and tells nothing"
  - "Cloud's request.preview in packages/room/src/room.ts can drop its buildStore copy with packages/room/tests/room.test.ts's preview tests unchanged"
description: "previewAll(calls, context) takes no author, via or admit, and its Preview carries no ops, so a host showing 'this is what will happen' rehearses on a copy of the store. The preview must refuse and report exactly as the apply would."
lastModified: "2026-10-04T15:31:00.000Z"
---
