---
id: "9ee370c0-8e80-4df7-ae5c-887b1d6667f8"
level: "feature"
title: "The framework's own markup passes axe at desktop and phone, light and dark"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "accessibility"
  - "axe"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
startedAt: "2026-10-10T16:00:00.000Z"
completedAt: "2026-10-10T17:00:00.000Z"
endedAt: "2026-10-10T17:00:00.000Z"
acceptanceCriteria:
  - "axe (wcag2a/aa, wcag21a/aa, wcag22aa, best-practice) finds nothing inside the app root of the example apps at 1280x800 and 390x844, light and dark"
  - "A harness holds it"
description: "Cloud's accessibility pass (scripts/a11y.mjs) has reported 48 axe nodes inside #graview-app every release since 0.1.18 and tolerates them as the framework's."
lastModified: "2026-10-10T17:00:00.000Z"
resolution: "All 48 were target-size: a showing's name on a district's signpost was 24 tall in the layout and drawn at its plane's 0.9, so 21.6 on the screen. A name's floor is 27 now, a fingertip as drawn; verify-a11y holds axe at nothing on Cloud's two shapes of app and every example, both faces, desk and phone, light and dark."
---
