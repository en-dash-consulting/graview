---
id: "30aa70e5-98a1-4f83-bbad-8bda4e2144ba"
type: "change"
title: "The one face's two pinch claims hold at a CPU four times slower"
slug: "f-one-face-pinch-claims-hold-at-slow-4"
intent: "Left out of PR #650's bar (f-one-face-holds-at-slow-4), 2026-11-21. (1) atNearbyAPinchOverTheCityZoomsItAndThePanelAndTheLevelStay fails on main too, at slow 4 and on the GPU leg (a line's building end misses during the pinch). (2) duringAPinchThatPansEveryBoardAndNameStaysFastenedToItsDistrictEveryFrame, completed in 0.2.5 (#622), failed 1 of 3 slow-4 runs on 2a116268c: Pixel 7 at the Map, a pinch let go of with a pan straight after, worst 18.9 px (place:task:the-week, 1,121 ms in), boards drifting 1-3 px a frame while their districts stand still. Untested guess: the pinch's zoom reaches the view after the pan has begun, and while a pan holds the face never reads the city's layout again. Also: scripts/verify-all.mjs overwrites a first look's verdict with the second look's, so a first-look failure leaves no frames to read."
acceptanceCriteria:
  - "Both claims hold on three `pnpm verify:github one-face --slow 4` runs on one head, and the pinch line-ends claim holds on the GPU leg (harness)"
  - "Each claim fails on the commit before its fix (harness)"
  - "A run that takes a second look keeps the first look's verdict and frames beside it (test)"
priority: "medium"
tags:
  - "one-face"
  - "hq:feature:f-one-face-holds-at-slow-4"
source: "PR #650"
---
