---
id: "e073ef87-a0ca-4573-b4be-351674331141"
level: "feature"
title: "A rule that reads a fact() is judged and worded over what the seat sees"
status: "completed"
priority: "high"
tags:
  - "n-dx"
  - "document"
  - "sight"
source: "The review round before 0.1.22 (#207), 2026-10-11"
startedAt: "2026-10-11T17:30:00.000Z"
completedAt: "2026-10-11T18:40:00.000Z"
endedAt: "2026-10-11T18:40:00.000Z"
acceptanceCriteria:
  - "A seat's violations and their lines are worked out over its sighted view, facts included"
  - "graview check warns on a rule whose message names a fact a role may not see in full"
  - "A test shows a hidden record never changes a seat's line"
description: "A rule reading fact() is judged, and its message written, over the whole graph, which can leak a hidden count to a seat."
lastModified: "2026-10-11T18:40:00.000Z"
resolution: "Fixed in #216: a seat's problems are judged over what it sees, facts and lines included, an act's answer to a seat as it judges them, and graview check warns of rule-says-hidden-fact."
---
