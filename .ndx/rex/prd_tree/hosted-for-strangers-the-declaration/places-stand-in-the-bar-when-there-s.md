---
id: "25e05754-3481-4d97-b102-141a89f0de6f"
level: "feature"
title: "Places stand in the bar when there's room (FR-145)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-145"
  - "design"
source: "Graview Cloud, 2026-10-08 (handoff: a record drawn twice, and the scene's own place control — Nick on 0.1.17)"
completedAt: "2026-10-08T22:10:00.000Z"
endedAt: "2026-10-08T22:10:00.000Z"
acceptanceCriteria:
  - "On both faces, with room after the name, the switch and the tools, the first places in declared order (the current one always among them) stand as plain text items and the rest fold into More ▾"
  - "The count is measured from the bar's real width and recomputed on resize; the bar stays one row of 48 px; a phone keeps the single control"
  - "At 1920 the reproduction's app shows four or more places in the bar; fewer at 1280; the single control at 390; the bar never wraps"
description: "Nick: 'Might also be nice to have some of them available with a More dropdown when screen real estate allows (for pages nav and scene nav)'. An extension of FR-138, not a reversal."
lastModified: "2026-10-08T22:10:00.000Z"
resolution: "Shipped in #156, merged through #162 (0.1.18): places stand on the bar's row as words where there is room, the rest under More, the one control where there is not; pnpm verify quiet measures it on both faces, three engines."
---
