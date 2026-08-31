---
id: "888f6b45-fcb5-460a-8637-b31341050c4e"
level: "task"
title: "Selecting a rule shows what it judges"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "Selecting a rule marks every node its current violations implicate, in whatever view is on screen"
  - "The strip states the rule's violations as observations"
  - "A rule with no violations says so rather than showing nothing"
  - "layout() still takes only (graph, schema, view) — violations do not leak into it"
description: "A rule node has no edges, so selecting one changes nothing on screen and it reads as broken. What a rule is ABOUT is derivable — its violations name the nodes they implicate — so selecting a rule should light those nodes wherever they are drawn. Layout stays pure: this rides on the implicated set, not on the layout function."
---
