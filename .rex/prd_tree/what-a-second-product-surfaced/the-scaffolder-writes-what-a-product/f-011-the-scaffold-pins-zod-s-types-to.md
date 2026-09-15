---
id: "e82e0c45-b43d-4b01-8827-f5fcc3d1563e"
level: "task"
title: "F-011 · The scaffold pins zod's types to an exact path inside the framework's pnpm store"
status: "completed"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "scaffolder"
source: "groundskeeper-graview/docs/graview-feedback.md"
startedAt: "2026-09-15T00:23:20.360Z"
completedAt: "2026-09-15T00:23:20.360Z"
endedAt: "2026-09-15T00:23:20.360Z"
acceptanceCriteria:
  - "The scaffold does not write a paths entry into another repository's package-manager internals"
  - "Types and runtime resolve the same zod (peer dependency or a re-export from @graview/core)"
description: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-011. tsconfig paths: zod -> ../../visual-system-design/node_modules/.pnpm/zod@4.4.3/…; types from 4.4.3, runtime 4.5.4; a framework bump reads as a corrupted install."
lastModified: "2026-09-15T00:23:20.371Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
