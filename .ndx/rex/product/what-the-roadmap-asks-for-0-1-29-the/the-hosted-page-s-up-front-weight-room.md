---
id: "186df33b-9649-49b1-a972-0bf331fe4c62"
type: "capability"
title: "The hosted page's up-front weight: room again"
slug: "the-hosted-page-s-up-front-weight-room"
statement: "The hosted page keeps its up-front weight low enough that new features fit without raising the budget."
criteria: [{"id":"c1","text":"The hosted page's first load shall leave at least 10 KB minified / 4 KB gzipped of room for new features, with no face losing anything."},{"id":"c2","text":"The hosted page's first load shall leave out zod's JSON-schema code and the helpers only fetched code uses (edgeWords, valueWords, counted, the view-state helpers) where possible."},{"id":"c3","text":"The hosted page's budgets shall be set low enough to keep the room that was freed."}]
tags:
  - "roadmap"
  - "0.1.29"
  - "f-weight-headroom"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
priority: "high"
resolution: "Shipped on perf/headroom-again: a tool's JSON Schema is written by graview from the schema's definition (core/src/schema/to-json-schema.ts, held equal to zod's key for key), so zod's 20.6 KB JSON-Schema writer is on no hosted page: 564 089 -> 542 940 B (-20.7 KB, -6.4 KB gzipped), handed a compiled app 522 312 -> 501 163 B; budgets lowered to 538.0 / 188.0 and 497.5 / 173.5 KB (~8 KB room). counted is drawn with up front (the store, the bar), and edgeWords/valueWords and the fetched-only view-state helpers stay put: about 1.5 KB together, and moving them off @graview/core and @graview/layout would break imports for little."
---

After the wave the hosted page has ~94 B gzipped of room; new features need space without raising the budget.
