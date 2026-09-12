---
id: "1bd31ee2-1d3e-4bbe-b339-f0a722b447a5"
level: "task"
title: "Walkthrough B · A second kind and an edge"
status: "in_progress"
priority: "critical"
tags:
  - "walkthrough"
startedAt: "2026-09-11T16:55:53.666Z"
resolutionType: "code-change"
resolutionDetail: "Stage B walked: a second kind (owner, with email), an edge item→owner (\"assigned-to\", description + inverse), and the connecting/severing acts, following the graview-node-kind skill. Four findings, each fixed with a criterion in the same commit: W-006 no line in a scaffolded app could be selected (layout's edge selection id split on a separator that ctx.freshId puts inside node ids); W-007 a record page captioned a relation from the wrong end (pages); W-008 a line offered the act that would make it and logged a duplicate op when pressed (tools); W-009 the scene's heading list skipped two levels once a relation was drawn (primitives). Criteria verified: graview check clean and the no-inverse run warns edge-without-inverse naming the far end's caption (\"from an owner it is captioned 'assigned to'\"); the scene draws the line and captions the neighbour with the focus's reading, the far end reads its inverse; connecting offers only unconnected candidates, severing only what is attached and is absent with nothing attached; the line's inspector offers the severing act and severing from either end removes exactly that line; the district opens and closes on double-click and a chip travels. axe clean on 20 face/scheme/width/state combinations."
acceptanceCriteria:
  - "graview check is clean; an edge without inverse warns edge-without-inverse naming the far end's caption"
  - "the caption over a neighbour is the focus's reading; the connections panel and the pages record read from each end"
  - "connecting offers only unconnected candidates; severing offers only what is attached and is absent when nothing is"
  - "selecting the line offers the severing act; severing from either end removes exactly that line"
  - "double-click opens a district, travels into a chip, and closes the district again"
description: "Stage B of docs/walkthrough.md: following graview-node-kind, declare a second kind and an edge with description and inverse, the connecting and severing acts; seed two of each; connect through the strip, the line's own menu and the pages record."
lastModified: "2026-09-12T02:23:04.896Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
