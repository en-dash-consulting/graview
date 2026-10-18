---
id: "5f0ea620-4187-472a-b44e-c366f50e998c"
level: "task"
title: "0.1.34 · FR-186: The right-click menu is ready before the click"
status: "pending"
priority: "high"
tags:
  - "roadmap"
  - "graview-cloud"
  - "0.1.34"
source: "ndx-capture"
blockedBy:
  - "2b16bb49-5218-4f2c-92ab-c8ad3ce5382c"
acceptanceCriteria:
  - "a short dwell (~150 ms) or keyboard focus on a record, card, row or kind prepares its derived acts and sections and loads the menu lazy chunks; a pass-over does nothing"
  - "a menu opened on a target the pointer rested on draws complete in its first frame; a reopened menu makes no new AI call until the record, seat or declaration changes"
  - "hovering across a list makes no AI call at all; suggestions come at most once per target, from the Fast slot only"
description: "Roadmap f-menu-prefetch-cache (FR-186, priority next). The menu derives everything on open and the inline AI section is a lazy chunk behind Suspense, so it fills in while the reader watches. Prefetch on hover/focus/touch-down, cache per target keyed by what it depends on."
lastModified: "2026-10-18T03:00:00.000Z"
lastModifiedBy: "Nick Daniel <nick@endash.us>"
---
