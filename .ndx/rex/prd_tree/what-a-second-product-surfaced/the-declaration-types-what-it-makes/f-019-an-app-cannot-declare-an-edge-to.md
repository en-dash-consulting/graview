---
id: "7753eced-d3c7-43f9-a583-6d5cb8e18f47"
level: "task"
title: "F-019 · An app cannot declare an edge to a person without losing its own kind names"
status: "completed"
priority: "high"
tags:
  - "groundskeeper-feedback"
  - "@graview/core"
source: "groundskeeper-graview/docs/graview-feedback.md"
startedAt: "2026-09-14T22:58:58.714Z"
completedAt: "2026-09-14T22:58:58.714Z"
endedAt: "2026-09-14T22:58:58.714Z"
acceptanceCriteria:
  - "declareInstallation returns its kinds as concrete NodeDefinition<'user', …> and NodeDefinition<'invitation', …>"
  - "An edge with to: ['user'] typechecks in an app that spreads installation.kinds into createSchema, with the app's own kind names intact"
  - "Groundskeeper's PERSON cast can be deleted"
description: "Found building Groundskeeper (../groundskeeper-graview), a ten-kind product on Graview. Full write-up with measurements: groundskeeper-graview/docs/graview-feedback.md, F-019. declareInstallation returns AnyNodeDefinition[]; spreading it into createSchema widens every kind name, so the documented edge to 'user' is refused by ValidateEdgeTargets. Groundskeeper casts: PERSON = ['user'] as unknown as ['zone']."
lastModified: "2026-09-14T22:58:58.726Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
