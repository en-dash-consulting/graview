---
id: "1c1c7317-3736-4878-a72f-9372aaef75b3"
level: "feature"
title: "A view can list related records: a list block with a walk as its source (FR-82)"
status: "completed"
startedAt: "2026-10-06T03:56:09.000Z"
completedAt: "2026-10-06T03:56:09.000Z"
endedAt: "2026-10-06T03:56:09.000Z"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-82"
  - "chat-authored"
  - "security"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
acceptanceCriteria:
  - "The list block works in card, row and page specs with a walk source (out('includes'), in('answers')); each related record is drawn with its own row or card and is a link"
  - "A package's page lists its offers as rows and a note's row lists the offers that answer it, on both faces; a related record the viewer can't see isn't listed or counted"
description: "A to-many walk in a block flattens to 'A, B, C' or a count; no block repeats a sub-view or links each related record."
lastModified: "2026-10-06T03:56:09.000Z"
---
