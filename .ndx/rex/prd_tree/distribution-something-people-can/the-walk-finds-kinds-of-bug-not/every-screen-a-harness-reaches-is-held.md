---
id: "9aec3db6-2f9e-41b1-9d82-194eefb8ba1d"
level: "task"
title: "Every screen a harness reaches is held to the rules that hold everywhere"
status: "completed"
priority: "critical"
tags:
  - "walkthrough"
  - "quality"
  - "harness"
completedAt: "2026-10-01T06:23:18.000Z"
endedAt: "2026-10-01T06:23:18.000Z"
resolutionType: "code-change"
resolutionDetail: "scripts/lib/watch.mjs runs in every page every harness opens (attached in launchEngine): keyboard-lands-nowhere (looked at twice, says what became of the control), machine-words-shown (exact match on ids the store reports via @graview/core watched.ts), offered-then-refused, page-error. verify-watch makes each rule fire and a clean page name nothing. The first run found ~45 violations (8 problems); fixed at the root: useTheKeyboardLandsSomewhere (Shell, Embed, routed face, studio), the studio takes and gives back the keyboard, routed pages land on the new heading, fieldWords/bandAggregateWords, the docs' main takes the skip link. The ledger (docs/watch/ledger.json) keeps each problem once; 0 open after the third run."
acceptanceCriteria:
  - "one in-page watch, attached where every harness launches its browser, judges every state a harness reaches — not a criterion per harness"
  - "the keyboard never falls to <body> after a key or a press inside an app"
  - "no visible text is a declared id, field key, act name, role or user id where the declaration has words for it"
  - "every act a surface offers the seat on it is one the store would take from that seat"
  - "each harness writes the watch's violations beside its verdict and fails on any it did not acknowledge by name, with a reason"
  - "the first run's violations are fixed in their packages or acknowledged with a reason in one list"
lastModified: "2026-10-01T06:23:18.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
