---
id: "18cd933f-c725-47d6-8a41-58b89967f169"
level: "task"
title: "Single click selects, double click travels"
status: "pending"
priority: "critical"
acceptanceCriteria:
  - "Clicking a player on the board selects them and the strip offers their actions, with the formation still on screen"
  - "Clicking an event in the calendar selects it without leaving the week"
  - "Double clicking either one travels to it"
  - "Keyboard: Enter selects, and a second activation travels, so the pointer is not the only way"
  - "Shift/meta click still adds to a multi-selection"
description: "The host routes a click on a `data-graview-pick` element to a focus change. It should select instead, so the actions appear for the thing you clicked while the picture stays put. Double click becomes \"go deeper\": on a pick target it focuses that node, on a view with no pick target it jacks in, which keeps one meaning for the gesture."
---
