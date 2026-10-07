---
id: "41ee5315-89e8-41b8-b064-7cdbce646013"
level: "feature"
title: "One place says how many problems there are (FR-122)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-122"
  - "design"
source: "Graview Cloud, 2026-10-07 (brief after 0.1.14)"
startedAt: "2026-10-07T14:24:40.000Z"
completedAt: "2026-10-07T14:52:32.000Z"
endedAt: "2026-10-07T14:52:32.000Z"
acceptanceCriteria:
  - "On the phone's Pages home the count appears once (the top bar's); the tab and the hero point to it rather than repeat it; the same on the desk"
  - "A fresh vendor app on a phone says \"3 problems\" once above the fold"
description: "A fresh vendor app on a phone said '3 problems' three times: top bar, tab, hero."
lastModified: "2026-10-07T14:52:32.000Z"
resolution: "Shipped in #124 (0.1.15): the embed sets PageContext.standingAbove while its strip is drawn, the shell's Problems tab then carries no count, and the home links to /problems without the number; pnpm verify quiet counts it once on 24 screens."
---
