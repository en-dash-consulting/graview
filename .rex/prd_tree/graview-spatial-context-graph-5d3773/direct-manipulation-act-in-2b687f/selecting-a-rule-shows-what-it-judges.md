---
id: "888f6b45-fcb5-460a-8637-b31341050c4e"
level: "task"
title: "Selecting a rule shows what it judges"
status: "completed"
priority: "high"
startedAt: "2026-08-31T02:50:08.530Z"
completedAt: "2026-08-31T02:50:08.530Z"
endedAt: "2026-08-31T02:50:08.530Z"
resolutionType: "code-change"
resolutionDetail: "Selecting a rule lights what its violations implicate, and a rule that is holding now says so instead of showing nothing. Emphasis is exposed as data-graview-emphasis so the claim is checkable rather than only a colour."
acceptanceCriteria:
  - "Selecting a rule marks every node its current violations implicate, in whatever view is on screen"
  - "The strip states the rule's violations as observations"
  - "A rule with no violations says so rather than showing nothing"
  - "layout() still takes only (graph, schema, view) — violations do not leak into it"
description: "A rule node has no edges, so selecting one changes nothing on screen and it reads as broken. What a rule is ABOUT is derivable — its violations name the nodes they implicate — so selecting a rule should light those nodes wherever they are drawn. Layout stays pure: this rides on the implicated set, not on the layout function."
---
