---
id: "186df33b-9649-49b1-a972-0bf331fe4c62"
level: "feature"
title: "The hosted page's up-front weight: room again"
status: "pending"
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
description: "After the wave the hosted page has ~94 B gzipped of room; new features need space without raising the budget."
---
