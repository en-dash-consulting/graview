---
id: "186df33b-9649-49b1-a972-0bf331fe4c62"
level: "feature"
title: "The hosted page's up-front weight: room again"
status: "completed"
priority: "high"
tags:
  - "roadmap"
  - "0.1.29"
  - "f-weight-headroom"
source: "Nick, 2026-10-14: \"i think any that can be picked up should be picked up.\""
acceptanceCriteria:
  - "At least 10 KB minified / 4 KB gzipped back up front without a face losing anything"
  - "zod's JSON-schema code and helpers only fetched code uses (edgeWords, valueWords, counted, view-state helpers) leave the first load where possible"
  - "budgets lowered to keep the room"
startedAt: "2026-10-13T21:05:00.000Z"
completedAt: "2026-10-13T22:30:00.000Z"
resolution: "Shipped on perf/headroom-again: a tool's JSON Schema is written by graview from the schema's definition (core/src/schema/to-json-schema.ts, held equal to zod's key for key), so zod's 20.6 KB JSON-Schema writer is on no hosted page: 564 089 -> 542 940 B (-20.7 KB, -6.4 KB gzipped), handed a compiled app 522 312 -> 501 163 B; budgets lowered to 538.0 / 188.0 and 497.5 / 173.5 KB (~8 KB room). counted is drawn with up front (the store, the bar), and edgeWords/valueWords and the fetched-only view-state helpers stay put: about 1.5 KB together, and moving them off @graview/core and @graview/layout would break imports for little."
description: "After the wave the hosted page has ~94 B gzipped of room; new features need space without raising the budget."
---
