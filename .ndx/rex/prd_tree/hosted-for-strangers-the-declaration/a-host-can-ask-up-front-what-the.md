---
id: "d8e07658-df54-4fea-887a-6af6eebd1928"
level: "feature"
title: "A host can ask up front what the studio will not edit: uneditable(document) (FR-62)"
status: "completed"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-62"
source: "Graview Cloud, 2026-10-04 (brief after 0.1.4)"
startedAt: "2026-10-04T15:31:00.000Z"
completedAt: "2026-10-04T15:31:00.000Z"
endedAt: "2026-10-04T15:31:00.000Z"
acceptanceCriteria:
  - "@graview/studio exports uneditable(document) returning one finding per field property the studio keeps but will not change"
  - "On the vendors fixture it names kinds.vendor.fields.quote and kinds.category.fields.budget"
description: "Cloud copies the studio's rule (a format, a unit, a list's item type) into studioLeaves in workers/cloud/src/builder.ts to warn before anyone tries."
lastModified: "2026-10-04T15:31:00.000Z"
---
