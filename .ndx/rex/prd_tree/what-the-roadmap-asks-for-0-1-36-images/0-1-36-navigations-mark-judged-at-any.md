---
id: "936da920-4d57-436d-8301-c198c80d8628"
level: "task"
title: "0.1.36 · navigation's theMarkMovesAsTheSceneDoes judged at any frame rate"
status: "pending"
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
