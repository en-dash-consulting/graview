---
id: "1bd31ee2-1d3e-4bbe-b339-f0a722b447a5"
level: "task"
title: "Walkthrough B · A second kind and an edge"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
startedAt: "2026-09-11T16:55:53.666Z"
completedAt: "2026-09-12T03:29:59.682Z"
endedAt: "2026-09-12T03:29:59.682Z"
resolutionType: "code-change"
resolutionDetail: "Third walk, stage B: a person kind, a handled-by edge with description and inverse, and the acts that connect and sever, declared in walk3 and verified (edge-without-inverse warns with the far end's caption; graview check clean). Three findings, each fixed with a criterion verified failing first — W-054 the scaffolded record page hard-coding one edge and one act (packages/core scaffold + two scaffold.test criteria), W-055 a stop naming a removed node or severed edge, including a blank-page crash from a self-measuring kind tag (packages/react context + scene, a-stop-that-still-exists.test.tsx + verify-navigation theStopSurvivesWhatItNames), W-056 an act at the far end asking for its subject as \"Id\" (packages/primitives workbench + the-ask-says-what-it-asks). Stage re-run clean: axe 0 across 52 screens both widths and schemes, audit clean, and the whole harness list passes."
acceptanceCriteria:
  - "graview check is clean; an edge without inverse warns edge-without-inverse naming the far end's caption"
  - "the caption over a neighbour is the focus's reading; the connections panel and the pages record read from each end"
  - "connecting offers only unconnected candidates; severing offers only what is attached and is absent when nothing is"
  - "selecting the line offers the severing act; severing from either end removes exactly that line"
  - "double-click opens a district, travels into a chip, and closes the district again"
description: "Stage B of docs/walkthrough.md: following graview-node-kind, declare a second kind and an edge with description and inverse, the connecting and severing acts; seed two of each; connect through the strip, the line's own menu and the pages record."
lastModified: "2026-09-12T03:29:59.691Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
