---
id: "ff6f572e-efb9-486f-900e-e5ae76f2b5fa"
level: "feature"
title: "Sentences use the declaration's words for an edge (FR-142)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-142"
  - "bug"
  - "words"
source: "Graview Cloud, 2026-10-08 (handoff: a record drawn twice, and the scene's own place control — Nick on 0.1.17)"
completedAt: "2026-10-08T21:18:53.000Z"
endedAt: "2026-10-08T21:18:53.000Z"
acceptanceCriteria:
  - "The panel's line about a record's ties says the edge as the declaration says it (its inverse's name or description), never the internal key"
  - "The count is said plainly: 4 of 4 is all"
  - "The reproduction's panel says 'Covers 4 topics' or close, with no partOf and no 'most'"
description: "The left panel says 'Holds 4 of 4 \"partOf\" — most of them'."
lastModified: "2026-10-08T21:18:53.000Z"
resolution: "Shipped in #155 (0.1.18): edgeWords says a relation from either end in its description or inverse, else its key spoken; the seat's panel says Covers: all 4 topics."
---
