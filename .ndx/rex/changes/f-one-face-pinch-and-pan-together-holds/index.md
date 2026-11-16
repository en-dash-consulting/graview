---
id: "02e0c20d-1a1d-4187-b310-db76ef967cff"
type: "change"
title: "During a pinch that pans, every board and name on the one face stays fastened to its district frame by frame"
slug: "f-one-face-pinch-and-pan-together-holds"
intent: "Found by PR #608's review (HQ feature:f-one-face-pinch-and-pan-together-holds): at Nearby and the Map, in a two-finger gesture that zooms and pans together (fingers whose middle moves, or a pan within about 300 ms of a zoom), the boards and names stop following the ground during the gesture and catch up when the hand lets go."
acceptanceCriteria:
  - "On a phone at Nearby and the Map, sampled every frame of the gesture, each board's foot and each district's name moves by no more than 1 px from where its district carried it: two fingers apart with their middle moving (and together, at Nearby), one finger on a board and one on the ground beside it, and a pinch let go of with a finger's pan straight after (duringAPinchThatPansEveryBoardAndNameStaysFastenedToItsDistrictEveryFrame)."
  - "The 'two fingers apart, their middle moving' gesture #608 dropped as flaky is in the claim, its fingers kept a fingertip clear of every board and name."
  - "The claim fails on the commit before the fix."
tags:
  - "hq:feature:f-one-face-pinch-and-pan-together-holds"
  - "one-face"
---
