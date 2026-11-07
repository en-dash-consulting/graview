---
id: "4e693d73-6411-4d2a-a50d-3f72665dbc36"
type: "capability"
title: "A seat's read is bounded, and a repeated read is not re-sent (FR-167)"
slug: "a-seat-s-read-is-bounded-and-a"
statement: "A seat's read tools answer within a bounded size, and a read repeated within one turn is answered by pointing back to the earlier answer instead of being sent again."
criteria: [{"id":"c1","text":"Each read tool shall answer with at most READ_CHARS characters of JSON, for a seat's turn and an MCP client alike."},{"id":"c2","text":"When get_graph is called, it shall answer a page of records with the total and \"and N more\" naming the offset of the next page."},{"id":"c3","text":"When get_node is called, it shall answer the record's fields and its links as ids, kinds and labels, capped each way a page, and shall not answer the neighborhood's fields."},{"id":"c4","text":"When search_graph is called, it shall answer at most READ_HITS hits whatever limit was asked and say how many more match."},{"id":"c5","text":"If a call within one turn has the same name and input as an earlier call, the seat shall answer \"Already read: see the answer to call N of this turn, which is above.\" and count the call toward the twelve-call cap."}]
tags:
  - "graview-cloud"
  - "FR-167"
source: "Graview Cloud, 2026-10-12 (the framework brief after 0.1.26, from the gateway's log of every call the seat made on staging)"
priority: "high"
resolution: "Shipped in #238: the bounded reads (packages/tools/src/agent/reads.ts, bounds in agent/bounds.ts) fetched with the first read, and the turn's repeat check in packages/tools/src/seat-model.ts."
---

One turn in an app of 30 components, 28 skills and 84 strengths ran seven steps whose input grew 5.6k to 91k tokens: get_graph answered about 28,000 tokens, the model asked for it three more times, and every step resent it all, $0.60 for one question.
