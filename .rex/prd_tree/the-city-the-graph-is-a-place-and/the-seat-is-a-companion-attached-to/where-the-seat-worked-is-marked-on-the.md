---
id: "72f50b3c-7d10-4373-a838-8e9a327acd3d"
level: "task"
title: "Where the seat worked is marked on the thing, with a fly-to from the companion's log; its questions stay pinned at their nodes"
status: "completed"
priority: "high"
tags:
  - "assistant"
  - "scene"
  - "presence"
blockedBy:
  - "82820801-f31e-435b-b1b6-375721ed72b3"
startedAt: "2026-09-22T00:22:02.721Z"
completedAt: "2026-09-22T00:38:50.612Z"
endedAt: "2026-09-22T00:38:50.612Z"
resolutionType: "code-change"
resolutionDetail: "useSeatWork + SeatMarks mark what the seat wrote and pin its questions; the companion logs what it did with a fly-to; undo clears both."
acceptanceCriteria:
  - "After a seat's turn, every node it wrote carries the seat's mark for the hold, on cards, buildings and chips, then it fades; undo clears it"
  - "The companion's log offers 'show me' per act that flies the camera to the district, focuses the node, or scrolls the pick into view depending on where you are"
  - "The seat's questions stay pinned at their nodes and are listed in the companion with fly-to"
  - "Idle agents have no figure; a working agent's figure stands at its work; people's figures unchanged"
  - "verify-companion: aTurnMarksWhatItWrote, showMeFliesThere, undoClearsTheMarks; who and seat harnesses green"
description: "The figure walking to what it wrote was attribution in space, and that is worth keeping without the walk. After a turn, each node the seat wrote carries a seat mark — the seat's glyph at 16px on the card, the building or the chip, beside the existing `graview-touched` pulse — for the same hold the figure used to stand there, then fades; the marks are drawn by the scene from the log (ops attributed to the seat), so they are the same on the DOM and GPU paths and inside a lens. The companion's log lists what the seat did as sentences with a \"show me\" on each that flies the camera there: at altitude, the district's plot centred (the fly-closer path); on the ground, the node focused; inside a lens, the pick scrolled into view and pulsed. Undo clears the marks (the old undoWalksItHome). The seat's questions back (OfferedQuestion) keep their pins at the nodes they are about and are listed in the companion with the same fly-to. Other people's agents keep their presence figures, but a figure for an agent is drawn only where the agent is WORKING, not idling on a pad — an agent with nothing to do is a name in the who-is-here list, not a body in the picture. verify-companion.mjs: aTurnMarksWhatItWrote (marks on the written nodes for the hold, none after), showMeFliesThere (camera centres the district / focuses the node), undoClearsTheMarks; the-robot-stands-where-it-worked.test.ts becomes the-seat-marks-where-it-worked.test.ts."
lastModified: "2026-09-22T00:38:50.623Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
