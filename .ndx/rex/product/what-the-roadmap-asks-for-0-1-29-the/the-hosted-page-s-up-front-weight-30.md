---
id: "6b6ebdfd-172d-4393-a1cf-1d336963da5b"
type: "capability"
title: "The hosted page's up-front weight: 30 KB of headroom back (FR-179)"
slug: "the-hosted-page-s-up-front-weight-30"
statement: "A hosted page loads only what its first view needs: a host page handed a compiled app carries no compiler and no zod up front, and the studio door, seat panel and lenses arrive with their face."
criteria: [{"id":"c1","text":"When a host page is handed a compiled app, the page shall carry no compiler and no zod in its up-front load."},{"id":"c2","text":"When a face is opened, the hosted page shall fetch the studio door, the seat panel and the lenses with that face and not before it."},{"id":"c3","text":"The hosted page shall carry at least 30 KB less up front than 0.1.28 as measured by pnpm verify hosted, with no face losing any capability."},{"id":"c4","text":"If a change spends more up front than its changeset states, CI shall fail that change."}]
tags:
  - "roadmap"
  - "f-weight-headroom"
  - "FR-179"
source: "Nick, 2026-10-13: \"do all planned items for graview core that the roadmap has laid out. capture and work them in ndx appropriately\""
priority: "high"
resolution: "Shipped on perf/fr-179-hosted-page-headroom: names only fetched faces, forms and the seat use moved to @graview/core/search, /words, /seat and @graview/layout/sizes, and the frame guest's host to @graview/guest/host/frame, fetched as drawn: the hosted page 587 597 -> 555 782 B (-31.1 KB, -12.3 KB gzipped), handed a compiled app 546 594 -> 514 777 B. Budgets 553.0 / 513.0 KB with ~10 KB room; raises need a budget-raises file naming a changeset that says the KB. Zod stays up front (it is the compiled app's field schemas)."
---

The hosted-page measure is 573.6 KB of 579.7; Cloud's shell 562 of 570. FR-171 to FR-174 will spend more. Roadmap f-weight-headroom. Hosted-page budgets are never raised.
