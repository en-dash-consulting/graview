---
id: "72468111-fcfe-430b-bdc6-e306880b3ffd"
level: "feature"
title: "A thumbnail reads as a place with no counts (FR-120)"
status: "completed"
priority: "low"
tags:
  - "graview-cloud"
  - "FR-120"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.14)"
startedAt: "2026-10-07T14:12:44.000Z"
completedAt: "2026-10-07T14:52:32.000Z"
endedAt: "2026-10-07T14:52:32.000Z"
acceptanceCriteria:
  - "With fit: \"content\" and no counts, each district stands a few blocks (three, seeded by the kind's name) rather than one"
  - "Cloud's twelve templates drawn with no counts at 264x132 look like their counted versions, not like each other"
description: "Cloud has no per-kind counts for a live app's tile; without them every district draws a single block and every app looks alike."
lastModified: "2026-10-07T14:52:32.000Z"
resolution: "Shipped in #124 (0.1.15): fitted without counts, each district stands three blocks on its whole block, cells and heights drawn from the kind's name; Cloud's twelve templates differ from each other and keep the counted map."
---
