---
id: "1e08c7c8-916a-4736-9e35-c3de11f81c55"
level: "feature"
title: "The studio changes a field in place: its type, required flag, options and description (FR-61)"
status: "completed"
startedAt: "2026-10-04T15:31:00.000Z"
completedAt: "2026-10-04T15:31:00.000Z"
endedAt: "2026-10-04T15:31:00.000Z"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-61"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
acceptanceCriteria:
  - "The studio offers acts for a field's type, required flag, options and description"
  - "Changing vendor's notes from text to string through the act yields edits() equal to [{ op: 'retype-field', kind: 'vendor', field: 'notes', type: 'string' }]"
  - "Each act's edits are the ones documentEdits already produces (retype-field, set-required, set-options, set-label)"
description: "STUDIO_MUTATIONS adds, renames and removes kinds, fields and edges, but cannot change a field, though documentEdits already turns such changes into edit ops."
lastModified: "2026-10-04T15:31:00.000Z"
---
