---
id: "f3119731-5385-4318-898b-c59317a6615d"
level: "task"
title: "The drive-in screen stands on its plot and the marquee is its sign: no picture hovering at the top of the window"
status: "completed"
priority: "high"
tags:
  - "city"
  - "altitude"
  - "drive-in"
startedAt: "2026-09-20T05:11:06.797Z"
completedAt: "2026-09-20T14:03:54.209Z"
endedAt: "2026-09-20T14:03:54.209Z"
resolutionType: "code-change"
resolutionDetail: "The screen is a framed billboard on two posts at the plot's back kerb; the nameplate is a signpost at the front corner; the board hangs under it; the landmark stands in the square; \"shown above\" is gone."
acceptanceCriteria:
  - "The focused screen stands on the back kerb of its plot with visible posts, not above the city"
  - "The marquee is a board at the plot's front corner; nothing stands on the buildings or the landmark"
  - "The audience row is in front of the screen on the tile (verify-who still passes)"
  - "Survey, audit, navigation, pages harnesses pass"
description: "From altitude a focused place's picture (the screen, LayoutNode.screenOf) is laid out above its district and the camera moves to keep it in view; in practice it floats at the top of the window as a large white sheet with the marquee pills down on the plot (rota 2026-09-19 screenshot). Make the screen a billboard standing at the BACK edge of its plot: its foot on the plot's back kerb, drawn with a thin frame and two posts into the ground, sized so that at DRIVE_IN_MIN_WIDTH it still fits above the plot without leaving the window, the audience row (screen:<kind> in whereIsIn) in front of it on the tile, and the marquee as a small board at the plot's front corner listing the showings (one per line; the current pills become rows on the board). The screen keeps its identity for navigation and whereIs; only its placement and frame change. The camera rule stays minimal (the smallest move that brings the screen in). The `graview-drive-in` block moves from the card to the board."
lastModified: "2026-09-20T14:03:54.220Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
