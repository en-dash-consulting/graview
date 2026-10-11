---
id: "b4e10e2d-6471-4da4-9259-08cd2238d737"
level: "feature"
title: "Under report, a local delete and a remote edit become a conflict"
status: "completed"
priority: "medium"
tags:
  - "n-dx"
  - "sync"
source: "The review round before 0.1.22 (#207), 2026-10-11"
startedAt: "2026-10-11T14:10:00.000Z"
completedAt: "2026-10-11T14:10:00.000Z"
endedAt: "2026-10-11T14:10:00.000Z"
acceptanceCriteria:
  - "A local delete of a record the remote edited since the last pull is reported as a conflict"
  - "resolve can keep either side"
  - "A test holds it"
description: "Under conflicts: \"report\", a local delete silently beats a remote edit."
lastModified: "2026-10-11T14:10:00.000Z"
resolution: "Fixed in #211: a local delete of a record the remote edited is a DeletedConflict, held under report; resolve sends the delete (ours) or makes the record again through createInbound (theirs), and the theirs and ours policies do the same in the pass."
---
