---
id: "9893a227-a8c5-4f50-80cf-01cf3c15375f"
level: "task"
title: "The provider itself: one call, many questions, honest about failure"
status: "in_progress"
priority: "high"
blockedBy:
  - "a5636b6f-44d3-409c-9311-03e59ec9957f"
startedAt: "2026-09-19T05:19:50.231Z"
acceptanceCriteria:
  - "One request carries a map of questions, so a node is one call rather than one per field"
  - "429 and 529 retry with backoff; 401 reads as a seat problem and 422 as our own bug"
  - "The key is read from the environment and never written into the graph or the log"
description: "A package (or @graview/tools entry) that posts state + a question map and returns typed answers. Batching matters — the API takes a MAP of questions in one call, so a node's whole unset half is one request. Retry on 429/529 with backoff, surface 401 as a seat problem and 422 as OUR bug rather than the model's. The key is read from the environment as TYPESAFE_API_KEY, which is the documented name and is now set, falling back to JEV_API_KEY. Plaintext in a shell profile is a deliberate call while the account carries a $5 ceiling — which is itself a design input rather than a footnote: a fan-out over four hundred questions is a fraction of a cent and a loop that does not stop is not, so a run declares its budget and refuses to begin one it cannot afford."
lastModified: "2026-09-19T05:19:50.263Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
