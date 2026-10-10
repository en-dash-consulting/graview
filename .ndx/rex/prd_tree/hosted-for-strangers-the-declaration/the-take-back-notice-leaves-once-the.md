---
id: "3938df11-4bf2-41d2-9f82-895208f3939a"
level: "feature"
title: "The \"Take back\" notice leaves once the act is settled, and can be closed (FR-152)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-152"
  - "pages"
  - "notices"
source: "Graview Cloud, 2026-10-10 (the framework brief after 0.1.20, ../graview-cloud/docs/framework-brief-0.1.21.md)"
acceptanceCriteria:
  - "The notice stands while the act can be taken back without thought (a few seconds, or until the next act or a move to another page), then goes"
  - "It carries a close control a keyboard reaches"
  - "Taking back stays reachable afterwards from history/activity"
  - "Pages and the scene behave alike"
description: "After an act on Pages, the notice offering \"Take back …\" stayed at the foot of the picture for the rest of the session: it never faded and nothing on it closed it, so every page carried a stale offer."
startedAt: "2026-10-10T20:00:00.000Z"
completedAt: "2026-10-10T20:00:00.000Z"
endedAt: "2026-10-10T20:00:00.000Z"
lastModified: "2026-10-10T20:00:00.000Z"
resolution: "Fixed in #195: the Pages offer goes after 10 s (held while pointed at or focused), with the next act, a move to another page or its × close; Cmd/Ctrl+Z still takes back."
---
