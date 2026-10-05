---
id: "c5efc332-411b-48a5-9de7-73229a9c0f7d"
level: "feature"
title: "A picture of an app without a browser: sceneThumbnail(document, { scheme }) as an SVG string (FR-74)"
status: "completed"
startedAt: "2026-10-05T04:56:18.000Z"
completedAt: "2026-10-05T04:56:18.000Z"
endedAt: "2026-10-05T04:56:18.000Z"
priority: "medium"
tags:
  - "graview-cloud"
  - "FR-74"
source: "Graview Cloud, 2026-10-05 (brief after 0.1.8; staging live at staging.graview.cloud)"
acceptanceCriteria:
  - "A pure sceneThumbnail(document, { scheme }) returns an SVG string with the Scene's district layout and hues, with no DOM or React"
  - "Cloud's app and template tiles use it"
description: "A host listing apps wants a small Scene-like picture of each; Cloud draws its own iso tiles from each app's kinds with hueFor and copied shading."
lastModified: "2026-10-05T04:56:18.000Z"
---
