---
id: "ee3586c7-cc80-42cc-9cf4-05c059fb9514"
type: "change"
title: "A move or merge of a person carries the links older than the log too, and a profile seat can be merged"
slug: "f-person-move-carries-links-past-horizon"
intent: "From HQ feature:f-person-move-carries-links-past-horizon (the later part of f-merge-profile-seat-and-links-past-horizon; leftBehind shipped in 0.2.8): (1) move the links made through $me before the log's horizon too; (2) merge a profile seat (acct~profile), which has no own record whose id equals the seat; reviewer nits from #649: two links of one relation between the same two records may swap ids, and a link from the person's record to itself moves at one end only. Private until built; public text neutral."
acceptanceCriteria:
  - "A move carries links older than the log's horizon, and leftBehind is empty for them (test)"
  - "A profile seat can be merged into a person (test)"
  - "Two links of one relation between the same two records keep their ids, and a self-link moves at both ends (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-person-move-carries-links-past-horizon"
source: "Graview HQ feature:f-person-move-carries-links-past-horizon"
---
