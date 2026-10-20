---
id: "b7ce8897-6e9d-478e-8dee-9d3009987f51"
level: "task"
title: "The scene's strip tells the watch when an act's own input refuses there"
status: "completed"
priority: "medium"
tags:
  - "walkthrough"
  - "carried"
source: "ndx-capture"
startedAt: "2026-10-20T07:37:49.000Z"
completedAt: "2026-10-20T07:37:49.000Z"
endedAt: "2026-10-20T07:37:49.000Z"
resolutionType: "code-change"
resolutionDetail: "The strip's preview of a press tells the watch when the act's own input refuses it: previewAffordance takes { pressed: { author } } and calls tellTheWatchOfAPressRefusedByItsInput (packages/core/src/watched.ts, on @graview/core); useApplyAffordance's preview (the scene strip and the kind stop) and the quick ask pass it. A preview before any press tells nothing; a form filled wrongly stays exempt by the watch's origin rule. Criteria: packages/primitives/tests/unit/the-scene-strip-tells-the-watch-when-an-acts-own-input-refuses.test.tsx and pnpm verify watch's aPressTheStripsPreviewRefusesIsCaught (both verified failing without the fix); pnpm verify navigation --quick holds."
acceptanceCriteria:
  - "a press refused by an act's own input on the scene strip is a watch finding, as it is on the pages"
  - "a watch test fails first"
description: "the scene strip previews an act before the press, so its own input refusing is not told to the watch (carried from W-228, W-238)"
lastModified: "2026-10-20T07:37:49.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
