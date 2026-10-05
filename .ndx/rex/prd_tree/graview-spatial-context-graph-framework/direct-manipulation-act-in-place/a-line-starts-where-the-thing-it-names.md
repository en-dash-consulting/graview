---
id: "22a718cc-99fd-4be7-aceb-05af0d0b1cbb"
level: "task"
title: "A line starts where the thing it names is drawn"
status: "completed"
priority: "high"
tags:
  - "relations"
  - "scene"
  - "layout"
source: "Nick, 2026-09-03: \"do a review of how the nodes are being connected and the lines are being drawn. still buggy. like for the squad, sometimes the Drills aren't being drawn to the sessions, but some are.\""
startedAt: "2026-09-03T21:20:40.533Z"
completedAt: "2026-09-03T21:20:40.801Z"
endedAt: "2026-09-03T21:20:40.801Z"
resolutionType: "code-change"
resolutionDetail: "Commits 1d29a4e and a9cb040 on main. Layout connectors carry an edges list; the scene resolves them into strands anchored on member elements, clips every run to open ground, lights the selection's own lines, and re-measures once per commit from a layout effect. Verified by a Playwright probe of the squad week (all eight session-drill lines, four lit for the selected session, endpoints tracking the span mid-drag), the squad and homeflow direct-manipulation harnesses, and 512 monorepo tests."
acceptanceCriteria: []
description: "Layout resolves a session inside the week to the week, so both sessions' edges to one drill collapsed into a single connector rising from the panel's centre, and the ties layer yielded to that line's claim on the edge. Selecting Tuesday lit three drills from the Tuesday box and left the fourth to a faint line from nowhere.\n\nA connector now carries every edge it stands for, and the scene unpicks it into strands anchored on the element a view draws for each member (any data-graview-pick inside the drawn host). Lines sit over the cards on both renderer paths and clip themselves to open ground with exact curve splitting: out of the box they start in, into the box they end in, under any card crossed between. Selection lights its own lines inside the stack; the ties layer yields only to lines that really start where a tie would; the tie dedupe keys on both boxes; a busy selection keeps its nearest fourteen ties instead of none; and both line layers re-render once from a layout effect after every commit, so a cut or a drag never leaves a line a frame behind its card."
lastModified: "2026-09-03T21:20:40.811Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
