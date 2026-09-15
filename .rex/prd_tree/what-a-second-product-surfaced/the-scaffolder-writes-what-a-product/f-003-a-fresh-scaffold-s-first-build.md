---
id: "5d1f3117-ed68-4a2a-b50e-fe1bff61e6bf"
level: "task"
title: "F-003 · A fresh scaffold's first build prints a bundle-size warning"
status: "completed"
priority: "medium"
tags:
  - "groundskeeper-feedback"
  - "scaffolder"
source: "groundskeeper-graview/docs/graview-feedback.md"
startedAt: "2026-09-15T00:23:34.975Z"
completedAt: "2026-09-15T00:23:34.975Z"
endedAt: "2026-09-15T00:23:34.975Z"
acceptanceCriteria:
  - "The scaffolded vite.config.ts sets manualChunks splitting the framework from app code along the tier boundary"
  - "A one-kind app's first build prints no size warning"
description: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-003. Splitting along the framework's own tier boundary (core/layout/tools/ship vs the UI packages) keeps both halves under the 500 kB warning and caches the framework across app changes."
lastModified: "2026-09-15T00:23:34.988Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
