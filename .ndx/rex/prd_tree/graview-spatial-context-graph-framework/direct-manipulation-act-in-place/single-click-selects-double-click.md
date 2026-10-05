---
id: "18cd933f-c725-47d6-8a41-58b89967f169"
level: "task"
title: "Single click selects, double click travels"
status: "completed"
priority: "critical"
startedAt: "2026-08-31T02:50:00.197Z"
completedAt: "2026-08-31T02:50:00.197Z"
endedAt: "2026-08-31T02:50:00.197Z"
resolutionType: "code-change"
resolutionDetail: "Built in commit 67d7295 and now pinned by scripts/verify-direct-manipulation.mjs, which drives a real browser: a click on a player and on a calendar event selects in place with the picture intact, a double click travels, Enter selects then travels, and shift-click adds."
acceptanceCriteria:
  - "Clicking a player on the board selects them and the strip offers their actions, with the formation still on screen"
  - "Clicking an event in the calendar selects it without leaving the week"
  - "Double clicking either one travels to it"
  - "Keyboard: Enter selects, and a second activation travels, so the pointer is not the only way"
  - "Shift/meta click still adds to a multi-selection"
description: "The host routes a click on a `data-graview-pick` element to a focus change. It should select instead, so the actions appear for the thing you clicked while the picture stays put. Double click becomes \"go deeper\": on a pick target it focuses that node, on a view with no pick target it jacks in, which keeps one meaning for the gesture."
---
