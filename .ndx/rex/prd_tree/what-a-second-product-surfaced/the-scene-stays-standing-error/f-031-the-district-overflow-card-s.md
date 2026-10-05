---
id: "c65ccb7c-b5c0-4143-b441-25ae7b6031dd"
level: "task"
title: "F-031 · The district overflow card's names are 22px targets"
status: "completed"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/react"
source: "groundskeeper-graview/docs/graview-feedback.md"
startedAt: "2026-09-15T03:41:39.639Z"
completedAt: "2026-09-15T03:41:39.639Z"
endedAt: "2026-09-15T03:41:39.639Z"
acceptanceCriteria:
  - "Every button in the beyond card is at least 24px tall (max(1.5rem, 24px))"
  - "The stylesheet-reading test from F-022 covers every data-graview-pick control the scene chrome draws, so new chrome inherits the floor"
  - "Groundskeeper's audit-ui holds 36/36 against the fix"
description: "Found by Groundskeeper's audit-ui on the first run after taking the F-018 fix. The beyond card (graview-beyond-list) names each overflowed district with a <button data-graview-pick=kind:…> at 123x21.7 (desktop) and 188x21.7 (phone) — under the 24px floor F-022 raised the chip controls to. Eight audit places fail, all this element. The F-022 stylesheet-reading test does not cover the card because it was written after it."
lastModified: "2026-09-15T03:41:39.650Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
