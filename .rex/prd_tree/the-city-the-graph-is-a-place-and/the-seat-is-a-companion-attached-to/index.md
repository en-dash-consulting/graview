---
id: "f7d98d04-10db-4583-a1d0-7788ead43d4c"
level: "feature"
title: "The seat is a companion attached to the viewframe, not a figure walking the ground"
status: "pending"
priority: "high"
tags:
  - "assistant"
  - "scene"
  - "design"
  - "presence"
source: "Nick, 2026-09-21: \"think about the user experience of the ai in the scene views.. it will need to be changed, both for full-screen lens/etc and also the elevated view. i don't think i like the robot entity in the middle following me. feels like it needs to be floating static something i think, like, attached to my viewframe.\""
acceptanceCriteria:
  - "One entrance to the assistant in the scene: a fixed companion dock, identical at altitude, on the ground and in a full-screen lens; no robot figure, pad or follow mode remain"
  - "The companion's header names its subject, which follows selection, then hover, then place, without any gesture to enable it"
  - "Where the seat worked is marked on the node for the hold and reachable from the companion's log by a fly-to"
  - "verify-robot.mjs becomes verify-companion.mjs with the checks rewritten; who/seat/chat/navigation/survey/audit stay green"
description: "The agent seat is drawn today as a robot figure in the scene: docked on its own pad in the city, walking to what it wrote after a turn, following the pointer when pressed, with the chat panel anchored beside it as a bubble while it follows. A thing in the middle of the picture that moves on its own reads as a distraction rather than a helper, and it has no place at all inside a full-screen lens. The seat becomes a companion fixed to the viewframe: one static dock in the corner, the same at altitude, on the ground and in a full-screen lens, that expands into the panel; the subject (\"this\") is the selection, else the hovered pick, else where you are, said in the companion's own header rather than found by a figure following the pointer; and where the seat worked is marked on the thing itself with a way to fly there, not walked to. The figure, its pad and follow mode retire; people's presence figures are unchanged; the seat's questions stay pinned at the nodes they are about. The same companion is what the pages face embeds."
lastModified: "2026-09-21T18:51:23.976Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---

## Children

| Title | Status |
|-------|--------|
| [The companion dock: a fixed corner element that expands into the panel, with the subject in its header, in every mode of the scene](./the-companion-dock-a-fixed-corner.md) | pending |
| [Where the seat worked is marked on the thing, with a fly-to from the companion's log; its questions stay pinned at their nodes](./where-the-seat-worked-is-marked-on-the.md) | pending |
