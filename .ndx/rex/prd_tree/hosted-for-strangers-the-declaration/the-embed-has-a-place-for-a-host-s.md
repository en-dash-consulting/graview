---
id: "eb680abe-316e-4efe-8185-226bdd48a451"
level: "feature"
title: "The embed has a place for a host's own actions, in the bar's profile menu (FR-72)"
status: "completed"
startedAt: "2026-10-05T04:56:18.000Z"
completedAt: "2026-10-05T04:56:18.000Z"
endedAt: "2026-10-05T04:56:18.000Z"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-72"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
acceptanceCriteria:
  - "mount(root, { hostActions: [{ label, href }] }) draws them in the bar's profile menu, keyboard reachable, in both schemes"
  - "A hosted Cloud app shows 'Change the app / Your apps / Report this app' there, and nothing Cloud draws is fixed-position over the scene"
description: "Cloud draws its own <details> menu floating bottom right above the zoom control (reportLink in workers/cloud/src/routes/app.ts, changeLink in packages/client/src/shell.ts)."
lastModified: "2026-10-05T04:56:18.000Z"
---
