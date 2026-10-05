---
id: "8eeb5a36-c027-45e5-bcd6-7dfa55799e77"
level: "feature"
title: "A host speaks in the app's own notices: notify() on the embed handle (FR-75)"
status: "completed"
startedAt: "2026-10-05T04:56:18.000Z"
completedAt: "2026-10-05T04:56:18.000Z"
endedAt: "2026-10-05T04:56:18.000Z"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-75"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
acceptanceCriteria:
  - "The embed handle exposes notify({ kind: \"toast\" | \"banner\", sentence, … }) drawn in the framework's own floating-panel look, on the notices layer (FR-76), in both schemes"
  - "A banner can be cleared by the host; Cloud's newer-build notice, offline and held banners, conflict card and toasts can move onto it"
description: "Cloud's notices are its own DOM restyled by hand to look like the framework's floating panels. NOTE: the ask arrived truncated at 'notify({ kind: \"toast\" | \"banner\".' — criteria above are the framework's reading; confirm with Cloud."
lastModified: "2026-10-05T04:56:18.000Z"
---
