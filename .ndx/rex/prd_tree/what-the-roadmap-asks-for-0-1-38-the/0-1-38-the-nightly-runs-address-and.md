---
id: "4d8a4e56-eaca-4d4a-afb3-dbd80f04c197"
level: "task"
title: "0.1.38 · The Nightly runs address, and the flakes and the scale harness are settled"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "0.1.38"
source: "ndx-capture"
acceptanceCriteria:
  - "address runs in the Nightly (it failed on main from 10-15 to 10-19 unseen)"
  - "navigation's theGroundTravelsWithTheCards, recorded as a flake on main's 0.1.37 Nightly, is judged by a property that does not depend on frame timing"
  - "the scale harness's rise holds 60 fps on the discography app again, or is re-baselined with a reason (PRD task the-scale-harness-holds-60-fps-again)"
description: "Follow-ups from the 0.1.37 release."
lastModified: "2026-10-19T12:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

**The scale harness (third criterion): held, on fix/scale-rise-60fps.** Not
re-baselined. The rise's long task was `RecordLinks` measuring the stage
once for every record the chosen hub links to; #289's re-split of the
discography's chunks only made its first box read force a layout, taking a
37 ms task past 50. `linksOfRecords` no longer asks about relations that go
to their district and the layer indexes the stage once: rise worst frame
71 ms → 37 ms, `aTransitionHolds60` holds (PRD task
the-scale-harness-holds-60-fps-again).
