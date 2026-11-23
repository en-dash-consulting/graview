---
id: "e120e6eb-57ab-40fb-a864-ec0a6363d431"
type: "change"
title: "Jev's quick AI, polished: a confidence floor, faster menus, honest no-answer wording, outcomes measured"
slug: "f-jev-fast-polish"
intent: "From HQ feature:f-jev-fast-polish (Nick 2026-11-22: Thinking AI is off in production, hone Jev; Cloud's Jev review 2026-11-23): (1) a confidence floor on menu picks and fills, today the top 3 show however unsure Jev is; (2) latency: start the Fast call as the right-click starts, reserve the rows' height, skip the call at 3 candidates or fewer, prefetch on hover; (3) a quick ask Jev cannot answer without Thinking says what Jev can do and offers Find or a connected chat, not 'These fit' or 'The AI had no answer'; (4) the first look points at right-click, long-press and the hover chip; (5) an accept/dismiss outcome per menu pick reported to the host, so Cloud can measure quality."
acceptanceCriteria:
  - "A pick or fill under the confidence floor is not shown (test)"
  - "The Fast call starts with the right-click, the rows' height is reserved, and no call is made at 3 candidates or fewer (test and harness claim)"
  - "A quick ask with no Thinking slot that Jev cannot answer says what Jev can do and offers Find (test)"
  - "The first look points at right-click, long-press and the hover chip (test)"
  - "Each menu pick's accept or dismiss is reported to the host (test)"
priority: "medium"
tags:
  - "graview"
  - "tools"
  - "primitives"
  - "hq:feature:f-jev-fast-polish"
source: "Graview HQ feature:f-jev-fast-polish"
---
