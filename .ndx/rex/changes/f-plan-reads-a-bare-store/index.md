---
id: "f685a4ef-c3d0-4e8a-aa10-7a52e9298789"
type: "change"
title: "The tools' plan works over a store with no graph handed in"
slug: "f-plan-reads-a-bare-store"
intent: "Found 2026-11-12 reviewing PR #577: groundskeeper-graview's survey.test.ts dies at packages/tools/src/plan.ts:206 because store.graph is undefined for its bare store; plan.ts has read it since 5301cbea3. Either plan.ts reads through the store's public surface, or groundskeeper's fixture is outdated; say which and fix the wrong side."
acceptanceCriteria:
  - "plan() over a store made the way groundskeeper's survey makes it returns the same plan as over a full store (test)"
  - "groundskeeper-graview's survey.test.ts passes against the linked checkout (run)"
touches:
  - "369257a0-22a8-471f-85dd-eee0e8bfcf78"
priority: "medium"
tags:
  - "graview"
  - "tools"
  - "hq:feature:f-plan-reads-a-bare-store"
source: "Graview HQ feature:f-plan-reads-a-bare-store"
---
