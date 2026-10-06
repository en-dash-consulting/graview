---
id: "aaf344c1-e9fd-4192-be44-d8299bba3854"
level: "task"
title: "A selection draws its own ties, from where the thing actually is"
status: "completed"
priority: "high"
tags:
  - "ux"
  - "relations"
  - "scene"
source: "Nick, 2026-08-31: \"i also want it to be clearer how the things are related, and what things within the highlight view are actually tied to what other things (this is also the case for the non graview perspective)\""
startedAt: "2026-09-01T03:12:10.922Z"
completedAt: "2026-09-01T03:12:10.922Z"
endedAt: "2026-09-01T03:12:10.922Z"
resolutionType: "code-change"
resolutionDetail: "Shipped in commit \"From altitude it is a city...\" — verified in the browser: selecting a calendar span draws its participates-in tie from the span itself to the PEOPLE district, whose nameplate reads \"5 · 1 tied\", in the stack and from inside the shrunk live view in the overview. All harnesses green."
acceptanceCriteria:
  - "Selecting up to four specific things draws their edges from the selected element's real drawn box (the pick target, measured from the DOM) to whatever stands for each neighbour on screen: another element in the same view, a raised card, or the containing kind card"
  - "Kind cards state the selection's reach into them ('N tied') and light their border, on the shelf and on the overview ring alike"
  - "Works in both perspectives, including from inside the shrunk live view in the overview"
  - "A whole-place selection (dozens of members) draws no fan — the lines are for deliberate selections"
  - "All harnesses stay green"
description: "Selecting a span in the calendar changed nothing outside the calendar: the graph knew the span's agreement, person and reasons, and the picture kept it to itself — in both the stack and the overview. Now SelectionTies (scene.tsx) draws the selection's own edges item-level from the pick target's measured box, with a destination dot; GroupGlyph counts implicated members and shows \"N tied\" with an accent border. Capped at 4 selected / 14 ties so a population-sized selection stays quiet."
---
