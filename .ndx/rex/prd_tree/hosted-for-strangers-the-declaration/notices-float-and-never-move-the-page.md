---
id: "88525787-eecd-4af2-b7dd-8e933b89242e"
level: "feature"
title: "Notices float, and never move the page (FR-133)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-133"
  - "design"
  - "a11y"
  - "bug"
source: "Graview Cloud, 2026-10-07 (handoff: one app bar, and the scene as a place — from Nick using Farm Bureau POM Workshop)"
startedAt: "2026-10-07T19:25:49.000Z"
completedAt: "2026-10-07T19:25:49.000Z"
endedAt: "2026-10-07T19:25:49.000Z"
acceptanceCriteria:
  - "Undo and other notices draw over the page — bottom-centre on a phone (above the safe area), bottom-left on a desk — with no layout shift; text wraps to two lines before it clips; announced politely; the action (Undo) is a real button"
  - "A banner that must stay (offline, held) sits inside the bar's height or directly under it as an overlay, not a new row"
  - "With an undo notice showing nothing on the page moves (layout shift 0) and its whole sentence is readable or wraps, at 390 and 1280 px in three engines"
description: "The undo notice opens a band under the strip that pushes everything down, and its text is cut off."
lastModified: "2026-10-08T01:00:00.000Z"
resolution: "Shipped in #134 (0.1.16): the way back and the host's toasts are notices in the top layer at the foot of the picture, clear of what stands there; pnpm verify quiet holds no layout shift in three engines."
---
