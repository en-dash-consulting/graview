---
id: "0c41c15d-711d-4635-a043-fe75ce1f0b4a"
level: "feature"
title: "A named step is a move: an act that sets the column field to a constant offers a move to that column (FR-108)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-108"
  - "security"
source: "Graview Cloud, 2026-10-06 (brief after 0.1.12)"
startedAt: "2026-10-06T20:49:02.000Z"
completedAt: "2026-10-06T20:49:02.000Z"
endedAt: "2026-10-06T20:49:02.000Z"
acceptanceCriteria:
  - "columnMoves also offers an act that sets the column field to a constant, as a move to that value's column, offered only where its allowedWhen holds for that record, running the act as declared with its side effects"
  - "Where both exist, the named step wins over a free set-<field> act"
  - "In the vendor template without set-status: a researching vendor offers Contacted (mark-contacted), Booked (book) and Declined (decline); a declined one offers only Contacted (reopen); a move to Fixed in the bug bash stamps fixedOn"
description: "Templates added an unguarded set-status act so boards could move cards, skipping each step's guard and side effects (no fixed date; Accepted without an offer)."
lastModified: "2026-10-06T20:49:02.000Z"
---
