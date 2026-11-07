---
id: "1c1c7317-3736-4878-a72f-9372aaef75b3"
type: "capability"
title: "A view can list related records: a list block with a walk as its source (FR-82)"
slug: "a-view-can-list-related-records-a-list"
statement: "A view's list block takes a walk as its source and draws each related record with its own row or card as a link, showing only the related records the viewer can see."
criteria: [{"id":"c1","text":"While a card, row or page spec has a list block with a walk source such as out('includes') or in('answers'), the list block shall draw each related record with its own row or card."},{"id":"c2","text":"When a list block draws a related record, the list block shall make that record a link."},{"id":"c3","text":"A package's page shall list its offers as rows, and a note's row shall list the offers that answer it, on both faces."},{"id":"c4","text":"If a related record is one the viewer cannot see, the list block shall neither list nor count that record."}]
tags:
  - "graview-cloud"
  - "FR-82"
  - "chat-authored"
  - "security"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
priority: "high"
---

A to-many walk in a block flattens to 'A, B, C' or a count; no block repeats a sub-view or links each related record.
