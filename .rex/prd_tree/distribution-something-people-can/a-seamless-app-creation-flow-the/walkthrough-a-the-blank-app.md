---
id: "ec0f8101-0c4b-417d-ab86-81c0f28d5017"
level: "task"
title: "Walkthrough A · The blank app"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
startedAt: "2026-09-11T16:38:45.362Z"
completedAt: "2026-09-12T02:23:00.646Z"
endedAt: "2026-09-12T02:23:00.646Z"
resolutionType: "code-change"
resolutionDetail: "Third walk, stage A: three findings (W-051 an ask drawn off the side of its pane and below a phone's fold; W-052 the activity rail's undo and Start fresh under 24px; W-053 every keyboard act ending at document body), each fixed in packages/primitives with a criterion verified failing first — audit-ui `asking` + `todo/activity`/`seedbed/asked`/`askedNarrow` states, and verify-menu `theKeyboardKeepsItsPlace`. Stage re-run clean: axe 0 across 40 screens, audit clean at both widths, and pnpm test/audit-ui/survey/site/progression/smoke:create/remember/navigation/menu/pages/chat/seat/shrunk all pass."
acceptanceCriteria:
  - "altitude shows one district with 0 that offers only its beginning, whose ask disables Apply until there is text"
  - "the record appears in the district, the shelf, the pages list and the home sentence with no reload"
  - "every stop is a URL; Back restores the previous picture and selection; Forward is offered only with somewhere to go"
  - "Escape backs out one level at a time and never drops a selection while rising"
  - "inspector, menu and strip stay inside the scene at 390px"
  - "axe reports nothing on either face; keyboard alone can do everything"
description: "Stage A of docs/walkthrough.md: open the scaffolded app; descend and rise; select the empty district; add the first item through the strip and through the pages form; rename in place; undo; Back and Forward; Escape from every state. Both faces, both schemes, 390 and 1280 wide."
lastModified: "2026-09-12T02:23:00.655Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
