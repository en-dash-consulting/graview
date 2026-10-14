---
id: "0ee61f71-18eb-456e-ac55-ed26585e2d70"
level: "feature"
title: "What the 0.1.29 wave left: archives in documents, keep-link per relation, import upserts"
status: "completed"
priority: "medium"
tags:
  - "roadmap"
  - "0.1.29"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
startedAt: "2026-10-14T01:15:00.000Z"
completedAt: "2026-10-14T01:50:00.000Z"
endedAt: "2026-10-14T01:50:00.000Z"
acceptanceCriteria:
  - "A document can say kinds.<kind>.archives: false"
  - "keep-link is permitted per relation (as connects would be), not to anyone with any create act"
  - "importRows can match existing records (by label or a key column) and update them instead of duplicating"
description: "Follow-ups the wave named."
lastModified: "2026-10-14T01:50:00.000Z"
resolution: "Shipped on fix/wave-leftovers-core: a document's `kinds.<kind>.archives: false` (compile, toDocument, describeApp, the checker's grant-act, `set-archives` with its sentence, the studio's round trip); `keep-link` permitted only through acts whose connects/severs name the link's relation; `importRows`/`previewImport` `match: \"label\" | { column, field }` changing a found record through `edit-<kind>` in the same batch, with `proposeMapping` suggesting it."
---
