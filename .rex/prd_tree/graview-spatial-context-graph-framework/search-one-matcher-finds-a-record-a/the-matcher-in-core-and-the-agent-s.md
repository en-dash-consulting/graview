---
id: "5b35ff0b-e2b8-435f-a968-167c628c84ee"
level: "task"
title: "The matcher in core, and the agent's search_graph tool"
status: "pending"
priority: "high"
acceptanceCriteria:
  - "search() returns hits typed node | kind | place | act | rule, each with a why naming the matched field and fragment, ranked exact label → prefix → whole word → field, then near the subject, current before past, recently touched, flagged as tiebreak, alphabetical, stable by id"
  - "Matching is squeezed (case, diacritics, punctuation aside) and not fuzzy; key:value tokens are conditions admitted per hit kind, the rest are the words; hits the seat may not see are not returned"
  - "search_graph is a read tool on the runtime whose reads are the hit ids; MCP hosts get it without change; the connect instructions say to reach for it before get_graph"
  - "describe and llms.txt say, per kind, which fields are searchable and that past records need is:any"
  - "Unit tests hold the ranking to properties over the awkward declaration and to a worked example"
description: "search(store, query, { principal, from, limit, today }) in @graview/core returns ranked hits — node, kind, place, act, rule — each with a why naming the matched field and fragment, plus what was searched. Squeezed matching (case, diacritics, punctuation aside), no fuzz. Words and key:value conditions split by the arrangement parser, conditions admitted per hit kind. Ranking: exact label, prefix, whole word, field; near the subject; current before past; recently touched (usageWeights); flagged as tiebreak; alphabetical. Hits the seat may not see (kindsKeptFrom) are not hits. search_graph joins the read tools with reads counted; describe and llms.txt say what is searchable per kind. Held to properties over the awkward declaration."
lastModified: "2026-09-28T21:09:32.654Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
