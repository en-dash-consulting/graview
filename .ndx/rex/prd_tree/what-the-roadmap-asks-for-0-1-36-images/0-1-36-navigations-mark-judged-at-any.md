---
id: "936da920-4d57-436d-8301-c198c80d8628"
level: "task"
title: "0.1.36 · navigation's theMarkMovesAsTheSceneDoes judged at any frame rate"
status: "completed"
startedAt: "2026-10-18T18:15:00.000Z"
completedAt: "2026-10-18T18:50:00.000Z"
priority: "high"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
acceptanceCriteria:
  - "the claim judges a morph by whether any frame stood strictly between the two states (and a cut by none), not by the frame nearest halfway"
  - "holds locally and under GRAVIEW_SLOW=4; the next Nightly records no flake for it"
description: "docs/flakes.json on 0.1.35's branch Nightly (run 39144385034): navigation missed theMarkMovesAsTheSceneDoes beside the others and held alone."
lastModified: "2026-10-18T18:10:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Notes

2026-10-18: the claim read the frame nearest halfway, so a runner that drew no frame between the states read a morph as a cut. The control's `--graview-altitude` is a registered property with a 640 ms transition, so the harness now listens for its `transitionrun` before pressing (the browser says the transition began however few frames follow) and keeps the frame reading as a second witness; where the property cannot register, the mark must cut and no transition may run. Holds locally (44 frames, transitioned) and under GRAVIEW_SLOW=4 (35 frames, transitioned). Seen on the way, not fixed: under GRAVIEW_SLOW=4 locally, `aCardsChipsDoNotSilenceItsLines` fails before and after this change with the week's lines never drawn (9 entries, 0 lines, settled) — not a timing race; CI has not met it.
