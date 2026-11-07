---
id: "936da920-4d57-436d-8301-c198c80d8628"
type: "change"
title: "0.1.36 · navigation's theMarkMovesAsTheSceneDoes judged at any frame rate"
slug: "0-1-36-navigation-s"
intent: "docs/flakes.json on 0.1.35's branch Nightly (run 39144385034): navigation missed theMarkMovesAsTheSceneDoes beside the others and held alone."
acceptanceCriteria:
  - "the claim judges a morph by whether any frame stood strictly between the two states (and a cut by none), not by the frame nearest halfway"
  - "holds locally and under GRAVIEW_SLOW=4; the next Nightly records no flake for it"
priority: "high"
tags:
  - "roadmap"
  - "0.1.36"
source: "ndx-capture"
---

Migration suggestion (text claude-sonnet-5-5, not accepted): place on "What the roadmap asks for 0.1.36: a view draws the pictures it was promised, and the navigation flake the second look recorded" (97f5a452-b235-4618-b5be-a4924a8c2b5e).
