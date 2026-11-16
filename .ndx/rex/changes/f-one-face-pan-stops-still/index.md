---
id: "10c8348d-b15f-45f3-857d-f3d3af947205"
type: "change"
title: "Letting go of a pan on the one face, every board and name stays where the last frame drew it"
slug: "f-one-face-pan-stops-still"
intent: "Nick, 2026-11-15 (HQ feature:f-one-face-pan-stops-still): at Nearby and the City, when a pan stops, all the billboards and signs snap back to where they were when the pan started, then animate over to their new positions. When the pan stops, nothing should move."
acceptanceCriteria:
  - "Letting go of a pan — a drag on the ground, a drag begun on a board, a scroll, a scroll over a district, a finger's drag on a phone — at Nearby and the City, no board's or name's box on the window moves more than a pixel for 600 ms from the last frame of the pan (letGoOfAPanEveryBoardAndNameStaysWhereTheLastFrameDrewIt)."
  - "Letting go of a zoom (ctrl and the wheel, two fingers apart), each board and name goes on from where the last frame of the zoom drew it, never jumping back to where the zoom began (letGoOfAZoomEveryBoardAndNameGoesOnFromWhereTheLastFrameDrewIt)."
  - "Both claims fail on the commit before the fix."
tags:
  - "hq:feature:f-one-face-pan-stops-still"
  - "one-face"
---
