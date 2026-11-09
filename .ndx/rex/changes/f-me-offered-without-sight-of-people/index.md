---
id: "08f703d9-24d4-4efb-9fc4-0614c4c098e7"
type: "change"
title: "An act done as $me is not offered to a seat that cannot see the people kind"
slug: "f-me-offered-without-sight-of-people"
intent: "Found reviewing per-viewer state (PR #534), present on main since 0.1.68. A seat whose sight excludes the people kind is offered a `$me` act, `permits` answers true, and applying it refuses with \"is done as you, and you have no record here\", with and without a profile. Offering an act and then refusing it is what the watch forbids."
acceptanceCriteria:
  - "A seat whose sight excludes the people kind is not offered a $me act (permits false, not in the act lists, the actions strip or the agent tool surface), or the act works; tests hold it with a profile and without one"
  - "A seat that can see its own person is unchanged"
touches:
  - "1abc350c-e5bf-4eee-87c4-7c67287a10db"
priority: "medium"
tags:
  - "graview"
  - "core"
  - "tools"
  - "hq:feature:f-me-offered-without-sight-of-people"
source: "Graview HQ feature:f-me-offered-without-sight-of-people"
---
