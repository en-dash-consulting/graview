---
id: "ae466023-42cc-4ac9-b818-961e2ff5a854"
level: "task"
title: "Descending with an open district scattered the shelf"
status: "completed"
priority: "high"
source: "Nick, 2026-09-01 (screenshot): \"in graview, if i expand/open a block, and then go back to normal view, i have this broken view\""
startedAt: "2026-09-01T13:04:35.173Z"
completedAt: "2026-09-01T13:04:35.173Z"
endedAt: "2026-09-01T13:04:35.173Z"
resolutionType: "code-change"
resolutionDetail: "withOverview(state, false) strips kind-card expansions on descent; overview stop keeps them so re-ascending reopens districts. Layout unit test added; 581 tests + full sweep green."
acceptanceCriteria: []
description: "Opening a district at altitude and the in-stack shelf expansion share the same expand=kind:* key, so descending carried the district-open state down and dissolved shelf kinds into a chip soup across the bottom band. Fixed in withOverview(state, false): kind-card expansions are stripped on descent (they mean \"show the district's members in place\", which has no in-stack reading anyone asked for), while the overview stop itself keeps them — going back up reopens the districts. Non-kind expansions survive descent. Covered by a layout unit test; both descent paths (Escape and the overview toggle) go through the helper."
---
