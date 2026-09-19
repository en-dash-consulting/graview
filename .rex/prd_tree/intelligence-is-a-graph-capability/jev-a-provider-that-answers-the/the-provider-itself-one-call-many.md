---
id: "9893a227-a8c5-4f50-80cf-01cf3c15375f"
level: "task"
title: "The provider itself: one call, many questions, honest about failure"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "One request carries a map of questions, so a node is one call rather than one per field"
  - "429 and 529 retry with backoff; 401 reads as a seat problem and 422 as our own bug"
  - "The key is read from the environment and never written into the graph or the log"
blockedBy:
  - "a5636b6f-44d3-409c-9311-03e59ec9957f"
description: "A package (or @graview/tools entry) that posts state + a question map and returns typed answers. Batching matters — the API takes a MAP of questions in one call, so a node's whole unset half is one request. Retry on 429/529 with backoff, surface 401 as a seat problem and 422 as OUR bug rather than the model's. The key is read from the environment; note the machine has JEV_API_KEY while the docs name TYPESAFE_API_KEY, and it currently sits in plaintext in ~/.zshrc."
lastModified: "2026-09-19T04:15:13.721Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
