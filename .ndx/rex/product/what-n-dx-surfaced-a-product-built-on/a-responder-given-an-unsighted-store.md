---
id: "18e72d4a-4357-4659-a4c9-9edc8157c073"
type: "capability"
title: "A responder given an unsighted store puts only what its seat sees in the system prompt"
slug: "a-responder-given-an-unsighted-store"
statement: "A responder given an unsighted store writes into its system prompt only the names and records that its principal's seat sees, while its tools stay sighted."
criteria: [{"id":"c1","text":"When a principal is known, llmResponder and seatResponder shall write the system prompt over seenBy(principal) rather than over the whole graph."},{"id":"c2","text":"If no principal is known, the responder shall say so in the system prompt rather than reading the whole graph."},{"id":"c3","text":"While a record is hidden from the principal's seat, the responder shall keep that record's name out of the system prompt."}]
tags:
  - "n-dx"
  - "seat"
  - "sight"
source: "The review round before 0.1.22 (#207), 2026-10-11"
priority: "high"
resolution: "Fixed in #213: llmResponder and seatResponder write the prompt over seenBy(principal) whatever store they are handed; with no principal they read as { kind: \"agent\" }, the seat the turn's tools act as, and say so where the policy keeps anything from it."
---

llmResponder and seatResponder called directly with an unsighted store write whole-graph names into the system prompt; the tools stay sighted.
