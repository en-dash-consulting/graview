---
id: "62f3c6fd-eb28-4cac-97cb-c44f435d24c7"
level: "feature"
title: "A contrast refusal names the pair and the ratio, with a fix (FR-126)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-126"
  - "chat-authored"
  - "a11y"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
startedAt: "2026-10-07T19:13:27.000Z"
completedAt: "2026-10-07T19:13:27.000Z"
endedAt: "2026-10-07T19:13:27.000Z"
acceptanceCriteria:
  - "A contrast refusal names the pair and the ratio (e.g. 'white text on #e6c200 is 1.6:1; 4.5:1 is needed') with a fix (the nearest passing shade)"
  - "set-brand { accent: \"#e6c200\" } is refused with that sentence and a suggested accent"
description: "An accent refused for contrast doesn't say which pair failed, so a chat can't fix it."
lastModified: "2026-10-08T01:00:00.000Z"
resolution: "Shipped in #133 (0.1.16): set-brand refuses an accent that does not read with the pair, the ratio and the nearest passing shade as its fix; graview check warns brand-accent on a document that holds one."
---
