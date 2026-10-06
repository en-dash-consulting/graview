---
id: "4082d14f-4b19-4b95-83f2-aacf8317e35e"
level: "feature"
title: "Edits for lenses, the home, pages, computed fields and the new blocks (FR-84)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-84"
  - "chat-authored"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.9: chat-authored interfaces, ADR 0007)"
startedAt: "2026-10-06T03:56:09.000Z"
completedAt: "2026-10-06T03:56:09.000Z"
endedAt: "2026-10-06T03:56:09.000Z"
acceptanceCriteria:
  - "EDIT_OPS gains add-lens, remove-lens, set-home, arrange-pages and set-computed, plus set-view for the new blocks, each with diff sentences; kind renames and removals rewrite them"
  - "Each op previews, applies and rolls back through editDocument → diffDocuments like the existing 22, with round-trip and rename tests"
description: "Cloud's propose_change needs ops for everything FR-79 to FR-83 adds."
lastModified: "2026-10-06T03:56:09.000Z"
---
