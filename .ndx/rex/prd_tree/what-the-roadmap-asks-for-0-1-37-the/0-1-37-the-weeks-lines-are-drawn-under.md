---
id: "d3b2caba-dce7-410a-b30e-c541b8220af0"
level: "task"
title: "0.1.37 · The week's lines are drawn under a throttled CPU"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "0.1.37"
source: "ndx-capture"
acceptanceCriteria:
  - "under GRAVIEW_SLOW=4, navigation's aCardsChipsDoNotSilenceItsLines holds: the week in focus with the lists raised draws each entry's line to its list"
  - "the cause is named (a budget that sheds connectors when frames are slow, a measurement that never settles, or a harness read too early) and, if the product drops them, it says so or brings them back"
description: "Seen 2026-10-18: under GRAVIEW_SLOW=4 locally, 9 entries and 0 holds lines after settling, before and after the 0.1.36 changes; CI has not met it."
lastModified: "2026-10-18T21:40:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
