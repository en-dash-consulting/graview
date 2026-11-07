---
id: "5d1f3117-ed68-4a2a-b50e-fe1bff61e6bf"
type: "change"
title: "F-003 · A fresh scaffold's first build prints a bundle-size warning"
slug: "f-003-a-fresh-scaffold-s-first-build"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-003. Splitting along the framework's own tier boundary (core/layout/tools/ship vs the UI packages) keeps both halves under the 500 kB warning and caches the framework across app changes."
acceptanceCriteria:
  - "The scaffolded vite.config.ts sets manualChunks splitting the framework from app code along the tier boundary"
  - "A one-kind app's first build prints no size warning"
touches:
  - "6badabc4-8621-488c-99c6-c0d0e6706461"
priority: "medium"
tags:
  - "groundskeeper-feedback"
  - "scaffolder"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
