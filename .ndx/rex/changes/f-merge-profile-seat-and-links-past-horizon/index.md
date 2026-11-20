---
id: "6295bf4f-de44-45dc-81d6-d1161a3325ad"
type: "change"
title: "A move or merge of a person says which links it left behind"
slug: "f-merge-profile-seat-and-links-past-horizon"
intent: "Left open by PR #649 (HQ feature:f-merge-profile-seat-and-links-past-horizon), the part Cloud asked for next on 2026-11-18: a rebind or merge that leaves links behind (made through $me before the log's horizon, so the move cannot find them) says so plainly in its result, with how many and of which relations, so a host's People page can tell the owner. Also from Cloud's 0.2.7 rollout: hostSeat's mark is a Symbol, so a seat that crosses JSON or RPC loses it; hostSeat's doc and the graview-sight skill say so and what a host does instead. Later (not this change): moving those links too, and merging a profile seat. Private until built; public text neutral."
acceptanceCriteria:
  - "A rebind or a merge whose person has links made through $me before the log's horizon answers with the count of those links per relation, and with none when there are none (test)"
  - "The count is said in a sentence a host can show an owner (test)"
  - "hostSeat's doc and the graview-sight skill say that its mark does not survive JSON or RPC and what a host does instead; the skill copies are current (test)"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "hq:feature:f-merge-profile-seat-and-links-past-horizon"
source: "Graview HQ feature:f-merge-profile-seat-and-links-past-horizon"
---
