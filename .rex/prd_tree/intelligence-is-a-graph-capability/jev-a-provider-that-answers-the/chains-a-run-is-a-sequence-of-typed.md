---
id: "f0b410ab-97af-4250-b55b-da1392c9c77f"
level: "task"
title: "Chains: a run is a sequence of typed asks over the graph, declared not scripted"
status: "pending"
priority: "critical"
blockedBy:
  - "1b750f27-d08d-4f10-b3d1-28bfb34eb53d"
  - "9893a227-a8c5-4f50-80cf-01cf3c15375f"
acceptanceCriteria:
  - "A run is declared as steps and can be read before it is run"
  - "Fan-out over every node of a kind is the ordinary case, not a special one"
  - "Each step is typed, so a step can be judged before the next one runs"
  - "The whole run lands as one batch with one undo"
description: "The thing a context graph buys that a chat box cannot. Declare a run as steps — select nodes by a rule, ask a derived question of each, turn answers into PlannedCalls, apply as one batch, re-evaluate. Fan-out is the normal case because output is unmetered: fill every unset field, classify every observation, score every concern against every practice. Each step's output is typed, so a step can be checked before the next one runs."
lastModified: "2026-09-19T04:15:15.127Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
