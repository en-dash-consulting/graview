---
id: "6285c90b-5729-425e-99f5-777eb825b40c"
level: "feature"
title: "setApp takes the new label, so a renamed app says its new name without a reload (FR-128)"
status: "completed"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-128"
source: "Graview Cloud, 2026-10-07 (handoff: brand and theme an app from a chat — docs/framework-handoff-branding.md)"
startedAt: "2026-10-07T18:51:54.000Z"
completedAt: "2026-10-07T18:51:54.000Z"
endedAt: "2026-10-07T18:51:54.000Z"
acceptanceCriteria:
  - "setApp takes the new label (or a setLabel)"
  - "After set-name through a chat, the open page's heading shows the new name"
description: "setApp keeps the first mount's label, so a rename shows the old name until a reload."
lastModified: "2026-10-08T01:00:00.000Z"
resolution: "Shipped in #131 (0.1.16): a label that was the app's own name follows the app through setApp, setApp takes { label }, and handle.setLabel and handle.setHostActions rename the embed and change the host's actions in place."
---
