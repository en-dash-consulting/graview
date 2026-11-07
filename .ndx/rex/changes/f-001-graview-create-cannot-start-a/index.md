---
id: "39d4fbd8-2b23-47fc-bfac-db4e1d54748c"
type: "change"
title: "F-001 · graview create cannot start a product in a repository that already exists"
slug: "f-001-graview-create-cannot-start-a"
intent: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-001."
acceptanceCriteria:
  - "--merge writes only files that do not exist and lists every collision by name without writing it, exiting non-zero"
  - "--force keeps its current meaning"
touches:
  - "6badabc4-8621-488c-99c6-c0d0e6706461"
priority: "medium"
tags:
  - "groundskeeper-feedback"
  - "scaffolder"
source: "groundskeeper-graview/docs/graview-feedback.md"
---
