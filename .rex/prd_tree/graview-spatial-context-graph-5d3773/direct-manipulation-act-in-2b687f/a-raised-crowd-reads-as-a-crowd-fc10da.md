---
id: "fc10dab0-ebdc-49ad-b33f-0b12c2621dbe"
level: "task"
title: "A raised crowd reads as a crowd, not as ten crushed cards"
status: "completed"
priority: "medium"
tags:
  - "ux"
  - "layout"
  - "plane-1"
source: "Nick, 2026-09-01: \"The bid-desk example shows the awkwardness of deselecting a viewable entity. most of those entities have a very non-graceful rendering when trying to select the Kind\""
startedAt: "2026-09-01T05:23:38.901Z"
completedAt: "2026-09-01T05:32:42.986Z"
endedAt: "2026-09-01T05:32:42.986Z"
resolutionType: "code-change"
resolutionDetail: "Width-driven fidelity degradation in the scene: a plane-1 card narrower than 175px renders its kind's GLYPH instead of a summary (the fidelity axis doing its job), and the host states data-graview-crowded for tooling. The bid-desk example's ten raised requirements verified in-browser: nine crowded hosts render as clean reference chips with warn marks, no wrapped slivers. TDD (binding.test \"a raised crowd\"), 488 tests, 23/23 audit, survey clean, direct 19/19."
acceptanceCriteria:
  - "Raising a kind with many members (the bid-desk example's ten requirements is the reproduction) produces a legible plane-1 presentation — no five-line wrapped titles in 130px slivers"
  - "The presentation degrades deliberately with count: full summaries while they fit, a denser designed form (title-first compact cards, or a capped run with '+N more' that expands) beyond that — decided by design, not by division"
  - "Selecting and deselecting members of the raised run stays one-click each way (ground-click deselection landed separately)"
  - "Survey and audit stay clean; the raised states in both cover the crowded case"
description: "Raising REQUIREMENTS in the bid-desk example divides the full width by ten: each summary card gets ~130px and its title wraps to five lines — functional, but visibly the fallback of an algorithm rather than a designed state. fit() shrinks uniformly; what is missing is a deliberate dense form for plane 1 at high counts, the same move the kind cards made when they became glyphs. The deselection half of the report was fixed immediately (clicking empty ground now clears the selection, like every canvas tool); this task holds the rendering half, which deserves a design pass rather than a bolt-on."
---
