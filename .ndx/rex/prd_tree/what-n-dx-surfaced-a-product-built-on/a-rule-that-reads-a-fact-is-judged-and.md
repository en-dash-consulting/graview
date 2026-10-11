---
id: "e073ef87-a0ca-4573-b4be-351674331141"
level: "feature"
title: "A rule that reads a fact() is judged and worded over what the seat sees"
status: "pending"
priority: "high"
tags:
  - "n-dx"
  - "document"
  - "sight"
source: "The review round before 0.1.22 (#207), 2026-10-11"
acceptanceCriteria:
  - "A seat's violations and their lines are worked out over its sighted view, facts included"
  - "graview check warns on a rule whose message names a fact a role may not see in full"
  - "A test shows a hidden record never changes a seat's line"
description: "A rule reading fact() is judged, and its message written, over the whole graph, which can leak a hidden count to a seat."
lastModified: "2026-10-11T08:00:00.000Z"
---
