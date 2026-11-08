---
id: "0920841f-3dfe-418d-af01-3ecabf7efe29"
type: "change"
title: "F-002 · The proven product layout is not the layout the scaffolder writes"
slug: "f-002-the-proven-product-layout-is-not"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-002. Every first-party product is a workspace with the app under app/ and harness scripts at the root."
acceptanceCriteria:
  - "--workspace (or the default) writes the root package.json, pnpm-workspace.yaml, tsconfig.base.json and vitest.config.ts with the app under app/ and stub harness scripts that say what they would measure"
touches:
  - "6badabc4-8621-488c-99c6-c0d0e6706461"
priority: "medium"
tags:
  - "groundskeeper-feedback"
  - "scaffolder"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
