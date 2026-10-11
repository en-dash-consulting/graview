---
id: "18e72d4a-4357-4659-a4c9-9edc8157c073"
level: "feature"
title: "A responder given an unsighted store puts only what its seat sees in the system prompt"
status: "pending"
priority: "high"
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
lastModified: "2026-10-11T08:00:00.000Z"
---
