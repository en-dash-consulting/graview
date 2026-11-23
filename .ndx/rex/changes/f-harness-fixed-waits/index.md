---
id: "73bcb5fb-3708-4cc1-bb6a-61c959914b6f"
type: "change"
title: "The harnesses wait on what they mean, not on a clock, so the full chain gets under 15 minutes"
slug: "f-harness-fixed-waits"
intent: "From HQ feature:f-harness-fixed-waits (left by PR #686): 49% of all harness time is fixed waitForTimeout, over 1,100 of them; the full chain is 32 min on the laptop and 22.5 min on GitHub against 15 min. Replace fixed waits with waits on data-graview-drawn, onDrawn, a selector or a frame, starting with journeys, gauntlet, the quiet parts, site and chrome. No claim loses coverage."
acceptanceCriteria:
  - "Fixed waits in the five slowest harnesses are replaced by waits on a condition, each one that stays says why"
  - "The full chain on GitHub runs in under 15 min, or the change says what remains and where"
  - "Every claim the harnesses held before still holds (verify:github)"
priority: "medium"
tags:
  - "scripts"
  - "harness"
  - "hq:feature:f-harness-fixed-waits"
source: "Graview HQ feature:f-harness-fixed-waits"
---
