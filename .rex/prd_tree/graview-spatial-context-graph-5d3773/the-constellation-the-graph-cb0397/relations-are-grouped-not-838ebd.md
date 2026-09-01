---
id: "838ebd51-71f6-4abd-b3e2-1bf23ded111d"
level: "task"
title: "Relations are grouped, not listed flat"
status: "completed"
priority: "high"
startedAt: "2026-08-31T02:11:06.092Z"
completedAt: "2026-08-31T02:20:08.352Z"
endedAt: "2026-08-31T02:20:08.352Z"
resolutionType: "code-change"
resolutionDetail: "New @graview/layout `rankKinds` derives primary/secondary and nesting from the schema alone; the kinds plane draws primaries full size, secondaries smaller and further back in their own slot, and a kind reachable only through another tucked half under that card's bottom edge."
acceptanceCriteria:
  - "Kinds directly related to the focus are visibly primary; the rest are secondary and smaller"
  - "A nested relationship reads as nested rather than as a sibling"
  - "The ranking is derived from the schema and the graph, not authored per app"
  - "Spatial memory holds: a kind does not move between primary and secondary as unrelated things change"
description: "The context plane shows every kind that is not on screen as an equal-sized card, so nine kinds get nine identical thumbnails and nothing says which of them matter. Relations should be ranked and grouped: the ones directly connected to what is focused shown large, the rest smaller or collapsed behind an \"everything else\", and nested relationships drawn as nested rather than flattened into siblings.\n\nThis is the same question the constellation answers at the level of the whole graph, asked at the level of one node — so the two should share a ranking rather than inventing two."
---
