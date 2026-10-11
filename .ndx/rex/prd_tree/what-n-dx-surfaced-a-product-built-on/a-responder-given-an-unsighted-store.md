---
id: "18e72d4a-4357-4659-a4c9-9edc8157c073"
level: "feature"
title: "A responder given an unsighted store puts only what its seat sees in the system prompt"
status: "completed"
priority: "high"
startedAt: "2026-10-11T18:20:00.000Z"
completedAt: "2026-10-11T18:20:00.000Z"
endedAt: "2026-10-11T18:20:00.000Z"
tags:
  - "n-dx"
  - "seat"
  - "sight"
source: "The review round before 0.1.22 (#207), 2026-10-11"
acceptanceCriteria:
  - "The system prompt is written over seenBy(principal) whenever a principal is known"
  - "Without a principal the responder says so rather than reading the whole graph"
  - "A test shows a hidden record's name never reaches the prompt"
description: "llmResponder and seatResponder called directly with an unsighted store write whole-graph names into the system prompt; the tools stay sighted."
lastModified: "2026-10-11T18:20:00.000Z"
resolution: "Fixed in #213: llmResponder and seatResponder write the prompt over seenBy(principal) whatever store they are handed; with no principal they read as { kind: \"agent\" }, the seat the turn's tools act as, and say so where the policy keeps anything from it."
---
