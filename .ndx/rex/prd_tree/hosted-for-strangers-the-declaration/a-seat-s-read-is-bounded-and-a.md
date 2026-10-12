---
id: "4e693d73-6411-4d2a-a50d-3f72665dbc36"
level: "feature"
title: "A seat's read is bounded, and a repeated read is not re-sent (FR-167)"
status: "completed"
priority: "high"
tags:
  - "graview-cloud"
  - "FR-167"
source: "Graview Cloud, 2026-10-12 (the framework brief after 0.1.26, from the gateway's log of every call the seat made on staging)"
startedAt: "2026-10-12T15:00:00.000Z"
completedAt: "2026-10-12T16:30:00.000Z"
endedAt: "2026-10-12T16:30:00.000Z"
acceptanceCriteria:
  - "Every read tool's answer is at most READ_CHARS characters of JSON, for a seat's turn and an MCP client alike"
  - "get_graph answers a page of records with the total, and \"and N more\" naming the offset of the next page"
  - "get_node answers a record's fields and its links as ids, kinds and labels, capped each way a page, never the neighborhood's fields"
  - "search_graph answers at most READ_HITS hits whatever limit asked, and says how many more match"
  - "Within one turn, a call with the same name and input is answered \"Already read: see the answer to call N of this turn, which is above.\" and counts toward the twelve-call cap"
  - "Tested in an app of 30 components, 28 skills and 84 strengths"
description: "One turn in an app of 30 components, 28 skills and 84 strengths ran seven steps whose input grew 5.6k to 91k tokens: get_graph answered about 28,000 tokens, the model asked for it three more times, and every step resent it all, $0.60 for one question."
lastModified: "2026-10-12T16:30:00.000Z"
resolution: "Shipped in #238: the bounded reads (packages/tools/src/agent/reads.ts, bounds in agent/bounds.ts) fetched with the first read, and the turn's repeat check in packages/tools/src/seat-model.ts."
---
