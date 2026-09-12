---
id: "41dae4fc-8647-41b9-84b3-160a2a864017"
level: "task"
title: "Walkthrough C · A rule and its repair"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
startedAt: "2026-09-11T17:12:40.628Z"
completedAt: "2026-09-12T04:14:35.504Z"
endedAt: "2026-09-12T04:14:35.504Z"
resolutionType: "code-change"
resolutionDetail: "Third walk, stage C: a second rule (someone-is-on-it) declared in walk3 with a repair that names hand-item, fills the subject and leaves `handler` to be asked for; it fires on the seed, the standing says \"1 problem\", the problems page and both record faces carry the same words, and repairing from the scene, the pages and the chat seat each leave one attributed op that undo takes back. Three findings, each fixed with a criterion verified failing first — W-057 the seat promising repairs it filters out (packages/tools conversation + conversation.test), W-058 the activity rail naming acts by their registered name (packages/primitives + verify-seat), W-059 a hydrated store restarting its op and batch id counters at zero, so everything done on the second visit was filed under the first turn ever taken (packages/core store + op-log.test ladders + verify-remember aChangeOnTheSecondVisitIsATurnOfItsOwn). Stage re-run clean: axe 0 across 52 screens, audit clean at both widths, and the whole harness list passes including smoke:create."
acceptanceCriteria:
  - "Standing says 1 problem and the problems page lists it in the same words; the flagged record is marked in the scene, its district and its pages record"
  - "the repair is one press when it needs nothing, an ask when it needs one thing, never a refusal on press"
  - "repairing from each surface leaves one op with the right author; undo takes it back and the problem returns"
description: "Stage C of docs/walkthrough.md: following graview-invariant, declare a rule that fails on the seed with a repair that names an act and leaves one argument to be asked for. Repair from the scene, the pages and the agent's seat."
lastModified: "2026-09-12T04:14:35.513Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
