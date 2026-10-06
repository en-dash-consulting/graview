---
id: "8ba8f8fd-cd84-4762-b1b8-6197541b4282"
level: "task"
title: "F-020 · A module you can never turn off is still warned about"
status: "completed"
priority: "medium"
tags:
  - "groundskeeper-feedback"
  - "@graview/core"
source: "groundskeeper-graview/docs/graview-feedback.md"
startedAt: "2026-09-14T23:08:43.944Z"
completedAt: "2026-09-14T23:08:43.944Z"
endedAt: "2026-09-14T23:08:43.944Z"
acceptanceCriteria:
  - "A module can declare itself required (declareInstallation({ required: true }) or modules: { x: { optional: false } })"
  - "graview check skips module-edge-leak for a required module"
  - "Groundskeeper's three answered warnings become zero"
description: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-020. Groundskeeper ships three module-edge-leak warnings for edges to users, all argued in prose in app.ts, because the installation module cannot be off."
lastModified: "2026-09-14T23:08:43.954Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
