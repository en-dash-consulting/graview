---
id: "a9b0da12-9358-474d-9d41-f178cc1942c7"
level: "feature"
title: "A host can read Graview's shape and type: SHAPE, TYPOGRAPHY and isoShade(scheme) from core (FR-73)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-73"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
startedAt: "2026-10-05T04:56:18.000Z"
completedAt: "2026-10-05T04:56:18.000Z"
endedAt: "2026-10-05T04:56:18.000Z"
acceptanceCriteria:
  - "@graview/core exports SHAPE, TYPOGRAPHY and isoShade(scheme) beside LIGHT, DARK and hueFor, and themeCss reads them rather than its own numbers"
  - "Cloud's workers/cloud/src/look.ts imports them with lint/look.test.ts deleted"
description: "Radius, density, the font stacks and the iso block shading exist only inside @graview/primitives' themeCss, so Cloud mirrors them and lints for drift."
lastModified: "2026-10-05T04:56:18.000Z"
---
