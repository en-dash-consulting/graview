---
id: "d3b2caba-dce7-410a-b30e-c541b8220af0"
level: "task"
title: "0.1.37 · The week's lines are drawn under a throttled CPU"
status: "completed"
startedAt: "2026-10-18T22:30:00.000Z"
completedAt: "2026-10-19T00:10:00.000Z"
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

## Notes

2026-10-18: not a budget and not a read too early — a measurement older than the drawing. The harness reaches the week by a hash change from the lists in focus, so the week's lens (`declared-lenses`, `lens/columns`) is fetched as it is first drawn (FR-57) and commits its entries after the frame has landed, at the week's own size. The lines are measured in `Lines` (packages/react/src/scene-lines.tsx:123, the layout effect) on a frame, a selection, the graph, a resize, a scroll or a moved caption, and none of those follow a lens drawing late; that measurement found no entries, and `connectorStrands` drops an edge to a member the focus does not draw (packages/react/src/connectors.tsx:509, "a line lands on a drawing of the thing, or is not drawn"), so it kept zero lines. Instrumented under GRAVIEW_SLOW=4: the last measurement at 3502 ms saw 0 picks, the entries appeared at 3524 ms, and a synthetic resize at 15 s brought all 9 lines back; a fresh load of the same address drew 9 under throttle, since the lens arrived before the frame landed. Without throttle the chunk arrives in time.

The product sheds nothing under load, so nothing is brought back "once frames recover": `connectorStrands` now fills an optional map with the members it looked for inside a view and found no drawing of (`Owed`), and `watchDrawnLate` (packages/react/src/drawn-late.ts) watches those views for marks and asks for one more measurement once one of them is drawn, checking once on arming for a view that drew between the measurement and the watch. Its check is the measurement's own test (`drawnSince`), so a member drawn but scrolled out of sight asks nothing and cannot loop.

Tests: `packages/react/tests/unit/a-line-waits-for-a-view-that-draws-late.test.ts` (five claims, failing first for want of the owed map and the watch). Verdicts with GRAVIEW_PORT_BASE=5900: before the fix `GRAVIEW_SLOW=4 pnpm verify navigation --strict` failed `aCardsChipsDoNotSilenceItsLines` alone (9 entries, 0 lines); after it, holds under GRAVIEW_SLOW=4 (9 entries, 9 lines) and without throttle (9, 9).

Budget: nothing more up front (570_935 B); the scene face before it draws grew 1_032 B (955_271 to 956_303), so `tests/a-hosted-page-keeps-to-its-budget.test.ts` says 934 KB with a line for it. `pnpm typecheck` and `pnpm test` green.
