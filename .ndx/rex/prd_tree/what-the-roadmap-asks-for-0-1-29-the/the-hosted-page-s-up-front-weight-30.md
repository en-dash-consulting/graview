---
id: "6b6ebdfd-172d-4393-a1cf-1d336963da5b"
level: "feature"
title: "The hosted page's up-front weight: 30 KB of headroom back (FR-179)"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "f-weight-headroom"
  - "FR-179"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
acceptanceCriteria:
  - "A host page handed a compiled app carries no compiler and no zod up front (finish FR-123)"
  - "The studio door, the seat panel and the lenses are fetched with their face, not before"
  - "pnpm verify hosted measures 30 KB or more less up front than 0.1.28, no face losing anything"
  - "CI fails a change that spends more up front than its changeset says"
  - "A changeset names FR-179 and says the weights"
startedAt: "2026-10-12T22:45:00.000Z"
completedAt: "2026-10-13T00:40:00.000Z"
resolution: "Shipped on perf/fr-179-hosted-page-headroom: names only fetched faces, forms and the seat use moved to @graview/core/search, /words, /seat and @graview/layout/sizes, and the frame guest's host to @graview/guest/host/frame, fetched as drawn: the hosted page 587 597 -> 555 782 B (-31.1 KB, -12.3 KB gzipped), handed a compiled app 546 594 -> 514 777 B. Budgets 553.0 / 513.0 KB with ~10 KB room; raises need a budget-raises file naming a changeset that says the KB. Zod stays up front (it is the compiled app's field schemas)."
description: "The hosted-page measure is 573.6 KB of 579.7; Cloud's shell 562 of 570. FR-171 to FR-174 will spend more. Roadmap f-weight-headroom. Hosted-page budgets are never raised."
---
