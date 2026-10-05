---
id: "4a737892-a936-4821-8e56-84fbcb9f0d4f"
level: "task"
title: "The render path holds 60 frames a second: nothing measures while moving, memoised hosts, linear lines and tweens"
status: "completed"
priority: "critical"
blockedBy:
  - "2675b82f-f2a5-4f16-adab-2e019358df1d"
startedAt: "2026-09-29T07:33:00.728Z"
completedAt: "2026-09-29T07:59:53.780Z"
endedAt: "2026-09-29T07:59:53.780Z"
acceptanceCriteria:
  - "panningHolds60 and wheelHolds60: p95 frame ≤ 16.7 ms, worst ≤ 50 ms at altitude and at the hub"
  - "aTransitionHolds60: rise, descend and a focus change hold p95 ≤ 16.7 ms after a first frame of at most 150 ms"
  - "aSelectionAndASearchAreCheap: selecting and typing at the hub have no frame over 50 ms after the first"
  - "the existing harness chain holds (navigation, menu, lines, shrunk, pages, audit)"
description: "Lines, captions and pick targets are measured when a stop settles, not per tween frame; the line layer fades out across a transition and back when it lands. SceneViewHost is memoised on what it draws with stable callbacks. connectorsFor bundles with a map; interpolate looks members up by id; a host's signature is its aggregate's count and a hash. A plane's blur is a class, not an interpolated inline filter; hosts get contain: layout style. Measured after each step; only if a transition's p95 is still above 16.7 ms does the tween leave React."
lastModified: "2026-09-29T07:59:53.846Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
