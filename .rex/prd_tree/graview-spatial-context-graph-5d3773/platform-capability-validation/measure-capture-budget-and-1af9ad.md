---
id: "1af9ad10-7fb0-4682-b4b6-0be1a3d27ac3"
level: "task"
title: "Measure capture budget and verify platform restrictions"
status: "completed"
priority: "high"
tags:
  - "spike"
  - "performance"
  - "platform-limits"
blockedBy:
  - "9a35ab31-d28d-4373-bfac-9703e722923a"
startedAt: "2026-08-30T04:22:20.226Z"
completedAt: "2026-08-30T04:22:20.226Z"
endedAt: "2026-08-30T04:22:20.226Z"
resolutionType: "code-change"
resolutionDetail: "Budget measured: ~0.016 ms/node linear to ~128 live captures per frame (2 ms, 12% of a 60Hz frame), then a cliff to 33 ms at 160 and a GPU-process crash at 256. Restrictions verified with pixel readback: inline SVG captures fine (no iconography constraint); nested canvas and cross-origin iframes capture SILENTLY BLANK rather than throwing. Paint-event frame lag was not reproduced in Chromium 154. All in docs/platform-findings.md."
acceptanceCriteria:
  - "Per-frame capture cost is measured across a range of node counts and written down"
  - "The live-capture node count that holds target frame rate is known"
  - "SVG restriction scope is determined — whether inline SVG can be captured at all"
  - "Paint-event frame lag is confirmed and characterised"
  - "Cross-origin and nested-canvas failure modes are observed rather than assumed"
description: "Find the ceiling and the sharp edges, so the fidelity axis can be budgeted rather than guessed.\n\nCost: measure per-frame capture cost against node count. The design assumes only plane 0 captures live each frame while summary fidelity caches on change — this task establishes whether that split is sufficient, and at what node count it stops holding frame rate.\n\nRestrictions to verify, since the docs are ambiguous or the implementation is young:\n- Cross-origin embedded content is excluded; confirm what that covers in practice\n- Nested canvas throws — confirm the failure mode\n- The exclusion list appears to mention SVG; determine what it actually covers. If inline SVG cannot be captured, iconography must be font or raster, which is a real design constraint\n- DOM changes made during the `paint` event land a frame later; confirm and characterise the lag, since it determines whether drag feedback must be shader-driven"
---
