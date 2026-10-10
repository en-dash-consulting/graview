---
id: "9ee370c0-8e80-4df7-ae5c-887b1d6667f8"
level: "feature"
title: "The framework's own markup passes axe at desktop and phone, light and dark"
status: "pending"
priority: "high"
tags:
  - "graview-cloud"
  - "accessibility"
  - "axe"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
acceptanceCriteria:
  - "axe (wcag2a/aa, wcag21a/aa, wcag22aa, best-practice) finds nothing inside the app root of the example apps at 1280x800 and 390x844, light and dark"
  - "A harness holds it"
description: "Cloud's accessibility pass (scripts/a11y.mjs) has reported 48 axe nodes inside #graview-app every release since 0.1.18 and tolerates them as the framework's."
lastModified: "2026-10-10T16:00:00.000Z"
---
