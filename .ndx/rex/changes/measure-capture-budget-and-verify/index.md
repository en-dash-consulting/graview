---
id: "1af9ad10-7fb0-4682-b4b6-0be1a3d27ac3"
type: "change"
title: "Measure capture budget and verify platform restrictions"
slug: "measure-capture-budget-and-verify"
intent: "Find the ceiling and the sharp edges, so the fidelity axis can be budgeted rather than guessed.\n\nCost: measure per-frame capture cost against node count. The design assumes only plane 0 captures live each frame while summary fidelity caches on change — this task establishes whether that split is sufficient, and at what node count it stops holding frame rate.\n\nRestrictions to verify, since the docs are ambiguous or the implementation is young:\n- Cross-origin embedded content is excluded; confirm what that covers in practice\n- Nested canvas throws — confirm the failure mode\n- The exclusion list appears to mention SVG; determine what it actually covers. If inline SVG cannot be captured, iconography must be font or raster, which is a real design constraint\n- DOM changes made during the `paint` event land a frame later; confirm and characterise the lag, since it determines whether drag feedback must be shader-driven"
acceptanceCriteria:
  - "Per-frame capture cost is measured across a range of node counts and written down"
  - "The live-capture node count that holds target frame rate is known"
  - "SVG restriction scope is determined — whether inline SVG can be captured at all"
  - "Paint-event frame lag is confirmed and characterised"
  - "Cross-origin and nested-canvas failure modes are observed rather than assumed"
touches:
  - "23d22798-65b2-4d59-80c7-8b82352aad16"
priority: "high"
tags:
  - "spike"
  - "performance"
  - "platform-limits"
blockedBy:
  - "9a35ab31-d28d-4373-bfac-9703e722923a"
---
