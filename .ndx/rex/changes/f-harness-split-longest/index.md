---
id: "a179cad9-9af9-47ba-aab8-7833502edaf9"
type: "change"
title: "The longest harnesses run in parts, so no GitHub shard takes more than 15 minutes"
slug: "f-harness-split-longest"
intent: "From HQ feature:f-harness-split-longest: Fixed waiting fell 63% but the longest shard is still journeys at 36.5 minutes; site and one-face follow. Split journeys, site and one-face into parts through scripts/lib/parts.mjs, as quiet already is, and look at journeys' short waits another way."
acceptanceCriteria:
  - "No shard of verify.yml's whole chain takes more than 15 minutes (a run's timings)"
  - "The parts together make every claim the whole made (test)"
priority: "medium"
tags:
  - "graview"
  - "scripts"
  - "hq:feature:f-harness-split-longest"
source: "Graview HQ feature:f-harness-split-longest"
---
