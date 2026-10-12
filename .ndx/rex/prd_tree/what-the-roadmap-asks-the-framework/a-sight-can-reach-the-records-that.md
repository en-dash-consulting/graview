---
id: "8143f52a-d91d-455a-bf71-9f6b797bb426"
level: "feature"
title: "A sight can reach the records that link to you"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "request:visibility-scoped-by-relation-see-records-linked-to-me"
source: "Graview Roadmap: request:visibility-scoped-by-relation-see-records-linked-to-me"
startedAt: "2026-10-12T14:15:00.000Z"
completedAt: "2026-10-12T14:45:00.000Z"
endedAt: "2026-10-12T14:45:00.000Z"
acceptanceCriteria:
  - "A sight can say { kinds, via: '<edge>' } and a seat then sees a record of those kinds only when that edge reaches the seat's own people record"
  - "The sight holds on every path that already honors sight: reads, tools, search, describe, sync, the wire"
  - "A document and TypeScript both declare it, and check refuses an edge that does not reach the people kind"
description: "sees hides whole kinds, plus own: true. A Secret Santa can't show each giver only their own match; a teacher can't see only their students."
lastModified: "2026-10-12T14:45:00.000Z"
resolution: "Shipped in #234: `via: '<relation>'` on a sight, in TypeScript and documents, held on every path sees() is (reads, counts, names, search, describe, the served log, the wire, answers, tools); check says sight-via-unknown-edge and sight-via-misses-people. Secret Santa is the fixture."
---
