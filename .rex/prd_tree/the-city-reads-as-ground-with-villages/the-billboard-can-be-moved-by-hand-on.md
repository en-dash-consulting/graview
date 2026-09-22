---
id: "ba5b28d8-6bb8-42ad-bdb5-fdc07f4d64cf"
level: "task"
title: "The billboard can be moved by hand, on a leash: dragged within a set distance of its village"
status: "pending"
priority: "medium"
tags:
  - "graview"
  - "city"
  - "altitude"
  - "drive-in"
blockedBy:
  - "5c901c77-690f-46e6-a7bc-de4c93ddb83c"
source: "Nick, 2026-09-22: \"i want to be able to move the billboard around a little, can be constrained to a certain distance away from the kind\""
acceptanceCriteria:
  - "The billboard is draggable at altitude with the same gesture that moves a card, and its posts follow it"
  - "A drag past the leash clamps rather than refusing: the gesture stays continuous and the billboard stops at the limit"
  - "The leash is expressed in city cells, so the same pin holds at every zoom"
  - "The pin round-trips through the URL and is cleared by \"put it back\" alongside every other pin"
  - "Unit test on the clamp; a navigation harness verdict that the billboard moved and stayed within range"
description: "The billboard stands on the back kerb of its plot and nowhere else (f3119731). Let a person drag it, and clamp where it lands to a radius of its own village, so it can never wander far enough to stop reading as THAT kind's picture. Most of the machinery is already here: dragging a card writes `state.pins[id]` through `withPin` (view-state.ts:418), the pin is stored unpanned so it survives the camera and the graph changing underneath (layout.ts:1347), and it travels in the link as `pin.<id>=x,y`. What is missing is that the billboard is not draggable and a pin has no clamp. Add the clamp at pin time: the offset from the plot's computed position is limited to a leash measured in city cells, so the same pin holds at every zoom, and the posts stay planted on the ground the billboard is tethered to. Decided at capture: the leash is zoom-relative (city cells, not pixels) and the position travels in the link like every other pin rather than staying local to the browser."
lastModified: "2026-09-22T05:15:02.708Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
