---
id: "a3cd3340-02cf-473b-a073-b67ce9ec9376"
level: "feature"
title: "The seat view serves an op that names a record that isn't there (FR-67)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-67"
  - "now"
  - "security"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.6, revised)"
startedAt: "2026-10-04T20:55:00.000Z"
completedAt: "2026-10-04T20:55:00.000Z"
endedAt: "2026-10-04T20:55:00.000Z"
acceptanceCriteria:
  - "With hidesFrom(store, seat) false, redact returns the ops unchanged"
  - "With sights, an id that names no record is judged as seesId judges it (seen), so the op is served as it is unless it names a record the seat may not see"
  - "Repro holds: a store with no policy, one node, and a remove-edge op from it to a:ghost is not withheld"
description: "redact(ops, seatLens(store, seat)) withholds an op whose primitive names an id with no record (Cloud's case: a repair removing a dangling fills: vendor:bloom → category:ghost), even with no sees declared, so an app's owner is told 'a change you cannot see' about their own app. Cloud carries served in packages/room/src/room.ts (INTERIM(FR-67))."
lastModified: "2026-10-04T20:55:00.000Z"
---
