---
id: "e82e0c45-b43d-4b01-8827-f5fcc3d1563e"
type: "change"
title: "F-011 · The scaffold pins zod's types to an exact path inside the framework's pnpm store"
slug: "f-011-the-scaffold-pins-zod-s-types-to"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-011. tsconfig paths: zod -> ../../visual-system-design/node_modules/.pnpm/zod@4.4.3/…; types from 4.4.3, runtime 4.5.4; a framework bump reads as a corrupted install."
acceptanceCriteria:
  - "The scaffold does not write a paths entry into another repository's package-manager internals"
  - "Types and runtime resolve the same zod (peer dependency or a re-export from @graview/core)"
touches:
  - "6badabc4-8621-488c-99c6-c0d0e6706461"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "scaffolder"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
