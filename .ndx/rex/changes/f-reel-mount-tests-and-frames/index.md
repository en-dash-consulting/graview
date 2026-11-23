---
id: "92f91598-5dfe-419a-9fa1-110836f510ce"
type: "change"
title: "The app's reel reaches every view mount, frame guests included"
slug: "f-reel-mount-tests-and-frames"
intent: "From HQ feature:f-reel-mount-tests-and-frames (left by PR #690): no test shows the reel reaching a view through WorkerViewMount, the Shell's or PagesApp's own reel props; frame guests (host/frame) are not handed it at all."
acceptanceCriteria:
  - "The reel reaches a worker view mounted through WorkerViewMount, the Shell and PagesApp (tests)"
  - "A frame guest is handed the reel the same way, its address never handed (test)"
priority: "medium"
tags:
  - "graview"
  - "guest"
  - "react"
  - "pages"
  - "hq:feature:f-reel-mount-tests-and-frames"
source: "Graview HQ feature:f-reel-mount-tests-and-frames"
---
