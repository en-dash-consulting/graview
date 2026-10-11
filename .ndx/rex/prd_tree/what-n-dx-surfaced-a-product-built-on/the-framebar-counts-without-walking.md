---
id: "cdb572e6-a881-4202-88f9-9d8301594aea"
level: "feature"
title: "The FrameBar counts without walking every node on each change"
status: "completed"
priority: "medium"
tags:
  - "n-dx"
  - "performance"
  - "bar"
source: "The review round before 0.1.22 (#207), 2026-10-11"
startedAt: "2026-10-11T18:30:00.000Z"
completedAt: "2026-10-11T18:30:00.000Z"
endedAt: "2026-10-11T18:30:00.000Z"
acceptanceCriteria:
  - "The bar's counts follow the change, not the whole graph"
  - "The scale harness on apps/discography holds its frame budget"
description: "FrameBar walks every node on each change."
lastModified: "2026-10-11T18:30:00.000Z"
resolution: "Fixed in #215: the graph keeps a count per kind as records come and go (Graph.count), and the bar reads it instead of walking every record."
---
